/**
 * 🧾 A SUPPLIER THE COUPLE ADDS SAYS HOW ITS PRICE WORKS — One price · Per guest · Per hour (owner 2026-11-13,
 * DECISION_LOG "MANUAL SERVICE PRICE BASIS — PROTOTYPE APPROVED"; prototype
 * `prototypes/manual_service_price_basis_2026-11-13/index.html`). Pure: the words, the parse, and the one total rule.
 *
 * The facts live on the booking (`event_vendors.pricing_basis` · `pricing_rate_php`, migration 20271342032145);
 * `total_cost_php` stays the ONE total the budget reads. The two numbers a rate multiplies come from the database
 * (`get_self_added_price_terms`): `counted` — the guests this booking counts, the same count the pax-follow prices a
 * quote on — and `hours` — that supplier's Arrive → Done on the schedule.
 *
 * 🛑 NEVER A GUESSED TOTAL. Per hour with no times, per guest with nobody counted, or a read that was refused → there
 * is NO total: the sheet says why, the save writes none, and a card never draws ₱0.
 */
import { formatPhp } from './php';

/** The Card Maker's own keys (`vendor_services.pricing_basis`). `fixed` = One price = NULL on the booking. */
export type SelfAddedBasis = 'fixed' | 'per_pax' | 'per_hour';

/** The form fields the sheet posts. The One-price row keeps its shipped `total_cost_php`. */
export const PRICE_BASIS_FIELD = 'pricing_basis';
export const PRICE_RATE_FIELD = 'pricing_rate_php';

/** What the sheet posted: a basis, or `null` when the form carried none (an older caller — leave the facts alone). */
export function parseSelfAddedBasis(v: unknown): SelfAddedBasis | null {
  return v === 'fixed' || v === 'per_pax' || v === 'per_hour' ? v : null;
}

/** The stored column → the basis (NULL and anything unknown read as One price). */
export function basisFromColumn(v: unknown): SelfAddedBasis {
  return v === 'per_pax' || v === 'per_hour' ? v : 'fixed';
}

/** A typed rate in pesos → a number above 0, or null. "1,350" → 1350; "0" / "" / "abc" → null. */
export function parseRatePhp(v: unknown): number | null {
  if (typeof v !== 'string' && typeof v !== 'number') return null;
  const n = Number(String(v).replace(/[,\s₱]/g, ''));
  return Number.isFinite(n) && n > 0 ? Math.round(n * 100) / 100 : null;
}

/** The numbers a rate multiplies. `hours` null = fewer than two times for them on the schedule. */
export type PriceTerms = { counted: number; hours: number | null; arriveAt: string | null; doneAt: string | null };

/** `get_self_added_price_terms`' answer → terms, or null when it is not the shape (said as unread, never as 0). */
export function parsePriceTerms(raw: unknown): PriceTerms | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  const counted = Number(r.counted);
  if (!Number.isFinite(counted) || counted < 0) return null;
  const h = r.hours == null ? null : Number(r.hours);
  return {
    counted: Math.trunc(counted),
    hours: h != null && Number.isFinite(h) && h > 0 ? h : null,
    arriveAt: typeof r.arrive_at === 'string' ? r.arrive_at : null,
    doneAt: typeof r.done_at === 'string' ? r.done_at : null,
  };
}

/** A read of the terms: the numbers, `'unread'` (refused — said), or `'loading'` (not back yet). */
export type PriceTermsRead = PriceTerms | 'unread' | 'loading';

export type BasisTotal =
  | { kind: 'total'; totalPhp: number; n: number }
  | { kind: 'none'; why: 'no_rate' | 'unread' | 'loading' | 'no_times' | 'none_counted' };

/**
 * THE ONE TOTAL RULE — rate × the number, to the centavo (SQL `self_added_price_follow`: `round(rate * n, 2)`).
 * One price has no rule here: its total is what the couple typed.
 */
export function basisTotal(basis: Exclude<SelfAddedBasis, 'fixed'>, ratePhp: number | null, terms: PriceTermsRead): BasisTotal {
  if (terms === 'loading') return { kind: 'none', why: 'loading' };
  if (terms === 'unread') return { kind: 'none', why: 'unread' };
  const n = basis === 'per_pax' ? (terms.counted > 0 ? terms.counted : null) : terms.hours;
  if (n == null) return { kind: 'none', why: basis === 'per_pax' ? 'none_counted' : 'no_times' };
  if (ratePhp == null) return { kind: 'none', why: 'no_rate' };
  return { kind: 'total', totalPhp: Math.round(ratePhp * n * 100) / 100, n };
}

/** The Price row's name follows the choice (prototype states 2 · 4 · 5). */
export function priceRowName(basis: SelfAddedBasis): string {
  return basis === 'per_pax' ? 'Price per guest' : basis === 'per_hour' ? 'Price per hour' : 'Price';
}

/** "120 guests" · "1 guest" · "5 hours" · "6.5 hours" · "1 hour". */
export function countWords(basis: Exclude<SelfAddedBasis, 'fixed'>, n: number): string {
  const num = Number.isInteger(n) ? n.toLocaleString('en-PH') : String(n);
  if (basis === 'per_pax') return `${num} ${n === 1 ? 'guest' : 'guests'}`;
  return `${num} ${n === 1 ? 'hour' : 'hours'}`;
}

