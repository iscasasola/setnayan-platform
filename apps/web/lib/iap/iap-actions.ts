'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient, createMoneyWriterClient } from '@/lib/supabase/admin';
import { getIapGate } from '@/lib/request-platform';
import { coordinatorMoneyScopeAllowed } from '@/lib/coordinator-money-scope';
import { resolveServiceSellability } from '@/lib/v2-catalog';
import { eventIsOver } from '@/lib/event-is-over.server';
import { eventOwnsSku } from '@/lib/entitlements';
import { papicPassPointsForSku } from '@/lib/papic-pass-tiers';
import { ADD_ONS } from '@/lib/add-ons-catalog';
import {
  iapProductById,
  iapProductIsRepeatable,
  iapSupplierGiftProductById,
  papicCreditsMatch,
  type IapSupplierGiftProduct,
} from './products';
import { fetchOwnVendorProfile } from '@/lib/vendor-profile';
import { resolveVendorRoleForProfile, canManageVendor } from '@/lib/vendor-role';
import { appleGiftOnSale } from './supplier-gift.server';
import { appleGiftQuantityOk } from './apple-gift-lines';
import { eventHubOwnership } from '@/lib/couple-website-pro';
import { verifyAppleTransaction } from './apple-transaction';
import { createPurchaseIntent, fulfilAppleTransaction, type FulfilOutcome } from './fulfil.server';
import { startRefusal, type IapStartResult, type IapConfirmResult, type IapRestoreResult } from './iap-outcome';
import { confirmSupplierPlanForUser, startSupplierPlanForUser } from './supplier-plan-confirm.server';
import { supplierPlanProductById } from './supplier-plans';

/**
 * 🍎 THE THREE DOORS THE APP KNOCKS ON — before, after and instead of Apple's sheet.
 *
 *   startAppStorePurchase   → checks everything a web checkout checks, then
 *                              writes the intent row and returns its key — the
 *                              `appAccountToken` StoreKit signs into the
 *                              purchase. Apple's sheet opens only after this.
 *   confirmAppStorePurchase → the signed transaction StoreKit returned. Verified
 *                              (lib/iap/apple-jws.ts), matched to THIS person's
 *                              intent, then the order + activation.
 *   restoreAppStorePurchases→ Profile › Restore purchases: every transaction
 *                              this Apple ID holds, each through the same
 *                              confirm path. Nothing is granted twice.
 *
 * App Store Server Notifications (`/api/iap/app-store-notifications`) run the
 * same fulfilment with no session — so a purchase whose app was closed mid-way
 * still lands. Whichever arrives first wins; the other finds the same order.
 *
 * Every refusal is a sentence the person can act on (lib/iap/iap-outcome.ts);
 * Apple's own error text is never shown.
 */

/** Same set the web checkout refuses once the day is over (checkout/actions.ts). */
const DAY_OF_ONLY_KEYS = new Set(
  ADD_ONS.filter((a) => a.dayOfOnly)
    .map((a) => a.serviceKey)
    .filter((k): k is string => Boolean(k)),
);

