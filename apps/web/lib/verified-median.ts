/**
 * Verified-Median Pricing — the pure math (no DB, no server-only import).
 *
 * THE IDEA (corpus: the biggest idea in the vendor model)
 * -------------------------------------------------------
 * A vendor's DECLARED prices from their LOCKED bookings aggregate into a MEDIAN
 * that becomes their VERIFIED market price. Setnayan then uses that median to
 * position them (a couple-facing "typical price" signal + future budget
 * matching). The mechanism is self-correcting:
 *   • under-declare → your verified price drops → you get flooded with
 *     leads whose budget you can't actually serve;
 *   • over-declare → your verified price rises → couples with real budgets
 *     screen you out and you lose leads.
 * So the honest declaration is the stable strategy.
 *
 * WHY A MEDIAN (not a mean): a median resists the single ₱1 barter lock or the
 * one gold-plated ₱2M booking dragging the signal around. It is the robust
 * centre of what this vendor actually charges.
 *
 * This module is deliberately DB-free so the money math is unit-testable in
 * isolation. The server reader (verified-median-read.ts) fetches the vendor's
 * locked prices and feeds them here. See that file for the price-source
 * decision (couple-confirmed `event_vendors.total_cost_php`).
 */

/**
 * Minimum number of qualifying locked bookings before a verified median is
 * "established". Below this we show "not yet established" and NEVER a number.
 *
 * DECISION (flagged): 3. A median of one or two points is not a market signal —
 * it's a single quote (n=1) or a coin-flip midpoint (n=2). Three is the smallest
 * count where a true middle value exists that at least one lock sits above and
 * one below, so the number can't be reverse-engineered to a single couple's
 * exact deal and can't be moved wholesale by one outlier. Mirrors the spirit of
 * the existing published-price band's min-N sample floor (price-position.ts).
 * Tune via MIN_MEDIAN_SAMPLE; owner may raise it.
 */
export const MIN_MEDIAN_SAMPLE = 3;

/** One locked-booking price fed into the median. */
export type MedianSample = {
  /** Couple-confirmed declared price in whole PHP (not centavos). */
  pricePhp: number;
  /**
   * Marked non-representative (comp / barter / ₱0 / promo / admin-excluded) so
   * it does NOT skew the market median. Excluded samples are dropped before the
   * count check, so they never count toward MIN_MEDIAN_SAMPLE either.
   */
  excluded?: boolean;
};

export type VerifiedMedianResult =
  // Enough qualifying locks → a real median the vendor can be positioned on.
  | {
      status: 'established';
      /** The verified market price (whole PHP). */
      medianPhp: number;
      /** Count of qualifying (non-excluded, positive) locks behind the median. */
      sampleN: number;
      /** Lowest qualifying lock (whole PHP) — vendor-dashboard spread only. */
      lowPhp: number;
      /** Highest qualifying lock (whole PHP) — vendor-dashboard spread only. */
      highPhp: number;
    }
  // Fewer than MIN_MEDIAN_SAMPLE qualifying locks → no number, ever.
  | { status: 'not_established'; sampleN: number };

/**
 * Pure median of a numeric list (whole PHP, rounded to an integer peso).
 * Even count → mean of the two middle values (rounded). Empty → null.
 * Exported so the math is testable without the result envelope.
 */
export function medianPhp(values: readonly number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 1) return sorted[mid] ?? null;
  const lo = sorted[mid - 1] ?? 0;
  const hi = sorted[mid] ?? 0;
  return Math.round((lo + hi) / 2);
}

/**
 * Compute a vendor's verified median from their locked-booking prices.
 *
 * Guards (both required by the spec):
 *   1. MIN COUNT — < MIN_MEDIAN_SAMPLE qualifying locks → { not_established }.
 *   2. EXCLUDABLE — samples flagged `excluded` (comp/barter/₱0/promo) are
 *      dropped up front; a non-positive or non-finite price is likewise never a
 *      market price and is dropped (so a ₱0 comp with no explicit flag still
 *      can't count).
 *
 * @param minSample override the count floor (defaults to MIN_MEDIAN_SAMPLE).
 */
export function computeVerifiedMedian(
  samples: readonly MedianSample[],
  opts?: { minSample?: number },
): VerifiedMedianResult {
  const minSample = opts?.minSample ?? MIN_MEDIAN_SAMPLE;

  const qualifying = samples
    .filter((s) => !s.excluded)
    .map((s) => s.pricePhp)
    .filter((p) => Number.isFinite(p) && p > 0);

  if (qualifying.length < minSample) {
    return { status: 'not_established', sampleN: qualifying.length };
  }

  const median = medianPhp(qualifying);
  // Unreachable given the length check above, but keeps the type honest.
  if (median == null) return { status: 'not_established', sampleN: qualifying.length };

  return {
    status: 'established',
    medianPhp: median,
    sampleN: qualifying.length,
    lowPhp: Math.min(...qualifying),
    highPhp: Math.max(...qualifying),
  };
}

/**
 * Round a verified median to a "typical price" for the PUBLIC couple-facing
 * signal, so it never reads as one couple's exact contract number. Rounds to a
 * granularity that scales with magnitude (₱100 under ₱10k, ₱500 under ₱100k,
 * ₱1,000 above). Vendor-facing surfaces show the exact median instead.
 *
 * DECISION (flagged): rounding the public figure is a privacy choice — the exact
 * median could otherwise pin down a small sample's real deal prices. Vendor sees
 * exact on their own dashboard; couples see the rounded band.
 */
export function roundToTypicalBand(php: number): number {
  if (!Number.isFinite(php) || php <= 0) return 0;
  const step = php < 10_000 ? 100 : php < 100_000 ? 500 : 1_000;
  return Math.round(php / step) * step;
}

/** ₱-format a whole-peso figure (no centavos) for either surface. */
export function formatMedianPhp(php: number): string {
  return `₱${Math.round(php).toLocaleString('en-PH', { maximumFractionDigits: 0 })}`;
}
