/**
 * Custom-tier quote math (owner-signed rate card · VENDOR_TIERS_AND_BENEFITS.md
 * §11). PURE + deterministic — no DB, no I/O. The per-unit prices are passed in
 * (read from the admin-managed vendor_billing_catalog by the caller), never
 * hardcoded here, so a price edit at /admin/pricing flows through without a code
 * change. `computeCustomQuote` returns every intermediate so the UI + the
 * admin quote surface can show the breakdown.
 *
 * RATE CARD (per 28-day cycle · prices are the ARGUMENT, these are the shape):
 *   - base:            everything in Enterprise + white-glove · main address +
 *                      100 km reach + 10 seats + 8 slots/category + 300 photos.
 *   - branch:          +price per ADDITIONAL branch (2nd onward).
 *   - reach:           +reachStep per +100 km (steps to 500 km) OR reachNationwide
 *                      flat (nationwide replaces the per-step reach entirely).
 *   - seats:           +seat per EXTRA team seat (beyond the base 10).
 *   - slots:           +slot per +1 event slot / category (beyond the base 8).
 *   - photos:          +photoPack per +100 portfolio photos (beyond the base 300).
 *   - tokens:          +includedToken each per cycle (flat face value).
 *   - domain:          +domain flat if a custom domain is included.
 *
 * CHARM: round UP to the next ‑99 (…x99). Floor at base (a plan can never quote
 * below the base fee). Annual = charm(final28 × 10) — a subscription year is 13
 * cycles billed for 10 (first 3 free).
 *
 * DISCOUNT (per org · optional): amount (₱ off) OR rate (% off) applied to the
 * charm-rounded LIST price, then RE-charm-rounded. Annual = 10 × the discounted
 * 28-day price (owner rule — annual re-derives from the discounted cycle).
 */

/** Composition knobs — mirrors vendor_custom_plans.composition. */
export interface CustomComposition {
  /** TOTAL branches the vendor operates (main + additional). 1 = main only. */
  branches: number;
  /** Reach in km (base 100). Ignored when `nationwide` is true. */
  reachKm: number;
  /** Nationwide reach — a flat add-on that replaces the per-step reach ladder. */
  nationwide: boolean;
  /** TOTAL team seats (base 10 included). */
  seats: number;
  /** TOTAL event slots per category (base 8 included). */
  slotsPerCategory: number;
  /** TOTAL portfolio photos (base 300 included). */
  photos: number;
  /** Included tokens granted per cycle (flat face value each). */
  tokensPerCycle: number;
  /** Custom domain included. */
  domain: boolean;
}

/** Per-unit prices (PHP), read from the admin-managed catalog by the caller. */
export interface CustomUnitPrices {
  /** Base 28-day fee. */
  base: number;
  /** Per additional branch (2nd onward). */
  branch: number;
  /** Per +100 km reach step. */
  reachStep: number;
  /** Flat nationwide-reach add-on. */
  reachNationwide: number;
  /** Per extra team seat (beyond base 10). */
  seat: number;
  /** Per +1 event slot / category (beyond base 8). */
  slot: number;
  /** Per +100 portfolio photos (beyond base 300). */
  photoPack: number;
  /** Per included token / cycle (flat face value). */
  includedToken: number;
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
  /** Annual price = charm(final28 × 10). */
  annual: number;
}

/** Included baselines (owner rate card). Excess above these is what's billed. */
export const CUSTOM_BASE = Object.freeze({
  reachKm: 100,
  seats: 10,
  slotsPerCategory: 8,
  photos: 300,
  /** Per-step reach caps at 500 km (4 steps of +100). Nationwide is separate. */
  reachMaxKm: 500,
});

/**
 * Charm-round UP to the next ‑99 ending (…x99). Examples (owner-signed edges):
 *   16997 → 16999 · 16999 → 16999 · 17000 → 17099.
 * A value already ending in ‑99 is unchanged; anything else rounds up to the
 * next hundred minus one. Non-finite / non-positive inputs pass through as 0.
 */
export function charmRoundUp(n: number): number {
  if (!Number.isFinite(n) || n <= 0) return 0;
  return Math.ceil((n + 1) / 100) * 100 - 1;
}

/** Count of billable +100 km reach steps above the 100 km base (capped 500 km). */
function reachSteps(reachKm: number): number {
  const clamped = Math.min(Math.max(reachKm, CUSTOM_BASE.reachKm), CUSTOM_BASE.reachMaxKm);
  return Math.max(0, Math.round((clamped - CUSTOM_BASE.reachKm) / 100));
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
  const reach = c.nationwide
    ? p.reachNationwide
    : reachSteps(c.reachKm) * p.reachStep;
  const extraSeats = excess(c.seats, CUSTOM_BASE.seats);
  const extraSlots = excess(c.slotsPerCategory, CUSTOM_BASE.slotsPerCategory);
  const photoPacks = Math.ceil(excess(c.photos, CUSTOM_BASE.photos) / 100);
  const tokens = Number.isFinite(c.tokensPerCycle) ? Math.max(0, Math.floor(c.tokensPerCycle)) : 0;

  const raw =
    p.base +
    additionalBranches * p.branch +
    reach +
    extraSeats * p.seat +
    extraSlots * p.slot +
    photoPacks * p.photoPack +
    tokens * p.includedToken +
    (c.domain ? p.domain : 0);

  // List price: charm-round, floored at base (a plan never quotes below base).
  const list28 = Math.max(charmRoundUp(raw), p.base);

  // Discount: apply to the charm-rounded list, re-charm-round, floor at base.
  let final28 = list28;
  if (discount && discount.value > 0) {
    const discounted =
      discount.type === 'percent'
        ? list28 * (1 - discount.value / 100)
        : list28 - discount.value;
    final28 = Math.max(charmRoundUp(discounted), p.base);
  }

  const discountValue = list28 - final28;

  // Annual: charm(final28 × 10) — 13 cycles billed for 10.
  const annual = charmRoundUp(final28 * 10);

  return { raw, list28, discountValue, final28, annual };
}
