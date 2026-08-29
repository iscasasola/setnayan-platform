/**
 * Custom-tier quote math (owner-signed rate card · VENDOR_TIERS_AND_BENEFITS.md
 * §11). PURE + deterministic — no DB, no I/O. The per-unit prices are passed in
 * (read from the admin-managed vendor_billing_catalog by the caller), never
 * hardcoded here, so a price edit at /admin/pricing flows through without a code
 * change. `computeCustomQuote` returns every intermediate so the UI + the
 * admin quote surface can show the breakdown.
 *
 * RATE CARD (per 28-day cycle · prices are the ARGUMENT, these are the shape):
 *   - base:            everything in Enterprise WITH ITS LIMITS REMOVED · main
 *                      address + 100 km reach + 10 seats + 8 slots/category +
 *                      300 photos. ⚖ NOT "white-glove": the owner ruled on
 *                      2026-08-27 that Custom is a CAPABILITY upgrade, not
 *                      human attention — no account manager, no review, no
 *                      concierge. None of those was ever built.
 *   - branch:          +price per ADDITIONAL branch (2nd onward).
 *   - reach:           reachNationwide, flat. THE ONLY REACH UPGRADE (owner
 *                      2026-08-27). The old +₱499-per-100km ladder is gone.
 *   - seats:           +seat per EXTRA team seat (beyond the base 10).
 *   - slots:           +slot per +1 event slot / category (beyond the base 8).
 *   - domain:          +domain flat if a custom domain is included.
 *
 * CHARM: round UP to the next ‑99 (…x99). Floor at base (a plan can never quote
 * below the base fee). Annual = final28 × 10.4 — a 20% saving on the 28-day
 * rate, the SAME multiplier Solo/Pro/Enterprise use since the 2026-08-27 price
 * sheet. ⚠ It was × 10 ("13 cycles, pay 10, 3 free") until the owner aligned it
 * on 2026-08-27; that phrasing is now FALSE and must not come back — 13 cycles
 * at 10.4 is 2.6 free, not 3.
 *
 * DISCOUNT (per org · optional): amount (₱ off) OR rate (% off) applied to the
 * charm-rounded LIST price, then RE-charm-rounded. Annual = 10 × the discounted
 * 28-day price (owner rule — annual re-derives from the discounted cycle).
 */

/** Composition knobs — mirrors vendor_custom_plans.composition. */
export interface CustomComposition {
  /** TOTAL branches the vendor operates (main + additional). 1 = main only. */
  branches: number;
  /**
   * Reach in km. NO LONGER PURCHASABLE — the +100 km step was dropped
   * 2026-08-27 and nationwide is the only reach upgrade, so this never differs
   * from the base except on a hand-negotiated plan an admin records directly.
   *
   * KEPT rather than deleted because it is a stored CAPABILITY, not a price:
   * `vendorEffectiveCaps` reads it to compute a Custom plan's serviceRadiusKm.
   * `computeCustomQuote` no longer reads it at all, so it cannot cost anybody
   * anything; if it is ever made settable again it needs a price first.
   */
  reachKm: number;
  /** Nationwide reach — a flat add-on that replaces the per-step reach ladder. */
  nationwide: boolean;
  /**
   * NO LIMIT on how many customers this shop may be chasing for ONE date —
   * a flat add-on that removes the per-tier pipeline ceiling entirely.
   *
   * Owner 2026-08-29, asked what "past 10" should cost: **"2500 for no limit."**
   * Enterprise and Custom both cap at 10 live candidates per date
   * (`vendor_tier_limit`); a shop that buys this has no cap at all.
   *
   * ⛔ SCOPE, deliberately narrow: this is the CHASING ceiling — accepted-but-
   * not-yet-locked customers on one date. It does NOT touch the BOOKED-OUT
   * WAITLIST (queued couples on a date already taken, capped at 5 for
   * Enterprise/Custom). Two different lists that share the word "limit"; the
   * owner was asked about the 10, answered about the 10, and widening the other
   * one would also mean widening a CHECK constraint on
   * vendor_profiles.max_waitlist_acceptances. Named, not assumed.
   *
   * Optional so pre-existing composition rows read as "not granted"
   * (fail-closed), exactly like `api_access`.
   */
  pipelineUnlimited?: boolean;
  /** TOTAL team seats (base 10 included). */
  seats: number;
  /** TOTAL event slots per category (base 8 included). */
  slotsPerCategory: number;
  /**
   * TOTAL portfolio photos. NO LONGER PURCHASABLE — the +100-photo pack was
   * dropped 2026-08-27. Kept for the same reason as `reachKm`: a stored
   * capability that `vendorEffectiveCaps` reads, priced by nothing.
   */
  photos: number;
  /** Custom domain included. */
  domain: boolean;
  /**
   * API access granted (Enterprise-vendor SDK). An ENTITLEMENT toggle, not a
   * numeric ceiling — the admin ticks it while composing the Custom plan when an
   * enterprise vendor requests API integration (owner 2026-07-11: "available if
   * custom plan of enterprise requests allowing api"). Optional so pre-existing
   * composition rows read as "not granted" (fail-closed). NOT priced in
   * `computeCustomQuote` today — it rides in the negotiated Custom quote; attach
   * a per-cycle price later by adding it to the rate card if the owner wants it
   * itemised. The API gate (lib/enterprise-vendor-gate.ts) reads this flag.
   */
  api_access?: boolean;
}

