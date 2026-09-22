/**
 * commission-promise.ts — the ONE place Setnayan says "0% commission".
 *
 * ── THE OWNER'S RULING ─────────────────────────────────────────────────────
 * 2026-08-06, recorded in `/pricing`'s own source: *"No commission on vendor
 * bookings" is CORRECT and stays — the couple pays the vendor directly and
 * Setnayan never touches that money. But this page ALSO sells vendor plans…
 * The fee is charged to the VENDOR for the introduction and the in-app sync;
 * it is not a cut of the couple↔vendor deal, so **both sentences are true at
 * once — but only if the second one is actually said.***
 *
 * Re-confirmed by the owner 2026-09-22: **0% commission stays; propagate the
 * /pricing wording everywhere.**
 *
 * ── WHAT WAS WRONG ─────────────────────────────────────────────────────────
 * The claim appears across ~50 files. `/pricing` said both sentences;
 * `vendor-grow-sections` said both and gated them on the billing flag. Almost
 * everything else said only the first — and three SUPPLIER pages
 * (`vendor-grow-hero`, `vendor-tier-matrix`, `vendor/claim/[token]`) still
 * promised **"0% commission while we launch"** with no gate at all, while
 * production has already charged and collected **₱837.50**.
 *
 * 🔑 A COUPLE-FACING "0% commission" NEEDS NO SECOND SENTENCE. It is true
 * without qualification: a couple pays no commission and never will. The
 * second sentence is owed wherever a SUPPLIER reads the claim, because for
 * them the whole truth includes a bill. That distinction is the ruling, and it
 * is why this module exports two different things rather than one.
 *
 * 🔑 EVERY NUMBER IS DERIVED. `bookingFeeScheduleSummary()` and
 * `FREE_BOOKING_LIMIT` are the same sources the actual bill uses, and the
 * launch-period wording is gated on `isBookingFeeEnabled()` — the very flag
 * that decides whether anyone is billed. A hand-edited sentence is exactly what
 * went stale here, twice.
 */
import { bookingFeeScheduleSummary } from '@/lib/booking-fee';
import { FREE_BOOKING_LIMIT } from '@/lib/booking-fee-lock';
import { isBookingFeeEnabled } from '@/lib/booking-fee-gate';

/**
 * The promise as a COUPLE reads it. True unqualified, and deliberately carries
 * no fee sentence: a couple is not billed and never will be, so adding one
 * would raise a question they do not have.
 */
export const COUPLE_COMMISSION_PROMISE =
  'No commission on your bookings — you pay your suppliers directly, and Setnayan never sits between you at checkout.';

/**
 * The promise as a SUPPLIER reads it: both sentences, always together.
 *
 * ⚠ NEVER RENDER THE FIRST HALF OF THIS ALONE on a supplier surface. That is
 * the defect this module exists to remove, and `one-commission-promise.test.ts`
 * fails if a supplier-facing file names commission without naming the fee.
 */
export function supplierCommissionPromise(): string {
  const base =
    'No commission on your bookings — couples pay you directly and we never sit between you at checkout.';
  if (!isBookingFeeEnabled()) {
    // The fee is switched off: there is no bill to disclose, and inventing one
    // would be its own kind of untrue. Said plainly rather than left silent.
    return `${base} Setnayan charges no booking fee while it is switched off.`;
  }
  return (
    `${base} Setnayan bills you a booking fee of ${bookingFeeScheduleSummary()}, ` +
    `only on the couples we introduce — your first ${FREE_BOOKING_LIMIT} are free, ` +
    'and your own clients stay free. It is charged to you, never added to what a couple pays.'
  );
}

/**
 * The short form, for a perk list or a matrix cell where a paragraph does not
 * fit. Still both halves — shorter, not partial.
 */
export function supplierCommissionShort(): string {
  if (!isBookingFeeEnabled()) return '0% commission — no booking fee while it is switched off';
  return `0% commission · booking fee ${bookingFeeScheduleSummary()}, only on couples we introduce`;
}

/**
 * 🛑 THE PHRASE THAT MAY NEVER RETURN.
 *
 * "0% commission while we launch" was false on 2026-09-20 — the owner drove a
 * real booking as Saysay and was billed ₱837.50 — and it was still on three
 * supplier pages on 2026-09-22. A launch period that has already ended cannot
 * be promised by any wording, gated or not, so the guard bans the SHAPE rather
 * than the sentence: no supplier surface may tie the zero to a time window.
 */
export const BANNED_LAUNCH_WINDOW_SHAPE = /commission[^.<>{}]{0,40}\b(while we launch|at launch|during launch|launch period)\b/i;
