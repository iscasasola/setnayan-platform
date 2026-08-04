/**
 * Unit suite for the vendor compatibility SCORE (lib/compat-score.ts) — the pure,
 * branch-heavy ranking math behind the public /vendors grid + the wizard match %.
 * Covers: weights sum to 1; the admit-unknown NEUTRAL baseline; the half-life
 * distance decay + floor; the Bayesian reviews prior-pull; trust; the 80/60 tier
 * cutoffs; and explainCompatScore's gating + the rating-phrasing split.
 *
 * Sub-functions aren't exported, so they're exercised THROUGH the two public
 * entry points; assertions avoid the FP-fragile .5 rounding boundary.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  COMPAT_NEUTRAL,
  COMPAT_WEIGHTS,
  MIN_DEMAND_COUPLE_COUNT,
  compatSubScores,
  computeCompatScore,
  explainCompatScore,
  topCompatDimension,
} from './compat-score';

test('the per-dimension weights sum to 1', () => {
  const sum = Object.values(COMPAT_WEIGHTS).reduce<number>((a, b) => a + b, 0);
  assert.ok(Math.abs(sum - 1) < 1e-9, `weights sum to ${sum}`);
});

test('all-unknown input scores at the neutral baseline (admit-unknown), tier fair', () => {
  const { score, tier } = computeCompatScore({});
  // refinement/budgetFit/distance/reviews/dateHeadroom/faithFit = 0.6, trust = 0.5
  // (unverified) → ~59.
  assert.ok(score >= 57 && score <= 60, `neutral score was ${score}`);
  assert.equal(tier, 'fair');
});

test('a fully-strong vendor maxes the score + earns the strong tier', () => {
  const { score, tier } = computeCompatScore({
    songOverlapRatio: 1,
    budgetFitRatio: 1,
    distanceKm: 0,
    travelRadiusKm: 25,
    avgRating: 5,
    reviewCount: 100,
    verified: true,
    boosted: true,
    dateHeadroomRatio: 1,
    faithMatch: true,
  });
  assert.ok(score >= 99, `strong score was ${score}`);
  assert.equal(tier, 'strong');
});

test('tier cutoffs: >=80 strong, >=60 good, <60 fair', () => {
  // Verified-only lifts trust (0.85) above the all-neutral floor → lands in good.
  const good = computeCompatScore({ verified: true });
  assert.equal(good.tier, 'good');
  assert.ok(good.score >= 60 && good.score < 80, `good score was ${good.score}`);
  assert.equal(computeCompatScore({}).tier, 'fair');
});

test('distance: nearer always outranks farther (half-life decay, never punished to 0)', () => {
  const near = computeCompatScore({ distanceKm: 0, travelRadiusKm: 25 }).score;
  const edge = computeCompatScore({ distanceKm: 25, travelRadiusKm: 25 }).score;
  const far = computeCompatScore({ distanceKm: 250, travelRadiusKm: 25 }).score;
  assert.ok(near > edge && edge > far, `expected ${near} > ${edge} > ${far}`);
  // Floored: a very-far vendor still scores below the neutral-distance baseline
  // but not at zero — confirm it's a positive, bounded contribution.
  assert.ok(far > 0);
});

test('reviews: Bayesian prior-pull — volume beats a thin 5★, unrated sits at the prior', () => {
  const proven = computeCompatScore({ avgRating: 5, reviewCount: 100 }).score;
  const thin = computeCompatScore({ avgRating: 5, reviewCount: 1 }).score;
  const unrated = computeCompatScore({ avgRating: null, reviewCount: 0 }).score;
  assert.ok(proven > thin, `proven ${proven} should beat thin ${thin}`);
  assert.ok(thin > unrated, `thin ${thin} should beat unrated ${unrated}`);
});

test('verified outranks unverified, all else equal', () => {
  assert.ok(
    computeCompatScore({ verified: true }).score > computeCompatScore({ verified: false }).score,
  );
});

test('budgetFit: within-budget outranks over-budget; unknown sits neutral between them', () => {
  const within = computeCompatScore({ budgetFitRatio: 1 }).score;
  const over = computeCompatScore({ budgetFitRatio: 0.1 }).score;
  const unknown = computeCompatScore({}).score;
  assert.ok(within > unknown, `within ${within} should beat unknown ${unknown}`);
  assert.ok(unknown > over, `unknown ${unknown} should beat over-budget ${over}`);
});

test('faithFit: an explicit faith match lifts the score; absent/false never penalises', () => {
  const match = computeCompatScore({ faithMatch: true }).score;
  const none = computeCompatScore({}).score;
  const explicitFalse = computeCompatScore({ faithMatch: false }).score;
  assert.ok(match > none, `faith match ${match} should beat neutral ${none}`);
  // false is treated as "serves all / unknown" → neutral, never a penalty.
  assert.equal(explicitFalse, none);
});

test('refinement: the general preference ratio feeds the dim, song overlap wins ties', () => {
  const pref = computeCompatScore({ preferenceMatchRatio: 1 }).score;
  const none = computeCompatScore({}).score;
  assert.ok(pref > none, `preference-matched ${pref} should beat neutral ${none}`);
  // Concrete song overlap takes precedence when both are present.
  const songWins = computeCompatScore({ songOverlapRatio: 0.1, preferenceMatchRatio: 1 }).score;
  const songOnly = computeCompatScore({ songOverlapRatio: 0.1 }).score;
  assert.equal(songWins, songOnly);
});

test('explainCompatScore: budget, faith + general preference surface their own reasons', () => {
  assert.deepEqual(explainCompatScore({ budgetFitRatio: 1 }), ['Fits your budget']);
  assert.deepEqual(explainCompatScore({ faithMatch: true }), ['Fits your ceremony']);
  assert.deepEqual(explainCompatScore({ preferenceMatchRatio: 1 }), ['Matches your style']);
});

test('explainCompatScore: nothing qualifies for an all-unknown vendor → []', () => {
  assert.deepEqual(explainCompatScore({}), []);
});

test('explainCompatScore: verified-only yields just the Verified reason', () => {
  assert.deepEqual(explainCompatScore({ verified: true }), ['Verified']);
});

test('explainCompatScore: shows the concrete rating only when >= 4.0, else generic', () => {
  assert.deepEqual(explainCompatScore({ avgRating: 4.8, reviewCount: 50 }), ['4.8★']);
  // avgRating null but rated (reviewCount>0) → above prior, but no number to show.
  assert.deepEqual(explainCompatScore({ avgRating: null, reviewCount: 20 }), ['Highly rated']);
});

test('explainCompatScore: ordered + capped at 3 reasons', () => {
  const reasons = explainCompatScore({
    songOverlapRatio: 1,
    distanceKm: 0,
    travelRadiusKm: 25,
    avgRating: 4.8,
    reviewCount: 50,
    dateHeadroomRatio: 1,
    verified: true,
  });
  assert.equal(reasons.length, 3);
  // Push order is refinement → distance → reviews → dateHeadroom → trust.
  assert.deepEqual(reasons, ['Matches your style', 'Nearest to your venue', '4.8★']);
});

// ── First-Look Window responsiveness blend (Wave 2) ─────────────────────────

test('First-Look: boostWeight defaults to 0 → respondsFast has no effect', () => {
  const base = computeCompatScore({ verified: true, avgRating: 5, reviewCount: 30 });
  // Same inputs, fast responder, but NO boostWeight → byte-for-byte identical.
  const noWeight = computeCompatScore({
    verified: true,
    avgRating: 5,
    reviewCount: 30,
    respondsFast: true,
  });
  assert.equal(noWeight.score, base.score);
});

test('First-Look: a fast responder out-scores an identical slow vendor at the same boost weight', () => {
  const inputs = { verified: true, avgRating: 4.5, reviewCount: 20, boostWeight: 0.1 } as const;
  const fast = computeCompatScore({ ...inputs, respondsFast: true });
  const slow = computeCompatScore({ ...inputs, respondsFast: false });
  assert.ok(fast.score > slow.score, `fast ${fast.score} !> slow ${slow.score}`);
});

test('First-Look: the boost is bounded — weight is clamped to 0.5 and the score stays 0–100', () => {
  // An over-large weight can't run the score past 100 or invert the scale.
  const huge = computeCompatScore({ respondsFast: true, boostWeight: 5 });
  assert.ok(huge.score >= 0 && huge.score <= 100, `blended score out of range: ${huge.score}`);
  // Clamped to 0.5: a perfect-everything fast responder tops out near the cap
  // (blend of a ~0.98 raw and a 1.0 responsiveness sub), never above 100.
  const maxed = computeCompatScore({
    songOverlapRatio: 1,
    budgetFitRatio: 1,
    distanceKm: 0,
    avgRating: 5,
    reviewCount: 100,
    verified: true,
    boosted: true,
    dateHeadroomRatio: 1,
    faithMatch: true,
    respondsFast: true,
    boostWeight: 0.5,
  });
  assert.ok(maxed.score >= 99 && maxed.score <= 100, `maxed score was ${maxed.score}`);
});

// ── demandPressure (Explore_Replan §15.3 · "In demand right now") ───────────

test('demandPressure carries ZERO weight in the global vector — no existing caller moves', () => {
  const base = computeCompatScore({ verified: true, avgRating: 4.5, reviewCount: 20 });
  const loud = computeCompatScore({
    verified: true,
    avgRating: 4.5,
    reviewCount: 20,
    demandCoupleCount: 50,
  });
  assert.equal(loud.score, base.score, 'demand must be inert outside its own lens');
});

test('demand below the min-N floor is NEUTRAL — the sub cannot lift, so no pill can render', () => {
  for (const n of [0, 1, 2]) {
    assert.equal(
      compatSubScores({ demandCoupleCount: n }).demandPressure,
      COMPAT_NEUTRAL,
      `n=${n} must sit at neutral`,
    );
    assert.deepEqual(explainCompatScore({ demandCoupleCount: n }), []);
  }
});

test('demand at the floor lifts above neutral, and more demand never scores lower', () => {
  const at = compatSubScores({ demandCoupleCount: MIN_DEMAND_COUPLE_COUNT }).demandPressure;
  const more = compatSubScores({ demandCoupleCount: 6 }).demandPressure;
  const saturated = compatSubScores({ demandCoupleCount: 10 }).demandPressure;
  const absurd = compatSubScores({ demandCoupleCount: 10_000 }).demandPressure;
  assert.ok(at > COMPAT_NEUTRAL, `floor sub ${at} did not lift`);
  assert.ok(more > at && saturated > more, 'the ramp must be monotonic');
  assert.equal(absurd, saturated, 'the lift saturates — a runaway count cannot dominate');
  assert.ok(saturated <= 1);
});

test('absent demand is NEUTRAL, never 0 — "nobody inquired" is unknown, not bad', () => {
  assert.equal(compatSubScores({}).demandPressure, COMPAT_NEUTRAL);
  assert.equal(compatSubScores({ demandCoupleCount: null }).demandPressure, COMPAT_NEUTRAL);
  // A vendor with no demand signal must not rank below one with a below-floor
  // signal — both are "no signal".
  assert.equal(
    computeCompatScore({ verified: true, demandCoupleCount: null }).score,
    computeCompatScore({ verified: true, demandCoupleCount: 2 }).score,
  );
});

test('the demand reason phrase states the measurement — never a scarcity claim', () => {
  const reasons = explainCompatScore({ demandCoupleCount: 4 });
  assert.deepEqual(reasons, ['4 couples inquired for your date']);
  const banned = /only \d+ left|booking fast|almost gone|lock it in|selling out|hurry/i;
  for (const n of [3, 5, 12, 99]) {
    for (const r of explainCompatScore({ demandCoupleCount: n })) {
      assert.ok(!banned.test(r), `forbidden scarcity copy: "${r}"`);
    }
  }
});

test('topCompatDimension never picks demandPressure under the GLOBAL weights (weight 0)', () => {
  assert.equal(topCompatDimension({ demandCoupleCount: 25 }), null);
});
