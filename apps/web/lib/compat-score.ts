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

/** Per-dimension weights · must sum to 1. §2 starting recommendation. */
export const COMPAT_WEIGHTS = {
  /** How well the vendor matches what the couple asked for (refinements /
   *  song overlap for music). Strongest "is this what I want" signal. */
  refinement: 0.3,
  /** Proximity to the couple's reception anchor (closer = cheaper logistics). */
  distance: 0.25,
  /** Rating × volume (Bayesian-adjusted so 1 five-star review ≠ 50). */
  reviews: 0.2,
  /** Date flexibility — free on more of the candidate dates = lower risk. */
  dateHeadroom: 0.15,
  /** Verified / Setnayan-Pay-boosted / profile completeness. */
  trust: 0.1,
} as const;

/** A dimension we have no data for scores at this neutral baseline (slightly
 *  positive — "no reason to down-rank"), never 0. */
const NEUTRAL = 0.6;

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
function trustSub(verified: boolean | undefined, boosted: boolean | undefined): number {
  let s = verified ? 0.85 : 0.5;
  if (boosted) s += 0.15;
  return clamp01(s);
}

/**
 * Compute the 0–100 compatibility score + tier for one eligible vendor.
 * Inputs that are null/absent fall back to a neutral baseline (admit-unknown).
 */
export function computeCompatScore(input: CompatInputs): { score: number; tier: CompatTier } {
  const refinement = input.songOverlapRatio == null ? NEUTRAL : clamp01(input.songOverlapRatio);
  const distance = distanceSub(input.distanceKm, input.travelRadiusKm);
  const reviews = reviewsSub(input.avgRating, input.reviewCount);
  const dateHeadroom = input.dateHeadroomRatio == null ? NEUTRAL : clamp01(input.dateHeadroomRatio);
  const trust = trustSub(input.verified, input.boosted);

  const raw =
    COMPAT_WEIGHTS.refinement * refinement +
    COMPAT_WEIGHTS.distance * distance +
    COMPAT_WEIGHTS.reviews * reviews +
    COMPAT_WEIGHTS.dateHeadroom * dateHeadroom +
    COMPAT_WEIGHTS.trust * trust;

  const score = Math.round(clamp01(raw) * 100);
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

  // refinement (.30) — strongest "is this what I want" signal. Above neutral
  // only when the couple's style/song overlap is genuinely high.
  if (input.songOverlapRatio != null && clamp01(input.songOverlapRatio) > NEUTRAL) {
    reasons.push('Matches your style');
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

  // dateHeadroom (.15) — free on most candidate dates.
  if (input.dateHeadroomRatio != null && clamp01(input.dateHeadroomRatio) > NEUTRAL) {
    reasons.push('Free on your dates');
  }

  // trust (.10) — verified pushes trust above neutral; unverified sits below it.
  if (trustSub(input.verified, input.boosted) > NEUTRAL) {
    reasons.push('Verified');
  }

  return reasons.slice(0, 3);
}
