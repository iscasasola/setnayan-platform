/**
 * SUPPLIER GIFTS — the rules, PURE (no I/O, no `server-only`), so every one is unit-testable. The reads and writes
 * are `lib/shop-gifts.server.ts`; the ledger and the one delivery door are migration
 * `supplier_gifts_stock_quote_lines_and_delivery`.
 *
 * ⚖ OWNER RULINGS (DECISION_LOG 2026-11-04 — closed, do not re-ask):
 *   • a shop BUYS gifts ahead, in quantity, and keeps them as STOCK (Papic credits as a credit balance);
 *   • gifts are offered ONLY on service cards and quotes, and ONLY while in stock ("buy first");
 *   • they leave the stock when that couple's FIRST PAYMENT clears, and land on the couple's EVENT;
 *   • a Verified-and-up shop pays the catalogue's GIFT price (`gift_price_php`); Free pays the list price;
 *   • a shop's gifts on one booking are capped at 40% of that booking's fee, measured at the price couples pay —
 *     the SAME 40% as the Setnayan gift (`GIFT_SHARE_OF_FEE_PCT`, reused, never re-typed) — and the smallest Papic
 *     pack ("Papic 150") is ALWAYS allowed, even above the limit.
 *
 * 🔑 THE ALWAYS-ALLOWED PACK IS DERIVED, NOT TYPED: it is the smallest active pack on the live catalogue
 * ("they can always give the lowest gift at any price. that is the lowest papic."). Typing 150 here would freeze a
 * number the admin can change.
 *
 * 💎 SLICE 2 (2026-11-05) — Event Plus and Event Pro are gifts too, kept as COUNTS beside the Papic credit balance.
 * For those two kinds one "credit" is ONE unlock: a pack's `credits` is 1, the stock moves ±1, a quote line gives 1.
 * At the first payment the gift unlocks the EVENT; a second Event Plus on an event that already holds Plus unlocks
 * Event Pro instead (owner 2026-11-05: *"yes, the second event plus will auto upgrade event pro"*). An event that
 * already holds Event Pro cannot take either — the quote says so before it is sent.
 */

import { bookingFeePhp, type BookingFeeSchedule } from './booking-fee';
import { EVENT_PLUS_SKU, FULL_PRO_SKU } from './hub-parts';
import { GIFT_SHARE_OF_FEE_PCT } from './setnayan-gift';

/** What a gift is: Papic credits, or one Event Plus / Event Pro unlock. The migration's CHECKs say the same three. */
export type ShopGiftKind = 'papic' | 'event_plus' | 'event_pro';

export const SHOP_GIFT_KINDS: readonly ShopGiftKind[] = ['papic', 'event_plus', 'event_pro'];

/** The couple product each unlock kind is (a `platform_retail_catalog_v2.service_code`). */
export const SHOP_GIFT_UNLOCK_CODE: Readonly<Record<Exclude<ShopGiftKind, 'papic'>, string>> = {
  event_plus: EVENT_PLUS_SKU,
  event_pro: FULL_PRO_SKU,
};

/** The kind of a giftable product code, or null when it cannot be gifted. */
export function shopGiftKindOf(code: string | null | undefined): ShopGiftKind | null {
  if (typeof code !== 'string') return null;
  if (/^PAPIC_GUEST(_[A-Z0-9]+)?$/.test(code)) return 'papic';
  if (code === SHOP_GIFT_UNLOCK_CODE.event_plus) return 'event_plus';
  if (code === SHOP_GIFT_UNLOCK_CODE.event_pro) return 'event_pro';
  return null;
}

/** What the couple's event already holds, from the app's entitlement chain — Event Pro includes everything Plus has. */
export type EventHolds = 'none' | 'plus' | 'pro';

/** The order key a GIFT purchase is minted under — `vendor_gift__<couple product code>`. */
export const SHOP_GIFT_KEY_PREFIX = 'vendor_gift__';

export function shopGiftServiceKey(code: string): string {
  return SHOP_GIFT_KEY_PREFIX + code;
}

/** The gifted product's code, or null for any other key: a `PAPIC_GUEST*` pack, Event Plus or Event Pro. */
export function shopGiftCodeOf(serviceKey: string | null | undefined): string | null {
  if (typeof serviceKey !== 'string' || !serviceKey.startsWith(SHOP_GIFT_KEY_PREFIX)) return null;
  const code = serviceKey.slice(SHOP_GIFT_KEY_PREFIX.length);
  return shopGiftKindOf(code) ? code : null;
}

/** How many of one pack a single gift order may buy (the migration's CHECK says the same). */
export const SHOP_GIFT_MAX_QUANTITY = 100;

