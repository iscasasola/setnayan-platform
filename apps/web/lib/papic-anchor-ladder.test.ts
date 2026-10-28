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

test('the anchors reproduce ALL SEVENTEEN live prices, to the peso — the editor’s output IS the live ladder', () => {
  for (const [shots, expectedPhp] of PAPIC_LADDER_EXPECTED) {
    assert.equal(
      papicPriceAt(shots),
      expectedPhp,
      `${shots} shots: the anchors compute a different price than the one being ` +
        `charged today — this would be a repricing disguised as a refactor`,
    );
  }
});

test('every priced rung is typed — a Save never recomputes the owner’s prices (owner 2026-10-28)', () => {
  const ladder = buildPapicLadder(ALL_SHOTS);
  const anchors = ladder.filter((r) => r.isAnchor);
  const computed = ladder.filter((r) => !r.isAnchor);

  // ⚖ "No use the price agreed and what i inputed": all seventeen are typed; was six typed, eleven computed.
  assert.equal(anchors.length, PAPIC_LADDER_EXPECTED.length, 'the owner types every price');
  assert.equal(computed.length, 0, 'no rung may compute — it would overwrite a typed (App Store) price on Save');
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

test('the per-credit rate never rises through the owner’s ladder', () => {
  // The rate is what an anchor actually controls, so it is asserted directly
  // rather than inferred from the totals.
  const expectedBands: [number, number][] = [
    // 💲 2026-10-28 one-price ladder (was 0.70 · 0.56 · 0.45 · 0.36 · 0.30 · 0.24).
    [100, 0.95], [500, 0.93], [1_000, 0.929], [2_000, 0.9225],
    [3_000, 0.738], [7_000, 0.738],
    [10_000, 0.595],
    [20_000, 0.4744], [30_000, 0.4744],
    [50_000, 0.39532],
    [100_000, 0.31625],
  ];
  for (const [shots, rate] of expectedBands) {
    assert.ok(
      Math.abs((papicRateAt(shots) ?? -1) - rate) < 1e-12,
      `${shots} shots should price at ₱${rate} a shot, got ${papicRateAt(shots)}`,
    );
  }
});

test('AN ANCHOR IS LOAD-BEARING — dropping 20,000 makes it cost two 10,000s', () => {
  // The owner's first cut had four anchors. This is the measurement that bought
  // the fifth, kept as a test so nobody "simplifies" it back.
  const withoutFifth = PAPIC_ANCHORS_DEFAULT.filter(([s]) => s !== 20_000);

  // 💲 2026-10-28 one-price ladder (was 9,000 / 13,500 / 7,200 / 10,800 / 9,000).
  assert.equal(papicPriceAt(20_000, withoutFifth), 11_900, '20,000 would inherit 0.595');
  // 30,000 is its own anchor since 2026-10-28, so only 20,000 moves.
  assert.equal(papicPriceAt(30_000, withoutFifth), 14_232, '30,000 is typed — it does not move');
  assert.equal(papicPriceAt(20_000), 9_488, 'with the fifth anchor it stays ₱9,488');
  assert.equal(papicPriceAt(30_000), 14_232, 'with the fifth anchor it stays ₱14,232');

  // And the reason he accepted it: without the fifth anchor, 20,000 costs
  // exactly what two 10,000s cost, so the bigger rung buys nothing.
  const twoTens = papicPriceAt(10_000)! * 2;
  assert.equal(twoTens, 11_900);
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
    // 💲 2026-10-28: ₱7,500 puts 10,000 at ₱0.75 a credit, above 3,000's ₱0.738, while every total still rises
    // (₱5,166 → ₱7,500 → ₱9,488). (Was ₱6,000 against the old ladder.)
    s === 10_000 ? ([s, 7_500] as const) : ([s, p] as const),
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
