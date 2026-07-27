/**
 * Vendor compatibility SCORE (0–100) · the soft-ranking layer that sits on
 * top of the already-built eligibility GATE in
 * `fetchWizardVendorRecommendations`.
 *
 * Architecture: Customer_Vendor_Marketplace_Architecture_2026-06-04.md §2
 * ("GATE + SCORE"). The GATE (ceremony/venue/region/pax/venue-type/schedule,
 * all admit-unknown / failing-open) decides who is ELIGIBLE — it already runs
 * in the matcher query + JS narrowing. This module decides how to RANK the
 * survivors and what % to show on the card ring. It NEVER hides a vendor — the
 * "never-empty" guarantee lives in the gate; the score only sorts + displays.
 *
 * Pure + integration-agnostic: it takes primitives (the caller resolves
 * distance via lib/geo haversine, reviews/verification from the rec row, etc.)
 * and returns a number. That keeps it trivially unit-testable and means it
 * can back the wizard cards AND the public /vendors grid without change.
 *
 * Admit-unknown is baked into every dimension: a missing input contributes a
 * NEUTRAL baseline (not zero), so we never punish a vendor for data we don't
 * have yet (e.g. a vendor with no reviews, or refinement data that 0044 hasn't
 * populated). This mirrors the gate's "don't hide unknown coverage" rule.
 *
 * Weights are a single CONFIG CONSTANT here. §2 calls for these to be
 * admin-tunable; that admin surface is a later PR — until then this constant
 * is the one source of truth (no magic numbers scattered in the matcher).
 */

/** Per-dimension weights · must sum to 1. §2 starting recommendation, rebalanced
 *  2026-07-12 to seat the two dims the Event Brief now feeds — budgetFit +
 *  faithFit — alongside the pre-existing five. Admin-tunable surface is a later PR. */
export const COMPAT_WEIGHTS = {
  /** How well the vendor matches what the couple asked for (style refinements /
   *  preference-facet overlap / song overlap for music). Strongest "is this what
   *  I want" signal. */
  refinement: 0.22,
  /** How the vendor's "starts at" fits the couple's per-category budget (from the
   *  Event Brief). The gate never filters on price, so this is the couple's
   *  most-asked signal that only the score can express. */
  budgetFit: 0.2,
  /** Proximity to the couple's reception anchor (closer = cheaper logistics). */
  distance: 0.18,
  /** Rating × volume (Bayesian-adjusted so 1 five-star review ≠ 50). */
  reviews: 0.18,
  /** Date flexibility — free on more of the candidate dates = lower risk. */
  dateHeadroom: 0.08,
  /** Vendor explicitly serves the couple's ceremony/faith. The gate already keeps
   *  only faith-compatible vendors, so this is a light lift for declared
   *  specialists — never a penalty for the "serves all" generalists. */
  faithFit: 0.07,
  /** Verified / Setnayan-Pay-boosted / profile completeness. */
  trust: 0.07,
  /** How many OTHER couples have INQUIRED with this vendor for the couple's
   *  exact date (Explore_Replan §15.1, "In demand right now"). ZERO in the
   *  global vector — it only carries weight inside that one lens, so every
   *  existing caller is byte-for-byte unchanged. Never a penalty: a vendor
   *  nobody has inquired about sits at NEUTRAL, not at 0. */
  demandPressure: 0,
} as const;

/** A dimension we have no data for scores at this neutral baseline (slightly
 *  positive — "no reason to down-rank"), never 0. */
export const COMPAT_NEUTRAL = 0.6;
const NEUTRAL = COMPAT_NEUTRAL;

/**
 * PRIVACY FLOOR for the same-date demand signal (`demandPressure`).
 *
 * `Schedule_Matrix_and_Date_Finder_2026-06-02.md` §8.3, owner: *"Don't show a
 * '1'."* A count of one, attached to a solo vendor and an exact date in a small
 * municipality, is functionally re-identifying — the other couple is findable.
 * Below this floor the dimension resolves to NEUTRAL (no lift, no pill, no
 * number), exactly as if there were no signal at all.
 *
 * This is the SECOND of two enforcement points, deliberately. The producer
 * (`dashboard/[eventId]/vendors/page.tsx`) refuses to serialize a below-floor
 * count to the client at all; this one guarantees that any OTHER caller that
 * ever passes a raw count still cannot render one.
 */
export const MIN_DEMAND_COUPLE_COUNT = 3;

