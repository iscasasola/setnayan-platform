/**
 * 🧭 FIND'S SORT — the two choices a sort needs a place or a price for (owner 2026-10-30, on the Suppliers › Find
 * "Best matches" ▾): *"nearest means it is compared to either their booked reception venue or ceremony venue … we make
 * them choose?"* → "Reception + Ceremony" · *"if they pick nearest to my budget. should we ask what is their budget
 * range for this search? so they give us lowest and highest budget range"* + *"our budget range will depend on the
 * lowest and highest service cards for that category"*.
 *
 * 📍 NEAREST FROM — the two venues the Event Hub already resolves (`lib/event-venues.ts` `resolveEventVenues`: the
 * booked venue's pin first, else the couple's own pin). Only a venue with a pin is offered, and the same place twice
 * ("Ceremony & Reception") is ONE row. Nothing is geocoded; a place with no pin is never measured from.
 *
 * ₱ YOUR RANGE — one per CATEGORY (a photographer and a venue cannot share a range), held for this search only: it is
 * never written to the budget plan, which would be a second budget disagreeing with the first. The boxes start at the
 * cheapest and the priciest card shown in that category. Inside the range scores 1; outside decays the way the shipped
 * `priceFitScore` does above a budget (half per range-width away), so nobody is removed — only re-ordered.
 *
 * Pure, so `find-sort-choices.test.ts` walks it.
 */
import type { EventVenue } from './event-venues';


export type NearFrom = 'reception' | 'ceremony';

export type NearPin = { latitude: number; longitude: number };

export type NearAnchors = { reception: NearPin | null; ceremony: NearPin | null };

const pinOf = (v: EventVenue): NearPin | null =>
  v.latitude != null && v.longitude != null && Number.isFinite(v.latitude) && Number.isFinite(v.longitude)
    ? { latitude: v.latitude, longitude: v.longitude }
    : null;

/** The reception and ceremony pins, read off the resolved venues ("both" fills both). */
export function nearAnchors(venues: readonly EventVenue[]): NearAnchors {
  let reception: NearPin | null = null;
  let ceremony: NearPin | null = null;
  for (const v of venues) {
    const p = pinOf(v);
    if (!p) continue;
    if ((v.role === 'reception' || v.role === 'both') && !reception) reception = p;
    if ((v.role === 'ceremony' || v.role === 'both') && !ceremony) ceremony = p;
  }
  return { reception, ceremony };
}

const samePin = (a: NearPin, b: NearPin) =>
  Math.abs(a.latitude - b.latitude) < 0.0014 && Math.abs(a.longitude - b.longitude) < 0.0014;

/**
 * The "Nearest" rows the sort menu offers, in order. Two different pins → "Nearest to reception" and "Nearest to
 * ceremony"; one pin (or the same place twice) → one row, "Nearest", measured from it; none → none (the menu keeps
 * its greyed "Nearest · Add your venue first").
 */
export function nearRows(a: NearAnchors): { from: NearFrom; label: string }[] {
  if (a.reception && a.ceremony && !samePin(a.reception, a.ceremony)) {
    return [
      { from: 'reception', label: 'Nearest to reception' },
      { from: 'ceremony', label: 'Nearest to ceremony' },
    ];
  }
  if (a.reception) return [{ from: 'reception', label: 'Nearest' }];
  if (a.ceremony) return [{ from: 'ceremony', label: 'Nearest' }];
  return [];
}

/** The place a "Nearest" sort measures from — the one asked for when it has a pin, else whichever does. */
export function nearFromOffered(asked: NearFrom, a: NearAnchors): NearFrom {
  if (asked === 'ceremony' ? a.ceremony : a.reception) return asked;
  return a.reception ? 'reception' : 'ceremony';
}

/** The menu key of a "Nearest" row (the sort itself stays the shipped `near` lens). */
export const nearKey = (from: NearFrom) => `near:${from}`;
export const nearFromKey = (key: string): NearFrom | null =>
  key === 'near:reception' ? 'reception' : key === 'near:ceremony' ? 'ceremony' : null;

// ── ₱ Your range ──────────────────────────────────────────────────────────────

export type PriceSpan = { low: number; high: number };

/** The cheapest and the priciest card shown in a category — what the range's two boxes show before anything is typed.
 *  Null with no priced card. */
export function priceSpan(prices: readonly (number | null | undefined)[]): PriceSpan | null {
  const ok = prices.filter((p): p is number => typeof p === 'number' && Number.isFinite(p) && p > 0);
  if (ok.length === 0) return null;
  return { low: Math.min(...ok), high: Math.max(...ok) };
}

/** The couple's typed range — either end may be blank (open on that side). */
export type BudgetRange = { low: number | null; high: number | null };

/** A typed range the couple has actually filled (an untouched pair of boxes orders nothing — the boxes only SHOW the
 *  category's span). */
export const rangeTyped = (r: BudgetRange | undefined): r is BudgetRange => r != null && (r.low != null || r.high != null);

/** The typed range with a blank end left open and the two ends put in order. */
export function effectiveRange(typed: BudgetRange): PriceSpan {
  const low = typed.low ?? 0;
  const high = typed.high ?? Number.POSITIVE_INFINITY;
  return low <= high ? { low, high } : { low: high, high: low };
}

/**
 * How well one card's price fits the range, 0..1 — 1 inside it; outside, half for every range-width it is away (an
 * open-ended range uses its one end; never under 1,000 pesos), never below 0.05. A card with no price is null → the scorer's NEUTRAL, never a penalty.
 */
export function rangeFitRatio(price: number | null | undefined, range: PriceSpan | null): number | null {
  if (range == null || typeof price !== 'number' || !Number.isFinite(price)) return null;
  if (price >= range.low && price <= range.high) return 1;
  const width = Math.max(1000, Number.isFinite(range.high) ? range.high - range.low : range.low);
  const away = price < range.low ? range.low - price : price - range.high;
  return Math.max(0.05, Math.pow(0.5, away / width));
}

/** A typed amount: digits only (₱, commas and spaces ignored); blank → null (the box falls back to the span). */
export function parsePeso(raw: string): number | null {
  const digits = raw.replace(/[^\d]/g, '');
  if (!digits) return null;
  const n = Number(digits);
  return Number.isFinite(n) && n > 0 ? n : null;
}