export async function startAppStorePurchase(input: {
  /** The couple's event. A shop's gift names no event — it lands in the shop's gift stock. */
  eventId?: string;
  productId: string;
  /**
   * 💝 A shop's gift cart line: how many of the gift ONE Apple purchase buys (1–10; owner 2026-11-22, "pays line by
   * line"). Absent ⇒ 1. A couple product is always 1.
   */
  quantity?: number;
}): Promise<IapStartResult> {
  const { iap, iapQuantity, iapSubscriptions } = await getIapGate();
  if (!iap) return startRefusal('unavailable');
  const quantity = input.quantity ?? 1;

  // 💝 A SHOP's gift (owner 2026-11-04, "they can purchase inside apple as well") has its own checks — the web gift
  // buy's — and never reaches the couple checks below, which are about an event. Only a build whose plugin passes a
  // quantity (`SetnayanIAP/3`+) buys gifts: an older one would charge for one while the line said more.
  const gift = iapSupplierGiftProductById(input.productId);
  if (gift) {
    if (!iapQuantity || !appleGiftQuantityOk(quantity)) return startRefusal('unavailable');
    return startShopGiftPurchase(gift, quantity);
  }
  if (quantity !== 1) return startRefusal('unavailable');

  // 🏪 A SHOP's plan (auto-renewable): the server issues the token for the shop the caller manages and keeps the
  // pairing, so Apple's notifications grant only to that shop (lib/iap/supplier-plan-confirm.server.ts).
  // Only a build whose app version carries the "Supplier plans" subscriptions (`SetnayanIAP/4`+) sells one: 1.0 (build
  // 9) does not, so the server refuses it there even if a stale page still drew the door.
  const plan = supplierPlanProductById(input.productId);
  if (plan) {
    if (!iapSubscriptions) return startRefusal('unavailable');
    const userId = await signedInUserId();
    if (!userId) return startRefusal('sign_in');
    return startSupplierPlanForUser(userId, plan);
  }

  const product = iapProductById(input.productId);
  const eventId = typeof input.eventId === 'string' ? input.eventId.trim() : '';
  if (!product || !eventId) return startRefusal('unavailable');

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || user.is_anonymous) return startRefusal('sign_in');

  // Same authorization as the web checkout: a member of THIS event, and a
  // coordinator only with the couple's money consent. Papic credits are the
  // couple's alone, as on the web (`getCoupleEventId`, studio/papic/actions.ts).
  const { data: membership } = await supabase
    .from('event_members')
    .select('member_type')
    .eq('event_id', eventId)
    .eq('user_id', user.id)
    .maybeSingle();
  if (!membership) return startRefusal('not_member');
  const admin = createAdminClient();
  if (product.kind === 'papic-credits' && (membership as { member_type?: string }).member_type !== 'couple') {
    return startRefusal('couple_only');
  }
  if (!(await coordinatorMoneyScopeAllowed(admin, eventId, user.id, 'checkout'))) {
    return startRefusal('no_money_consent');
  }

  // On sale — the catalogue's own switch, failing closed on a read error.
  const sellable = await resolveServiceSellability(product.serviceKey);
  if (sellable === 'error') return startRefusal('try_again');
  if (sellable !== 'sellable') return startRefusal('not_on_sale');
  if (product.kind === 'papic-credits') {
    const points = await papicPassPointsForSku(admin, product.serviceKey);
    if (!papicCreditsMatch(product, points)) return startRefusal('not_on_sale');
  }
  // 🗑 Setnayan AI is not sold on its own since 2026-11-04 (it comes with Event Plus and Event Pro): its four products
  // left `IAP_PRODUCTS`, so `iapProductById` above already refuses one as unavailable.
  if ((product.kind === 'papic-credits' || DAY_OF_ONLY_KEYS.has(product.serviceKey)) && (await eventIsOver(admin, eventId))) {
    return startRefusal('event_over');
  }

  // 🔒 Owned is never sold twice (prototype frames 10 · 11). Credits (Papic) are
  // consumable and always buyable; Pro, Live Watch and every 'event-unlock' are one per event.
  // ⛔ Event Pro is sold WHOLE (owner 2026-10-26, "just have the upgrade Event Pro"): the part products are
  // retired out of `IAP_PRODUCTS`, so one is an unknown product above. "Everything" is not sold in the app once ANY
  // part is owned (it would charge the full Apple price for what is less on the web, and the app may not say so);
  // such an event finishes on the web.
  // 💰 Event Plus ⊂ Event Pro (owner 2026-11-04): an event with Pro already has everything Plus sells, and an event
  // with Plus pays only the DIFFERENCE for Pro on the web. The app has no upgrade product yet, so Event Pro is not sold
  // in the app to an event that owns Plus — the full Apple price would charge it twice for Plus (same reasoning as the
  // part-owner rule above). Such an event upgrades on the web until an upgrade product exists.
  if (product.kind === 'event-hub-pro') {
    const own = await eventHubOwnership(admin, eventId, 'owned');
    // 🏛 Since 20 Nov Event Plus holds the whole Hub (`own.full`), so "owned" means the Pro PLAN, never the Hub alone. An
    // event with Plus is still refused below (it upgrades for the difference on the web).
    if (own.proPlan) return startRefusal('owned');
    if (own.parts.size > 0 || own.paidPhp > 0) return startRefusal('not_on_sale');
    if (await eventOwnsSku(admin, eventId, 'EVENT_PLUS')) return startRefusal('not_on_sale');
  } else if (product.kind === 'event-ultra') {
    // 💎 Event Ultra (owner 2026-11-13): one per event. Like Pro above, it is not sold in the app to an event that has
    // already PAID toward a plan (Plus, Pro or a part) — the full Apple price would charge that twice, and what such an
    // event pays for Ultra is not ruled yet. It upgrades on the web.
    if (await eventOwnsSku(admin, eventId, product.serviceKey)) return startRefusal('owned');
    const own = await eventHubOwnership(admin, eventId, 'owned');
    if (own.full || own.parts.size > 0 || own.paidPhp > 0) return startRefusal('not_on_sale');
    if (await eventOwnsSku(admin, eventId, 'EVENT_PLUS')) return startRefusal('not_on_sale');
  } else if (product.kind === 'event-plus') {
    if ((await eventHubOwnership(admin, eventId, 'owned')).full) return startRefusal('owned');
    if (await eventOwnsSku(admin, eventId, product.serviceKey)) return startRefusal('owned');
  } else if (!iapProductIsRepeatable(product) && (await eventOwnsSku(admin, eventId, product.serviceKey))) {
    return startRefusal('owned');
  }

  const intent = await createPurchaseIntent(createMoneyWriterClient(), {
    userId: user.id,
    eventId,
    product,
  });
  if (!intent.ok) return startRefusal('try_again');
  return { ok: true, token: intent.token, productId: product.productId, quantity: 1 };
}

