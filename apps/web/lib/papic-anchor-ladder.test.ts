/**
 * THE ANCHORS MUST REPRODUCE THE LADDER THAT IS ALREADY BEING CHARGED.
 *
 * 🔑 THE EXPECTATION IS IMPORTED, NEVER RETYPED. Every number here comes from
 * `tests/db/papic-ladder.expected.ts` — the file that already exists precisely
 * because this ladder was once written down twice and the two copies drifted.
 * If this test held its own list of sixteen prices it would be the third copy,
 * and a repricing could leave it agreeing with nothing.
 *
 * WHAT THIS PROVES: turning sixteen typed prices into five typed prices plus
 * eleven computed ones is a REFACTOR, not a repricing. The moment that stops
 * being true, this goes red.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  PAPIC_ANCHORS_DEFAULT,
  PAPIC_ANCHOR_SHOTS,
  buildPapicLadder,
  isPapicAnchor,
  ladderComplaints,
  papicPriceAt,
  papicRateAt,
} from './papic-anchor-ladder';
import { PAPIC_LADDER_EXPECTED } from '../tests/db/papic-ladder.expected';

const ALL_SHOTS = PAPIC_LADDER_EXPECTED.map(([shots]) => shots);

test('the six anchors reproduce ALL SEVENTEEN live prices, to the peso', () => {
  for (const [shots, expectedPhp] of PAPIC_LADDER_EXPECTED) {
    assert.equal(
      papicPriceAt(shots),
      expectedPhp,
      `${shots} shots: the anchors compute a different price than the one being ` +
        `charged today — this would be a repricing disguised as a refactor`,
    );
  }
});

test('exactly six rungs are typed; the other eleven are computed', () => {
  const ladder = buildPapicLadder(ALL_SHOTS);
  const anchors = ladder.filter((r) => r.isAnchor);
  const computed = ladder.filter((r) => !r.isAnchor);

  assert.equal(anchors.length, 6, 'the owner types six prices');
  assert.equal(computed.length, 11, 'eleven rungs must compute');
  assert.equal(
    anchors.length + computed.length,
    PAPIC_LADDER_EXPECTED.length,
    'every rung is either typed or computed — none is unaccounted for',
  );
  assert.deepEqual(
    anchors.map((r) => r.shots),
    [...PAPIC_ANCHOR_SHOTS].sort((a, b) => a - b),
  );
});

test('the per-credit rate steps down through the six bands the owner set', () => {
  // The rate is what an anchor actually controls, so it is asserted directly
  // rather than inferred from the totals.
  const expectedBands: [number, number][] = [
    [100, 0.7], [2_000, 0.7],
    [3_000, 0.56], [7_000, 0.56],
    [10_000, 0.45],
    [20_000, 0.36], [30_000, 0.36],
    [50_000, 0.3],
    [100_000, 0.24],
  ];
  for (const [shots, rate] of expectedBands) {
    assert.ok(
      Math.abs((papicRateAt(shots) ?? -1) - rate) < 1e-12,
      `${shots} shots should price at ₱${rate} a shot, got ${papicRateAt(shots)}`,
    );
  }
});

test('THE FIFTH ANCHOR IS LOAD-BEARING — dropping it moves two real prices', () => {
  // The owner's first cut had four anchors. This is the measurement that bought
  // the fifth, kept as a test so nobody "simplifies" it back.
  const withoutFifth = PAPIC_ANCHORS_DEFAULT.filter(([s]) => s !== 20_000);

  assert.equal(papicPriceAt(20_000, withoutFifth), 9_000, '20,000 would inherit 0.45');
  assert.equal(papicPriceAt(30_000, withoutFifth), 13_500, '30,000 would inherit 0.45');
  assert.equal(papicPriceAt(20_000), 7_200, 'with the fifth anchor it stays ₱7,200');
  assert.equal(papicPriceAt(30_000), 10_800, 'with the fifth anchor it stays ₱10,800');

  // And the reason he accepted it: without the fifth anchor, 20,000 costs
  // exactly what two 10,000s cost, so the bigger rung buys nothing.
  const twoTens = papicPriceAt(10_000)! * 2;
  assert.equal(twoTens, 9_000);
  assert.equal(
    papicPriceAt(20_000, withoutFifth),
    twoTens,
    'without the fifth anchor the bulk incentive at 20,000 disappears entirely',
  );
  assert.ok(
    papicPriceAt(20_000)! < twoTens,
    'with it, 20,000 is genuinely cheaper than buying 10,000 twice',
  );
});

test('the live ladder is clean under BOTH monotonicity rules', () => {
  assert.deepEqual(ladderComplaints(buildPapicLadder(ALL_SHOTS)), []);
});

test('a bad anchor that keeps totals rising is still caught by the RATE rule', () => {
  // ⚠ THE ONE THAT MATTERS. Raising a middle anchor can leave every total
  // rising while inverting the price per credit — a ladder a check on totals
  // alone reports as clean.
  //
  // 🪤 THIS MUTATION SILENTLY BECAME A NO-OP AND THE TEST CAUGHT IT. It used to
  // bump 10,000 to ₱4,500 — which is 10,000's REAL price since the seed was
  // un-drifted, so the "bad anchor" was the good one and no inversion existed
  // to report. A sabotage that equals the truth proves nothing; ₱6,000 puts
  // 10,000 at ₱0.60 a credit, above 3,000's ₱0.56, while every total still
  // rises (₱3,920 → ₱6,000 → ₱7,200). That is the trap, restored.
  const bumped = PAPIC_ANCHORS_DEFAULT.map(([s, p]) =>
    s === 10_000 ? ([s, 6_000] as const) : ([s, p] as const),
  );
  const rungs = buildPapicLadder(ALL_SHOTS, bumped);

  const totals = rungs.map((r) => r.php!);
  for (let i = 1; i < totals.length; i++) {
    assert.ok(totals[i]! > totals[i - 1]!, 'every total still rises — the trap');
  }

  const complaints = ladderComplaints(rungs);
  assert.ok(
    complaints.some((c) => c.kind === 'rate_rising'),
    'the rate inversion must be reported even though no total falls',
  );
  assert.ok(
    !complaints.some((c) => c.kind === 'total_not_rising'),
    'and it must be reported as a RATE problem, not mislabelled as a total one',
  );
});

test('a falling total is caught too', () => {
  const broken = PAPIC_ANCHORS_DEFAULT.map(([s, p]) =>
    s === 50_000 ? ([s, 100] as const) : ([s, p] as const),
  );
  const complaints = ladderComplaints(buildPapicLadder(ALL_SHOTS, broken));
  assert.ok(complaints.some((c) => c.kind === 'total_not_rising'));
});

test('a rung below the lowest anchor is uncomputable, never free', () => {
  // Failing toward ₱0 would hand shots away; the caller must be told instead.
  assert.equal(papicPriceAt(50), null);
  assert.equal(papicRateAt(50), null);
  const complaints = ladderComplaints(buildPapicLadder([50, ...ALL_SHOTS]));
  assert.ok(complaints.some((c) => c.kind === 'uncomputable'));
});

test('isPapicAnchor agrees with the anchor list', () => {
  for (const shots of ALL_SHOTS) {
    assert.equal(
      isPapicAnchor(shots),
      PAPIC_ANCHOR_SHOTS.includes(shots),
      `${shots}: editable-vs-computed must match the anchor set exactly — a rung ` +
        `drawn as editable that is actually computed is a dead field`,
    );
  }
});
