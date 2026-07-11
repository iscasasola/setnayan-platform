/**
 * lib/smart-sort — the PROGRESSIVE constraint math for the couple's vendor
 * search (behind NEXT_PUBLIC_SMART_SORT_ENABLED · lib/smart-sort-flag).
 *
 * Pure + deterministic (no I/O) so it is unit-testable and the SERVER stays the
 * authority on every number. Three signals, one per constraint the couple firms
 * up as they plan:
 *
 *   1. paxAdjustedStartsAtPhp — the vendor's "starts at" for the couple's LIVE
 *      pax. For a per-pax service the displayed floor is per-head × headcount
 *      (or the tiered base + added-block model), so it SHARPENS as guests
 *      confirm. Non-pax services return their flat starts-at unchanged.
 *   2. priceFitScore — a SOFT [0,1] score of how well that starts-at fits the
 *      couple's REMAINING budget for the category. Never a filter by itself;
 *      it re-ranks toward affordability and shrinks as the couple spends.
 *   3. availabilityDisposition / budgetDisposition — how a strict toggle turns a
 *      soft signal into a hard filter ONLY when the couple asks for it, plus the
 *      "raise your budget?" pressure flag.
 *
 * Money is PHP integers end-to-end (matches vendor_services.*_php).
 */

/** How a vendor_services row is priced. Mirrors vendor_services.pricing_basis. */
export type ServicePricingBasis = 'fixed' | 'per_pax' | 'per_hour';

/** The pricing-relevant subset of a vendor_services row (all PHP integers). */
export type ServicePricingRow = {
  pricing_basis?: string | null;
  starting_price_php?: number | null;
  per_pax_price_php?: number | null;
  base_pax?: number | null;
  added_pax_block?: number | null;
  added_pax_price_php?: number | null;
  min_pax?: number | null;
  hour_base_php?: number | null;
  extra_hour_php?: number | null;
  min_hours?: number | null;
};

/** Coerce anything to a finite non-negative integer (0 fallback). */
function nn(v: unknown): number {
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) && n > 0 ? Math.round(n) : 0;
}

export type StartsAt = {
  /** The pax-adjusted "starts at" in PHP, or null when the vendor set no price. */
  startsAtPhp: number | null;
  /** True when the figure moved with pax (a per-pax service + a known pax). */
  paxDriven: boolean;
};

/**
 * The vendor's "starts at" for THIS couple — pax-adaptive for pax-oriented
 * services. `livePax` should be the couple's live headcount (lib/pax
 * resolveLivePax), NOT the static estimated_pax, so the figure sharpens as
 * guests confirm. Returns null startsAtPhp when the vendor published no usable
 * price (so callers can fall back to today's price-less behaviour).
 */
export function paxAdjustedStartsAtPhp(
  svc: ServicePricingRow | null | undefined,
  livePax: number | null | undefined,
): StartsAt {
  if (!svc) return { startsAtPhp: null, paxDriven: false };
  const basis = (svc.pricing_basis ?? 'fixed') as ServicePricingBasis;
  const flat = nn(svc.starting_price_php);
  const pax = livePax != null && Number.isFinite(livePax) ? Math.max(0, Math.round(livePax)) : null;

  if (basis === 'per_pax') {
    // Bill at least the vendor's floor (min_pax / base_pax), and use the
    // couple's live pax when known — else the vendor's own floor, so a per-pax
    // service always shows a real "from" number.
    const floor = Math.max(nn(svc.min_pax), nn(svc.base_pax), 1);
    const billable = Math.max(pax ?? floor, floor);

    // Tiered model (starting_price_php covers base_pax, then added blocks).
    const basePax = nn(svc.base_pax);
    const block = nn(svc.added_pax_block);
    const blockPrice = nn(svc.added_pax_price_php);
    if (flat > 0 && basePax > 0 && block > 0 && blockPrice > 0) {
      const over = Math.max(0, billable - basePax);
      const blocks = Math.ceil(over / block);
      return { startsAtPhp: flat + blocks * blockPrice, paxDriven: pax != null };
    }
    // Straight per-head model.
    const perHead = nn(svc.per_pax_price_php);
    if (perHead > 0) {
      return { startsAtPhp: perHead * billable, paxDriven: pax != null };
    }
    // Per-pax basis but only a flat figure published → treat it as the floor.
    return { startsAtPhp: flat > 0 ? flat : null, paxDriven: false };
  }

  if (basis === 'per_hour') {
    // No coverage-hours in a category search → the hourly base is the floor.
    const base = nn(svc.hour_base_php);
    const v = base > 0 ? base : flat;
    return { startsAtPhp: v > 0 ? v : null, paxDriven: false };
  }

  // fixed / unknown.
  return { startsAtPhp: flat > 0 ? flat : null, paxDriven: false };
}

