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
 * Slice 1 is Papic only. Event Plus / Event Pro gifts (counts, not credits) are the next slice.
 */

import { bookingFeePhp, type BookingFeeSchedule } from './booking-fee';
import { GIFT_SHARE_OF_FEE_PCT } from './setnayan-gift';

/** The order key a GIFT purchase is minted under — `vendor_gift__<couple product code>`. */
export const SHOP_GIFT_KEY_PREFIX = 'vendor_gift__';

export function shopGiftServiceKey(code: string): string {
  return SHOP_GIFT_KEY_PREFIX + code;
}

/** The gifted product's code, or null for any other key. Slice 1: only `PAPIC_GUEST*` packs. */
export function shopGiftCodeOf(serviceKey: string | null | undefined): string | null {
  if (typeof serviceKey !== 'string' || !serviceKey.startsWith(SHOP_GIFT_KEY_PREFIX)) return null;
  const code = serviceKey.slice(SHOP_GIFT_KEY_PREFIX.length);
  return /^PAPIC_GUEST(_[A-Z0-9]+)?$/.test(code) ? code : null;
}

/** How many of one pack a single gift order may buy (the migration's CHECK says the same). */
export const SHOP_GIFT_MAX_QUANTITY = 100;

/** One giftable pack, as the catalogue says it today. Money in whole centavos. */
export type ShopGiftPack = {
  code: string;
  title: string;
  credits: number;
  /** The price couples pay — what the 40% limit is measured in. */
  srpCentavos: number;
  /** What a Verified-and-up shop pays; null ⇒ this pack has no gift price and everyone pays `srpCentavos`. */
  giftPriceCentavos: number | null;
};

/** Packs from the shop-pack reader's rows (`fetchShopPapicPacks`), smallest first. Bad rows are dropped. */
export function shopGiftPacksFrom(
  rows: ReadonlyArray<{ code: string; title: string; credits: number; pricePhp: number; giftPricePhp?: number | null }>,
): ShopGiftPack[] {
  const out: ShopGiftPack[] = [];
  for (const r of rows) {
    if (!r || typeof r.code !== 'string' || !Number.isInteger(r.credits) || r.credits <= 0) continue;
    const srp = Math.round(Number(r.pricePhp) * 100);
    if (!Number.isFinite(srp) || srp <= 0) continue;
    const g = r.giftPricePhp == null ? NaN : Math.round(Number(r.giftPricePhp) * 100);
    out.push({
      code: r.code,
      title: r.title || r.code,
      credits: r.credits,
      srpCentavos: srp,
      giftPriceCentavos: Number.isFinite(g) && g > 0 ? g : null,
    });
  }
  return out.sort((a, b) => a.credits - b.credits);
}

/** The pack that is always allowed on a quote — the smallest one on the live catalogue. */
export function alwaysAllowedPack(packs: readonly ShopGiftPack[]): ShopGiftPack | null {
  return packs.length > 0 ? packs[0]! : null;
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

/** The verdict on a quote's gifts. */
export type QuoteGiftsVerdict = {
  lines: ShopGiftPack[];
  credits: number;
  /** At the price couples pay. */
  valueCentavos: number;
  limitCentavos: number;
  /** Only the always-allowed pack — fits whatever the limit. */
  alwaysAllowed: boolean;
  state: 'none' | 'ok' | 'over_limit' | 'short' | 'unknown_pack';
  /** Credits missing from stock (state 'short'). */
  shortBy: number;
};

/**
 * Judge the gifts a supplier put on a quote. The server runs this before it writes the lines; the composer runs the
 * SAME function to draw the block, so the two can never disagree.
 *
 * @param codes the packs added, one entry per pack (two Papic 1000 ⇒ the code twice)
 * @param free  credits free to offer, from `freeCredits` — `null` (stock unread) judges as short
 */
export function judgeQuoteGifts(
  codes: readonly string[],
  packs: readonly ShopGiftPack[],
  totalCentavos: number,
  schedule: BookingFeeSchedule,
  free: number | null,
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
  const credits = lines.reduce((s, p) => s + p.credits, 0);
  const valueCentavos = lines.reduce((s, p) => s + p.srpCentavos, 0);
  const smallest = alwaysAllowedPack(packs);
  const alwaysAllowed = lines.length === 1 && !!smallest && lines[0]!.code === smallest.code;
  const base = { lines, credits, valueCentavos, limitCentavos, alwaysAllowed, shortBy: 0 };

  if (unknown) return { ...base, state: 'unknown_pack' };
  if (lines.length === 0) return { ...base, state: 'none' };
  if (!alwaysAllowed && valueCentavos > limitCentavos) return { ...base, state: 'over_limit' };
  const have = free ?? 0;
  if (credits > have) return { ...base, state: 'short', shortBy: credits - have };
  return { ...base, state: 'ok' };
}

/** What the quote builder needs to draw "Gifts from you" and re-judge it as the total moves. */
export type ShopGiftQuoteBasis = {
  packs: ShopGiftPack[];
  schedule: BookingFeeSchedule;
  /** Credits free to offer on THIS quote (this event's old holds left out). Null = could not be read. */
  free: number | null;
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
  free: number | null,
): GiftMenuOption[] {
  return packs.map((p) => {
    const v = judgeQuoteGifts([...codes, p.code], packs, totalCentavos, schedule, free);
    if (v.state === 'ok') return { code: p.code, title: p.title, ok: true, why: null };
    if (v.state === 'over_limit') return { code: p.code, title: p.title, ok: false, why: 'Over this booking’s gift limit' };
    if (v.state === 'short') return { code: p.code, title: p.title, ok: false, why: 'Not enough in your stock · buy first' };
    return { code: p.code, title: p.title, ok: false, why: 'Not on sale right now' };
  });
}

/** "1,000" — a count as people read it. */
export function giftCount(n: number): string {
  return new Intl.NumberFormat('en-PH', { maximumFractionDigits: 0 }).format(n);
}

/** The couple's line for one quote: "Gift from Saysay Studio 🎁 · 1,150 Papic credits". */
export function coupleGiftHeadline(credits: number, shopName: string | null | undefined): string | null {
  if (!Number.isFinite(credits) || credits <= 0) return null;
  const from = shopName?.trim() ? `Gift from ${shopName.trim()}` : 'A gift from your supplier';
  return `${from} 🎁 · ${giftCount(credits)} Papic credits`;
}

/** Where the couple's gift stands. */
export type CoupleGiftState = 'promised' | 'given';

export function coupleGiftDetail(state: CoupleGiftState): string {
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

/** The supplier's stock row sub-line: "850 free to offer · 300 on sent quotes". */
export function stockSubline(stock: ShopGiftStock | null): string {
  if (!stock) return 'Couldn’t read your gifts right now';
  const free = freeCredits(stock) ?? 0;
  const held = stock.held > 0 ? ` · ${giftCount(stock.held)} on sent quotes` : '';
  return `${giftCount(free)} free to offer${held}`;
}
