import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  computeEventPool,
  combinePointsGates,
  shapeEventPoolStatus,
  DEFAULT_EVENT_POOL_CONFIG,
  EVENT_POOL_ABSENT,
  EVENT_POOL_UNLIMITED_REMAINING,
} from './papic-event-pool';
import { resolvePointsGate, papicCaptureCost } from './papic-cameras';
import { GUEST_CAPTURE_CREDITS } from './papic-guest';

// Money-logic guard for the EVENT-SCOPED capture fence (Phase 0c). The fence is
// the only bound on a flat per-event pass, so its formula, its "tighter wins"
// combination, and its fail-CLOSED posture are all load-bearing.

// ── 1. The pool formula across guest counts ──────────────────────────────

test('pool is derived from guest count, not flat (the 3×-tightening trap)', () => {
  // The council's flat 10,000-pt proposal at 150 pax = 66 pts/guest — TIGHTER
  // than the shipped 150/guest. This formula must not reproduce that.
  const typical = computeEventPool(150, DEFAULT_EVENT_POOL_CONFIG);
  assert.equal(typical.basePoints, 22_500); // 150 × 150
  assert.ok(
    typical.basePoints > 10_000,
    'a flat 10,000 pool would have been a 3× tightening at 150 pax',
  );
});

test('default points-per-guest EQUALS the shipped per-guest credit model', () => {
  // lib/papic-guest.ts GUEST_CAPTURE_CREDITS = 150. If that ever moves, the
  // fence silently becomes a tightening (or a giveaway) — this pins them.
  assert.equal(DEFAULT_EVENT_POOL_CONFIG.pointsPerGuest, GUEST_CAPTURE_CREDITS);
});

test('SMALL event: the floor lifts the pool, never the raw product', () => {
  const small = computeEventPool(20, DEFAULT_EVENT_POOL_CONFIG);
  assert.equal(small.rawPoints, 3_000); // 20 × 150
  assert.equal(small.basePoints, 5_000); // floored up
  assert.equal(small.flooredUp, true);
  assert.equal(small.cappedDown, false);
});

test('TYPICAL event: neither bound binds — pure guest-count derivation', () => {
  const t = computeEventPool(120, DEFAULT_EVENT_POOL_CONFIG);
  assert.equal(t.rawPoints, 18_000);
  assert.equal(t.basePoints, 18_000);
  assert.equal(t.flooredUp, false);
  assert.equal(t.cappedDown, false);
});

test('LARGE event: the ceiling brakes the fat tail at the 200-pax equivalent', () => {
  const at200 = computeEventPool(200, DEFAULT_EVENT_POOL_CONFIG);
  assert.equal(at200.basePoints, 30_000); // exactly today's 200 × 150
  assert.equal(at200.cappedDown, false); // 30,000 is not > 30,000

  const at300 = computeEventPool(300, DEFAULT_EVENT_POOL_CONFIG);
  assert.equal(at300.rawPoints, 45_000);
  assert.equal(at300.basePoints, 30_000);
  assert.equal(at300.cappedDown, true);
});

test('the fence is NOT a tightening at or below 200 pax', () => {
  // For every pax count up to the ceiling's anchor, the pool must be >= what
  // the shipped per-guest model already granted (guests × 150).
  for (const pax of [1, 10, 33, 50, 66, 100, 150, 199, 200]) {
    const pool = computeEventPool(pax, DEFAULT_EVENT_POOL_CONFIG).basePoints;
    assert.ok(
      pool >= pax * GUEST_CAPTURE_CREDITS,
      `at ${pax} pax the fence (${pool}) must not be tighter than the shipped ${pax * GUEST_CAPTURE_CREDITS}`,
    );
  }
});

test('soft stop lands below the hard stop at the configured percentage', () => {
  const p = computeEventPool(150, DEFAULT_EVENT_POOL_CONFIG);
  assert.equal(p.softStopAt, 19_125); // 85% of 22,500
  assert.ok(p.softStopAt < p.basePoints);
});

test('parameters are tunable — a different config yields a different pool', () => {
  const tuned = computeEventPool(150, {
    pointsPerGuest: 200,
    floorPoints: 1_000,
    ceilingPoints: 100_000,
    softStopPct: 50,
  });
  assert.equal(tuned.basePoints, 30_000);
  assert.equal(tuned.softStopAt, 15_000);
});

test('degenerate inputs never produce a negative or inverted pool', () => {
  assert.equal(computeEventPool(0, DEFAULT_EVENT_POOL_CONFIG).basePoints, 5_000);
  assert.equal(computeEventPool(-40, DEFAULT_EVENT_POOL_CONFIG).basePoints, 5_000);
  assert.equal(
    computeEventPool(Number.NaN, DEFAULT_EVENT_POOL_CONFIG).basePoints,
    5_000,
  );
  // A misconfigured ceiling BELOW the floor must not invert the clamp.
  const bad = computeEventPool(150, {
    pointsPerGuest: 150,
    floorPoints: 8_000,
    ceilingPoints: 1_000,
    softStopPct: 85,
  });
  assert.equal(bad.basePoints, 8_000);
});