/** One giftable pack, as the catalogue says it today. Money in whole centavos. */
export type ShopGiftPack = {
  code: string;
  title: string;
  kind: ShopGiftKind;
  /** Papic credits ONE pack adds — or 1 for an Event Plus / Event Pro unlock. */
  credits: number;
  /** The price couples pay — what the 40% limit is measured in. */
  srpCentavos: number;
  /** What a Verified-and-up shop pays; null ⇒ this pack has no gift price and everyone pays `srpCentavos`. */
  giftPriceCentavos: number | null;
};

/**
 * Packs from the catalogue rows (`fetchShopPapicPacks` + `fetchShopGiftUnlockRows`): the Papic packs smallest first,
 * then Event Plus, then Event Pro. Bad rows — and any code that cannot be gifted — are dropped.
 */
export function shopGiftPacksFrom(
  rows: ReadonlyArray<{ code: string; title: string; credits: number; pricePhp: number; giftPricePhp?: number | null }>,
): ShopGiftPack[] {
  const out: ShopGiftPack[] = [];
  for (const r of rows) {
    if (!r || typeof r.code !== 'string' || !Number.isInteger(r.credits) || r.credits <= 0) continue;
    const kind = shopGiftKindOf(r.code);
    if (!kind || (kind !== 'papic' && r.credits !== 1)) continue;
    const srp = Math.round(Number(r.pricePhp) * 100);
    if (!Number.isFinite(srp) || srp <= 0) continue;
    const g = r.giftPricePhp == null ? NaN : Math.round(Number(r.giftPricePhp) * 100);
    out.push({
      code: r.code,
      title: r.title || r.code,
      kind,
      credits: r.credits,
      srpCentavos: srp,
      giftPriceCentavos: Number.isFinite(g) && g > 0 ? g : null,
    });
  }
  const order = (p: ShopGiftPack) => SHOP_GIFT_KINDS.indexOf(p.kind);
  return out.sort((a, b) => order(a) - order(b) || a.credits - b.credits);
}

/** The pack that is always allowed on a quote — the smallest PAPIC pack on the live catalogue. */
export function alwaysAllowedPack(packs: readonly ShopGiftPack[]): ShopGiftPack | null {
  return packs.find((p) => p.kind === 'papic') ?? null;
}

/** What one pack gives, as people read it: "1,000 Papic credits" · "Unlocks Event Plus on their event". */
export function giftPackLine(pack: Pick<ShopGiftPack, 'kind' | 'credits' | 'title'>): string {
  return pack.kind === 'papic' ? `${giftCount(pack.credits)} Papic credits` : `Unlocks ${pack.title} on their event`;
}

/** What this shop pays for ONE pack: the gift price when it is Verified-and-up and the pack has one, else the list. */
export function giftUnitPrice(
  pack: ShopGiftPack,
  paysGiftPrice: boolean,
): { centavos: number; basis: 'gift' | 'list' } {
  if (paysGiftPrice && pack.giftPriceCentavos != null && pack.giftPriceCentavos < pack.srpCentavos) {
    return { centavos: pack.giftPriceCentavos, basis: 'gift' };
  }
  return { centavos: pack.srpCentavos, basis: 'list' };
}

/**
 * The gift LIMIT for a quote of `totalCentavos`: 40% of its booking fee, in whole centavos, FLOORED (the limit can
 * never exceed 40% by a centavo). The fee comes from `bookingFeePhp` under the LIVE schedule — never a re-typed rate.
 */
export function giftLimitCentavos(totalCentavos: number, schedule: BookingFeeSchedule): number {
  if (!Number.isFinite(totalCentavos) || totalCentavos <= 0) return 0;
  const feeCentavos = Math.round(bookingFeePhp(totalCentavos / 100, schedule) * 100);
  return Math.floor((feeCentavos * GIFT_SHARE_OF_FEE_PCT) / 100);
}

/** The stock a shop can still offer: balance − what live quotes hold. `null` = could not be read. */
export type ShopGiftStock = {
  /** SUM of the ledger. */
  balance: number;
  /** Promised on live quotes, not yet given. */
  held: number;
};

export function freeCredits(stock: ShopGiftStock | null): number | null {
  if (!stock) return null;
  return Math.max(0, stock.balance - stock.held);
}

/** The stock of every kind. `null` = could not be read (never zeros). */
export type ShopGiftStocks = Readonly<Record<ShopGiftKind, ShopGiftStock>>;

/** What can still be offered of each kind. */
export type FreeByKind = Readonly<Record<ShopGiftKind, number>>;

export function freeByKind(stocks: ShopGiftStocks | null): FreeByKind | null {
  if (!stocks) return null;
  return {
    papic: freeCredits(stocks.papic) ?? 0,
    event_plus: freeCredits(stocks.event_plus) ?? 0,
    event_pro: freeCredits(stocks.event_pro) ?? 0,
  };
}