/**
 * Reduce a set of the vendor's services to ONE displayed "starts at" — the
 * cheapest usable per-couple floor across the vendor's services in the searched
 * category. Null when none published a price.
 */
export function cheapestStartsAt(
  services: (ServicePricingRow | null | undefined)[],
  livePax: number | null | undefined,
): StartsAt {
  let best: number | null = null;
  let paxDriven = false;
  for (const s of services) {
    const r = paxAdjustedStartsAtPhp(s, livePax);
    if (r.startsAtPhp == null) continue;
    if (best == null || r.startsAtPhp < best) {
      best = r.startsAtPhp;
      paxDriven = r.paxDriven;
    }
  }
  return { startsAtPhp: best, paxDriven };
}

/**
 * SOFT budget fit in [0,1]. 1 = comfortably within the remaining budget; decays
 * smoothly as the starts-at exceeds it; NEUTRAL (0.5) when we can't judge (no
 * budget set, or the vendor published no price) so a missing signal never
 * penalises. Never a filter — this only re-ranks. As the couple spends and
 * `remainingPhp` shrinks, the same vendor scores lower, so the sort tightens
 * toward affordability on every lock.
 */
export const PRICE_FIT_NEUTRAL = 0.5;

export function priceFitScore(
  startsAtPhp: number | null | undefined,
  remainingPhp: number | null | undefined,
): number {
  if (startsAtPhp == null || remainingPhp == null || !Number.isFinite(remainingPhp)) {
    return PRICE_FIT_NEUTRAL;
  }
  if (remainingPhp <= 0) {
    // Nothing left in the pot → any priced vendor is a stretch, but softly.
    return startsAtPhp <= 0 ? 1 : 0.15;
  }
  if (startsAtPhp <= remainingPhp) return 1;
  // Over budget: half-life decay in units of the remaining budget. At 1× over
  // → 0.5, 2× over → 0.25, etc. Always > 0 so it re-ranks rather than removes.
  const overRatio = (startsAtPhp - remainingPhp) / remainingPhp;
  return Math.max(0.05, Math.pow(0.5, overRatio));
}

export type BudgetMode = 'soft' | 'strict';
export type AvailabilityMode = 'soft' | 'strict';

/**
 * Whether a vendor should be HARD-FILTERED for budget. Only true in strict mode
 * (the couple explicitly asked to cap) AND when we actually know both numbers
 * and the starts-at exceeds the remaining budget. Soft mode never filters.
 */
export function isBudgetFiltered(
  mode: BudgetMode,
  startsAtPhp: number | null | undefined,
  remainingPhp: number | null | undefined,
): boolean {
  if (mode !== 'strict') return false;
  if (startsAtPhp == null || remainingPhp == null || !Number.isFinite(remainingPhp)) return false;
  return startsAtPhp > remainingPhp;
}

/**
 * Whether an unavailable-on-date vendor should be HARD-FILTERED. Only in strict
 * availability mode; soft mode down-ranks (handled by the caller) but keeps them.
 * `available` is the caller's per-vendor service-calendar check for the date
 * (TRUE when free / unknown → fail-open).
 */
export function isAvailabilityFiltered(mode: AvailabilityMode, available: boolean): boolean {
  return mode === 'strict' && available === false;
}

/**
 * "Raise your budget?" pressure — TRUE when the couple has a remaining budget
 * but the best (cheapest) real options in the category all sit above it, so a
 * soft re-rank alone can't help. Drives the overlay nudge to lift the budget.
 * `topStartsAt` = the cheapest starts-at figures among the shown vendors.
 */
export function budgetPressure(
  topStartsAt: (number | null | undefined)[],
  remainingPhp: number | null | undefined,
): boolean {
  if (remainingPhp == null || !Number.isFinite(remainingPhp) || remainingPhp <= 0) return false;
  const priced = topStartsAt.filter(
    (p): p is number => p != null && Number.isFinite(p) && p > 0,
  );
  if (priced.length === 0) return false;
  // Every priced option is above what's left → the budget, not the sort, is the
  // blocker. (Uses the cheapest, so one affordable vendor clears the pressure.)
  return Math.min(...priced) > remainingPhp;
}