/** Where the demand lift saturates. At or above this many inquiring couples the
 *  dimension is maxed; between the floor and here it ramps. Bounded so a
 *  runaway count can't dominate a weighted composite. */
const DEMAND_SATURATION_COUPLES = 10;

/** The seven weighted dimensions, as a type. Lets a caller reason about WHICH
 *  dimension carried a score without re-deriving the weight table. */
export type CompatDimension = keyof typeof COMPAT_WEIGHTS;

/**
 * A complete weight vector over every dimension — the shape of `COMPAT_WEIGHTS`
 * with the literal types widened so an alternative vector can be declared.
 * `Record<CompatDimension, …>` on purpose: adding a dimension to
 * `COMPAT_WEIGHTS` immediately fails every lens vector that has not been
 * updated, rather than silently scoring the new dim at `undefined`.
 *
 * ── 2026-07-27 · RANKING LENSES (Explore_Replan_BUILD_SPEC §15)
 * A "lens" ("Best matches", "Nearest to your venue") is NOT a second scorer and
 * NOT a bespoke comparator — it is a NAMED WEIGHT VECTOR handed to the one
 * scorer below. The vectors live in `lib/ranking-lenses.ts`; this module only
 * learns to accept one. `COMPAT_WEIGHTS` itself is unchanged to the byte, so
 * every caller that does not pass a vector (`category-search.ts`,
 * `build-3state-actions.ts`, `plan-budget-accordion.tsx`, `app/tour/vendors`,
 * `vendor-autoreply`) keeps its exact current output.
 *
 * INVARIANT: every vector must sum to 1.000. Asserted per-member in
 * `ranking-lenses.test.ts` — a vector that does not sum to 1 fails CI.
 */
export type CompatWeights = Record<CompatDimension, number>;

export type CompatTier = 'strong' | 'good' | 'fair';

export type CompatInputs = {
  /** Straight-line km from the couple's reception anchor to the vendor base
   *  (caller computes via lib/geo haversine). Null = vendor or event has no
   *  coords → neutral (admit-unknown). */
  distanceKm?: number | null;
  /** The vendor's declared travel radius (km). Used to scale the distance
   *  decay so a wide-coverage vendor isn't penalised for being far. Falls
   *  back to DEFAULT_RADIUS_KM when absent. */
  travelRadiusKm?: number | null;
  /** vendor_market_stats.avg_rating_overall (0–5). Null = no reviews yet. */
  avgRating?: number | null;
  /** vendor_market_stats.review_count. Null/0 = unrated → low confidence. */
  reviewCount?: number | null;
  /** vendor_profiles.verification_state === 'verified'. */
  verified?: boolean;
  /** ad_rank > 0 (Setnayan-Pay / Boosted). A light nudge, NOT a takeover —
   *  Boosted floats via the sort key in the matcher, not by inflating the %. */
  boosted?: boolean;
  /** For music categories: fraction of the couple's song picks the vendor
   *  performs (0–1). Stands in for "refinement fit" where we have it. Null =
   *  neutral. */
  songOverlapRatio?: number | null;
  /** Fraction of the couple's candidate dates the vendor is free on (0–1).
   *  Null = neutral (we haven't resolved per-date availability for this row). */
  dateHeadroomRatio?: number | null;
  /** Generalised refinement fit for NON-music categories: the fraction of the
   *  couple's expressed preference dimensions this vendor's facet tags satisfy
   *  (0–1). Feeds the refinement dim when songOverlapRatio is absent. Null =
   *  neutral (no preference signal resolved for this row). */
  preferenceMatchRatio?: number | null;
  /** Budget fit in [0,1] — how well the vendor's pax-adjusted "starts at" sits
   *  inside the couple's per-category budget (caller computes via lib/smart-sort
   *  priceFitScore against the Event Brief budget). 1 = within budget, decays as
   *  it goes over. Null = no price or no budget → neutral (admit-unknown). */
  budgetFitRatio?: number | null;
  /** True when the vendor's compatible_ceremony_types EXPLICITLY lists one of the
   *  couple's faiths (a declared specialist). Undefined/false = "serves all" or
   *  unknown → neutral — never a penalty, since the gate already guaranteed
   *  compatibility. */
  faithMatch?: boolean;
  /** First-Look Window (Wave 2): the vendor replied to recent in-region
   *  inquiries within the admin SLA → earns a responsiveness head-start.
   *  Undefined/false = no head-start (sits at neutral, never a penalty). */
  respondsFast?: boolean;
  /** How many OTHER couples have INQUIRED with this vendor for the couple's
   *  exact event date. Feeds the `demandPressure` dim (weight 0 outside the
   *  "In demand right now" lens).
   *
   *  Three hard rules the caller must honour, and which this module enforces
   *  again regardless:
   *  1. INQUIRIES, not saves. A couple who merely shortlisted a vendor has not
   *     competed for them — counting that is manufactured scarcity (owner,
   *     2026-06-02: competition "starts at the inquiry (Stage 2), NEVER at
   *     search (Stage 1)").
   *  2. Below `MIN_DEMAND_COUPLE_COUNT` this resolves to NEUTRAL — no lift, no
   *     reason phrase, no number.
   *  3. Absent/null is NEUTRAL, never 0. A vendor nobody has inquired about is
   *     unknown demand, not bad demand. */
  demandCoupleCount?: number | null;
  /** Admin-managed `platform_settings.firstlook_boost_weight` (0–0.5). The
   *  fast-responder blend scales the five-dimension score by (1 - boostWeight)
   *  and adds boostWeight for fast responders, so COMPAT_WEIGHTS still sum to 1
   *  internally. Default 0 → no effect (every existing caller is unchanged). */
  boostWeight?: number;
};

