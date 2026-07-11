/**
 * Unit suite for the demo-booth rotation core (lib/demo-booth-rotation). The 3D
 * demo render can't run in CI, so the ranking + weighted rotation is proven
 * here — deterministically (every fn takes the window/clock as a parameter).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  rotationWeight,
  rankVendors,
  buildRotationRing,
  rotationWindow,
  selectDemoRotation,
  ROTATION_PERIOD_MS,
  type RotatableVendor,
} from './demo-booth-rotation';

function v(over: Partial<RotatableVendor> & Pick<RotatableVendor, 'vendorProfileId'>): RotatableVendor {
  return {
    name: over.vendorProfileId,
    slug: over.vendorProfileId,
    logoRef: null,
    category: 'catering',
    tier: null,
    adRank: 0,
    ...over,
  };
}

const ids = (r: RotatableVendor[]) => r.map((x) => x.vendorProfileId);

// ── weight ───────────────────────────────────────────────────────────────────

test('rotationWeight: Enterprise 3 · Pro/Custom 2 · Verified 1 · +1 for an ad boost', () => {
  assert.equal(rotationWeight('enterprise', 0), 3);
  assert.equal(rotationWeight('pro', 0), 2);
  assert.equal(rotationWeight('custom', 0), 2);
  assert.equal(rotationWeight('verified', 0), 1);
  assert.equal(rotationWeight('free', 0), 1);
  assert.equal(rotationWeight(null, 0), 1);
  // ad boost adds one on top of the tier
  assert.equal(rotationWeight('enterprise', 5), 4);
  assert.equal(rotationWeight(null, 5), 2);
});

// ── rank ─────────────────────────────────────────────────────────────────────

test('rankVendors: premium first (weight), then ad_rank, then stable id', () => {
  const pool = [
    v({ vendorProfileId: 'z-verified' }),
    v({ vendorProfileId: 'a-verified' }),
    v({ vendorProfileId: 'pro', tier: 'pro' }),
    v({ vendorProfileId: 'ent', tier: 'enterprise' }),
    v({ vendorProfileId: 'verified-boosted', adRank: 9 }),
  ];
  // ent(3) > verified-boosted(2) & pro(2) > verified(1)
  // within weight-2: ad_rank desc → verified-boosted(9) before pro(0)
  // within weight-1: id asc → a-verified before z-verified
  assert.deepEqual(ids(rankVendors(pool)), ['ent', 'verified-boosted', 'pro', 'a-verified', 'z-verified']);
});

// ── ring ─────────────────────────────────────────────────────────────────────

test('buildRotationRing: each vendor appears `weight` times, spread (not clustered)', () => {
  const ranked = rankVendors([
    v({ vendorProfileId: 'ent', tier: 'enterprise' }), // 3
    v({ vendorProfileId: 'pro', tier: 'pro' }), // 2
    v({ vendorProfileId: 'ver' }), // 1
  ]);
  const ring = ids(buildRotationRing(ranked));
  assert.equal(ring.length, 6, 'ring length = total weight');
  const count = (id: string) => ring.filter((x) => x === id).length;
  assert.equal(count('ent'), 3);
  assert.equal(count('pro'), 2);
  assert.equal(count('ver'), 1);
  // spread check: the weight-3 vendor's copies are NOT all consecutive.
  const entPositions = ring.map((x, i) => (x === 'ent' ? i : -1)).filter((i) => i >= 0);
  const allConsecutive = entPositions.every((p, k) => k === 0 || p === entPositions[k - 1]! + 1);
  assert.ok(!allConsecutive, 'premium copies are stride-spread, not clustered');
});

// ── window ───────────────────────────────────────────────────────────────────

test('rotationWindow: advances one per period', () => {
  assert.equal(rotationWindow(0), 0);
  assert.equal(rotationWindow(ROTATION_PERIOD_MS - 1), 0);
  assert.equal(rotationWindow(ROTATION_PERIOD_MS), 1);
  assert.equal(rotationWindow(ROTATION_PERIOD_MS * 5 + 10), 5);
});

// ── select ───────────────────────────────────────────────────────────────────

test('selectDemoRotation: pool that fits the slots → everyone shows, ranked', () => {
  const pool = [v({ vendorProfileId: 'ver' }), v({ vendorProfileId: 'ent', tier: 'enterprise' })];
  assert.deepEqual(ids(selectDemoRotation(pool, 3, 0)), ['ent', 'ver']);
});

test('selectDemoRotation: distinct picks, exactly `slots` when the pool is large', () => {
  const pool = Array.from({ length: 10 }, (_, i) => v({ vendorProfileId: `x${i}` }));
  for (let w = 0; w < 6; w++) {
    const sel = selectDemoRotation(pool, 3, w);
    assert.equal(sel.length, 3, `window ${w} fills all slots`);
    assert.equal(new Set(ids(sel)).size, 3, `window ${w} has no dup vendor`);
  }
});

test('selectDemoRotation: the top vendor leads window 0; premium shows early', () => {
  const pool = [
    v({ vendorProfileId: 'ent', tier: 'enterprise' }),
    v({ vendorProfileId: 'pro', tier: 'pro' }),
    ...Array.from({ length: 8 }, (_, i) => v({ vendorProfileId: `ver${i}` })),
  ];
  // The highest-weight vendor is ring position 0 by construction → always on-air
  // at window 0.
  assert.ok(ids(selectDemoRotation(pool, 3, 0)).includes('ent'), 'the Enterprise vendor leads window 0');
  // Both premium vendors surface within the first few windows.
  const early = new Set<string>();
  for (let w = 0; w < 3; w++) for (const id of ids(selectDemoRotation(pool, 3, w))) early.add(id);
  assert.ok(early.has('ent') && early.has('pro'), 'both premium vendors appear in the first 3 windows');
});

test('selectDemoRotation: premium gets MORE airtime than a plain vendor across windows', () => {
  const pool = [
    v({ vendorProfileId: 'ent', tier: 'enterprise' }), // weight 3
    ...Array.from({ length: 9 }, (_, i) => v({ vendorProfileId: `ver${i}` })), // weight 1 each
  ];
  let entCount = 0;
  let verCount = 0;
  const windows = 40;
  for (let w = 0; w < windows; w++) {
    const on = new Set(ids(selectDemoRotation(pool, 2, w)));
    if (on.has('ent')) entCount++;
    if (on.has('ver0')) verCount++;
  }
  assert.ok(entCount > verCount, `enterprise on-air ${entCount} vs a verified ${verCount} across ${windows} windows`);
});

test('selectDemoRotation: everyone cycles in eventually (no permanent lockout)', () => {
  const pool = Array.from({ length: 7 }, (_, i) => v({ vendorProfileId: `x${i}` }));
  const everSeen = new Set<string>();
  for (let w = 0; w < 30; w++) for (const id of ids(selectDemoRotation(pool, 2, w))) everSeen.add(id);
  assert.equal(everSeen.size, 7, 'every eligible vendor appears in some window');
});

test('selectDemoRotation: deterministic + guards empty / zero slots', () => {
  const pool = Array.from({ length: 5 }, (_, i) => v({ vendorProfileId: `x${i}` }));
  assert.deepEqual(ids(selectDemoRotation(pool, 2, 3)), ids(selectDemoRotation(pool, 2, 3)));
  assert.deepEqual(selectDemoRotation([], 3, 0), []);
  assert.deepEqual(selectDemoRotation(pool, 0, 0), []);
});