function outcomeToResult(o: FulfilOutcome): IapConfirmResult {
  switch (o.status) {
    case 'on':
      return o.vendorProfileId
        ? { status: 'on', eventId: null, vendorProfileId: o.vendorProfileId, serviceKey: o.serviceKey }
        : { status: 'on', eventId: o.eventId, serviceKey: o.serviceKey };
    case 'refunded':
      return { status: 'refunded' };
    case 'retired':
      return { status: 'retired' };
    case 'refused':
      return { status: 'refused', reason: o.reason };
    default:
      // Apple has the money; we could not finish writing. Apple re-delivers
      // the transaction (Server Notifications + the app's next launch), so the
      // honest word is "switching it on", never "failed".
      return { status: 'pending' };
  }
}

/**
 * 💝 THE SHOP GIFT'S START — the web gift buy's own gate (`buyVendorPapicPortfolioPack`, `for=gift`), then the intent.
 * The shop is the caller's OWN shop, read here (never sent by the phone); only its owner or an admin buys, as on the
 * web; the gift must be on sale through the SAME catalogue reads (and, for Papic, the Papic switch and the tier). The
 * intent names the shop and no event: the gift waits in the shop's stock until the shop gives it, exactly like a gift
 * bought on the web. No payment ceiling or rail check — those are the web rails' rules; Apple charges one gift.
 */
async function startShopGiftPurchase(gift: IapSupplierGiftProduct, quantity: number): Promise<IapStartResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || user.is_anonymous) return startRefusal('sign_in');

  const profile = await fetchOwnVendorProfile(supabase, user.id);
  if (!profile) return startRefusal('not_shop_owner');
  const vendorProfileId = profile.vendor_profile_id;
  // Scoped to THIS shop, not the caller's highest role anywhere — the web gift buy's reasoning.
  const role = await resolveVendorRoleForProfile(supabase, user.id, vendorProfileId);
  if (!canManageVendor(role)) return startRefusal('not_shop_owner');

  const onSale = await appleGiftOnSale(createAdminClient(), gift);
  if (onSale === 'error') return startRefusal('try_again');
  if (onSale !== 'on_sale') return startRefusal('not_on_sale');

  const intent = await createPurchaseIntent(createMoneyWriterClient(), { userId: user.id, vendorProfileId, product: gift });
  if (!intent.ok) return startRefusal('try_again');
  return { ok: true, token: intent.token, productId: gift.productId, quantity };
}