const DEFAULT_RADIUS_KM = 25;

function clamp01(n: number): number {
  return n < 0 ? 0 : n > 1 ? 1 : n;
}

/** Distance → 0..1. 1.0 at the doorstep, ~0.55 at the edge of the radius,
 *  decaying gently beyond (never 0 — a reachable-but-far vendor still scores).
 *  The gate already removed the genuinely-unreachable, so this only shades
 *  the survivors. */
function distanceSub(distanceKm: number | null | undefined, radiusKm: number | null | undefined): number {
  if (distanceKm == null) return NEUTRAL;
  const r = radiusKm && radiusKm > 0 ? radiusKm : DEFAULT_RADIUS_KM;
  // Half-life decay: score = 0.5 ^ (distance / radius). At d=0 →1, d=r →0.5,
  // d=2r →0.25. Floored at 0.15 so far-but-reachable never reads as a zero.
  return Math.max(0.15, Math.pow(0.5, distanceKm / r));
}

/** Reviews → 0..1, Bayesian: pull the raw rating toward a 3.5/5 prior with a
 *  confidence that grows with volume (m=5 reviews). Unrated → just the prior
 *  (~0.6), so a new vendor isn't buried, only out-ranked by a proven one. */
function reviewsSub(avgRating: number | null | undefined, reviewCount: number | null | undefined): number {
  const n = reviewCount && reviewCount > 0 ? reviewCount : 0;
  const priorRating = 3.5;
  const m = 5;
  if (n === 0 && (avgRating == null || avgRating === 0)) return NEUTRAL;
  const r = avgRating ?? priorRating;
  const adjusted = (n * r + m * priorRating) / (n + m);
  return clamp01(adjusted / 5);
}

/** Verified + boosted → 0..1. Verified is the bulk of trust; boosted adds a
 *  small nudge. Unverified sits at the midpoint (not punished, not rewarded). */
/**
 * Same-date inquiry demand → 0..1. Shaped like `faithFit`: a LIFT for the
 * positive case, NEUTRAL for everything else, and never a penalty — a vendor
 * with no recorded demand must not be pushed below a vendor with some, because
 * "nobody inquired" and "we have no data" are indistinguishable here.
 *
 * Below the privacy floor (or absent) → NEUTRAL. At the floor → a modest lift;
 * ramping to a full 1.0 at `DEMAND_SATURATION_COUPLES` and no further.
 */
function demandSub(count: number | null | undefined): number {
  if (count == null || !Number.isFinite(count) || count < MIN_DEMAND_COUPLE_COUNT) {
    return NEUTRAL;
  }
  const span = DEMAND_SATURATION_COUPLES - MIN_DEMAND_COUPLE_COUNT;
  const t = span > 0 ? clamp01((count - MIN_DEMAND_COUPLE_COUNT) / span) : 1;
  // 0.7 at the floor → 1.0 at saturation.
  return clamp01(NEUTRAL + (1 - NEUTRAL) * (0.25 + 0.75 * t));
}

function trustSub(verified: boolean | undefined, boosted: boolean | undefined): number {
  let s = verified ? 0.85 : 0.5;
  if (boosted) s += 0.15;
  return clamp01(s);
}

