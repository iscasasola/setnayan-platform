/**
 * Setnayan vendor BOOKING FEE — the pure, deterministic fee schedule.
 *
 * Owner-locked 2026-07-21 (DECISION_LOG rows 2488/2491; canonical mechanism in
 * corpus `3D_Plan_and_Vendor_Revenue_Model_2026-07-20.md`, build brief
 * `Booking_Fee_Build_Plan_2026-07-21.md`). This is the "Rule 1" deterministic
 * core — no LLM, no I/O, no rounding surprises — that every downstream surface
 * (the prepaid send-gate, the charge ledger, and the Papic documentation points)
 * computes from. It is SAFE to ship ahead of the rest of the fee system because
 * it is a value → value function with no dependencies.
 *
 * THE SCHEDULE — marginal, tax-style brackets on the finalized proposal amount
 * (the ONE number the customer accepts), continuous at every boundary so there is
 * no cliff to shave:
 *   • first ₱2,500          → ₱50 flat  (a floor; = 2% of ₱2,500)
 *   • ₱2,500  – ₱50,000     → 2.0% of the excess
 *   • ₱50,000 – ₱150,000    → 1.5% of the excess
 *   • ₱150,000 – ₱300,000   → 1.0% of the excess
 *   • above ₱300,000        → ₱4,000 flat  (the CAP, owner-locked "until 4k/vendor")
 * Effective rate only ever FALLS (2.00% → 0.40%); the vendor keeps ≥98%.
 *
 * Worked (from the model doc): ₱10k→₱200 · ₱50k→₱1,000 · ₱80k→₱1,450 ·
 * ₱150k→₱2,500 · ₱300k→₱4,000 · ₱1M→₱4,000.
 *
 * ⚠ NOT the whole fee SYSTEM. Two things this file deliberately does NOT decide,
 * because they are OPEN owner sign-offs, not math:
 *   1. The ₱4,000 CAP UNIT (#3c-unit) — per-booking vs per-vendor×event vs
 *      per-vendor-lifetime. That is a LEDGER concern (how many times the cap
 *      binds across bookings), not this per-proposal computation. This function
 *      caps a SINGLE proposal at ₱4,000; the ledger decides aggregation.
 *   2. The ₱0 / barter case (#4) — the schedule has a ₱50 floor but no ₱0 rule.
 *      Until the owner rules, a non-positive amount returns 0 (no consideration,
 *      no fee) rather than billing ₱50 on nothing.
 */

/** The locked fee constants (PHP). Admin-dialable later without touching callers. */
export const BOOKING_FEE = {
  /** Flat fee (and floor) for a proposal up to the first-bracket ceiling. */
  floorPhp: 50,
  /** Hard cap — the fee never exceeds this for a single proposal. */
  capPhp: 4000,
  /** Bracket ceilings (PHP) and the MARGINAL rate applied within each. */
  brackets: [
    { upTo: 2_500, rate: 0 }, // covered by the flat floor
    { upTo: 50_000, rate: 0.02 },
    { upTo: 150_000, rate: 0.015 },
    { upTo: 300_000, rate: 0.01 },
  ] as const,
  /** Above this proposal amount the cap binds. */
  capAbovePhp: 300_000,
} as const;

/**
 * The booking fee (PHP, to the centavo) for a finalized proposal amount in PHP.
 *
 * PURE + deterministic. A non-positive / non-finite amount → 0 (see the ₱0/barter
 * note above). Result is rounded to 2 decimals (centavos) and capped at ₱4,000.
 */
export function bookingFeePhp(proposalPhp: number): number {
  if (!Number.isFinite(proposalPhp) || proposalPhp <= 0) return 0;
  if (proposalPhp <= BOOKING_FEE.brackets[0].upTo) return BOOKING_FEE.floorPhp;

  // Flat floor for the first bracket, then the marginal rate on each slice above.
  let fee = BOOKING_FEE.floorPhp;
  let lower = BOOKING_FEE.brackets[0].upTo; // ₱2,500
  for (let i = 1; i < BOOKING_FEE.brackets.length; i++) {
    const { upTo, rate } = BOOKING_FEE.brackets[i];
    if (proposalPhp <= lower) break;
    const sliceTop = Math.min(proposalPhp, upTo);
    fee += (sliceTop - lower) * rate;
    lower = upTo;
    if (proposalPhp <= upTo) break;
  }

  const rounded = Math.round(fee * 100) / 100; // centavo precision
  return Math.min(rounded, BOOKING_FEE.capPhp);
}

/**
 * The effective rate (fee ÷ proposal) as a fraction, for display copy
 * ("you keep 98%"). Returns 0 for a non-positive proposal.
 */
export function bookingFeeEffectiveRate(proposalPhp: number): number {
  if (!Number.isFinite(proposalPhp) || proposalPhp <= 0) return 0;
  return bookingFeePhp(proposalPhp) / proposalPhp;
}
