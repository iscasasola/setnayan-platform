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
import { iapProductById, iapProductFitsAiTier, iapProductIsRepeatable, papicCreditsMatch } from './products';
import { setnayanAiTierInApp } from './setnayan-ai-in-app.server';
import { eventHubOwnership } from '@/lib/couple-website-pro';
import { verifyAppleTransaction } from './apple-transaction';
import { createPurchaseIntent, fulfilAppleTransaction, type FulfilOutcome } from './fulfil.server';
import { startRefusal, type IapStartResult, type IapConfirmResult, type IapRestoreResult } from './iap-outcome';

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
  eventId: string;
  productId: string;
}): Promise<IapStartResult> {
  const { iap } = await getIapGate();
  if (!iap) return startRefusal('unavailable');

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
  // ✦ Setnayan AI: one product per web tier (owner 2026-10-23). The event's tier, read the way the web's charge
  // reads it (setnayan-ai-in-app.server.ts), must be THIS product's — a Tier D product never unlocks a wedding.
  if (product.serviceKey === 'SETNAYAN_AI') {
    const sai = await setnayanAiTierInApp(admin, eventId);
    if (sai.status === 'error') return startRefusal('try_again');
    if (sai.status !== 'sellable') return startRefusal('not_on_sale');
    if (!iapProductFitsAiTier(product, sai.tier)) return startRefusal('not_on_sale');
  }
  if ((product.kind === 'papic-credits' || DAY_OF_ONLY_KEYS.has(product.serviceKey)) && (await eventIsOver(admin, eventId))) {
    return startRefusal('event_over');
  }

  // 🔒 Owned is never sold twice (prototype frames 10 · 11). Credits (Papic) are
  // consumable and always buyable; Pro, Live Watch and every 'event-unlock' are one per event.
  // ⛔ Event Hub Pro is sold WHOLE (owner 2026-10-26, "just have the upgrade event hub pro"): the part products are
  // retired out of `IAP_PRODUCTS`, so one is an unknown product above. "Everything" is not sold in the app once ANY
  // part is owned (it would charge the full Apple price for what is less on the web, and the app may not say so);
  // such an event finishes on the web.
  if (product.kind === 'event-hub-pro') {
    const own = await eventHubOwnership(admin, eventId, 'owned');
    if (own.full) return startRefusal('owned');
    if (own.parts.size > 0 || own.paidPhp > 0) return startRefusal('not_on_sale');
  } else if (!iapProductIsRepeatable(product) && (await eventOwnsSku(admin, eventId, product.serviceKey))) {
    return startRefusal('owned');
  } else if (product.serviceKey === 'SETNAYAN_AI') {
    // The stored flag is Setnayan AI's own "owned" (sku-activation.ts) — a comp or a bundle can set it with no order.
    const { data: ev, error: evErr } = await admin.from('events').select('setnayan_ai_active').eq('event_id', eventId).maybeSingle();
    if (evErr) return startRefusal('try_again');
    if ((ev as { setnayan_ai_active?: boolean | null } | null)?.setnayan_ai_active === true) return startRefusal('owned');
  }

  const intent = await createPurchaseIntent(createMoneyWriterClient(), {
    userId: user.id,
    eventId,
    product,
  });
  if (!intent.ok) return startRefusal('try_again');
  return { ok: true, token: intent.token, productId: product.productId };
}

function outcomeToResult(o: FulfilOutcome): IapConfirmResult {
  switch (o.status) {
    case 'on':
      return { status: 'on', eventId: o.eventId, serviceKey: o.serviceKey };
    case 'refunded':
      return { status: 'refunded' };
    case 'refused':
      return { status: 'refused', reason: o.reason };
    default:
      // Apple has the money; we could not finish writing. Apple re-delivers
      // the transaction (Server Notifications + the app's next launch), so the
      // honest word is "switching it on", never "failed".
      return { status: 'pending' };
  }
}

async function signedInUserId(): Promise<string | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user && !user.is_anonymous ? user.id : null;
}

export async function confirmAppStorePurchase(input: { jws: string }): Promise<IapConfirmResult> {
  const userId = await signedInUserId();
  if (!userId) return { status: 'refused', reason: 'not_yours' };
  const verified = verifyAppleTransaction(typeof input.jws === 'string' ? input.jws : '');
  if (!verified.ok) return { status: 'invalid' };
  const outcome = await fulfilAppleTransaction(createMoneyWriterClient(), verified.tx, { expectUserId: userId });
  if (outcome.status === 'on') revalidatePath(`/dashboard/${outcome.eventId}`, 'layout');
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
  for (const jws of list) {
    const verified = verifyAppleTransaction(typeof jws === 'string' ? jws : '');
    if (!verified.ok) continue;
    // Restore matches only THIS person's intents; another account's purchase on
    // the same Apple ID is theirs to restore, signed in as them.
    const o = await fulfilAppleTransaction(writer, verified.tx, { expectUserId: userId });
    if (o.status === 'on') on.push({ eventId: o.eventId, serviceKey: o.serviceKey });
    else if (o.status === 'error') pending += 1;
  }
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
