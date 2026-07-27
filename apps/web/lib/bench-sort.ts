/**
 * bench-sort.ts — reason-labeled sort for the couple Shortlist bench (2026-07-09).
 *
 * The bench orders each category's considered vendors by one of three lenses,
 * and every card carries a one-line "why it's here" pill so the re-order
 * explains itself (owner (d): "follow and filter and sort"). Pure + framework-
 * free (no React) so it's unit-testable and reusable by the two-column workspace
 * (PR-4).
 *
 * ── 2026-07-27 · "Best fit" now calls the REAL scorer (Explore_Replan §13.4/§14)
 * The original `fitScore` was three BINARY flags (reach + budgetFit + dateFit),
 * so a category had only four possible scores — most cards tied and the
 * tie-breaks decided, i.e. "Best fit" quietly degenerated into "sort by rating".
 * Worse, it scored `reachesVenue === true ? 1 : 0`, so an UNKNOWN reach LOST a
 * point — and FREE-tier vendors carry `serviceRadiusKm: 0`, which makes reach
 * permanently unknown for them. Every free-tier vendor, and every vendor without
 * geocoded coordinates, was ranked down on every bench forever, however close
 * they were. The badge deliberately fails OPEN ("never a false out-of-range");
 * the sort failed CLOSED. That is the defect this rewrite removes.
 *
 * The fix is NOT a new scorer. `lib/compat-score.ts` already ships a
 * seven-dimension weighted composite built to
 * `Customer_Vendor_Marketplace_Architecture_2026-06-04.md §2` — continuous
 * distance decay scaled by the vendor's own travel radius, Bayesian-adjusted
 * reviews, and NEUTRAL (0.6, never 0) for every missing input. The bench simply
 * never called it. Now it does.
 */

import type { ShortlistVendor } from '@/lib/shortlist-taxonomy';
import {
  compatSubScores,
  computeCompatScore,
  topCompatDimension,
  type CompatDimension,
  type CompatInputs,
} from '@/lib/compat-score';

export type BenchSort = 'fit' | 'price' | 'rating';

export const BENCH_SORTS: { key: BenchSort; label: string }[] = [
  { key: 'fit', label: 'Best fit' },
  { key: 'price', label: 'Lowest price' },
  { key: 'rating', label: 'Top rated' },
];

/** A per-card reason pill. `ok` reads positive (accent), `soft` is a quiet
 *  neutral qualifier (e.g. a rating readout). */
export type SortReason = { label: string; tone: 'ok' | 'soft' };

/**
 * Project a bench card onto the composite scorer's inputs. ONE mapping, shared
 * by the ranking and the reason pill, so the order and its explanation can never
 * disagree.
 *
 * What is deliberately NOT passed:
 * - `songOverlapRatio` / `preferenceMatchRatio` (refinement) — the bench card has
 *   no style/song signal, and §14.3 is explicit that this change uses what the
 *   page already computes rather than adding a query. Omitted → NEUTRAL.
 * - `boosted` — the scorer documents this as `ad_rank > 0` (paid placement).
 *   `isSetnayan` is a DIFFERENT fact (a first-party Setnayan SKU); feeding it in
 *   here would silently float Setnayan's own services above real vendors inside
 *   a lens labeled "Best fit". §14.4-6 flags that as an owner decision, so the
 *   bench leaves it unset until it is one.
 * - `respondsFast` / `boostWeight` — First-Look Window inputs the bench does not
 *   resolve; the default 0 makes the blend a no-op.
 *
 * `reachesVenue` is not passed either, and that is the whole point: `distanceKm`
 * + `travelRadiusKm` say the same thing continuously, and say nothing at all
 * (NEUTRAL) when unknown — instead of docking a point.
 */
export function benchCompatInputs(v: ShortlistVendor): CompatInputs {
  return {
    distanceKm: v.distanceKm,
    travelRadiusKm: v.serviceRadiusKm,
    avgRating: v.rating,
    reviewCount: v.reviewCount,
    verified: v.isVerified,
    budgetFitRatio: v.budgetFitRatio,
    // Only the positive case is carried — a non-match must read as "unknown",
    // never as a penalty (the gate already guaranteed compatibility).
    faithMatch: v.faithMatch === true ? true : undefined,
    // The one date signal the bench has: free on the committed date = full
    // headroom, booked = none, no signal = null → NEUTRAL.
    dateHeadroomRatio: v.dateFit === 'free' ? 1 : v.dateFit === 'booked' ? 0 : null,
    // Same-date INQUIRY count (never a save count), already floored upstream.
    // Weight 0 in the global vector, so this is inert outside the lens that
    // asks for it.
    demandCoupleCount: v.demandCoupleCount,
  };
}

/** The bench card's 0–100 composite fit, straight from `computeCompatScore`.
 *  Never rendered as a number — it only orders the rail (§14.4-3). */
export function benchFitScore(v: ShortlistVendor): number {
  return computeCompatScore(benchCompatInputs(v)).score;
}

/** Couple-facing wording per dimension. `lead` is the superlative form and is
 *  used only when this vendor genuinely holds the best sub-score in its category
 *  for that dimension — otherwise the plain form, so a card can never claim to
 *  be the closest or the most-reviewed when it isn't. */
