/**
 * "YOUR CREDIT IS ABOUT TO EXPIRE" — the rule, the window and the words.
 * Pure, no I/O, so it is testable with no request context and no database.
 *
 * ⚖ OWNER RULING 2026-08-28: a shop is told before its carried credit is taken,
 * *"before the money goes"*.
 *
 * ── WHY THIS IS NOT PART OF THE EXPIRY ─────────────────────────────────────
 * 🔑 THE SENTENCE THAT DECIDES THE WHOLE DESIGN. Credit expires inside
 * `sweep_vendor_tier_expiry`, which is LOGIN-DRIVEN: it runs when that shop's
 * own dashboard loads. So the visit that takes the money is the FIRST visit
 * after the term ended, and a notice emitted from there would arrive in the
 * same page load as the loss. A warning that arrives with the thing it warns
 * about is a caption, not a warning.
 *
 * The warning therefore has to be decided while `tier_expires_at` is still in
 * the FUTURE, by something other than that shop's own visit.
 */

/**
 * How long before the term ends the warning goes out.
 *
 * Seven days rather than one: the shop has to have time to DO something — a
 * 28-day plan is bought and paid for by hand in this product, with a reference
 * code and a bank transfer, and a day's notice cannot be acted on over a
 * weekend. Longer than this and it stops reading as urgent.
 */
export const CREDIT_WARNING_WINDOW_DAYS = 7;

/** Below this the balance is not worth interrupting somebody about. */
export const CREDIT_WARNING_MIN_PHP = 1;

export type CreditWarningCandidate = {
  vendorProfileId: string;
  ownerUserId: string | null;
  businessName: string | null;
  creditPhp: number;
  /** When the current term runs out. Null means nothing is scheduled to end. */
  tierExpiresAt: string | null;
};

/**
 * Whether a shop should be warned right now.
 *
 * ⚠ THE UPPER BOUND IS AS LOAD-BEARING AS THE LOWER ONE. A term that has
 * ALREADY passed is deliberately NOT warned: at that point the money is gone at
 * the shop's next visit no matter what we send, and a message saying "about to"
 * would be false. The honest handling of an already-lapsed term is the ledger
 * row the expiry itself writes, which is a different message and not this one.
 */
export function shouldWarnAboutCredit(
  candidate: CreditWarningCandidate,
  nowMs: number,
): boolean {
  if (!candidate.ownerUserId) return false;
  if (!Number.isFinite(candidate.creditPhp) || candidate.creditPhp < CREDIT_WARNING_MIN_PHP) {
    return false;
  }
  if (!candidate.tierExpiresAt) return false;

  const expiresMs = Date.parse(candidate.tierExpiresAt);
  /*
    An unparseable date must never be read as "expires now" — a false alarm
    about somebody's money is its own harm.

    ⚠ HONEST NOTE: this line is DOCUMENTATION, not the mechanism. `Date.parse`
    yields NaN and every comparison with NaN is false, so the window arithmetic
    below already refuses a malformed date; a mutation run gutting this line
    stayed green. It is kept so the intent survives an edit to that arithmetic —
    but do not mistake it for the thing doing the work, and do not write a test
    that claims to guard it.
  */
  if (!Number.isFinite(expiresMs)) return false;

  const windowMs = CREDIT_WARNING_WINDOW_DAYS * 24 * 60 * 60 * 1000;
  return expiresMs > nowMs && expiresMs - nowMs <= windowMs;
}

/**
 * The idempotency key — what makes this "once per term" rather than "once".
 *
 * 🔑 THE TERM'S OWN END DATE IS IN THE KEY, AND THAT IS THE WHOLE TRICK. A key
 * that were merely per-shop would warn a shop once in its life: renew, drift
 * toward a second lapse, and the second one arrives in silence. Keying on the
 * expiry instant means a renewed term is a NEW key, so the next term warns
 * again — and a re-run inside the same term matches the existing notification
 * and sends nothing.
 */
export function creditWarningKey(vendorProfileId: string, tierExpiresAt: string): string {
  return `/vendor-dashboard/subscription?credit-expiring=${encodeURIComponent(tierExpiresAt)}&shop=${vendorProfileId}`;
}

/** Whole pesos, the way every other money string in this product is written. */
function peso(n: number): string {
  return `₱${Math.round(n).toLocaleString('en-PH')}`;
}

/**
 * The words. Plain, specific, and they name the amount and the date — a warning
 * that says "some credit" and "soon" cannot be acted on.
 */
export function creditWarningCopy(input: {
  creditPhp: number;
  tierExpiresAt: string;
  timeZone?: string;
}): { title: string; body: string } {
  const when = new Date(input.tierExpiresAt).toLocaleDateString('en-PH', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    // The venue-time rule: a date rendered in the server's clock can print the
    // day before for anyone west of it. Manila is this product's wall clock.
    timeZone: input.timeZone ?? 'Asia/Manila',
  });

  return {
    title: `${peso(input.creditPhp)} of your credit expires on ${when}`,
    body:
      `Your plan ends on ${when}. The ${peso(input.creditPhp)} credit on your shop goes with it — ` +
      `renew before then and you keep it.`,
  };
}