/** Per-unit prices (PHP), read from the admin-managed catalog by the caller. */
export interface CustomUnitPrices {
  /** Base 28-day fee. */
  base: number;
  /** Per additional branch (2nd onward). */
  branch: number;
  /** Flat nationwide-reach add-on — the ONLY reach upgrade (owner 2026-08-27). */
  reachNationwide: number;
  /** Flat "no limit on customers chased per date" add-on (owner 2026-08-29). */
  pipelineUnlimited: number;
  /** Per extra team seat (beyond base 10). */
  seat: number;
  /** Per +1 event slot / category (beyond base 8). */
  slot: number;
  /** Flat custom-domain add-on. */
  domain: number;
}

export type CustomDiscount =
  | { type: 'amount'; value: number }
  | { type: 'percent'; value: number };

export interface CustomQuote {
  /** Un-rounded sum of base + all add-ons. */
  raw: number;
  /** Charm-rounded list price (before discount), floored at base. */
  list28: number;
  /** ₱ subtracted by the discount (0 when no discount). = list28 − final28. */
  discountValue: number;
  /** Charm-rounded 28-day price after discount, floored at base. */
  final28: number;
  /** Annual price = final28 × 10.4 (20% off the 28-day rate). */
  annual: number;
}

/** Included baselines (owner rate card). Excess above these is what's billed. */
export const CUSTOM_BASE = Object.freeze({
  reachKm: 100,
  seats: 10,
  slotsPerCategory: 8,
  photos: 300,
});

/**
 * Charm-round UP to the next ‑99 ending (…x99). Examples (owner-signed edges):
 *   16997 → 16999 · 16999 → 16999 · 17000 → 17099.
 * A value already ending in ‑99 is unchanged; anything else rounds up to the
 * next hundred minus one. Non-finite / non-positive inputs pass through as 0.
 *
 * ⛔ NOTHING APPLIES THIS TO A CUSTOM QUOTE ANY MORE — owner 2026-08-27.
 * `computeCustomQuote` used to run it over the list price, the discounted price
 * AND the annual, which quietly put a ‑99 back on every total. He had just
 * rounded five prices to whole numbers precisely to get clean figures, so the
 * bump was undoing the rounding before it ever reached a buyer. A Custom plan
 * now quotes exactly what its dials add up to.
 *
 * ⚖ THE FUNCTION IS KEPT ON PURPOSE, not overlooked. He ruled on CUSTOM QUOTE
 * TOTALS, not on charm pricing as a platform-wide mechanism — the same day's
 * DECISION_LOG row records that charm pricing is explicitly NOT retired, and
 * `SETNAYAN_AI` still sells at ₱2,499. This is the tested, documented encoding
 * of that convention, with zero call sites today. Deleting it is a separate
 * call; wiring it back onto Custom totals needs a new ruling.
 */
export function charmRoundUp(n: number): number {
  if (!Number.isFinite(n) || n <= 0) return 0;
  return Math.ceil((n + 1) / 100) * 100 - 1;
}

/**
 * The two terms a subscription may be bought for, and nothing else.
 * Owner 2026-08-27: *"subscription will only extend their plans for an
 * additional 28 days … or 1 year."*
 */
export type CustomPlanTerm = '28d' | 'annual';

/** Days a term buys. 365 for a year — NOT 13 × 28 (= 364); see the annual note. */
export const CUSTOM_TERM_DAYS: Readonly<Record<CustomPlanTerm, number>> = {
  '28d': 28,
  annual: 365,
};

/**
 * The annual multiplier — a 20% saving on the 28-day rate, the same one
 * Solo/Pro/Enterprise took in the 2026-08-27 price sheet.
 */
export const CUSTOM_ANNUAL_MULTIPLIER = 10.4;

/**
 * The annual price for a 28-day total. THE ONLY PLACE ×10.4 IS APPLIED.
 *
 * ⛔ THE ANNUAL FIGURE IS DERIVED, NEVER STORED. `vendor_custom_plans` holds
 * `quoted_28d_php` and nothing else, on purpose: a stored annual would be a
 * second copy of a price, which is the drift this codebase spent 2026-08-27
 * closing everywhere else. The quote, the order amount and the activation
 * binding all call THIS function, so they cannot disagree.
 *
 * Rounds to whole pesos: an undiscounted total is a multiple of 250 and lands
 * exact on its own, but a discounted total × 10.4 can leave a fraction. This is
 * not the retired charm bump — it never adds 99, and an exact peso is unchanged.
 */
export function annualFromMonthly(php28: number): number {
  const n = Number(php28);
  if (!Number.isFinite(n) || n <= 0) return 0;
  return Math.round(n * CUSTOM_ANNUAL_MULTIPLIER);
}

/**
 * What a term costs, given the 28-day total. The one switch every caller uses,
 * so no path can invent its own arithmetic.
 */