/**
 * The seven per-dimension sub-scores (each 0..1) BEFORE weighting — the single
 * implementation `computeCompatScore` itself consumes, exported so a caller can
 * explain a score without re-deriving (and inevitably drifting from) the math.
 * Every missing input still resolves to NEUTRAL here, exactly as in the score.
 */
export function compatSubScores(input: CompatInputs): Record<CompatDimension, number> {
  // Refinement fit: prefer the concrete music song-overlap, else the general
  // preference-facet ratio, else neutral (admit-unknown).
  const refinement =
    input.songOverlapRatio != null
      ? clamp01(input.songOverlapRatio)
      : input.preferenceMatchRatio != null
        ? clamp01(input.preferenceMatchRatio)
        : NEUTRAL;
  return {
    refinement,
    budgetFit: input.budgetFitRatio == null ? NEUTRAL : clamp01(input.budgetFitRatio),
    distance: distanceSub(input.distanceKm, input.travelRadiusKm),
    reviews: reviewsSub(input.avgRating, input.reviewCount),
    dateHeadroom: input.dateHeadroomRatio == null ? NEUTRAL : clamp01(input.dateHeadroomRatio),
    faithFit: input.faithMatch === true ? 0.95 : NEUTRAL,
    trust: trustSub(input.verified, input.boosted),
    demandPressure: demandSub(input.demandCoupleCount),
  };
}

/**
 * WHICH dimension is actually carrying this vendor's score — the one with the
 * largest WEIGHTED LIFT ABOVE NEUTRAL, i.e. `weight × (sub − NEUTRAL)`.
 *
 * Measuring the lift (not `weight × sub`) is what makes the answer honest: an
 * all-unknown vendor sits at NEUTRAL on every dimension, every lift is 0, and
 * the function returns **null** — there is no reason to give, so the caller
 * must render none rather than invent one. A dimension scoring BELOW neutral
 * (e.g. booked on the date) can never win either.
 *
 * `weights` defaults to `COMPAT_WEIGHTS`. Passing a lens vector makes the
 * explanation agree with the ORDER the couple is actually looking at — under
 * "Nearest to your venue" (distance 0.45) proximity should be what the pill
 * names, and it now is.
 */
export function topCompatDimension(
  input: CompatInputs,
  weights: CompatWeights = COMPAT_WEIGHTS,
): CompatDimension | null {
  const sub = compatSubScores(input);
  let best: CompatDimension | null = null;
  let bestLift = 0;
  for (const dim of Object.keys(COMPAT_WEIGHTS) as CompatDimension[]) {
    const lift = weights[dim] * (sub[dim] - NEUTRAL);
    if (lift > bestLift) {
      bestLift = lift;
      best = dim;
    }
  }
  return best;
}

/**
 * Compute the 0–100 compatibility score + tier for one eligible vendor.
 * Inputs that are null/absent fall back to a neutral baseline (admit-unknown).
 *
 * `weights` defaults to `COMPAT_WEIGHTS` — the SIGNATURE changed for the
 * ranking lenses (§15.0), the MATH did not. Omitting the argument is
 * byte-identical to the pre-lens behaviour for every existing caller.
 */
export function computeCompatScore(
  input: CompatInputs,
  weights: CompatWeights = COMPAT_WEIGHTS,
): { score: number; tier: CompatTier } {
  const sub = compatSubScores(input);

  const raw =
    weights.refinement * sub.refinement +
    weights.budgetFit * sub.budgetFit +
    weights.distance * sub.distance +
    weights.reviews * sub.reviews +
    weights.dateHeadroom * sub.dateHeadroom +
    weights.faithFit * sub.faithFit +
    weights.trust * sub.trust +
    weights.demandPressure * sub.demandPressure;

  // First-Look Window responsiveness blend (Wave 2). Admin-tunable boostWeight
  // (default 0 → no-op, so existing callers are byte-for-byte unchanged). A fast
  // responder's responsiveness sub-score is 1; an unknown/slow vendor sits at
  // NEUTRAL — a head-start for the fast, never a penalty for the rest. Mixing as
  // (1 - bw)·raw + bw·respSub keeps the five COMPAT_WEIGHTS summing to 1
  // internally: the boost is a top-level blend, not a sixth weight that would
  // break the normalization.
  const bw = Math.max(0, Math.min(input.boostWeight ?? 0, 0.5));
  const respSub = input.respondsFast === true ? 1 : NEUTRAL;
  const blended = bw > 0 ? (1 - bw) * raw + bw * respSub : raw;

  const score = Math.round(clamp01(blended) * 100);
  const tier: CompatTier = score >= 80 ? 'strong' : score >= 60 ? 'good' : 'fair';
  return { score, tier };
}

