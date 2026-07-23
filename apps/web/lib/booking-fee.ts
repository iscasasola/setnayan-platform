/**
 * Setnayan vendor BOOKING FEE — the pure, deterministic fee schedule.
 *
 * Owner-directed 2026-07-23 (final): a SINGLE FLAT RATE of 2%, floored and capped.
 * Verbatim: *"the charge starts at 2500 to get 50 pesos, stays 2% until it reaches
 * 4,000 from 200,000 then locks at 4,000 even if the cost is higher."*
 *   • ₱50 MINIMUM — 2% of ₱2,500 = ₱50, so the fee bottoms out at ₱50 and any
 *     booking at or below ₱2,500 pays ₱50.
 *   • flat 2% of the finalized proposal from ₱2,500 up.
 *   • ₱4,000 CAP — 2% of ₱200,000 = ₱4,000, so the fee locks at ₱4,000 for any
 *     booking at or above ₱200,000.
 *
 * THE SCHEDULE (on the finalized proposal amount — the ONE number the customer
 * accepts):
 *   • ≤ ₱2,500            → ₱50 flat  (the minimum)
 *   • ₱2,500 – ₱200,000   → 2% of the amount, straight line
 *   • ≥ ₱200,000          → ₱4,000 flat  (the CAP, owner-locked)
 *
 * Worked: ₱10k→₱200 · ₱50k→₱1,000 · ₱100k→₱2,000 · ₱200k→₱4,000 · ₱300k→₱4,000 ·
 * ₱1M→₱4,000. Effective rate is a flat 2% across the linear span (higher below the
 * floor, lower above the cap).
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
  /** Flat rate on the proposal amount. */
  rate: 0.02,
  /** Minimum fee (and floor) for any positive proposal. */
  minPhp: 50,
  /** Hard cap — the fee never exceeds this for a single proposal. */
  capPhp: 4000,
} as const;

/** The flat rate (2%). Exposed for display copy / callers. */
export const BOOKING_FEE_RATE = BOOKING_FEE.rate;

/**
 * The booking fee (PHP, to the centavo) for a finalized proposal amount in PHP.
 *
 * PURE + deterministic. A flat 2% clamped to [₱50, ₱4,000]: the ₱50 floor binds
 * below ₱2,500, the ₱4,000 cap binds at/above ₱200,000. A non-positive /
 * non-finite amount → 0 (see the ₱0/barter note above). Rounded to the centavo.
 */
export function bookingFeePhp(proposalPhp: number): number {
  if (!Number.isFinite(proposalPhp) || proposalPhp <= 0) return 0;
  const linear = proposalPhp * BOOKING_FEE.rate;
  // Clamp to [min, cap] — the ₱50 floor and the ₱4,000 cap.
  const bounded = Math.min(Math.max(linear, BOOKING_FEE.minPhp), BOOKING_FEE.capPhp);
  return Math.round(bounded * 100) / 100; // centavo precision
}

/**
 * The effective rate (fee ÷ proposal) as a fraction, for display copy
 * ("you keep 98%"). Returns 0 for a non-positive proposal. Equals the flat 2%
 * across the linear span; higher under the floor, lower above the cap.
 */
export function bookingFeeEffectiveRate(proposalPhp: number): number {
  if (!Number.isFinite(proposalPhp) || proposalPhp <= 0) return 0;
  return bookingFeePhp(proposalPhp) / proposalPhp;
}