/** The verdict on a quote's gifts. */
export type QuoteGiftsVerdict = {
  lines: ShopGiftPack[];
  /** Papic credits only. */
  credits: number;
  /** Event Plus / Event Pro unlocks on the quote. */
  unlocks: { event_plus: number; event_pro: number };
  /** At the price couples pay. */
  valueCentavos: number;
  limitCentavos: number;
  /** Only the always-allowed pack — fits whatever the limit. */
  alwaysAllowed: boolean;
  state: 'none' | 'ok' | 'over_limit' | 'short' | 'unknown_pack' | 'already_has';
  /** Missing from stock (state 'short') — credits for Papic, units for an unlock. */
  shortBy: number;
  /** Which kind is short (state 'short'). */
  shortKind: ShopGiftKind | null;
};

/**
 * Judge the gifts a supplier put on a quote. The server runs this before it writes the lines; the composer runs the
 * SAME function to draw the block, so the two can never disagree.
 *
 * @param codes    the packs added, one entry per pack (two Papic 1000 ⇒ the code twice)
 * @param free     what is free to offer of each kind, from `freeByKind` — `null` (stock unread) judges as short
 * @param eventHas what the couple's event already holds — an event with Event Pro cannot take Plus or Pro
 */
export function judgeQuoteGifts(
  codes: readonly string[],
  packs: readonly ShopGiftPack[],
  totalCentavos: number,
  schedule: BookingFeeSchedule,
  free: FreeByKind | null,
  eventHas: EventHolds = 'none',
): QuoteGiftsVerdict {
  const limitCentavos = giftLimitCentavos(totalCentavos, schedule);
  const byCode = new Map(packs.map((p) => [p.code, p]));
  const lines: ShopGiftPack[] = [];
  let unknown = false;
  for (const c of codes) {
    const p = byCode.get(c);
    if (p) lines.push(p);
    else unknown = true;
  }
  const need = (k: ShopGiftKind) => lines.reduce((s, p) => s + (p.kind === k ? p.credits : 0), 0);
  const credits = need('papic');
  const unlocks = { event_plus: need('event_plus'), event_pro: need('event_pro') };
  const valueCentavos = lines.reduce((s, p) => s + p.srpCentavos, 0);
  const smallest = alwaysAllowedPack(packs);
  const alwaysAllowed = lines.length === 1 && !!smallest && lines[0]!.code === smallest.code;
  const base = { lines, credits, unlocks, valueCentavos, limitCentavos, alwaysAllowed, shortBy: 0, shortKind: null };

  if (unknown) return { ...base, state: 'unknown_pack' };
  if (lines.length === 0) return { ...base, state: 'none' };
  if (eventHas === 'pro' && unlocks.event_plus + unlocks.event_pro > 0) return { ...base, state: 'already_has' };
  if (!alwaysAllowed && valueCentavos > limitCentavos) return { ...base, state: 'over_limit' };
  for (const k of SHOP_GIFT_KINDS) {
    const have = free?.[k] ?? 0;
    if (need(k) > have) return { ...base, state: 'short', shortBy: need(k) - have, shortKind: k };
  }
  return { ...base, state: 'ok' };
}

/** What the quote builder needs to draw "Gifts from you" and re-judge it as the total moves. */
export type ShopGiftQuoteBasis = {
  packs: ShopGiftPack[];
  schedule: BookingFeeSchedule;
  /** Free to offer on THIS quote, per kind (this event's old holds left out). Null = could not be read. */
  free: FreeByKind | null;
  /** What the couple's event already holds — Plus and Pro gifts read it. */
  eventHas: EventHolds;
};

/** One choice in the "＋ Add a gift" menu. */
export type GiftMenuOption = {
  code: string;
  title: string;
  /** False ⇒ shown disabled with `why`. */
  ok: boolean;
  why: string | null;
};

/**
 * The add menu: every pack, each saying whether it can go on THIS quote now. A pack that would break the limit or
 * that stock cannot cover is listed with the reason, so "buy first" is said where the choice is made.
 */
export function addGiftMenu(
  codes: readonly string[],
  packs: readonly ShopGiftPack[],
  totalCentavos: number,
  schedule: BookingFeeSchedule,
  free: FreeByKind | null,
  eventHas: EventHolds = 'none',
): GiftMenuOption[] {
  return packs.map((p) => {
    const v = judgeQuoteGifts([...codes, p.code], packs, totalCentavos, schedule, free, eventHas);
    if (v.state === 'ok') return { code: p.code, title: p.title, ok: true, why: null };
    if (v.state === 'already_has') return { code: p.code, title: p.title, ok: false, why: 'Their event already has Event Pro' };
    if (v.state === 'over_limit') return { code: p.code, title: p.title, ok: false, why: 'Over this booking’s gift limit' };
    if (v.state === 'short') return { code: p.code, title: p.title, ok: false, why: 'Not enough in your stock · buy first' };
    return { code: p.code, title: p.title, ok: false, why: 'Not on sale right now' };
  });
}