/**
 * Plain-English "WHY this %" — an ORDERED list of up to 3 short reason strings
 * for surfacing NEXT TO the % match (never replacing the number). It is the
 * human-readable companion to `computeCompatScore`: same inputs, same neutral
 * baselines, same admit-unknown rule.
 *
 * A dimension only earns a phrase when its input is BOTH present AND scores
 * strictly ABOVE its neutral baseline — i.e. it's a real positive signal. A
 * missing / neutral dimension is OMITTED (never phrased), so we never invent a
 * reason we can't back. With today's host-search inputs (refinement +
 * dateHeadroom unresolved → neutral) this naturally yields only the live
 * signals — distance / reviews / verified — and will surface "Matches your
 * style" / "Free on your dates" on its own once 0044 populates those dims.
 *
 * Returns [] when nothing qualifies → the caller renders nothing.
 */
export function explainCompatScore(input: CompatInputs): string[] {
  const reasons: string[] = [];

  // refinement (.22) — strongest "is this what I want" signal. Fires when either
  // the music song-overlap OR the general preference-facet fit is genuinely high.
  const refinementRatio =
    input.songOverlapRatio != null
      ? clamp01(input.songOverlapRatio)
      : input.preferenceMatchRatio != null
        ? clamp01(input.preferenceMatchRatio)
        : null;
  if (refinementRatio != null && refinementRatio > NEUTRAL) {
    reasons.push('Matches your style');
  }

  // budgetFit (.20) — the vendor's starts-at sits comfortably inside the budget.
  if (input.budgetFitRatio != null && clamp01(input.budgetFitRatio) > NEUTRAL) {
    reasons.push('Fits your budget');
  }

  // distance (.25) — "close" means the decay scores above neutral, which the
  // gate already guarantees is reachable.
  if (
    input.distanceKm != null &&
    distanceSub(input.distanceKm, input.travelRadiusKm) > NEUTRAL
  ) {
    reasons.push('Nearest to your venue');
  }

  // reviews (.20) — the Bayesian sub scores above the prior. Show the concrete
  // rating ("4.8★") only when it's genuinely flattering (≥ 4.0); a thinner-but-
  // still-above-baseline rating gets the generic phrase rather than parading a
  // middling number as a selling point. The include/omit decision stays gated
  // on the SAME `> NEUTRAL` threshold the score uses — only the wording differs.
  if (reviewsSub(input.avgRating, input.reviewCount) > NEUTRAL) {
    reasons.push(
      typeof input.avgRating === 'number' && input.avgRating >= 4
        ? `${input.avgRating.toFixed(1)}★`
        : 'Highly rated',
    );
  }

  // faithFit (.07) — the vendor explicitly declares the couple's ceremony/faith.
  if (input.faithMatch === true) {
    reasons.push('Fits your ceremony');
  }

  // dateHeadroom (.08) — free on most candidate dates.
  if (input.dateHeadroomRatio != null && clamp01(input.dateHeadroomRatio) > NEUTRAL) {
    reasons.push('Free on your dates');
  }

  // demandPressure (0 globally; 0.22 inside the "In demand right now" lens) —
  // a FACT with its own number, not a scarcity claim. The phrase states what
  // was measured ("N couples inquired for your date") and nothing more: no
  // "only N left", no "booking fast", no "almost gone" — there is no capacity
  // counter behind any of those (vendor_schedule_pool_bookings has no
  // cross-couple SELECT policy), so they would be invented. The
  // `demandSub > NEUTRAL` gate means the privacy floor is already applied:
  // this phrase can never render for fewer than MIN_DEMAND_COUPLE_COUNT.
  const demandCount = input.demandCoupleCount;
  if (demandCount != null && demandSub(demandCount) > NEUTRAL) {
    reasons.push(`${demandCount} couples inquired for your date`);
  }

  // trust (.10) — verified pushes trust above neutral; unverified sits below it.
  if (trustSub(input.verified, input.boosted) > NEUTRAL) {
    reasons.push('Verified');
  }

  return reasons.slice(0, 3);
}
