/**
 * apps/web/lib/papic-cost-comparison.test.ts
 *
 * ⚠ THE PAPIC SIDE IS ASSERTED AGAINST THE SHARED LIVE-SHAPED FIXTURE, NEVER A
 * HARDCODED ₱280. `tests/db/papic-ladder.expected.ts` is the same fixture
 * `papic-anchor-ladder.test.ts` and the `.db.test.ts` fundability guards
 * already compare production against; importing it here means a real reprice
 * of the ladder updates this test for free instead of leaving a second,
 * silently stale copy of "400 shots costs ₱280" sitting in this file.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  buildPapicCostComparison,
  resolvePapicComparisonRung,
  COMPARISON_PHOTOGRAPHER_DAY_RATE_PHP,
  COMPARISON_PHOTOGRAPHER_SHOTS_PER_HOUR,
  COMPARISON_EVENT_HOURS,
  COMPARISON_PHOTOGRAPHER_SHOTS,
  type PapicComparisonRung,
} from './papic-cost-comparison';
import { PAPIC_LADDER_EXPECTED } from '../tests/db/papic-ladder.expected';

/** The real ladder, shaped exactly the way `resolvePapicAnchor()` shapes it. */
const LIVE_SHAPED_RUNGS: readonly PapicComparisonRung[] = PAPIC_LADDER_EXPECTED.map(
  ([shots, pesos]) => ({ bought: shots, peso: pesos }),
);

test('the assumption derives to 400, not a second typed 400', () => {
  assert.equal(COMPARISON_PHOTOGRAPHER_SHOTS_PER_HOUR * COMPARISON_EVENT_HOURS, 400);
  assert.equal(COMPARISON_PHOTOGRAPHER_SHOTS, 400);
});

test('against the live-shaped ladder, the comparison lands on the real 400-credit rung', () => {
  const cmp = buildPapicCostComparison(LIVE_SHAPED_RUNGS);
  assert.notEqual(cmp, null);
  // Pulled straight off the fixture, never retyped — if PAPIC_LADDER_EXPECTED
  // ever moves off [400, 280], this assertion moves with it.
  const [expectedShots, expectedPeso] = PAPIC_LADDER_EXPECTED.find(([s]) => s === 400)!;
  assert.equal(cmp!.papicShots, expectedShots);
  assert.equal(cmp!.papicPeso, expectedPeso);
  assert.equal(cmp!.exactMatch, true);
});

test('the peso-per-shot rates and the multiplier are arithmetic, not asserted numbers', () => {
  const cmp = buildPapicCostComparison(LIVE_SHAPED_RUNGS)!;
  assert.equal(
    cmp.photographerPesoPerShot,
    COMPARISON_PHOTOGRAPHER_DAY_RATE_PHP / COMPARISON_PHOTOGRAPHER_SHOTS,
  );
  assert.equal(cmp.papicPesoPerShot, cmp.papicPeso / cmp.papicShots);
  assert.equal(
    cmp.timesCheaper,
    Math.floor(cmp.photographerPesoPerShot / cmp.papicPesoPerShot),
  );
  // Sanity bound on today's real numbers (₱20/shot vs ₱0.70/shot ≈ 28.57×) —
  // floored, so this can only read as EQUAL OR CHEAPER than reality, never
  // more flattering than the arithmetic.
  assert.equal(cmp.timesCheaper, 28);
});

test('the multiplier never rounds up past the true ratio', () => {
  // A rung priced so the true ratio sits just under a whole number (10,000 /
  // 999 credits ≈ 10.01×) must still floor to 10, not 11 — proves this is
  // Math.floor and not Math.round hiding behind a convenient fixture.
  const rung: PapicComparisonRung = { bought: 999, peso: 1000 };
  const cmp = buildPapicCostComparison([rung])!;
  const trueRatio = cmp.photographerPesoPerShot / cmp.papicPesoPerShot;
  assert.ok(cmp.timesCheaper <= trueRatio);
  assert.equal(cmp.timesCheaper, Math.floor(trueRatio));
});

test('resolvePapicComparisonRung picks the smallest rung that clears the target', () => {
  const rungs: PapicComparisonRung[] = [
    { bought: 100, peso: 70 },
    { bought: 300, peso: 210 },
    { bought: 500, peso: 350 },
    { bought: 1_000, peso: 700 },
  ];
  // No 400 rung exists here — must land on 500, the smallest that clears it,
  // never on the closest by raw distance (300 is numerically closer to 400).
  const hit = resolvePapicComparisonRung(rungs, 400);
  assert.deepEqual(hit, { bought: 500, peso: 350 });
});

test('when every rung falls short of the target, the largest available wins', () => {
  const rungs: PapicComparisonRung[] = [
    { bought: 100, peso: 70 },
    { bought: 200, peso: 140 },
  ];
  const hit = resolvePapicComparisonRung(rungs, 400);
  assert.deepEqual(hit, { bought: 200, peso: 140 });
});

test('an unpriced or empty rung list resolves to null, never a zero price', () => {
  assert.equal(resolvePapicComparisonRung([], 400), null);
  assert.equal(
    resolvePapicComparisonRung([{ bought: 400, peso: 0 }, { bought: 0, peso: 0 }], 400),
    null,
  );
  assert.equal(buildPapicCostComparison([]), null);
});

test('a rung priced above the assumption is not an exact match', () => {
  const cmp = buildPapicCostComparison([{ bought: 500, peso: 350 }])!;
  assert.equal(cmp.papicShots, 500);
  assert.equal(cmp.exactMatch, false);
});
