'use server';

/**
 * 🏷 THE OFFER MAKER'S ONE WRITER (Build 6 · Lane D) — save · switch on/off · remove · undo a remove.
 *
 * 🔒 THE LOCK IS THE RULE HERE, NOT ONLY THE LOOK (Lane B: "a UI-only lock is a bug"): every action asks
 * `canUse('offerMaker', shop)` (lib/locks.ts) — the same question the 🔒 tile asks — and an unverified shop is refused in
 * words. `lib/locks.ts` names this file as the Offer Maker's `server` gate.
 *
 * Nothing here types a price: the supplier's own %, ₱ and first payment are the only figures, and each is checked
 * (`offerProblem`) — the same function the editor runs, so the two never disagree.
 */
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { canUse } from '@/lib/locks';
import { readOfferMaker, readOfferShop, type OfferMakerData } from '@/lib/offer-maker.server';
import { revalidateShopPage } from '@/lib/shop-page-cache';
import { findVendorTextViolation } from '@/lib/service-text-integrity';
import {
  giftsToJson,
  hasFirstPayment,
  hasPct,
  hasPhp,
  offerFromRow,
  offerProblem,
  OFFER_WHO,
  parseOfferGifts,
  VENDOR_OFFER_SELECT,
  type Offer,
  type VendorOfferRow,
} from '@/lib/offers';

export type OfferResult = { ok: true; offer: Offer } | { ok: false; message: string };

const NOT_VERIFIED = 'The Offer Maker opens once your shop is Verified.';
const COULD_NOT = 'Couldn’t save your offer — check your connection and try again.';

async function gate() {
  const supabase = await createClient();
  const shop = await readOfferShop(supabase);
  if (!shop) return { ok: false as const, message: 'Sign in to your shop first.' };
  if (!canUse('offerMaker', { verified: shop.verified, tier: shop.tier }).ok) return { ok: false as const, message: NOT_VERIFIED };
  return { ok: true as const, supabase, shop };
}

function after(shop: { id: string; slug: string | null }) {
  revalidatePath('/vendor-dashboard/shop');
  revalidateShopPage(shop.id, shop.slug);
}

const posOrNull = (v: unknown) => {
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) && n > 0 ? n : null;
};
const dayOrNull = (v: unknown) => (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null);

/** The client's answer, re-read as the server trusts it: unknown fields dropped, every answer re-checked. */
function clean(input: Offer): Offer {
  const who = (OFFER_WHO as readonly string[]).includes(input.who) ? input.who : 'everyone';
  const o: Offer = {
    id: typeof input.id === 'string' ? input.id : 'new',
    name: String(input.name ?? '').trim(),
    reachesAll: input.reachesAll !== false,
    cards: Array.isArray(input.cards) ? [...new Set(input.cards.filter((c) => typeof c === 'string' && c.length > 0))] : [],
    pctOff: posOrNull(input.pctOff),
    phpOff: posOrNull(input.phpOff),
    firstPayment: posOrNull(input.firstPayment),
    firstPaymentUnit: input.firstPaymentUnit === 'pct' ? 'pct' : 'php',
    giftMode: input.giftMode === 'per' ? 'per' : 'same',
    gifts: parseOfferGifts(giftsToJson(Array.isArray(input.gifts) ? input.gifts : [])),
    who,
    // Each Who keeps only its own answer (the migration's CHECKs say the same).
    minLeadMonths: who === 'early_bird' ? posOrNull(input.minLeadMonths) : null,
    firstNCap: who === 'first_n' ? posOrNull(input.firstNCap) : null,
    firstNTaken: 0,
    seasonFrom: who === 'season' ? dayOrNull(input.seasonFrom) : null,
    seasonTo: who === 'season' ? dayOrNull(input.seasonTo) : null,
    untilDate: dayOrNull(input.untilDate),
    isOn: input.isOn !== false,
    sortOrder: 0,
  };
  if (o.reachesAll) o.cards = [];
  if (o.minLeadMonths != null) o.minLeadMonths = Math.round(o.minLeadMonths);
  if (o.firstNCap != null) o.firstNCap = Math.round(o.firstNCap);
  // Pick per card: a gift keeps its card only while that card is still one the offer reaches.
  if (o.giftMode === 'per') o.gifts = o.gifts.filter((g) => g.card && (o.reachesAll || o.cards.includes(g.card)));
  else o.gifts = o.gifts.map(({ card: _c, ...g }) => g as Offer['gifts'][number]);
  return o;
}

