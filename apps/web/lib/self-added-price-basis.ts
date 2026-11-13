/**
 * 🧾 A SUPPLIER THE COUPLE ADDS SAYS HOW ITS PRICE WORKS — v2 (owner 2026-11-13, DECISION_LOG "SELF-ADDED PRICE: THE
 * COUPLE RECORDS WHAT WAS AGREED" · "AFTER THE CLAIM, THE SUPPLIER'S PRICE FOLLOWS THE GUEST LIST" · "PRICE BASIS v2
 * AGREED"; prototype `prototypes/manual_service_price_basis_2026-11-13/v2.html`). Pure: the words, the parse, the
 * "works out to" and the claim door's pre-fill.
 *
 * The couple records WHAT WAS AGREED, both numbers typed — never read from the schedule or the live guest list:
 *   One price  — one payment for the whole day (`total_cost_php`).
 *   Per guest  — the TOTAL agreed (`total_cost_php`) + the GUESTS agreed (`event_vendors.pax_quote_base`, the shipped
 *                "guest count the base price is anchored to" — no new column).
 *   Per hour   — the TOTAL agreed (`total_cost_php`) + the HOURS agreed (`event_vendors.agreed_hours`).
 * `event_vendors.pricing_basis` says which (NULL = One price). Migration 20271342032145.
 *
 * 🛑 A failed read is never ₱0 and never "0 guests": a count that is not there is `null`, and a line that needs it is
 * not drawn.
 */
import { formatPhp } from './php';
import { countNoun, formatCount } from './format-number';

/** The Card Maker's own keys (`vendor_services.pricing_basis`). `fixed` = One price = NULL on the booking. */
export type SelfAddedBasis = 'fixed' | 'per_pax' | 'per_hour';

/** The form fields the sheet posts. The total keeps its shipped `total_cost_php` for every basis. */
export const PRICE_BASIS_FIELD = 'pricing_basis';
export const AGREED_COUNT_FIELD = 'agreed_count';

/** What the sheet posted: a basis, or `null` when the form carried none (an older caller — leave the facts alone). */
export function parseSelfAddedBasis(v: unknown): SelfAddedBasis | null {
  return v === 'fixed' || v === 'per_pax' || v === 'per_hour' ? v : null;
}

/** The stored column → the basis (NULL and anything unknown read as One price). */
export function basisFromColumn(v: unknown): SelfAddedBasis {
  return v === 'per_pax' || v === 'per_hour' ? v : 'fixed';
}

/**
 * A typed agreed count → a number above 0, or null. Guests are whole ("120"); hours may be halves or quarters
 * ("5", "6.5"), kept to two decimals (the column's own scale). "0" / "" / "abc" → null.
 */
export function parseAgreedCount(basis: SelfAddedBasis, v: unknown): number | null {
  if (basis === 'fixed') return null;
  if (typeof v !== 'string' && typeof v !== 'number') return null;
  const n = Number(String(v).replace(/[,\s]/g, ''));
  if (!Number.isFinite(n) || n <= 0) return null;
  if (basis === 'per_pax') return Number.isInteger(n) && n <= 100_000 ? n : null;
  return n <= 999 ? Math.round(n * 100) / 100 : null;
}

/** The two stored columns → the agreed count for this basis (null = none recorded, never 0). */
export function agreedCountFromRow(
  basis: SelfAddedBasis,
  row: { pax_quote_base?: number | string | null; agreed_hours?: number | string | null },
): number | null {
  const raw = basis === 'per_pax' ? row.pax_quote_base : basis === 'per_hour' ? row.agreed_hours : null;
  if (raw == null) return null;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : null;
}

/** The row names (v2): One price keeps the shipped "Price". */
export const TOTAL_ROW_NAME = 'Total agreed';
export function countRowName(basis: Exclude<SelfAddedBasis, 'fixed'>): string {
  return basis === 'per_pax' ? 'Guests agreed' : 'Hours agreed';
}

/** One price's one short line (v2). */
export const ONE_PRICE_LINE = 'One payment for the whole day';

/** "120 guests" · "1 guest" · "5 hours" · "6.5 hours". */
export function countWords(basis: Exclude<SelfAddedBasis, 'fixed'>, n: number): string {
  return basis === 'per_pax' ? countNoun(n, 'guest', 'guests') : countNoun(n, 'hour', 'hours');
}

/**
 * The rate the agreed numbers work out to — total ÷ count, to whole pesos. `rounds` = it did not divide exactly
 * (₱100,000 ÷ 120), so a screen that shows it says so instead of hiding the rounding. Null when either is missing.
 */