export function priceForTerm(php28: number, term: CustomPlanTerm): number {
  return term === 'annual' ? annualFromMonthly(php28) : php28;
}

/**
 * When a Custom plan should expire after a purchase of `term` is activated.
 *
 * 🔑 IT EXTENDS. Remaining time is kept and the new term is added ON TOP —
 * `GREATEST(now, existing) + termDays` — mirroring, deliberately and exactly,
 * what `_apply_subscription_credit` does in SQL for the three ordinary tiers.
 * Owner 2026-08-27: *"subscription will only extend their plans for an
 * additional 28 days … or 1 year."*
 *
 * 🚨 THE BUG THIS REPLACES: the Custom activation hook used to write
 * `now + 28 days` straight over `tier_expires_at`, discarding whatever was
 * left. A shop with 300 days remaining who renewed came out with 28. It went
 * unnoticed because the SQL path already had the GREATEST — and Custom does not
 * use the SQL path.
 *
 * An already-lapsed plan (expiry in the past, or none) starts from `nowMs`,
 * which is the same `GREATEST(now(), …)` behaviour.
 *
 * PURE — takes its clock, returns an ISO string, so the extend property is
 * unit-testable without a database.
 */
export function customPlanExpiryFrom(
  nowMs: number,
  existingExpiryMs: number | null,
  term: CustomPlanTerm,
): string {
  const base =
    existingExpiryMs !== null && Number.isFinite(existingExpiryMs) && existingExpiryMs > nowMs
      ? existingExpiryMs
      : nowMs;
  return new Date(base + CUSTOM_TERM_DAYS[term] * 24 * 60 * 60 * 1000).toISOString();
}

/** Non-negative excess of `total` over an included `base`, integer-floored. */
function excess(total: number, base: number): number {
  const t = Number.isFinite(total) ? Math.floor(total) : base;
  return Math.max(0, t - base);
}

/**
 * Compute the full Custom-tier quote from a composition + the (catalog-read)
 * unit prices, with an optional per-org discount. Pure — safe to unit-test and
 * to call from both the vendor composer and the admin quote surface.
 */
export function computeCustomQuote(
  composition: CustomComposition,
  unitPrices: CustomUnitPrices,
  discount?: CustomDiscount | null,
): CustomQuote {
  const c = composition;
  const p = unitPrices;

  const additionalBranches = excess(c.branches, 1); // main branch is included
  // Reach is now BINARY: the included base, or nationwide. There is no priced
  // middle any more, so `c.reachKm` no longer contributes to the total — see
  // CustomComposition.reachKm for why the field itself survives.
  const reach = c.nationwide ? p.reachNationwide : 0;
  const extraSeats = excess(c.seats, CUSTOM_BASE.seats);
  const extraSlots = excess(c.slotsPerCategory, CUSTOM_BASE.slotsPerCategory);

  const raw =
    p.base +
    additionalBranches * p.branch +
    reach +
    extraSeats * p.seat +
    extraSlots * p.slot +
    (c.domain ? p.domain : 0) +
    // No limit on customers chased per date (owner 2026-08-29: "2500 for no
    // limit"). Flat, like nationwide reach — `=== true` rather than truthy so a
    // composition row predating the axis reads as NOT granted rather than as
    // undefined-and-therefore-free.
    (c.pipelineUnlimited === true ? p.pipelineUnlimited : 0);

  // List price: exactly what the dials add up to, floored at base.
  //
  // 🔑 THAT `Math.max` WAS DOING TWO JOBS AND ONLY ONE OF THEM LEFT. It rounded
  // AND it floored. The charm bump is gone (owner 2026-08-27); the floor STAYS,
  // because a composition below every baseline must still quote the base fee
  // rather than something under it.
  const list28 = Math.max(raw, p.base);

  // Discount: applied to the list, floored at base. No re-rounding either — the
  // same bump on the way out would have re-dirtied a discounted total.
  let final28 = list28;
  if (discount && discount.value > 0) {
    const discounted =
      discount.type === 'percent'
        ? list28 * (1 - discount.value / 100)
        : list28 - discount.value;
    // A percentage can land on a fraction of a peso. Round to whole pesos —
    // that is what "whole numbers" means for a figure somebody is quoted, and
    // it is NOT the charm bump: it never adds 99, and an exact peso is
    // unchanged.
    final28 = Math.max(Math.round(discounted), p.base);
  }

  const discountValue = list28 - final28;

  // Annual: final28 × 10.4 — a 20% saving, matching every other tier since the
  // 2026-08-27 price sheet (owner aligned Custom to it the same day).
  //
  // 🔑 THE ROUNDING HERE IS NOT THE CHARM BUMP COMING BACK. Every undiscounted
  // total is a multiple of 250, and 250 × 10.4 = 2,600, so those land on exact
  // pesos on their own. A DISCOUNTED total is an arbitrary integer, and × 10.4
  // can leave a fraction of a peso (e.g. 13,501 → 140,410.4). `Math.round`
  // settles that to whole pesos — it never adds 99, and an already-exact figure
  // passes through untouched.
  const annual = annualFromMonthly(final28);

  return { raw, list28, discountValue, final28, annual };
}