const DIMENSION_COPY: Record<CompatDimension, { lead: string; plain: string }> = {
  distance: { lead: 'Closest to your venue', plain: 'Near your venue' },
  reviews: { lead: 'Most reviewed', plain: 'Well reviewed' },
  budgetFit: { lead: 'Fits your budget', plain: 'Fits your budget' },
  dateHeadroom: { lead: 'Free on your date', plain: 'Free on your date' },
  refinement: { lead: 'Matches your style', plain: 'Matches your style' },
  faithFit: { lead: 'Fits your ceremony', plain: 'Fits your ceremony' },
  trust: { lead: 'Verified', plain: 'Verified' },
  // Demand is the one dimension whose honest pill is a MEASUREMENT, not an
  // adjective — the number is the whole claim. `dimensionCopyFor` overrides
  // these with "N couples inquired for your date"; this static pair is the
  // count-less fallback and is deliberately free of any scarcity verb ("only N
  // left" / "booking fast" / "almost gone" are all forbidden — no capacity
  // counter exists to back them).
  demandPressure: {
    lead: 'Most inquired for your date',
    plain: 'Others inquired for your date',
  },
};

/**
 * Resolve a dimension's pill copy for ONE card. Identical to `DIMENSION_COPY`
 * except where the honest phrasing needs a value off the card itself.
 *
 * `demandPressure` is such a case: "3 couples inquired for your date" states
 * exactly what was measured, where "in demand" would be an interpretation. The
 * count is guaranteed to be at or above `MIN_DEMAND_COUPLE_COUNT` — the server
 * never serialises a smaller one and `demandSub` would not have lifted above
 * NEUTRAL for it, so this dimension could not have won.
 */
function dimensionCopyFor(
  dim: CompatDimension,
  v: ShortlistVendor,
): { lead: string; plain: string } {
  if (dim === 'demandPressure' && v.demandCoupleCount != null) {
    const phrase = `${v.demandCoupleCount} couples inquired for your date`;
    return { lead: phrase, plain: phrase };
  }
  // `budgetFit` is scored off the service's "starts at", not a quote (see
  // `vendorBudgetFitRatio`). When that is the basis, the pill MUST carry the
  // same `est.` qualifier the budget fit-badge already renders — an estimate
  // must never read as a firm number. `budgetEstimated` is the shipped source
  // of truth for that (shortlist-taxonomy.ts); reuse it, never re-derive it.
  //
  // Note also what this pill deliberately does NOT say. `priceFitScore`
  // returns a FLAT 1.0 for every vendor at or under budget — a ₱30k and an
  // ₱89k photographer tie exactly — so it ranks distance from OVER-budget, not
  // value. "Best value" / "cheapest" / "most for your money" are therefore
  // unbackable and forbidden (§15.4).
  if (dim === 'budgetFit' && v.budgetEstimated) {
    return { lead: 'Fits your budget · est.', plain: 'Fits your budget · est.' };
  }
  return DIMENSION_COPY[dim];
}

/**
 * Sort a category's vendors by the active lens and attach a per-card reason.
 * Returns a NEW array (never mutates the input). The reason explains the card's
 * position under the current lens — the sort leader gets the headline label,
 * the rest get an honest qualifier or nothing (calm by default).
 *
 * Under the fit lens the pill names the dimension actually carrying that card's
 * score. It NEVER renders a bare number or % — a weighted composite is a black
 * box unless the card says why (§14.4-3) — and it renders NOTHING when every
 * input is unknown, rather than inventing a reason we cannot back.
 */
export function sortWithReasons(
  vendors: ShortlistVendor[],
  mode: BenchSort,
): { v: ShortlistVendor; reason: SortReason | null }[] {
  const arr = [...vendors];

  if (mode === 'price') {
    arr.sort((a, b) => (a.totalCostPhp ?? Infinity) - (b.totalCostPhp ?? Infinity));
    return arr.map((v, i) => ({
      v,
      reason:
        i === 0 && v.totalCostPhp != null
          ? ({ label: 'Lowest price', tone: 'ok' } as SortReason)
          : null,
    }));
  }

  if (mode === 'rating') {
    arr.sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0));
    return arr.map((v, i) => ({
      v,
      reason:
        i === 0 && v.rating != null
          ? ({ label: 'Top rated', tone: 'ok' } as SortReason)
          : v.rating != null
            ? ({ label: `${v.rating.toFixed(1)}★`, tone: 'soft' } as SortReason)
            : null,
    }));
  }

  // ── Fit lens · the composite. Score + explain each card ONCE (not once per
  // comparison), then sort on the cached score.
  const scored = new Map<
    ShortlistVendor,
    { score: number; dim: CompatDimension | null; subs: Record<CompatDimension, number> }
  >();
  for (const v of arr) {
    const inputs = benchCompatInputs(v);
    scored.set(v, {
      score: computeCompatScore(inputs).score,
      dim: topCompatDimension(inputs),
      subs: compatSubScores(inputs),
    });
  }
  arr.sort(
    (a, b) =>
      (scored.get(b)?.score ?? 0) - (scored.get(a)?.score ?? 0) ||
      (b.rating ?? 0) - (a.rating ?? 0) ||
      (a.totalCostPhp ?? Infinity) - (b.totalCostPhp ?? Infinity),
  );

  // Best sub-score per dimension across THIS category, so a superlative pill
  // ("Closest to your venue") is earned rather than assumed.
  const bestByDim = new Map<CompatDimension, number>();
  for (const v of arr) {
    const s = scored.get(v);
    if (!s?.dim) continue;
    const sub = s.subs[s.dim];
    const prev = bestByDim.get(s.dim);
    if (prev == null || sub > prev) bestByDim.set(s.dim, sub);
  }

  return arr.map((v, i) => {
    const s = scored.get(v);
    const dim = s?.dim ?? null;
    // No dimension rose above neutral → we have nothing honest to say. Render
    // no pill rather than a manufactured reason.
    if (!s || !dim) return { v, reason: null };
    const copy = dimensionCopyFor(dim, v);
    const isBestOnDim = bestByDim.get(dim) === s.subs[dim];
    return {
      v,
      reason: {
        label: isBestOnDim ? copy.lead : copy.plain,
        tone: i === 0 ? 'ok' : 'soft',
      } as SortReason,
    };
  });
}