/** Save one offer — new (`id: 'new'`) or an edit. Returns the offer as stored. */
async function saveOffer(input: Offer): Promise<OfferResult> {
  const g = await gate();
  if (!g.ok) return g;
  const { supabase, shop } = g;
  const o = clean(input);
  const problem = offerProblem(o) ?? findVendorTextViolation([{ field: 'The name', value: o.name }, ...o.gifts.flatMap((x, i) => (x.kind === 'typed' ? [{ field: `Gift ${i + 1}`, value: x.label }] : []))]);
  if (problem) return { ok: false, message: problem };

  // The cards and add-ons must be this shop's own (the trigger refuses another shop's card too; this says it in words).
  const [cardsRes, addonsRes] = await Promise.all([
    supabase.from('vendor_services').select('vendor_service_id').eq('vendor_profile_id', shop.id),
    supabase.from('vendor_service_addons').select('id').eq('vendor_profile_id', shop.id),
  ]);
  if (cardsRes.error || addonsRes.error) return { ok: false, message: COULD_NOT };
  const ownCards = new Set(((cardsRes.data ?? []) as { vendor_service_id: string }[]).map((r) => r.vendor_service_id));
  const ownAddons = new Set(((addonsRes.data ?? []) as { id: number }[]).map((r) => r.id));
  if (o.cards.some((c) => !ownCards.has(c))) return { ok: false, message: 'One of those cards is no longer in your shop — pick again.' };
  if (o.gifts.some((x) => x.kind === 'addon' && !ownAddons.has(x.addonId))) return { ok: false, message: 'One of those extras is no longer on your cards — pick again.' };

  const row = {
    vendor_profile_id: shop.id,
    name: o.name,
    reaches_all: o.reachesAll,
    pct_off: hasPct(o) ? o.pctOff : null,
    php_off: hasPhp(o) ? o.phpOff : null,
    first_payment: hasFirstPayment(o) ? o.firstPayment : null,
    first_payment_unit: o.firstPaymentUnit,
    gift_mode: o.giftMode,
    gifts: giftsToJson(o.gifts),
    who: o.who,
    min_lead_months: o.minLeadMonths,
    first_n_cap: o.firstNCap,
    season_from: o.seasonFrom,
    season_to: o.seasonTo,
    until_date: o.untilDate,
    updated_at: new Date().toISOString(),
  };

  let id: number;
  if (o.id === 'new') {
    const { data: last } = await supabase.from('vendor_offers').select('sort_order').eq('vendor_profile_id', shop.id).order('sort_order', { ascending: false }).limit(1).maybeSingle();
    const { data, error } = await supabase
      .from('vendor_offers')
      .insert({ ...row, is_on: true, sort_order: ((last as { sort_order: number } | null)?.sort_order ?? -1) + 1 })
      .select('id')
      .single();
    if (error || !data) {
      console.error('[supabase-error] offers/actions.ts · insert vendor_offers', error);
      return { ok: false, message: COULD_NOT };
    }
    id = (data as { id: number }).id;
  } else {
    const { data, error } = await supabase.from('vendor_offers').update(row).eq('vendor_profile_id', shop.id).eq('public_id', o.id).select('id').maybeSingle();
    if (error || !data) {
      console.error('[supabase-error] offers/actions.ts · update vendor_offers', error);
      return { ok: false, message: COULD_NOT };
    }
    id = (data as { id: number }).id;
  }

  // 2 · Which cards? — the picked set, replaced whole.
  const del = await supabase.from('vendor_offer_cards').delete().eq('vendor_offer_id', id);
  if (del.error) return { ok: false, message: COULD_NOT };
  if (!o.reachesAll && o.cards.length) {
    const ins = await supabase.from('vendor_offer_cards').insert(o.cards.map((c) => ({ vendor_offer_id: id, vendor_service_id: c, vendor_profile_id: shop.id })));
    if (ins.error) {
      console.error('[supabase-error] offers/actions.ts · insert vendor_offer_cards', ins.error);
      return { ok: false, message: COULD_NOT };
    }
  }

  const back = await supabase.from('vendor_offers').select(VENDOR_OFFER_SELECT).eq('id', id).maybeSingle();
  if (back.error || !back.data) return { ok: false, message: COULD_NOT };
  after(shop);
  return { ok: true, offer: offerFromRow(back.data as unknown as VendorOfferRow) };
}

