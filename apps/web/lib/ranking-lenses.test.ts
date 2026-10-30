/**
 * Unit suite for the ranking-lens registry (Explore_Replan §15).
 *
 * Most cases are stated as the DEFECT they lock out, because most of them lock
 * out a defect that would be invisible in review: a weight vector that quietly
 * stops summing to 1, a lens whose "tidied" weights make it a no-op, a chip
 * offered over data that cannot order it, or a card claiming something the
 * data underneath cannot support.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  BUDGET_WEIGHTS,
  DEMAND_WEIGHTS,
  FORBIDDEN_LENS_COPY,
  FRESHNESS_WINDOW_DAYS,
  LENSES,
  LENS_ORDER,
  NEAREST_WEIGHTS,
  NEW_HERE_WEIGHTS,
  findForbiddenLensCopy,
  freshnessRatioFrom,
  isLensAvailable,
  isLensKey,
  visibleLenses,
  weightSum,
  type LensKey,
} from './ranking-lenses';
import {
  COMPAT_NEUTRAL,
  COMPAT_WEIGHTS,
  MIN_DEMAND_COUPLE_COUNT,
  compatSubScores,
  computeCompatScore,
  topCompatDimension,
  type CompatDimension,
  type CompatInputs,
} from './compat-score';

const DAY_MS = 86_400_000;
const NOW = Date.parse('2026-07-27T00:00:00.000Z');

// ───────────────────────────────────────────────────────────────────────────
// 1 · The sum-to-one invariant, asserted PER MEMBER
// ───────────────────────────────────────────────────────────────────────────

test('every lens weight vector sums to exactly 1.000', () => {
  for (const key of LENS_ORDER) {
    const sum = weightSum(LENSES[key].weights);
    assert.ok(
      Math.abs(sum - 1) < 1e-9,
      `lens "${key}" sums to ${sum}, not 1.000 — the 0–100 range and the ` +
        `strong/good/fair tiers stop meaning the same thing across lenses`,
    );
  }
});

test('the registry covers every lens key exactly once, and LENS_ORDER matches', () => {
  assert.equal(LENS_ORDER.length, 5);
  assert.deepEqual([...LENS_ORDER].sort(), Object.keys(LENSES).sort());
  for (const key of LENS_ORDER) assert.equal(LENSES[key].key, key);
});

test('every lens vector carries a weight for every dimension (no silent omission)', () => {
  const dims = Object.keys(COMPAT_WEIGHTS) as CompatDimension[];
  for (const key of LENS_ORDER) {
    for (const dim of dims) {
      assert.equal(
        typeof LENSES[key].weights[dim],
        'number',
        `lens "${key}" has no weight for "${dim}" — an omitted dimension reads ` +
          `as NaN in the composite, not as zero`,
      );
    }
  }
});

// ───────────────────────────────────────────────────────────────────────────
// 2 · COMPAT_WEIGHTS is unchanged, so every existing caller is unchanged
// ───────────────────────────────────────────────────────────────────────────

test('COMPAT_WEIGHTS still holds its shipped values — existing callers unchanged', () => {
  // `_actions/category-search.ts`, `build-3state-actions.ts`,
  // `build-3state-fallback-actions.ts`, `vendor-autoreply/auto-accept.ts`,
  // `plan-budget-accordion.tsx` and `app/tour/vendors/page.tsx` all call the
  // scorer with ONE argument. If any number below moves, every one of those
  // surfaces silently re-ranks.
  assert.equal(COMPAT_WEIGHTS.refinement, 0.22);
  assert.equal(COMPAT_WEIGHTS.budgetFit, 0.2);
  assert.equal(COMPAT_WEIGHTS.distance, 0.18);
  assert.equal(COMPAT_WEIGHTS.reviews, 0.18);
  assert.equal(COMPAT_WEIGHTS.dateHeadroom, 0.08);
  assert.equal(COMPAT_WEIGHTS.faithFit, 0.07);
  assert.equal(COMPAT_WEIGHTS.trust, 0.07);
  // The two lens-only dimensions are ZERO in the global vector — that is what
  // makes adding them a no-op everywhere else.
  assert.equal(COMPAT_WEIGHTS.demandPressure, 0);
  assert.equal(COMPAT_WEIGHTS.freshness, 0);
  assert.ok(Math.abs(weightSum(COMPAT_WEIGHTS) - 1) < 1e-9);
});

test('"Best matches" IS COMPAT_WEIGHTS — the same object, so they cannot drift', () => {
  assert.equal(LENSES.fit.weights, COMPAT_WEIGHTS);
});

test('the defaulted weights argument produces byte-identical scores', () => {
  const cases: CompatInputs[] = [
    {},
    { distanceKm: 3.2, travelRadiusKm: 20, avgRating: 4.8, reviewCount: 40, verified: true },
    { budgetFitRatio: 1, faithMatch: true, dateHeadroomRatio: 1 },
    { preferenceMatchRatio: 0.9, distanceKm: 55, reviewCount: 0 },
    // Both lens-only inputs present: still inert at weight 0.
    { demandCoupleCount: 9, freshnessRatio: 1, avgRating: 4.2, reviewCount: 12 },
  ];
  for (const input of cases) {
    const implicit = computeCompatScore(input);
    assert.deepEqual(computeCompatScore(input, COMPAT_WEIGHTS), implicit);
    assert.deepEqual(computeCompatScore(input, LENSES.fit.weights), implicit);
  }
});

test('the two lens-only dimensions cannot move a default-weights score', () => {
  const base: CompatInputs = { distanceKm: 8, avgRating: 4.4, reviewCount: 20, verified: true };
  const withExtras: CompatInputs = { ...base, demandCoupleCount: 10, freshnessRatio: 1 };
  assert.deepEqual(computeCompatScore(withExtras), computeCompatScore(base));
  // …and they cannot win the reason pill either, because a zero weight is a
  // zero lift. Without this, every vendor would claim to be new.
  assert.notEqual(topCompatDimension(withExtras), 'freshness');
  assert.notEqual(topCompatDimension(withExtras), 'demandPressure');
});

// ───────────────────────────────────────────────────────────────────────────
// 3 · Each lens actually leans where it claims to
// ───────────────────────────────────────────────────────────────────────────

test('"Nearest" puts distance ahead of every other dimension', () => {
  assert.equal(NEAREST_WEIGHTS.distance, 0.45);
  for (const dim of Object.keys(NEAREST_WEIGHTS) as CompatDimension[]) {
    if (dim === 'distance') continue;
    assert.ok(NEAREST_WEIGHTS[dim] < NEAREST_WEIGHTS.distance);
  }
  // The chip has to CHANGE something. A nearer-but-unrated vendor loses to a
  // further-but-proven one under the default vector, and wins under this one —
  // otherwise "Nearest" is decoration.
  const near: CompatInputs = { distanceKm: 12 };
  const far: CompatInputs = { distanceKm: 25, avgRating: 5, reviewCount: 200 };
  assert.ok(
    computeCompatScore(near).score < computeCompatScore(far).score,
    'the default vector should prefer the proven vendor here',
  );
  assert.ok(
    computeCompatScore(near, NEAREST_WEIGHTS).score >
      computeCompatScore(far, NEAREST_WEIGHTS).score,
    'the "Nearest" lens must flip that order — proximity leads',
  );
});

test('"Fits your budget" puts budgetFit ahead of every other dimension', () => {
  assert.equal(BUDGET_WEIGHTS.budgetFit, 0.4);
  for (const dim of Object.keys(BUDGET_WEIGHTS) as CompatDimension[]) {
    if (dim === 'budgetFit') continue;
    assert.ok(BUDGET_WEIGHTS[dim] < BUDGET_WEIGHTS.budgetFit);
  }
});

test('"Fits your budget" ranks distance-from-over-budget, NOT value', () => {
  // The honesty constraint, expressed as arithmetic: `priceFitScore` returns a
  // flat 1.0 for every vendor at or under budget, so a cheap and an expensive
  // in-budget vendor are INDISTINGUISHABLE to this lens. This tie is exactly
  // why "best value" / "cheapest" copy is forbidden below — it is not a style
  // preference, the data cannot support the claim.
  const cheapInBudget: CompatInputs = { budgetFitRatio: 1 };
  const pricyInBudget: CompatInputs = { budgetFitRatio: 1 };
  assert.deepEqual(
    computeCompatScore(cheapInBudget, BUDGET_WEIGHTS),
    computeCompatScore(pricyInBudget, BUDGET_WEIGHTS),
  );
  // What it CAN do is sink the vendor who would break the budget.
  const overBudget: CompatInputs = { budgetFitRatio: 0.2 };
  assert.ok(
    computeCompatScore(cheapInBudget, BUDGET_WEIGHTS).score >
      computeCompatScore(overBudget, BUDGET_WEIGHTS).score,
  );
});

test('"New here" drops reviews to 0.06 — lowering reviews IS the lens', () => {
  assert.equal(NEW_HERE_WEIGHTS.freshness, 0.25);
  assert.equal(NEW_HERE_WEIGHTS.reviews, 0.06);
  assert.ok(
    NEW_HERE_WEIGHTS.reviews < COMPAT_WEIGHTS.reviews / 2,
    'reviews must stay well below the global weight or an established rival ' +
      'out-ranks the newcomer and the lens returns Best-matches order',
  );

  // The defect this locks out, concretely. Both vendors are verified and the
  // same distance away, so the ONLY things separating them are freshness and
  // reviews — which is exactly the trade-off this lens exists to make.
  const newcomer: CompatInputs = { freshnessRatio: 1, reviewCount: 0, verified: true, distanceKm: 10 };
  const established: CompatInputs = {
    freshnessRatio: null,
    avgRating: 4.9,
    reviewCount: 90,
    verified: true,
    distanceKm: 10,
  };
  assert.ok(
    computeCompatScore(newcomer, NEW_HERE_WEIGHTS).score >
      computeCompatScore(established, NEW_HERE_WEIGHTS).score,
    'a brand-new vendor must lead the "New here" lens',
  );

  // Now "tidy" reviews back to the global 0.18, taking the difference out of
  // freshness — a plausible-looking refactor that still sums to 1. The newcomer
  // immediately LOSES to the proven rival and the lens quietly returns
  // Best-matches order. That is why 0.06 is load-bearing and not a typo.
  const reviewsNotLowered = { ...NEW_HERE_WEIGHTS, reviews: 0.18, freshness: 0.13 };
  assert.ok(Math.abs(weightSum(reviewsNotLowered) - 1) < 1e-9);
  assert.ok(
    computeCompatScore(newcomer, reviewsNotLowered).score <
      computeCompatScore(established, reviewsNotLowered).score,
    'with reviews back at full weight the lens stops favouring newcomers — ' +
      'this is why 0.06 is load-bearing',
  );
});

test('"In demand" weights demandPressure but never lets it dominate', () => {
  assert.equal(DEMAND_WEIGHTS.demandPressure, 0.22);
  assert.ok(
    DEMAND_WEIGHTS.demandPressure < NEAREST_WEIGHTS.distance,
    'demand is a fact about OTHER people; it may shade the order, never own it',
  );
});

test('freshness and demand only ever LIFT — never a penalty', () => {
  // "Nobody inquired" and "we have no data" are indistinguishable, as are
  // "verified two years ago" and "no anchor recorded". Both must sit at NEUTRAL,
  // so an established vendor cannot be pushed below an unknown one.
  const blank = compatSubScores({});
  assert.equal(blank.freshness, COMPAT_NEUTRAL);
  assert.equal(blank.demandPressure, COMPAT_NEUTRAL);
  assert.equal(compatSubScores({ freshnessRatio: null }).freshness, COMPAT_NEUTRAL);
  assert.equal(compatSubScores({ freshnessRatio: 0 }).freshness, COMPAT_NEUTRAL);
  assert.ok(compatSubScores({ freshnessRatio: 1 }).freshness > COMPAT_NEUTRAL);
  const established: CompatInputs = { avgRating: 4.6, reviewCount: 40, verified: true };
  assert.ok(
    computeCompatScore(established, NEW_HERE_WEIGHTS).score >= 0,
    'an established vendor still scores under the newcomer lens',
  );
});

// ───────────────────────────────────────────────────────────────────────────
// 4 · The freshness anchor
// ───────────────────────────────────────────────────────────────────────────

test('freshnessRatioFrom decays across the window, then reads UNKNOWN not zero', () => {
  const at = (days: number) => new Date(NOW - days * DAY_MS).toISOString();
  assert.equal(freshnessRatioFrom(at(0), NOW), 1);
  assert.ok(Math.abs((freshnessRatioFrom(at(45), NOW) ?? -1) - 0.5) < 1e-9);
  // Past the window is NULL, never 0 — being established is not a defect, and
  // 0 would actively push a long-standing vendor below an unknown one.
  assert.equal(freshnessRatioFrom(at(FRESHNESS_WINDOW_DAYS + 1), NOW), null);
  assert.equal(freshnessRatioFrom(at(400), NOW), null);
});

test('freshnessRatioFrom returns null — never 0 — for every uncertain input', () => {
  assert.equal(freshnessRatioFrom(null, NOW), null);
  assert.equal(freshnessRatioFrom(undefined, NOW), null);
  assert.equal(freshnessRatioFrom('', NOW), null);
  assert.equal(freshnessRatioFrom('not-a-date', NOW), null);
  // Clock skew / a future stamp must not mint a head-start.
  assert.equal(freshnessRatioFrom(new Date(NOW + 5 * DAY_MS).toISOString(), NOW), null);
});

// ───────────────────────────────────────────────────────────────────────────
// 5 · The visibility gate (§15.2)
// ───────────────────────────────────────────────────────────────────────────

const blankCandidate: CompatInputs = {};

test('"Best matches" is always offerable, even at zero resolved inputs', () => {
  assert.equal(isLensAvailable('fit', []), true);
  assert.equal(isLensAvailable('fit', [blankCandidate]), true);
});

test('a lens is hidden below 3 candidates or below 2 measured ones', () => {
  const measured: CompatInputs = { distanceKm: 4 };
  // Three candidates but only one measured → nothing to put in order.
  assert.equal(isLensAvailable('near', [measured, blankCandidate, blankCandidate]), false);
  // Two measured out of three → offerable.
  assert.equal(isLensAvailable('near', [measured, measured, blankCandidate]), true);
  // Plenty measured but too few candidates → a rail of two needs no lens.
  assert.equal(isLensAvailable('near', [measured, measured]), false);
});

test('each lens gates on ITS OWN driving input, not on any other', () => {
  const three = (c: CompatInputs) => [c, c, c];
  assert.equal(isLensAvailable('near', three({ budgetFitRatio: 1 })), false);
  assert.equal(isLensAvailable('budget', three({ distanceKm: 3 })), false);
  assert.equal(isLensAvailable('new', three({ distanceKm: 3 })), false);
  assert.equal(isLensAvailable('near', three({ distanceKm: 3 })), true);
  assert.equal(isLensAvailable('budget', three({ budgetFitRatio: 0.8 })), true);
  assert.equal(isLensAvailable('new', three({ freshnessRatio: 0.9 })), true);
});

test('an empty marketplace offers exactly one lens — Best matches', () => {
  // Prod, measured 2026-07-27: one unverified `coming_soon` profile; zero
  // services, packages, reviews, stats. This is correct behaviour, not a bug.
  const chips = visibleLenses([]);
  assert.deepEqual(
    chips.filter((c) => !c.disabled).map((c) => c.key),
    ['fit'],
  );
});

test('an unavailable lens is DISABLED with an honest reason, not silently dropped', () => {
  const chips = visibleLenses([blankCandidate, blankCandidate, blankCandidate]);
  const near = chips.find((c) => c.key === 'near');
  assert.ok(near, 'the "Nearest" chip stays visible so the couple can learn why');
  assert.equal(near.disabled, true);
  assert.equal(near.reason, 'Add your venue to sort by distance.');
});

test('the "In demand" chip is REMOVED, never greyed, when it cannot render', () => {
  // The one lens with no honest disabled wording: every phrasing either implies
  // a scarcity concept nothing measures, or discloses the absence of other
  // couples' activity on this couple's date. §15.3 — below the floor it renders
  // nothing at all, chip included.
  const chips = visibleLenses([blankCandidate, blankCandidate, blankCandidate]);
  assert.equal(
    chips.some((c) => c.key === 'demand'),
    false,
  );
  assert.equal(LENSES.demand.unavailableReason, null);
});

test('the n<3 demand floor renders NOTHING — no chip, no lift, no pill', () => {
  const below = (n: number): CompatInputs[] => [
    { demandCoupleCount: n },
    { demandCoupleCount: n },
    { demandCoupleCount: n },
  ];
  for (const n of [1, 2]) {
    assert.equal(
      isLensAvailable('demand', below(n)),
      false,
      `a count of ${n} must not light up the lens`,
    );
    assert.equal(
      visibleLenses(below(n)).some((c) => c.key === 'demand'),
      false,
    );
    // …and it contributes no lift, so no card can carry a demand pill either.
    assert.equal(compatSubScores({ demandCoupleCount: n }).demandPressure, COMPAT_NEUTRAL);
  }
  // 3 is the first count that ships.
  assert.equal(MIN_DEMAND_COUPLE_COUNT, 3);
  assert.equal(isLensAvailable('demand', below(3)), true);
  assert.ok(compatSubScores({ demandCoupleCount: 3 }).demandPressure > COMPAT_NEUTRAL);
});

test('isLensKey accepts exactly the five keys', () => {
  for (const key of LENS_ORDER) assert.equal(isLensKey(key), true);
  for (const other of ['price', 'rating', '', 'FIT', 'nearest', 'demand ']) {
    assert.equal(isLensKey(other), false);
  }
});

// ───────────────────────────────────────────────────────────────────────────
// 6 · Honesty guardrails (§15.4) — CI-checkable
// ───────────────────────────────────────────────────────────────────────────

test('the forbidden-vocabulary guard catches every banned claim', () => {
  const banned = [
    // Value language the budget lens cannot support.
    'Best value in your budget',
    'The cheapest photographer near you',
    'Most for your money',
    'Best price for your date',
    // Scarcity language nothing counts.
    'Only 2 left for your date',
    'Only a few slots left',
    '3 slots left',
    'Booking fast',
    'Almost gone',
    'Nearly gone',
    'Lock it in soon',
    'Selling fast',
    'Going fast',
    'Last chance to book',
    'Hurry — 3 couples inquired',
    'Act now',
    // Endorsement language freshness cannot support.
    'Vetted by our team',
    'Hand-picked for you',
    'Handpicked for you',
    'A curated newcomer',
    'Endorsed by Setnayan',
    'A rising star',
    // Quality language the fit score cannot support.
    'Best vendors for your wedding',
    'Top-rated match',
    'Recommended by Setnayan',
  ];
  for (const phrase of banned) {
    assert.ok(
      findForbiddenLensCopy(phrase) != null,
      `"${phrase}" must be caught by FORBIDDEN_LENS_COPY — a card can otherwise ` +
        `claim something no column on this platform measures`,
    );
  }
});

test('every string the lens control can render is clean', () => {
  for (const key of LENS_ORDER) {
    const lens = LENSES[key];
    assert.equal(findForbiddenLensCopy(lens.label), null, `lens label "${lens.label}"`);
    if (lens.unavailableReason) {
      assert.equal(findForbiddenLensCopy(lens.unavailableReason), null, lens.unavailableReason);
    }
  }
});

test('the guard does not fire on honest, measured copy', () => {
  // Each of these states something a column actually holds. A guard that
  // flagged them would push authors toward vaguer, less honest wording.
  for (const ok of [
    '3 couples inquired for your date',
    'Fits your budget · est.',
    'Over budget (est.)',
    'Closest to your venue',
    '3.2 km from your venue',
    'New on Setnayan',
    'Newest on Setnayan',
    'Most reviewed',
    'Free on your date',
    'Matches your style',
    'Verified',
    'Add your venue to sort by distance.',
  ]) {
    assert.equal(findForbiddenLensCopy(ok), null, `"${ok}" is honest and must pass`);
  }
});

test('the forbidden list is documented — every entry names its lens and reason', () => {
  assert.ok(FORBIDDEN_LENS_COPY.length > 0);
  for (const entry of FORBIDDEN_LENS_COPY) {
    assert.ok(entry.why.length > 0, 'an unexplained ban gets deleted by the next author');
    assert.ok((['fit', 'near', 'budget', 'new', 'demand'] as LensKey[]).includes(entry.lens as LensKey));
  }
});
