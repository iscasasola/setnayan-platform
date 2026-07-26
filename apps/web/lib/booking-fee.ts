/**
 * Setnayan vendor BOOKING FEE — the pure, deterministic fee schedule.
 *
 * THE TAPER (owner-locked 2026-07-25 — CURRENT). Canonical:
 * `Vendor_Monetization_Model_LOCKED_2026-07-25.md` § 3, implemented to the exact
 * formula in `Vendor_Monetization_BUILD_PLAN_2026-07-25.md` § "EXACT fee-taper
 * spec":
 *
 *   • 5% on the FIRST ₱100,000 of the booking
 *   • 1% on the amount ABOVE ₱100,000
 *   • floor ₱50 (survives the taper) · NO cap
 *
 * Worked (the owner's own examples, all asserted in booking-fee.test.ts):
 *   ₱60,000 → ₱3,000 · ₱300,000 → ₱7,000 · ₱1M → ₱14,000 · ₱10M → ₱104,000
 *
 * WHY: a flat 5% with no cap made large bookings punitive (₱1M → ₱50,000) and
 * re-opened the large-ticket under-declaration incentive the old ₱4,000 cap had
 * been bought to close. The 1% tail softens the top instead. Deals above ~₱3–5M
 * route to Enterprise/Custom hand-pricing rather than the automatic formula.
 *
 * ⚠ The taper is a DISCOUNT, never a surcharge: continuous at ₱100,000 (₱5,000
 * either way) and monotonic, so under-declaring can never pay. Both properties
 * are asserted — in the test suite AND as a post-condition on migration
 * 20271009120000, which refuses to apply if the SQL mirror disagrees.
 *
 * SCOPE, unchanged by this reprice: the fee applies to SOURCED clients only
 * (BYO / vendor-invited / returning are free forever), a verified vendor's
 * FIRST 5 sourced bookings are free as a standing perk, and attribution is
 * stamped once at first contact and is immutable.
 *
 * HISTORY: supersedes the 2026-07-24 flat 5% / ₱50 floor / no cap, which itself
 * superseded the 2026-07-23 flat 2% / ₱50 floor / ₱4,000 cap. Charges carry the
 * `schedule_version` they were priced under, so nothing is re-priced
 * retroactively.
 *
 * ⚠ Do not treat any header comment as the source of truth for pricing — the
 * corpus is. This file previously claimed the taper was "scoped to the payment
 * session" and therefore deliberately unimplemented; that stale note cost real
 * time before it was caught.
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

/**
 * The locked fee constants (PHP). Admin-dialable later without touching callers.
 *
 * TAPER (owner-locked 2026-07-25, `Vendor_Monetization_Model_LOCKED_2026-07-25.md`
 * § 3 + `Vendor_Monetization_BUILD_PLAN_2026-07-25.md` § "EXACT fee-taper spec"):
 * **5% on the first ₱100,000, then 1% on the amount above.** Floor ₱50 survives;
 * still no cap. Supersedes the 2026-07-24 flat 5%.
 */
export const BOOKING_FEE = {
  /** Rate on the first `tier1LimitPhp` of the booking. */
  rate: 0.05,
  /** Rate on everything above `tier1LimitPhp` — the taper that softens big deals. */
  tailRate: 0.01,
  /** Where the 5% band ends and the 1% tail begins. */
  tier1LimitPhp: 100_000,
  /** Minimum fee (and floor) for any positive proposal. */
  minPhp: 50,
} as const;

/** The FIRST-BAND rate (5%). Exposed for display copy / callers. */
export const BOOKING_FEE_RATE = BOOKING_FEE.rate;

/** The tail rate (1%) applied above ₱100,000. */
export const BOOKING_FEE_TAIL_RATE = BOOKING_FEE.tailRate;

/** Where the 5% band ends (₱100,000). */
export const BOOKING_FEE_TIER1_LIMIT_PHP = BOOKING_FEE.tier1LimitPhp;

/**
 * The booking fee (PHP, to the centavo) for a finalized proposal amount in PHP.
 *
 * PURE + deterministic. **5% on the first ₱100,000, then 1% above**, floored at
 * ₱50, no upper cap. The ₱50 floor binds below ₱1,000. A non-positive /
 * non-finite amount → 0 (see the ₱0/barter note above).
 *
 * Owner's own worked examples (`..._MODEL_LOCKED_2026-07-25.md` § 3), all
 * asserted in the test suite:
 *   ₱60,000 → ₱3,000 · ₱300,000 → ₱7,000 · ₱1M → ₱14,000 · ₱10M → ₱104,000
 *
 * ⚠ The taper is a DISCOUNT on large bookings, never a surcharge: it is
 * continuous at ₱100,000 (₱5,000 either way) and monotonic, so no vendor is
 * ever better off declaring less.
 */
export function bookingFeePhp(proposalPhp: number): number {
  if (!Number.isFinite(proposalPhp) || proposalPhp <= 0) return 0;
  const tier1 = Math.min(proposalPhp, BOOKING_FEE.tier1LimitPhp);
  const tier2 = Math.max(0, proposalPhp - BOOKING_FEE.tier1LimitPhp);
  const linear = tier1 * BOOKING_FEE.rate + tier2 * BOOKING_FEE.tailRate;
  // Floor at ₱50 — no upper cap (owner 2026-07-25; the floor SURVIVES the taper).
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
