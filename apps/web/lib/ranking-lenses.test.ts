/**
 * Unit suite for the ranking-lens registry (Explore_Replan §15).
 *
 * The load-bearing assertions here are invariants, not examples: every vector
 * sums to 1.000, the default vector is the untouched `COMPAT_WEIGHTS`, and a
 * lens that cannot discriminate is not offerable. Each is stated as the defect
 * it locks out.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  isLensAvailable,
  isLensKey,
  lensWeights,
  LENSES,
  LENS_ORDER,
  NEAREST_WEIGHTS,
  weightSum,
  type LensCandidate,
} from './ranking-lenses';
import { COMPAT_WEIGHTS, computeCompatScore, type CompatWeights } from './compat-score';

// ─────────────────────────────────────────────────────────────────────────────
// The sum-to-one invariant — asserted for EVERY member of the registry.
// A vector that doesn't sum to 1 silently rescales every score it produces, so
// two lenses would no longer be comparable and the 0–100 range would stop
// meaning anything. This is the test the spec asks CI to fail on.
// ─────────────────────────────────────────────────────────────────────────────

for (const key of LENS_ORDER) {
  test(`lens "${key}" weight vector sums to exactly 1.000`, () => {
    // Float addition, so compare within an epsilon far tighter than any weight.
    assert.ok(
      Math.abs(weightSum(LENSES[key].weights) - 1) < 1e-9,
      `${key} sums to ${weightSum(LENSES[key].weights)}`,
    );
  });

  test(`lens "${key}" has no negative or absent weight`, () => {
    const w = LENSES[key].weights;
    for (const dim of Object.keys(COMPAT_WEIGHTS) as (keyof CompatWeights)[]) {
      assert.equal(typeof w[dim], 'number', `${key}.${dim} missing`);
      assert.ok(w[dim] >= 0, `${key}.${dim} is negative`);
    }
  });
}

test('exactly two lenses ship — the other three are owner-blocked', () => {
  // "Fits your budget" (priceFitScore ties every in-budget vendor at 1.0),
  // "New here" (no freshness anchor column exists) and "In demand right now"
  // (the signal counts SAVES, not inquiries — manufactured scarcity) must not
  // appear until their blockers clear. This asserts they were not quietly
  // stubbed in.
  assert.deepEqual([...LENS_ORDER], ['fit', 'near']);
  assert.deepEqual(Object.keys(LENSES).sort(), ['fit', 'near']);
});

// ─────────────────────────────────────────────────────────────────────────────
// The default lens must be the UNCHANGED production vector.
// ─────────────────────────────────────────────────────────────────────────────

test('"Best matches" is COMPAT_WEIGHTS itself — every existing caller is unchanged', () => {
  assert.equal(LENSES.fit.weights, COMPAT_WEIGHTS);
  assert.deepEqual({ ...LENSES.fit.weights }, { ...COMPAT_WEIGHTS });
});

test('COMPAT_WEIGHTS still holds its shipped values to the digit', () => {
  // A regression guard on the constant itself: `category-search.ts`,
  // `build-3state-actions.ts`, `plan-budget-accordion.tsx`, `app/tour/vendors`
  // and `vendor-autoreply` all score against it and none of them passes a
  // vector, so editing a number here silently moves five other surfaces.
  assert.deepEqual(
    { ...COMPAT_WEIGHTS },
    {
      refinement: 0.22,
      budgetFit: 0.2,
      distance: 0.18,
      reviews: 0.18,
      dateHeadroom: 0.08,
      faithFit: 0.07,
      trust: 0.07,
      // Landed by #3839 as an INPUT only. Weight 0 globally and 0 in every lens
      // here — "In demand right now" is still owner-blocked.
      demandPressure: 0,
    },
  );
});

test('demandPressure carries ZERO weight in every shipped lens', () => {
  // The blocked-lens guard with teeth. #3839 made the demand INPUT honest
  // (inquiry-backed, floored at n>=3), but the owner has not ruled on the min-N
  // question and there is no capacity read — so no lens may let scarcity move a
  // vendor's position. A non-zero here would ship the blocked behaviour without
  // ever adding a chip for it.
  for (const key of LENS_ORDER) {
    assert.equal(LENSES[key].weights.demandPressure, 0, `${key} gives demand weight`);
  }
});

test('omitting the weights argument reproduces the pre-lens score exactly', () => {
  const input = { distanceKm: 12, avgRating: 4.4, reviewCount: 30, verified: true };
  assert.equal(computeCompatScore(input).score, computeCompatScore(input, COMPAT_WEIGHTS).score);
});

// ─────────────────────────────────────────────────────────────────────────────
// The "Nearest" vector must actually be about distance.
// ─────────────────────────────────────────────────────────────────────────────

test('Nearest raises distance to 0.45 and lowers every other ACTIVE dimension', () => {
  assert.equal(NEAREST_WEIGHTS.distance, 0.45);
  for (const dim of Object.keys(COMPAT_WEIGHTS) as (keyof CompatWeights)[]) {
    if (dim === 'distance') continue;
    // Dimensions that are inert globally (weight 0) stay inert — there is
    // nothing to rebalance down, and raising one here would quietly ship a
    // blocked lens's behaviour under a different name.
    if (COMPAT_WEIGHTS[dim] === 0) {
      assert.equal(NEAREST_WEIGHTS[dim], 0, `${dim} is inert globally but weighted in Nearest`);
      continue;
    }
    assert.ok(
      NEAREST_WEIGHTS[dim] < COMPAT_WEIGHTS[dim],
      `${dim} was not rebalanced down (${NEAREST_WEIGHTS[dim]} vs ${COMPAT_WEIGHTS[dim]})`,
    );
  }
});

test('Nearest reorders a pair that Best matches ranks the other way', () => {
  // A close-but-unrated vendor vs a far-but-well-reviewed one. Under the
  // default vector reviews (0.18) out-weigh the distance gap; under Nearest
  // (0.45) proximity leads. If both lenses returned the same order the lens
  // would be decorative.
  const close = { distanceKm: 1, avgRating: null, reviewCount: 0 };
  const far = { distanceKm: 14, avgRating: 4.9, reviewCount: 120 };

  const fitClose = computeCompatScore(close, lensWeights('fit')).score;
  const fitFar = computeCompatScore(far, lensWeights('fit')).score;
  const nearClose = computeCompatScore(close, lensWeights('near')).score;
  const nearFar = computeCompatScore(far, lensWeights('near')).score;

  assert.ok(fitFar > fitClose, 'Best matches should favour the proven vendor here');
  assert.ok(nearClose > nearFar, 'Nearest should favour the close vendor here');
});

// ─────────────────────────────────────────────────────────────────────────────
// §15.2 · the visibility gate. A sort that silently no-ops must not be offered.
// ─────────────────────────────────────────────────────────────────────────────

const cand = (km: number | null): LensCandidate => ({ distanceKm: km });

test('the default lens is always offerable, even with nothing on the bench', () => {
  assert.equal(isLensAvailable('fit', []), true);
  assert.equal(isLensAvailable('fit', [cand(null)]), true);
});

test('Nearest is hidden when the event has no venue anchor (every distance null)', () => {
  // The whole-bench case this exists for: `events.venue_latitude` is NULL, so
  // every haversine is null and the chip would reorder nothing at all.
  assert.equal(isLensAvailable('near', [cand(null), cand(null), cand(null), cand(null)]), false);
});

test('Nearest is hidden when only ONE vendor is measurable — nothing to order', () => {
  assert.equal(isLensAvailable('near', [cand(4), cand(null), cand(null)]), false);
});

test('Nearest is hidden below the three-candidate floor', () => {
  assert.equal(isLensAvailable('near', [cand(4), cand(9)]), false);
});

test('Nearest appears at three candidates with two measurable', () => {
  assert.equal(isLensAvailable('near', [cand(4), cand(9), cand(null)]), true);
});

test('a hidden Nearest still carries honest copy for the disabled chip', () => {
  assert.equal(LENSES.near.unavailableReason, 'Add your venue to sort by distance.');
  // The default lens never needs one — it is never disabled.
  assert.equal(LENSES.fit.unavailableReason, null);
});

test('isLensKey rejects the plain sorts and anything hand-typed', () => {
  assert.equal(isLensKey('fit'), true);
  assert.equal(isLensKey('near'), true);
  assert.equal(isLensKey('price'), false);
  assert.equal(isLensKey('rating'), false);
  assert.equal(isLensKey('budget'), false);
  assert.equal(isLensKey(''), false);
});