/** The list's switch. */
async function setOfferOn(offerId: string, on: boolean): Promise<OfferResult> {
  const g = await gate();
  if (!g.ok) return g;
  const { data, error } = await g.supabase
    .from('vendor_offers')
    .update({ is_on: on, updated_at: new Date().toISOString() })
    .eq('vendor_profile_id', g.shop.id)
    .eq('public_id', offerId)
    .select(VENDOR_OFFER_SELECT)
    .maybeSingle();
  if (error || !data) return { ok: false, message: 'Couldn’t switch it — try again.' };
  after(g.shop);
  return { ok: true, offer: offerFromRow(data as unknown as VendorOfferRow) };
}

/** Swipe left → Remove. The list waits out the Undo window before calling this (`deleteWithUndo`). Booked couples and sent quotes
 *  keep what they got — those are frozen in their own rows (`pricing_snapshot`, `vendor_proposals`), never read from here. */
async function removeOffer(offerId: string): Promise<{ ok: true } | { ok: false; message: string }> {
  const g = await gate();
  if (!g.ok) return g;
  const { error } = await g.supabase.from('vendor_offers').delete().eq('vendor_profile_id', g.shop.id).eq('public_id', offerId);
  if (error) return { ok: false, message: 'Couldn’t remove it — try again.' };
  after(g.shop);
  return { ok: true };
}

/**
 * Open the maker: everything it draws, in one wave. A read, so it writes nothing — but it still asks the lock, so an
 * unverified shop is never handed the maker's data (the 🔒 tile shows Problem → Solution instead).
 */
async function loadOfferMaker(): Promise<{ ok: true; data: OfferMakerData } | { ok: false; message: string; locked?: boolean }> {
  const g = await gate();
  if (!g.ok) return { ...g, locked: g.message === NOT_VERIFIED };
  return { ok: true, data: await readOfferMaker(g.supabase, { id: g.shop.id, tier: g.shop.tier, city: g.shop.city }) };
}

/**
 * 🔀 THE ONE DOOR (the server-action budget, `scripts/lint-server-action-budget.mjs`: one dispatcher, not four exports —
 * the couple-photo-share pattern). Every op runs through the lock (`gate`) inside its own function.
 */
export type OfferOp =
  | { op: 'load' }
  | { op: 'save'; offer: Offer }
  | { op: 'switch'; id: string; on: boolean }
  | { op: 'remove'; id: string };

export type OfferReply =
  | { ok: true; data: OfferMakerData }
  | { ok: true; offer: Offer }
  | { ok: true }
  | { ok: false; message: string; locked?: boolean };

export async function offerMaker(input: OfferOp): Promise<OfferReply> {
  switch (input.op) {
    case 'load':
      return loadOfferMaker();
    case 'save':
      return saveOffer(input.offer);
    case 'switch':
      return setOfferOn(input.id, input.on);
    case 'remove':
      return removeOffer(input.id);
    default:
      return { ok: false, message: 'Unknown request.' };
  }
}
