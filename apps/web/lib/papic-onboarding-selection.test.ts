/**
 * Tests for the onboarding Papic picker's pure math.
 *
 * The fixtures below are SHAPES, not the live ladder: the point of the module is
 * that it works off whatever the catalog resolves to, so pinning it to today's
 * prices would make this suite fail the next time the owner reprices — exactly
 * the coupling papic-copy-guardrails exists to stop.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import type { PapicTypeView } from '@/lib/onboarding/services-step-data';
import {
  EMPTY_PAPIC_SELECTION,
  ONBOARDING_MAX_EXTRA_CAMERAS,
  oneCameraTotal,
  onePriceOf,
  oneRungOf,
  parsePapicSelection,
  poolPriceAt,
  poolRungAt,
  poolShotsAt,
  poolStepCount,
  poolStepOf,
  quotePapicSelection,
  selectionHasPurchase,
  setOneCameras,
  setOneRung,
  stepPool,
} from './papic-onboarding-selection';

const POOL: PapicTypeView = {
  id: 'pool',
  inappKey: 'papic_guest',
  freePoints: 50,
  freeCameras: null,
  rungs: [
    { key: 'P_A', points: 3_000, pricePhp: 1_000 },
    { key: 'P_B', points: 6_000, pricePhp: 2_000 },
    { key: 'P_C', points: 10_000, pricePhp: 3_000 },
  ],
};

const ONE: PapicTypeView = {
  id: 'one',
  inappKey: 'papic_seats',
  freePoints: 5,
  freeCameras: 1,
  rungs: [
    { key: 'O_A', points: 50, pricePhp: 50 },
    { key: 'O_B', points: 100, pricePhp: 100 },
  ],
};

const TYPES = [POOL, ONE];

// ── the pool ladder ────────────────────────────────────────────────────────

test('step 0 is the free floor: real shots, no charge', () => {
  assert.equal(poolStepOf(POOL, EMPTY_PAPIC_SELECTION), 0);
  assert.equal(poolRungAt(POOL, 0), null);
  assert.equal(poolShotsAt(POOL, 0), POOL.freePoints);
  assert.equal(poolPriceAt(POOL, 0), 0);
});

test('the free floor is ADDED to every paid step, never replaced by it', () => {
  for (let step = 1; step < poolStepCount(POOL); step += 1) {
    const rung = poolRungAt(POOL, step);
    assert.ok(rung, `step ${step} must land on a rung`);
    assert.equal(
      poolShotsAt(POOL, step),
      POOL.freePoints + rung!.points,
      'a paid step must include the free grant — it is armed at commit either way',
    );
  }
});

test('+ walks up the ladder and stops at the top; − walks back to free', () => {
  let s = EMPTY_PAPIC_SELECTION;
  const top = poolStepCount(POOL) - 1;
  for (let i = 0; i < top; i += 1) s = stepPool(POOL, s, +1);
  assert.equal(poolStepOf(POOL, s), top);

  // Pressing + at the ceiling is a no-op, not a wrap-around and not an
  // unpriceable step.
  s = stepPool(POOL, s, +1);
  assert.equal(poolStepOf(POOL, s), top);
  assert.equal(poolPriceAt(POOL, poolStepOf(POOL, s)), POOL.rungs[top - 1]!.pricePhp);

  for (let i = 0; i < top + 3; i += 1) s = stepPool(POOL, s, -1);
  assert.equal(poolStepOf(POOL, s), 0, '− bottoms out at the free floor');
  assert.equal(s.poolRungKey, null);
});

test('every reachable step names a rung the catalog priced', () => {
  let s = EMPTY_PAPIC_SELECTION;
  for (let i = 1; i < poolStepCount(POOL); i += 1) {
    s = stepPool(POOL, s, +1);
    assert.ok(
      POOL.rungs.some((r) => r.key === s.poolRungKey),
      'the picker must never land on a key that is not on the live ladder',
    );
  }
});

test('a ladder with no sellable rung still has its free floor', () => {
  const dead: PapicTypeView = { ...POOL, rungs: [] };
  assert.equal(poolStepCount(dead), 1);
  assert.equal(poolShotsAt(dead, 0), dead.freePoints);
  assert.equal(stepPool(dead, EMPTY_PAPIC_SELECTION, +1).poolRungKey, null);
});

test('a selection whose rung was deactivated falls back to FREE, not another rung', () => {
  // The dangerous alternative is resolving by index: rung 2 disappearing would
  // silently slide the couple onto a different — possibly dearer — rung.
  const stale = { ...EMPTY_PAPIC_SELECTION, poolRungKey: 'GONE' };
  assert.equal(poolStepOf(POOL, stale), 0);
  assert.equal(poolPriceAt(POOL, poolStepOf(POOL, stale)), 0);
});

// ── papic one ──────────────────────────────────────────────────────────────

test('the camera count defaults to the free camera alone, at no charge', () => {
  assert.equal(oneCameraTotal(ONE, EMPTY_PAPIC_SELECTION), ONE.freeCameras);
  assert.equal(onePriceOf(ONE, EMPTY_PAPIC_SELECTION), 0);
});

test('extra cameras bill per camera at the chosen rung', () => {
  const s = setOneCameras(ONE, EMPTY_PAPIC_SELECTION, 3);
  assert.equal(s.oneExtraCameras, 3);
  assert.equal(onePriceOf(ONE, s), ONE.rungs[0]!.pricePhp * 3);
  assert.equal(oneCameraTotal(ONE, s), ONE.freeCameras! + 3);
});

test('the rung defaults to the CHEAPEST — a default may never over-quote', () => {
  assert.equal(oneRungOf(ONE, EMPTY_PAPIC_SELECTION)?.key, 'O_A');
  const cheapest = Math.min(...ONE.rungs.map((r) => r.pricePhp));
  assert.equal(oneRungOf(ONE, EMPTY_PAPIC_SELECTION)?.pricePhp, cheapest);
});

test('picking a rung with the counter at zero starts it at one', () => {
  const s = setOneRung(EMPTY_PAPIC_SELECTION, 'O_B');
  assert.equal(s.oneExtraCameras, 1);
  assert.equal(onePriceOf(ONE, s), ONE.rungs[1]!.pricePhp);
});

test('dropping back to zero cameras clears the rung — no phantom purchase', () => {
  const bought = setOneCameras(ONE, EMPTY_PAPIC_SELECTION, 2);
  const cleared = setOneCameras(ONE, bought, 0);
  assert.equal(cleared.oneExtraCameras, 0);
  assert.equal(
    cleared.oneRungKey,
    null,
    'a rung key with a zero count reads as a purchase in every log that sees it',
  );
  assert.equal(selectionHasPurchase(cleared), false);
});

test('the camera stepper is bounded, and the bound is not a product rule', () => {
  const s = setOneCameras(ONE, EMPTY_PAPIC_SELECTION, 9_999);
  assert.equal(s.oneExtraCameras, ONBOARDING_MAX_EXTRA_CAMERAS);
  assert.equal(setOneCameras(ONE, EMPTY_PAPIC_SELECTION, -4).oneExtraCameras, 0);
});

test('no live camera rung ⇒ no camera can be added', () => {
  const dead: PapicTypeView = { ...ONE, rungs: [] };
  const s = setOneCameras(dead, EMPTY_PAPIC_SELECTION, 5);
  assert.equal(s.oneExtraCameras, 0);
  assert.equal(onePriceOf(dead, s), 0);
});

// ── the quote ──────────────────────────────────────────────────────────────

test('the running total is the two products summed', () => {
  let s = stepPool(POOL, EMPTY_PAPIC_SELECTION, +1);
  s = setOneCameras(ONE, s, 2);
  const q = quotePapicSelection(TYPES, s);
  assert.equal(q.poolPhp, POOL.rungs[0]!.pricePhp);
  assert.equal(q.onePhp, ONE.rungs[0]!.pricePhp * 2);
  assert.equal(q.totalPhp, q.poolPhp + q.onePhp);
});

test('touching nothing costs nothing', () => {
  assert.equal(quotePapicSelection(TYPES, EMPTY_PAPIC_SELECTION).totalPhp, 0);
  assert.equal(selectionHasPurchase(EMPTY_PAPIC_SELECTION), false);
});

test('either product alone counts as a purchase', () => {
  assert.equal(selectionHasPurchase(stepPool(POOL, EMPTY_PAPIC_SELECTION, +1)), true);
  assert.equal(selectionHasPurchase(setOneCameras(ONE, EMPTY_PAPIC_SELECTION, 1)), true);
});

// ── the untrusted boundary ─────────────────────────────────────────────────

test('parse strips anything that is not the three fields', () => {
  assert.deepEqual(parsePapicSelection(null), EMPTY_PAPIC_SELECTION);
  assert.deepEqual(parsePapicSelection('P_A'), EMPTY_PAPIC_SELECTION);
  assert.deepEqual(parsePapicSelection(42), EMPTY_PAPIC_SELECTION);
  assert.deepEqual(parsePapicSelection({ poolRungKey: 'P_A', evil: 'x', totalPhp: 0 }), {
    poolRungKey: 'P_A',
    oneRungKey: null,
    oneExtraCameras: 0,
  });
});

test('parse bounds the camera count a tampered payload can post', () => {
  const s = parsePapicSelection({ oneRungKey: 'O_A', oneExtraCameras: 1e9 });
  assert.equal(s.oneExtraCameras, ONBOARDING_MAX_EXTRA_CAMERAS);
  assert.equal(
    parsePapicSelection({ oneRungKey: 'O_A', oneExtraCameras: -5 }).oneExtraCameras,
    0,
  );
  assert.equal(
    parsePapicSelection({ oneRungKey: 'O_A', oneExtraCameras: Number.NaN }).oneExtraCameras,
    0,
  );
});

test('parse keeps the count and the rung consistent in both directions', () => {
  assert.equal(parsePapicSelection({ oneExtraCameras: 3 }).oneExtraCameras, 0);
  assert.equal(parsePapicSelection({ oneRungKey: 'O_A' }).oneRungKey, null);
  const ok = parsePapicSelection({ oneRungKey: 'O_A', oneExtraCameras: 3 });
  assert.equal(ok.oneRungKey, 'O_A');
  assert.equal(ok.oneExtraCameras, 3);
});

test('parse does not authorise — it only shapes', () => {
  // An unknown key survives parsing on purpose: whether a rung is real, live and
  // priced is the server's question, answered against the tier tables. Deciding
  // it here would put an allow-list in the browser bundle that goes stale the
  // moment an admin edits a row.
  const s = parsePapicSelection({ poolRungKey: 'NOT_A_RUNG' });
  assert.equal(s.poolRungKey, 'NOT_A_RUNG');
  assert.equal(poolStepOf(POOL, s), 0, 'and the ladder still refuses to price it');
});

test('an over-long key is dropped rather than carried to the server', () => {
  assert.equal(parsePapicSelection({ poolRungKey: 'x'.repeat(200) }).poolRungKey, null);
  assert.equal(parsePapicSelection({ poolRungKey: '   ' }).poolRungKey, null);
});
