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

test('the anchors reproduce EVERY live price, to the peso — the editor’s output IS the live ladder', () => {
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

  // ⚖ "No use the price agreed and what i inputed": every pack is typed (three since 2026-11-03).
  assert.equal(anchors.length, PAPIC_LADDER_EXPECTED.length, 'the owner types every price');
  assert.equal(computed.length, 0, 'no rung may compute — it would overwrite a typed (App Store) price on Save');
  assert.deepEqual(
    anchors.map((r) => r.shots),
    [...PAPIC_ANCHOR_SHOTS].sort((a, b) => a - b),
  );
});

test('Papic is THREE packs — 150 · 1,000 · 3,000 (owner 2026-11-03)', () => {
  assert.deepEqual([...PAPIC_ANCHOR_SHOTS], [150, 1_000, 3_000]);
  assert.deepEqual(
    PAPIC_ANCHORS_DEFAULT.map(([s, p]) => [s, p]),
    PAPIC_LADDER_EXPECTED.map(([s, p]) => [s, p]),
    'the editor seed and the expected ladder disagree',
  );
});

test('the per-credit rate never rises through the owner’s ladder', () => {
  // ₱99/150 = 0.66 · ₱499/1,000 = 0.499 · ₱999/3,000 = 0.333 (final price sheet 2026-11-04; was 0.60 · 0.49 · 0.33).
  const expectedBands: [number, number][] = [
    [150, 0.66],
    [1_000, 0.499],
    [3_000, 0.333],
  ];
  for (const [shots, rate] of expectedBands) {
    assert.ok(
      Math.abs((papicRateAt(shots) ?? -1) - rate) < 1e-12,
      `${shots} shots should price at ₱${rate} a shot, got ${papicRateAt(shots)}`,
    );
  }
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
    // 💲 2026-11-03: ₱700 puts 1,000 at ₱0.70 a credit, above 150's ₱0.60, while every total still rises
    // (₱90 → ₱700 → ₱990). (Was 10,000 at ₱7,500 against the seventeen-rung ladder.)
    s === 1_000 ? ([s, 700] as const) : ([s, p] as const),
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
    s === 3_000 ? ([s, 100] as const) : ([s, p] as const),
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
