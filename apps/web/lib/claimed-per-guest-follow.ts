/**
 * 👥🧾 AFTER THE CLAIM, A PER-GUEST PRICE FOLLOWS THE GUEST LIST — the TS mirror of
 * `public.quote_follow_claimed_per_guest` (migration 20271343652941), and the one line the couple reads.
 *
 * DECISION_LOG 2026-11-13 "AFTER THE CLAIM, THE SUPPLIER'S PRICE FOLLOWS THE GUEST LIST" (owner: "Yes, follow it" —
 * billed = max(count, minimum)) · 2026-11-12 "WHEN A GUEST IS REMOVED, THE PRICE FALLS BACK — UNLESS THE SUPPLIER
 * LOCKED IT" · 2026-11-12 "A LOCKED QUOTATION STILL FOLLOWS THE GUEST LIST".
 *
 * Every figure is the booking's own: the total the couple agreed (T) for the guests agreed (G). The rate is T ÷ G and
 * G is the minimum. Nothing here is typed, guessed or read from a service card.
 *
 *   unlocked → billed = max(count, G)                 — up and down, never under the guests agreed
 *   locked   → billed = max(count, G, billed now)     — rises, never falls
 *   total    = T × billed ÷ G, to the centavo          — at billed = G it is exactly T again
 *   paid     → the agreed total now (total + accepted change lines) never goes under what is paid
 */
import { formatCount } from './format-number';

export type ClaimedPerGuestFacts = {
  /** The total agreed, ₱ (the anchor). */
  agreedTotalPhp: number;
  /** The guests agreed (the anchor and the minimum). */
  agreedGuests: number;
  /** What it bills now (G when it never followed). */
  billedNow: number;
  /** The booking's total now, ₱. */
  totalNowPhp: number;
  /** The per-service count on the guest list (`quote_guest_count`). */
  count: number;
  /** Booked (contracted · deposit_paid) or the supplier agreed to the lock. */
  locked: boolean;
  /** Payments logged and not refused, ₱. */
  paidPhp: number;
  /** Accepted change lines, ₱ (signed). */
  changesPhp: number;
};

/** T × billed ÷ G in whole centavos (SQL `round(T * billed / G, 2)`), as ₱. */
export function perGuestTotal(agreedTotalPhp: number, agreedGuests: number, billed: number): number {
  return Math.round((Math.round(agreedTotalPhp * 100) * billed) / agreedGuests) / 100;
}

/** The new billed count and total, or null when the price stays (sideways, or a drop with nothing unsettled). */
export function followClaimedPerGuest(f: ClaimedPerGuestFacts): { billed: number; totalPhp: number } | null {
  const g = f.agreedGuests;
  if (!(g > 0) || !(f.agreedTotalPhp > 0)) return null;
  let billed = Math.max(f.count, g, f.locked ? f.billedNow : 0);
  let total = perGuestTotal(f.agreedTotalPhp, g, billed);
  if (total < f.totalNowPhp) {
    while (total + f.changesPhp < f.paidPhp && billed < f.billedNow) {
      billed += 1;
      total = perGuestTotal(f.agreedTotalPhp, g, billed);
    }
    if (total + f.changesPhp < f.paidPhp) return null;
  }
  if (total === f.totalNowPhp) return null;
  return { billed, totalPhp: total };
}

/** What a claimed per-guest card knows about its follow (`event_vendor_guest_follow`; no row = never moved). */
export type GuestFollow = { agreedGuests: number; billedGuests: number };

/**
 * THE ONE LINE under the price, on the bench card and in the workspace — why the total is what it is.
 *   "Follows your guest list · 130 guests counted, 120 agreed"
 *   "Follows your guest list · never below the 120 guests agreed"
 * Null when a count is not a real number (never "0 guests").
 */
export function guestFollowLine(f: GuestFollow | null | undefined): string | null {
  if (!f || !(f.agreedGuests > 0) || !(f.billedGuests > 0)) return null;
  if (f.billedGuests > f.agreedGuests) {
    return `Follows your guest list · ${formatCount(f.billedGuests)} guests counted, ${formatCount(f.agreedGuests)} agreed`;
  }
  return `Follows your guest list · never below the ${formatCount(f.agreedGuests)} guests agreed`;
}

/**
 * A follow row read back is only trusted while it still describes the booking: the same guests agreed. Otherwise the
 * booking was re-agreed since and the card says only what the booking says (billed = agreed).
 */
export function followFromRows(
  agreedGuestsOnBooking: number | null,
  row: { agreed_guests: number | null; billed_guests: number | null } | null | undefined,
): GuestFollow | null {
  const g = Number(agreedGuestsOnBooking);
  if (!Number.isFinite(g) || g <= 0) return null;
  const billed = Number(row?.billed_guests);
  if (row && Number(row.agreed_guests) === g && Number.isFinite(billed) && billed > 0) return { agreedGuests: g, billedGuests: billed };
  return { agreedGuests: g, billedGuests: g };
}
