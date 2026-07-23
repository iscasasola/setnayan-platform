/**
 * Setnayan vendor BOOKING FEE — the pure, deterministic fee schedule.
 *
 * Owner-directed 2026-07-23: a SINGLE LINEAR RATE (superseding the marginal
 * tax-style brackets of 2026-07-21). Two owner anchors define the whole curve:
 *   • the fee is a straight-line proportion of the finalized proposal amount, and
 *   • it LOCKS at ₱4,000 once the proposal reaches ₱300,000 ("if the cost reaches
 *     300k, the price becomes locked 4000 regardless of the amount they declare").
 * Those two fix the rate exactly: ₱4,000 ÷ ₱300,000 = **1.3333%** (not 2% — a flat
 * 2% would hit the ₱4,000 cap at ₱200k, not ₱300k). A ₱50 minimum ("starts with
 * 50 pesos") is the floor for the smallest bookings.
 *
 * THE SCHEDULE (on the finalized proposal amount — the ONE number the customer
 * accepts):
 *   • below ~₱3,750     → ₱50 flat  (the minimum; = 1.3333% of ₱3,750)
 *   • ~₱3,750 – ₱300,000 → 1.3333% of the amount, straight line
 *   • at / above ₱300,000 → ₱4,000 flat  (the CAP, owner-locked)
 *
 * Worked: ₱10k→₱133.33 · ₱50k→₱666.67 · ₱75k→₱1,000 · ₱150k→₱2,000 ·
 * ₱225k→₱3,000 · ₱300k→₱4,000 · ₱1M→₱4,000. Effective rate is a flat 1.3333%
 * across the linear span (higher below the floor, lower above the cap).
 *
 * This is the "Rule 1" deterministic core — no LLM, no I/O — that every downstream
 * surface (the prepaid send-gate, the charge ledger, and the Papic documentation
 * points) computes from. SAFE to ship ahead of the rest of the fee system: it is a
 * value → value function with no dependencies.
 *
 * ⚠ NOT the whole fee SYSTEM, and it deliberately does NOT decide the ₱0/barter
 * case (#4 — the schedule has a ₱50 floor but no ₱0 rule; a non-positive amount
 * returns 0, no consideration → no fee). The ₱4,000 cap UNIT is per-vendor×event
 * (owner 2026-07-23) — a LEDGER concern (how many times the cap binds across
 * bookings), enforced there, not in this per-proposal computation.
 */

/** The locked fee constants (PHP). Admin-dialable later without touching callers. */
export const BOOKING_FEE = {
  /** Minimum fee (and floor) for any positive proposal. */
  minPhp: 50,
  /** Hard cap — the fee never exceeds this for a single proposal. */
  capPhp: 4000,
  /** The proposal amount at which the fee reaches (and locks at) the cap. */
  capAtPhp: 300_000,
} as const;

/** The linear rate implied by the cap anchor: ₱4,000 ÷ ₱300,000 = 0.0133… */
export const BOOKING_FEE_RATE = BOOKING_FEE.capPhp / BOOKING_FEE.capAtPhp;

/**
 * The booking fee (PHP, to the centavo) for a finalized proposal amount in PHP.
 *
 * PURE + deterministic. A single linear rate up to the ₱300,000 cap point, then
 * flat ₱4,000; floored at ₱50. A non-positive / non-finite amount → 0 (see the
 * ₱0/barter note above). Result is rounded to 2 decimals (centavos).
 */
export function bookingFeePhp(proposalPhp: number): number {
  if (!Number.isFinite(proposalPhp) || proposalPhp <= 0) return 0;
  // Linear proportion, computed from the anchors (avoids rounding the rate).
  const linear = (proposalPhp * BOOKING_FEE.capPhp) / BOOKING_FEE.capAtPhp;
  // Clamp to [min, cap] — the ₱50 floor and the ₱4,000 cap.
  const bounded = Math.min(Math.max(linear, BOOKING_FEE.minPhp), BOOKING_FEE.capPhp);
  return Math.round(bounded * 100) / 100; // centavo precision
}

/**
 * The effective rate (fee ÷ proposal) as a fraction, for display copy
 * ("you keep 98.7%"). Returns 0 for a non-positive proposal. Equals the flat
 * 1.3333% across the linear span; higher under the floor, lower above the cap.
 */
export function bookingFeeEffectiveRate(proposalPhp: number): number {
  if (!Number.isFinite(proposalPhp) || proposalPhp <= 0) return 0;
  return bookingFeePhp(proposalPhp) / proposalPhp;
}
