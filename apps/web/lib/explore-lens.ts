/**
 * explore-lens.ts — the marketplace grid orders by the RANKING LENSES the owner
 * approved on 2026-07-27, instead of by reviews and rating alone.
 *
 * Owner 2026-08-29, asked whether the public marketplace should use them:
 * ***"use the lenses."***
 *
 * ── THERE IS STILL EXACTLY ONE SCORER ───────────────────────────────────────
 * `lib/compat-score.ts`. A lens is a named weight vector handed to it
 * (`lib/ranking-lenses.ts`), and this module is a **projection**, not a second
 * scorer: it maps what the explore grid already knows about a shop onto
 * `CompatInputs`, exactly as `benchCompatInputs` does for the couple's own
 * shortlist. Two projections of one scorer is the shape §15.0 allows; two
 * scorers is the one it forbids.
 *
 * ── WHY EXPLORE IS NOT THE BENCH ────────────────────────────────────────────
 * Three differences decide what can honestly be offered here, and each one is a
 * rule below rather than a caveat in a comment:
 *
 *   1. A VISITOR MAY HAVE NO EVENT AT ALL. Signed out, or signed in with
 *      nothing planned, there is no venue, no budget and no date — every lens
 *      input is null, every lens hides itself, and the grid orders exactly as it
 *      does today. That is the correct answer for a stranger, not a degraded one.
 *
 *   2. "FITS YOUR BUDGET" NEEDS A CATEGORY. The couple's budget is split
 *      per-category by the planner, so a shop's starting price can only be
 *      compared against *the budget for the category it is in*. The grid browses
 *      across everything at once. So `budgetFitRatio` is passed ONLY when the
 *      visitor has filtered to a category and we resolved a budget for it —
 *      otherwise it is null, and the lens hides itself by its own gate. Ordering
 *      a mixed grid against one category's budget would be a number that means
 *      nothing.
 *
 *   3. ⛔ "IN DEMAND RIGHT NOW" IS NOT OFFERED HERE, DELIBERATELY. It is the one
 *      signal on the marketplace that tells a couple something about OTHER
 *      couples, and it has **no per-couple opt-out** — a couple cannot exclude
 *      their own enquiry from other people's counts. `lib/privacy-coverage.ts`
 *      records that missing opt-out as the open question for the NPC filing,
 *      which lodges January 2027. The DPO approval it has (`same_date_demand`,
 *      active 2026-07-30) covers the couple's own dashboard; a PUBLIC page is a
 *      different exposure than the one approved. It comes back when the filing
 *      speaks to the opt-out — not before, and not on an engineer's judgement.
 */

import { computeCompatScore, type CompatInputs, type CompatWeights } from './compat-score';
import { LENSES, LENS_ORDER, freshnessRatioFrom, type LensKey } from './ranking-lenses';

/** The lenses the public grid may ever offer. `demand` is absent on purpose —
 *  see rule 3 above. A test fails if it appears. */
export const EXPLORE_LENS_ORDER: readonly LensKey[] = LENS_ORDER.filter(
  (k) => k !== 'demand',
);

/** What the explore grid already knows about one shop. Every field is optional
 *  because the grid resolves them opportunistically — an unresolved input is
 *  NEUTRAL to the scorer, never a penalty. */
export type ExploreVendor = {
  /** Kilometres from the couple's venue, when both have coordinates. */
  distanceKm?: number | null;
  /** The shop's declared service radius, when known. The owner ruled 2026-07-27
   *  that a bigger tier means genuinely wider reach, so a declared radius stays
   *  in the score — matching the bench, not the older spec text. */
  serviceRadiusKm?: number | null;
  avgRating?: number | null;
  reviewCount?: number | null;
  /** `public_visibility === 'verified'` — the same pair the marketplace lists on. */
  verified?: boolean;
  /** Price-fit for the FILTERED category only. Null on an unfiltered grid. */
  budgetFitRatio?: number | null;
  /** First time this shop was verified — the honest "new here" anchor. */
  firstVerifiedAt?: string | null;
};

/**
 * Project a grid card onto the scorer's inputs. ONE mapping, shared by the
 * ordering and by whatever explains it, so the order and its explanation can
 * never disagree.
 *
 * What is deliberately NOT passed, each for a reason that would otherwise be
 * re-invented:
 *   • `demandCoupleCount` — rule 3. Not passed at all, so the input cannot reach
 *     the scorer here even if a lens weight for it somehow did.
 *   • `boosted` — that is `ad_rank > 0`, paid placement. The grid's
 *     `is_setnayan_service` is a DIFFERENT fact, and feeding it here would float
 *     Setnayan's own services above real shops inside a lens labelled "Best
 *     matches". The bench refuses the same substitution.
 *   • `songOverlapRatio` / `preferenceMatchRatio` — the grid has no style signal.
 *   • `faithMatch` — the grid already FILTERS on faith; scoring it again would
 *     count one fact twice.
 */
export function exploreCompatInputs(v: ExploreVendor, nowMs?: number): CompatInputs {
  return {
    distanceKm: v.distanceKm ?? null,
    travelRadiusKm: v.serviceRadiusKm ?? null,
    avgRating: v.avgRating ?? null,
    reviewCount: v.reviewCount ?? null,
    verified: v.verified === true,
    budgetFitRatio: v.budgetFitRatio ?? null,
    freshnessRatio: freshnessRatioFrom(v.firstVerifiedAt ?? null, nowMs),
  };
}

/** The weight vector behind a lens. */
export function exploreLensWeights(lens: LensKey): CompatWeights {
  return LENSES[lens].weights;
}

/** One shop's 0–100 composite under a lens. Never rendered as a number — it
 *  only orders the grid. */
export function exploreLensScore(
  v: ExploreVendor,
  lens: LensKey,
  nowMs?: number,
): number {
  return computeCompatScore(exploreCompatInputs(v, nowMs), exploreLensWeights(lens)).score;
}

/**
 * Which lenses this grid may honestly offer right now.
 *
 * Reuses each lens's OWN `hideWhen` gate rather than re-deciding: a lens needs
 * at least three candidates and at least two with a resolved driving input, or
 * it would reorder nothing and read as broken. `fit` has no driving input and is
 * always offerable, which is why a stranger — and production today, with one
 * live shop — sees exactly one chip and today's ordering.
 */
export function offerableExploreLenses(
  candidates: readonly ExploreVendor[],
  nowMs?: number,
): LensKey[] {
  const inputs = candidates.map((c) => exploreCompatInputs(c, nowMs));
  return EXPLORE_LENS_ORDER.filter((k) => {
    const hide = LENSES[k].hideWhen;
    return hide ? !hide(inputs) : true;
  });
}

/**
 * Order a grid under a lens, highest composite first. STABLE: equal scores keep
 * the caller's incoming order, so the existing relationship-depth and
 * rating/volume ordering survives underneath as the tiebreak it always was.
 *
 * ⚠ It re-orders; it never REMOVES. A lens is a ranking, and a shop that scores
 * badly on one still appears — the same rule the couple's own search follows.
 */
export function orderByExploreLens<T extends ExploreVendor>(
  vendors: readonly T[],
  lens: LensKey,
  nowMs?: number,
): T[] {
  const scored = vendors.map((v, i) => ({ v, i, s: exploreLensScore(v, lens, nowMs) }));
  scored.sort((a, b) => (b.s - a.s) || (a.i - b.i));
  return scored.map((x) => x.v);
}