/** Where a fulfilled purchase shows: the couple's event, or the shop's gifts. */
function revalidateOn(o: FulfilOutcome): void {
  if (o.status !== 'on') return;
  if (o.vendorProfileId) revalidatePath('/vendor-dashboard/shop/promote');
  else if (o.eventId) revalidatePath(`/dashboard/${o.eventId}`, 'layout');
}

async function signedInUserId(): Promise<string | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user && !user.is_anonymous ? user.id : null;
}

export async function confirmAppStorePurchase(input: {
  jws: string;
  /** Which phone door handed it over — the buy sheet's answer, or a launch-time replay. Only labels the fault log. */
  via?: 'confirm' | 'replay';
}): Promise<IapConfirmResult> {
  const userId = await signedInUserId();
  if (!userId) return { status: 'refused', reason: 'not_yours' };
  // 🏪 A supplier plan (auto-renewable, the shop's own) has its own confirm; null = not one, the event path goes on.
  const plan = await confirmSupplierPlanForUser(userId, typeof input.jws === 'string' ? input.jws : '');
  if (plan) return plan;
  const verified = verifyAppleTransaction(typeof input.jws === 'string' ? input.jws : '');
  if (!verified.ok) return { status: 'invalid' };
  const outcome = await fulfilAppleTransaction(createMoneyWriterClient(), verified.tx, {
    expectUserId: userId,
    via: input.via === 'replay' ? 'replay' : 'confirm',
  });
  revalidateOn(outcome);
  return outcomeToResult(outcome);
}

/** At most this many transactions per Restore — one phone's history, never a flood. */
const RESTORE_CEILING = 200;

export async function restoreAppStorePurchases(input: { jwsList: string[] }): Promise<IapRestoreResult> {
  const userId = await signedInUserId();
  if (!userId) return { ok: false };
  const list = Array.isArray(input.jwsList) ? input.jwsList.slice(0, RESTORE_CEILING) : [];
  const writer = createMoneyWriterClient();
  const on: Array<{ eventId: string; serviceKey: string }> = [];
  let pending = 0;
  let gifts = false;
  for (const jws of list) {
    const verified = verifyAppleTransaction(typeof jws === 'string' ? jws : '');
    if (!verified.ok) continue;
    // Restore matches only THIS person's intents; another account's purchase on
    // the same Apple ID is theirs to restore, signed in as them.
    const o = await fulfilAppleTransaction(writer, verified.tx, { expectUserId: userId, via: 'restore' });
    if (o.status === 'on' && o.eventId) on.push({ eventId: o.eventId, serviceKey: o.serviceKey });
    // 💝 A shop's gift landed in its stock — nothing to name on Profile's event list, but the gifts page re-reads.
    else if (o.status === 'on' && o.vendorProfileId) gifts = true;
    else if (o.status === 'error') pending += 1;
  }
  if (gifts) revalidatePath('/vendor-dashboard/shop/promote');
  if (on.length === 0) return { ok: true, restored: [], pending };

  // Name each event — read with the admin client, scoped to the ids just fulfilled for this user.
  const admin = createAdminClient();
  const ids = [...new Set(on.map((r) => r.eventId))];
  const names = new Map<string, string>();
  for (const id of ids) {
    const { data } = await admin.from('events').select('display_name').eq('event_id', id).maybeSingle();
    const name = (data as { display_name?: string | null } | null)?.display_name;
    if (name) names.set(id, name);
  }
  const seen = new Set<string>();
  const restored = on
    .filter((r) => {
      const k = `${r.eventId}:${r.serviceKey}`;
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    })
    .map((r) => ({ eventId: r.eventId, eventName: names.get(r.eventId) ?? null, serviceKey: r.serviceKey }));
  for (const id of ids) revalidatePath(`/dashboard/${id}`, 'layout');
  return { ok: true, restored, pending };
}