export function worksOut(totalPhp: number | null, count: number | null): { ratePhp: number; rounds: boolean } | null {
  if (totalPhp == null || count == null || !(totalPhp > 0) || !(count > 0)) return null;
  const exact = totalPhp / count;
  const ratePhp = Math.round(exact);
  return { ratePhp, rounds: Math.abs(exact - ratePhp) > 1e-9 };
}

/** "Works out to ₱1,350 a guest" · "Works out to about ₱833 a guest" · null when the two numbers are not both there. */
export function worksOutWords(basis: Exclude<SelfAddedBasis, 'fixed'>, totalPhp: number | null, count: number | null): string | null {
  const w = worksOut(totalPhp, count);
  if (!w) return null;
  return `Works out to ${w.rounds ? 'about ' : ''}${formatPhp(w.ratePhp)} ${basis === 'per_pax' ? 'a guest' : 'an hour'}`;
}

/** The saved cards' lines, by booking id (`readSelfAddedPriceLines`). */
export type SelfAddedPriceLine = { basis: SelfAddedBasis; count: number | null };
export type SelfAddedPriceLines = Record<string, SelfAddedPriceLine>;

/**
 * THE SAVED CARD on Suppliers (v2): the card draws its total, then " · 120 guests agreed" / " · 5 hours agreed".
 * One price, or no count recorded → null (the card is as shipped).
 */
export function agreedSuffix(line: SelfAddedPriceLine | null | undefined): string | null {
  if (!line || line.basis === 'fixed' || line.count == null) return null;
  return `${countWords(line.basis, line.count)} agreed`;
}

/** The card's one "After they claim" line (decided, owner 13 Nov: "Yes, follow it") and the detail for its ⓘ. */
export function afterClaim(basis: SelfAddedBasis): { line: string; detail: string } {
  if (basis === 'per_pax')
    return {
      line: 'After they claim: their rate × your guest list',
      detail: 'Once they claim, their price per guest follows your guest list — never below their minimum.',
    };
  if (basis === 'per_hour')
    return {
      line: 'After they claim: extra hours at their rate',
      detail: 'Once they claim, their price covers the hours agreed; hours past that are charged at their extra-hour rate.',
    };
  return {
    line: 'After they claim: this stays the price',
    detail: 'Once they claim, this stays the price. Their extras are offered on top, never added to it.',
  };
}

/**
 * THE CLAIM DOOR'S PRE-FILL — the Card Maker's own fields (`pricing-basis-editor.tsx`), from what the couple typed:
 *   One price → From (PHP) = the one price.
 *   Per guest → From, per guest (PHP) = total ÷ guests (whole pesos; `rounds` says when it rounded) · Minimum guests =
 *               the guests agreed.
 *   Per hour  → Minimum hours = the hours agreed · From (PHP) = the total · Each extra hour (PHP) = empty, required.
 * A number the couple did not record is '' (an empty box), never 0.
 */
export type ClaimPricePrefill =
  | { basis: 'fixed'; from: string }
  | { basis: 'per_pax'; perPax: string; minPax: string; rounds: boolean }
  | { basis: 'per_hour'; minHours: string; hourBase: string; extraHour: string };

export function claimPricePrefill(basis: SelfAddedBasis, totalPhp: number | null, count: number | null): ClaimPricePrefill {
  const s = (n: number | null) => (n != null && n > 0 ? String(n) : '');
  if (basis === 'per_pax') {
    const w = worksOut(totalPhp, count);
    return { basis, perPax: s(w?.ratePhp ?? null), minPax: s(count), rounds: w?.rounds ?? false };
  }
  if (basis === 'per_hour') return { basis, minHours: s(count), hourBase: s(totalPhp), extraHour: '' };
  return { basis: 'fixed', from: s(totalPhp) };
}

/** The band on the claim door's card slide: the couple's agreed total stays as their booking. */
export function claimStaysLine(inviter: string, basis: SelfAddedBasis, totalPhp: number | null, count: number | null): string | null {
  if (totalPhp == null || !(totalPhp > 0)) return null;
  const t = formatPhp(totalPhp);
  if (basis === 'per_pax' && count != null) return `${inviter}’s ${t} for ${formatCount(count)} guests stays as their booking.`;
  if (basis === 'per_hour' && count != null) return `${inviter}’s ${t} for ${countWords('per_hour', count)} stays as their booking.`;
  return `${inviter}’s ${t} stays as their booking — one payment for the whole day.`;
}

/** The read-only "How the price works" row's words on the claim door (the Card Maker's own labels, "One price"). */
export function basisLabel(basis: SelfAddedBasis): string {
  return basis === 'per_pax' ? 'Per guest' : basis === 'per_hour' ? 'Per hour' : 'One price';
}
