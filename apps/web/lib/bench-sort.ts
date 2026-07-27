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
 *
 * ── 2026-07-27 · RANKING LENSES (Explore_Replan §15) — flag-dark
 * The segmented control now carries TWO KINDS of chip. "Best matches" and
 * "Nearest to your venue" are LENSES: the same scorer, different weight
 * vectors from `lib/ranking-lenses.ts`, each card explaining itself. "Lowest
 * price" and "Top rated" stay PLAIN SORTS in their own group — a user job, not
 * a recommendation. Still no second scorer and still no bespoke comparator:
 * a lens is a weight vector, nothing more.
 *
 * While the flag is OFF the bench renders `BENCH_SORTS` exactly as before and
 * `'fit'` resolves to `COMPAT_WEIGHTS`, so the order is unchanged.
 */

import type { ShortlistVendor } from '@/lib/shortlist-taxonomy';
import {
  compatSubScores,
  computeCompatScore,
  topCompatDimension,
  type CompatDimension,
  type CompatInputs,
  type CompatWeights,
} from '@/lib/compat-score';
import { isLensKey, lensWeights, LENSES, LENS_ORDER, type LensKey } from '@/lib/ranking-lenses';

export type BenchSort = LensKey | 'price' | 'rating';

/**
 * The pre-lens segmented control, kept EXACTLY as it shipped. This is what the
 * bench renders while `NEXT_PUBLIC_EXPLORE_REPLAN_ENABLED` is OFF, so flag-off
 * production is byte-identical — same three chips, same labels, same order.
 */
export const BENCH_SORTS: { key: BenchSort; label: string }[] = [
  { key: 'fit', label: 'Best fit' },
  { key: 'price', label: 'Lowest price' },
  { key: 'rating', label: 'Top rated' },
];

/**
 * ── LENSES vs PLAIN SORTS (Explore_Replan §15.0) ──────────────────────────
 * These are two different kinds of control and the bench renders them as two
 * visually separate groups, not one row of four.
 *
 * A LENS is a recommendation: the same composite scorer under a different
 * weight vector, and every card carries a reason pill saying which dimension
 * earned its place.
 *
 * A PLAIN SORT is a user JOB — "just show me the cheapest" — with no scorer,
 * no weights and no recommendation implied. They are deliberately NOT modelled
 * as weight vectors: `priceFitScore` returns a flat 1.0 for every vendor inside
 * the budget, so a "cheapest" weight vector is arithmetically impossible, and a
 * lens that ties its whole field would be a label pretending to be a ranking.
 */
export const BENCH_LENSES: { key: LensKey; label: string }[] = LENS_ORDER.map((k) => ({
  key: k,
  label: LENSES[k].label,
}));

export const BENCH_PLAIN_SORTS: { key: 'price' | 'rating'; label: string }[] = [
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
 *
 * ⚠ `travelRadiusKm` — a DELIBERATE divergence from `category-search.ts`.
 * That call site omits the radius, so `DEFAULT_RADIUS_KM = 25` applies to
 * everyone and distance scoring is tier-blind. The build spec's §15.1 asks the
 * bench to match it. It does NOT: the owner ruled 2026-07-27 that a bigger tier
 * means wider reach, so the vendor's own tier radius keeps scaling the decay
 * here — a Pro vendor who pays to travel 50 km is not treated as if they only
 * travel 25. The owner ruling supersedes §15.1. If that position is ever
 * reversed, drop this one line and the two surfaces converge.
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
 *  Never rendered as a number — it only orders the rail (§14.4-3).
 *  `weights` defaults to the "Best matches" vector; pass a lens vector to score
 *  the same card under a different lens. */
export function benchFitScore(v: ShortlistVendor, weights?: CompatWeights): number {
  return computeCompatScore(benchCompatInputs(v), weights).score;
}

/**
 * Distance as the couple reads it. One decimal under 10 km (the difference
 * between 2.4 and 7.1 is a real logistics difference), whole km above it (the
 * difference between 41 and 41.3 is noise). Pure + exported for the unit test.
 */
export function formatDistanceKm(km: number): string {
  return km < 10 ? `${km.toFixed(1)} km` : `${Math.round(km)} km`;
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

  // ── A LENS · the composite under this lens's weight vector. Score + explain
  // each card ONCE (not once per comparison), then sort on the cached score.
  // `'fit'` resolves to COMPAT_WEIGHTS, so the default lens is unchanged.
  const weights = lensWeights(isLensKey(mode) ? mode : 'fit');
  const scored = new Map<
    ShortlistVendor,
    { score: number; dim: CompatDimension | null; subs: Record<CompatDimension, number> }
  >();
  for (const v of arr) {
    const inputs = benchCompatInputs(v);
    scored.set(v, {
      score: computeCompatScore(inputs, weights).score,
      // Weight-aware, so the pill names the dimension carrying the card UNDER
      // THIS LENS. Still measured as lift above NEUTRAL, never `weight × sub`:
      // under the naive form an all-unknown vendor always "wins" on refinement
      // and every card would falsely claim "Matches your style".
      dim: topCompatDimension(inputs, weights),
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
    // Under "Nearest to your venue" a non-leader states the MEASURED number
    // instead of the vague "Near your venue" — §15.4 permits a measured
    // distance and forbids turning the tier radius into a reach claim, and a
    // number is the whole point of the lens. The category leader keeps the
    // superlative, which it has genuinely earned on this dimension.
    const measured =
      mode === 'near' && dim === 'distance' && v.distanceKm != null
        ? `${formatDistanceKm(v.distanceKm)} from your venue`
        : null;
    return {
      v,
      reason: {
        label: isBestOnDim ? copy.lead : (measured ?? copy.plain),
        tone: i === 0 ? 'ok' : 'soft',
      } as SortReason,
    };
  });
}