/** "3:00 PM" in Manila (the schedule's own clock). */
export function manilaClock(iso: string): string {
  return new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit', timeZone: 'Asia/Manila' }).format(new Date(iso));
}

export const NO_TIMES_WORDS = 'No times for them on the schedule yet, so no total.';
export const NONE_COUNTED_WORDS = 'Nobody is counted for them on the guest list yet, so no total.';
export const GUESTS_UNREAD_WORDS = 'Couldn’t read your guest list just now, so no total yet.';
export const SCHEDULE_UNREAD_WORDS = 'Couldn’t read your schedule just now, so no total yet.';
export const GUEST_LIST_LINK_WORDS = 'Set who it counts on the guest list ›';
export const SET_HOURS_LINK_WORDS = 'Set their hours on the schedule ›';
export const CHANGE_HOURS_LINK_WORDS = 'Change their hours on the schedule ›';
export const COUNTED_FROM_WORDS = 'Counted on your guest list. Kids or sponsors left out lower it.';

/**
 * Under the rate row: the sum, or why there is none, and the one link to where the number is set.
 *   per guest  "× 120 guests it counts = ₱162,000" · "Counted on your guest list…" · "Set who it counts on the guest list ›"
 *   per hour   "× 5 hours on the schedule = ₱30,000" · "Arrive 3:00 PM · Done 8:00 PM" · "Change their hours on the schedule ›"
 *   no times   "No times for them on the schedule yet, so no total." · "Set their hours on the schedule ›"
 */
export function basisCalc(
  basis: Exclude<SelfAddedBasis, 'fixed'>,
  ratePhp: number | null,
  terms: PriceTermsRead,
): { calc: { count: string; tail: string; total: string | null } | null; wait: string | null; from: string | null; link: string } {
  const t = basisTotal(basis, ratePhp, terms);
  const hoursKnown = terms !== 'loading' && terms !== 'unread' && terms.hours != null;
  const link = basis === 'per_pax' ? GUEST_LIST_LINK_WORDS : hoursKnown ? CHANGE_HOURS_LINK_WORDS : SET_HOURS_LINK_WORDS;
  const tail = basis === 'per_pax' ? 'it counts' : 'on the schedule';
  const from =
    basis === 'per_pax'
      ? COUNTED_FROM_WORDS
      : terms !== 'loading' && terms !== 'unread' && terms.arriveAt && terms.doneAt && terms.hours != null
        ? `Arrive ${manilaClock(terms.arriveAt)} · Done ${manilaClock(terms.doneAt)}`
        : null;
  if (t.kind === 'total') return { calc: { count: countWords(basis, t.n), tail, total: formatPhp(t.totalPhp) }, wait: null, from, link };
  switch (t.why) {
    case 'loading':
      return { calc: null, wait: basis === 'per_pax' ? 'Counting your guest list…' : 'Reading your schedule…', from: null, link };
    case 'unread':
      return { calc: null, wait: basis === 'per_pax' ? GUESTS_UNREAD_WORDS : SCHEDULE_UNREAD_WORDS, from: null, link };
    case 'none_counted':
      return { calc: null, wait: NONE_COUNTED_WORDS, from: null, link };
    case 'no_times':
      return { calc: null, wait: NO_TIMES_WORDS, from: null, link };
    case 'no_rate': {
      // The number is known; only the rate is missing — show it, with no total yet.
      const n = terms !== 'loading' && terms !== 'unread' ? (basis === 'per_pax' ? terms.counted : (terms.hours ?? 0)) : 0;
      return { calc: { count: countWords(basis, n), tail, total: null }, wait: null, from, link };
    }
  }
}

/** The saved cards' lines, by booking id (`readSelfAddedPriceLines`). */
export type SelfAddedPriceLines = Record<string, { lead: string; showsTotal: boolean }>;

/**
 * THE SAVED CARD on Suppliers (prototype state 7): "₱1,350 per guest · 120 counted" — the card then draws its own
 * total after it ("· ₱162,000"), the SAME number it always drew (the one total, as the agreed-total roster reads it).
 * `showsTotal` is false when the number the rate multiplies is not known — no times, nobody counted, an unread
 * count — and the card then draws NO total: the line says why instead.
 */
export function selfAddedCardLine(input: {
  basis: SelfAddedBasis;
  ratePhp: number | null;
  terms: PriceTerms | 'unread';
}): { lead: string; showsTotal: boolean } | null {
  const { basis, ratePhp, terms } = input;
  if (basis === 'fixed' || ratePhp == null) return null;
  const unit = basis === 'per_pax' ? 'per guest' : 'per hour';
  const rate = `${formatPhp(ratePhp)} ${unit}`;
  if (terms === 'unread') {
    return { lead: `${rate} · couldn’t read ${basis === 'per_pax' ? 'the guest count' : 'the schedule'}`, showsTotal: false };
  }
  const t = basisTotal(basis, ratePhp, terms);
  if (t.kind === 'none') {
    return { lead: `${rate} · ${basis === 'per_pax' ? 'nobody counted yet' : 'no times on the schedule yet'}`, showsTotal: false };
  }
  const n = basis === 'per_pax' ? `${t.n.toLocaleString('en-PH')} counted` : countWords(basis, t.n);
  return { lead: `${rate} · ${n}`, showsTotal: true };
}