/** "1,000" — a count as people read it. */
export function giftCount(n: number): string {
  return new Intl.NumberFormat('en-PH', { maximumFractionDigits: 0 }).format(n);
}

/** Unlock titles on a quote, in order — the catalogue's own titles ("Event Plus", "Event Pro"). */
export type GiftUnlockTitles = readonly string[];

/**
 * The couple's line for one quote: "Gift from Saysay Studio 🎁 · 1,150 Papic credits · Event Plus". Null when the
 * quote gives nothing.
 */
export function coupleGiftHeadline(
  credits: number,
  shopName: string | null | undefined,
  unlocks: GiftUnlockTitles = [],
): string | null {
  const parts = [
    ...(Number.isFinite(credits) && credits > 0 ? [`${giftCount(credits)} Papic credits`] : []),
    ...unlocks.filter((t) => typeof t === 'string' && t.trim().length > 0),
  ];
  if (parts.length === 0) return null;
  const from = shopName?.trim() ? `Gift from ${shopName.trim()}` : 'A gift from your supplier';
  return `${from} 🎁 · ${parts.join(' · ')}`;
}

/** Where the couple's gift stands. */
export type CoupleGiftState = 'promised' | 'given';

export function coupleGiftDetail(state: CoupleGiftState, hasUnlock = false, hasCredits = false): string {
  if (hasUnlock && hasCredits) {
    return state === 'given' ? 'Added to your event.' : 'Added to your event when your first payment is confirmed.';
  }
  if (hasUnlock) {
    return state === 'given' ? 'Unlocked on your event.' : 'Unlocked on your event when your first payment is confirmed.';
  }
  return state === 'given'
    ? 'Added to your event’s Papic credits.'
    : 'Added to your event’s Papic credits when your first payment is confirmed.';
}

/** The same gift as the SUPPLIER reads it on their own sent quote. */
export function supplierGiftDetail(state: CoupleGiftState): string {
  return state === 'given'
    ? 'Given — it left your gift stock and is on their event.'
    : 'Leaves your gift stock when their first payment clears.';
}

/** The supplier's stock row sub-line: "850 free to offer · 300 on sent quotes" (credits, or Plus / Pro counts). */
export function stockSubline(stock: ShopGiftStock | null): string {
  if (!stock) return 'Couldn’t read your gifts right now';
  const free = freeCredits(stock) ?? 0;
  const held = stock.held > 0 ? ` · ${giftCount(stock.held)} on sent quotes` : '';
  return `${giftCount(free)} free to offer${held}`;
}

/**
 * 🎁 ONE CHOICE IN A SERVICE CARD'S Gift DROPDOWN (owner 2026-11-07, DECISION_LOG "THE FOUR MAKERS ARE APPROVED").
 * The card maker's Gift is one dropdown: No gift · Setnayan gift · the shop's own packs. A card ADVERTISES a gift —
 * there is no booking total yet, so the 40% limit is judged where it always is, on the quote; what a card can say is
 * only whether the stock can cover ONE of the pack right now ("buy first" — the quote menu's own words).
 */
export type CardGiftOption = {
  code: string;
  title: string;
  kind: ShopGiftKind;
  /** Papic credits ONE pack adds — or 1 for an unlock. From the catalogue, never typed. */
  credits: number;
  /** What the pack gives — `giftPackLine`, e.g. "1,000 Papic credits" · "Unlocks Event Plus on their event". */
  line: string;
  /** False ⇒ listed, not pickable, with `why`. */
  ok: boolean;
  why: string | null;
};

/** The shop's packs as Gift-dropdown choices. `free` null (stock unread) lists every pack as not pickable, saying so. */
export function cardGiftMenu(packs: readonly ShopGiftPack[], free: FreeByKind | null): CardGiftOption[] {
  return packs.map((p) => {
    const base = { code: p.code, title: p.title, kind: p.kind, credits: p.credits, line: giftPackLine(p) };
    if (free === null) return { ...base, ok: false, why: 'Couldn’t read your gifts right now' };
    if ((free[p.kind] ?? 0) < p.credits) return { ...base, ok: false, why: 'Not enough in your stock · buy first' };
    return { ...base, ok: true, why: null };
  });
}

/** The couple's headline for a card that offers ONE pack — the quote's own `coupleGiftHeadline`, never re-worded. */
export function cardGiftHeadline(
  gift: Pick<CardGiftOption, 'kind' | 'credits' | 'title'>,
  shopName: string | null | undefined,
): string {
  return (
    coupleGiftHeadline(gift.kind === 'papic' ? gift.credits : 0, shopName, gift.kind === 'papic' ? [] : [gift.title]) ??
    gift.title
  );
}
