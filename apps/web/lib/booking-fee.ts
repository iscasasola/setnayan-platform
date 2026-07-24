/**
 * Setnayan vendor BOOKING FEE — the pure, deterministic fee schedule.
 *
 * Owner-directed 2026-07-24 (final): a SINGLE FLAT RATE of 5%, floored at ₱50,
 * with NO cap. Supersedes the 2026-07-23 "flat 2%, ₱50 floor, ₱4,000 cap" schedule
 * (the ₱4,000 cap is REMOVED and the rate is raised 2% → 5%). The owner was flagged
 * that a flat 5% with no cap makes large bookings expensive (₱1M → ₱50,000) and
 * re-opens the large-ticket under-declaration incentive the old cap was bought to
 * close; the cap-less 5% was chosen deliberately with that trade accepted. The
 * couple-confirmation + verified-median enforcement layers hold the declared value
 * honest.
 *   • ₱50 MINIMUM — 5% of ₱1,000 = ₱50, so the fee bottoms out at ₱50 and any
 *     booking at or below ₱1,000 pays ₱50.
 *   • flat 5% of the finalized proposal from ₱1,000 up, UNBOUNDED (no cap).
 *
 * THE SCHEDULE (on the finalized proposal amount — the ONE number the customer
 * accepts):
 *   • ≤ ₱1,000   → ₱50 flat  (the minimum)
 *   • ≥ ₱1,000   → 5% of the amount, straight line, no upper bound
 *
 * Worked: ₱10k→₱500 · ₱50k→₱2,500 · ₱100k→₱5,000 · ₱200k→₱10,000 · ₱1M→₱50,000.
 * Effective rate is a flat 5% at and above the floor (higher below ₱1,000).
 *
 * This is the "Rule 1" deterministic core — no LLM, no I/O — that every downstream
 * surface (the prepaid send-gate, the charge ledger, and the Papic documentation
 * points) computes from. SAFE to ship ahead of the rest of the fee system: it is a
 * value → value function with no dependencies.
 *
 * ⚠ NOT the whole fee SYSTEM, and it deliberately does NOT decide the ₱0/barter
 * case (#4 — the schedule has a ₱50 floor but no ₱0 rule; a non-positive amount
 * returns 0, no consideration → no fee).
 */

/** The locked fee constants (PHP). Admin-dialable later without touching callers. */
export const BOOKING_FEE = {
  /** Flat rate on the proposal amount. */
  rate: 0.05,
  /** Minimum fee (and floor) for any positive proposal. */
  minPhp: 50,
} as const;

/** The flat rate (5%). Exposed for display copy / callers. */
export const BOOKING_FEE_RATE = BOOKING_FEE.rate;

/**
 * The booking fee (PHP, to the centavo) for a finalized proposal amount in PHP.
 *
 * PURE + deterministic. A flat 5% floored at ₱50: the ₱50 floor binds below
 * ₱1,000, and there is NO upper cap. A non-positive / non-finite amount → 0 (see
 * the ₱0/barter note above). Rounded to the centavo.
 */
export function bookingFeePhp(proposalPhp: number): number {
  if (!Number.isFinite(proposalPhp) || proposalPhp <= 0) return 0;
  const linear = proposalPhp * BOOKING_FEE.rate;
  // Floor at ₱50 — no upper cap (owner 2026-07-24).
  const bounded = Math.max(linear, BOOKING_FEE.minPhp);
  return Math.round(bounded * 100) / 100; // centavo precision
}

/**
 * The effective rate (fee ÷ proposal) as a fraction, for display copy
 * ("you keep 95%"). Returns 0 for a non-positive proposal. Equals the flat 5%
 * at and above the floor; higher below ₱1,000.
 */
export function bookingFeeEffectiveRate(proposalPhp: number): number {
  if (!Number.isFinite(proposalPhp) || proposalPhp <= 0) return 0;
  return bookingFeePhp(proposalPhp) / proposalPhp;
}