// ── 2. Two budgets, TIGHTER wins ─────────────────────────────────────────

test('both budgets are enforced — the tighter one wins', () => {
  // Both fine → allow.
  assert.equal(combinePointsGates('allow', 'allow'), 'allow');
  // Per-SEAT budget spent, event pool fine → still exhausted.
  assert.equal(combinePointsGates('exhausted', 'allow'), 'exhausted');
  // Event pool spent, per-seat budget fine → still exhausted.
  assert.equal(combinePointsGates('allow', 'exhausted'), 'exhausted');
  assert.equal(combinePointsGates('exhausted', 'exhausted'), 'exhausted');
});

test('blocked (fail-CLOSED) beats everything, from either side', () => {
  assert.equal(combinePointsGates('blocked', 'allow'), 'blocked');
  assert.equal(combinePointsGates('allow', 'blocked'), 'blocked');
  assert.equal(combinePointsGates('exhausted', 'blocked'), 'blocked');
  assert.equal(combinePointsGates('blocked', 'exhausted'), 'blocked');
});

// ── 3. Fail posture on the event seam (shared with the per-camera gate) ──

test('event-pool RPC error fails CLOSED (never silently un-fences a pass)', () => {
  // A definitive "no room" is exhaustion → 409 camera_points_exhausted.
  assert.equal(resolvePointsGate(null, false), 'exhausted');
  // Any other RPC failure blocks.
  assert.equal(resolvePointsGate('57014', null), 'blocked'); // statement timeout
  assert.equal(resolvePointsGate('42501', true), 'blocked'); // permission denied
  assert.equal(resolvePointsGate('unknown', null), 'blocked');
  // An indeterminate result shape also blocks.
  assert.equal(resolvePointsGate(null, null), 'blocked');
});

test('only function-not-found fails OPEN (the seam-cutover carve-out)', () => {
  assert.equal(resolvePointsGate('42883', null), 'allow');
  assert.equal(resolvePointsGate('PGRST202', null), 'allow');
});

test('exhaustion is reached in POINTS, so a clip costs 3× a photo', () => {
  // The event fence spends the same currency as the per-camera ladder — a clip
  // must not sneak through a pool with only 1 point left.
  assert.equal(papicCaptureCost('photo'), 1);
  assert.equal(papicCaptureCost('clip'), 3);
  const poolLeft = 2;
  assert.equal(
    resolvePointsGate(null, poolLeft >= papicCaptureCost('clip')),
    'exhausted',
  );
  assert.equal(
    resolvePointsGate(null, poolLeft >= papicCaptureCost('photo')),
    'allow',
  );
});

// ── 4. Non-pass events are unaffected ────────────────────────────────────

test('a NON-pass event reads back as unfenced (today’s behaviour preserved)', () => {
  const absent = shapeEventPoolStatus({ applies: false });
  assert.deepEqual(absent, EVENT_POOL_ABSENT);
  assert.equal(absent.applies, false);
  assert.equal(absent.remainingPoints, EVENT_POOL_UNLIMITED_REMAINING);
  assert.equal(absent.soft, false);
  // MAXINT remaining always clears the cost check → the gate is a pure no-op.
  assert.equal(
    combinePointsGates(
      'allow',
      resolvePointsGate(
        null,
        absent.remainingPoints >= papicCaptureCost('clip'),
      ),
    ),
    'allow',
  );
});

test('a null / missing status row is treated as unfenced, not as blocked', () => {
  assert.deepEqual(shapeEventPoolStatus(null), EVENT_POOL_ABSENT);
  assert.deepEqual(shapeEventPoolStatus(undefined), EVENT_POOL_ABSENT);
});

// ── 5. Soft-stop signal shaping ──────────────────────────────────────────

test('soft flips only once usage crosses the soft-stop line', () => {
  const below = shapeEventPoolStatus({
    applies: true,
    guest_count: 150,
    base_points: 22_500,
    granted_points: 0,
    total_points: 22_500,
    used_points: 19_124,
    remaining_points: 3_376,
    soft_stop_at: 19_125,
  });
  assert.equal(below.soft, false);

  const at = shapeEventPoolStatus({
    applies: true,
    guest_count: 150,
    base_points: 22_500,
    granted_points: 0,
    total_points: 22_500,
    used_points: 19_125,
    remaining_points: 3_375,
    soft_stop_at: 19_125,
  });
  assert.equal(at.soft, true);
  assert.equal(at.remainingPoints, 3_375);
});

test('top-up grants add to the pool total (plumbing, no SKU)', () => {
  const topped = shapeEventPoolStatus({
    applies: true,
    guest_count: 300,
    base_points: 30_000,
    granted_points: 5_000,
    total_points: 35_000,
    used_points: 30_000,
    remaining_points: 5_000,
    soft_stop_at: 29_750,
  });
  assert.equal(topped.grantedPoints, 5_000);
  assert.equal(topped.totalPoints, 35_000);
  assert.equal(topped.remainingPoints, 5_000);
  assert.equal(topped.soft, true);
});
