import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  shapeHostPoolMeter,
  POOL_METER_LOW_PCT,
} from './papic-pool-meter';
import {
  EVENT_POOL_ABSENT,
  type EventPoolStatus,
} from './papic-event-pool';

// Display-shaping guard for the HOST pool meter (build ③ PR-1). The meter is
// read-only — it must render the same numbers the reserve RPC enforces, warn
// at the documented <10%-remaining line, and disappear (null) rather than
// invent a fence where none applies.

function status(overrides: Partial<EventPoolStatus>): EventPoolStatus {
  return {
    applies: true,
    guestCount: 150,
    basePoints: 22_500,
    grantedPoints: 0,
    totalPoints: 22_500,
    usedPoints: 0,
    remainingPoints: 22_500,
    softStopAt: 19_125,
    soft: false,
    ...overrides,
  };
}

// ── 1. Absence → no card ─────────────────────────────────────────────────

test('a non-pool event (applies=false) yields no meter at all', () => {
  assert.equal(shapeHostPoolMeter(EVENT_POOL_ABSENT), null);
});

test('null / undefined status yields no meter (graceful-degrade path)', () => {
  assert.equal(shapeHostPoolMeter(null), null);
  assert.equal(shapeHostPoolMeter(undefined), null);
});

test('a degenerate zero-total pool yields no meter, never a red bar', () => {
  // Only reachable via a misconfigured pool config; the safe display is none.
  assert.equal(
    shapeHostPoolMeter(status({ totalPoints: 0, remainingPoints: 0 })),
    null,
  );
});

// ── 2. The healthy meter ─────────────────────────────────────────────────

test('a fresh pool reads full: remaining == total, level ok', () => {
  const m = shapeHostPoolMeter(status({}));
  assert.ok(m);
  assert.equal(m.totalPoints, 22_500);
  assert.equal(m.remainingPoints, 22_500);
  assert.equal(m.usedPoints, 0);
  assert.equal(m.pctUsed, 0);
  assert.equal(m.pctRemaining, 100);
  assert.equal(m.level, 'ok');
});

test('mid-drain arithmetic: used + remaining track the RPC, pcts round', () => {
  const m = shapeHostPoolMeter(
    status({ usedPoints: 9_000, remainingPoints: 13_500 }),
  );
  assert.ok(m);
  assert.equal(m.pctUsed, 40);
  assert.equal(m.pctRemaining, 60);
  assert.equal(m.level, 'ok');
});

test('grant-only event (base 0, total == SUM(grants)) shapes correctly', () => {
  // 20270902148488 § 3a: a Free/Papic-One event has base=0 and lives entirely
  // on ledger grants — e.g. the 50-pt free_grant + one 250-pt camera_grant.
  const m = shapeHostPoolMeter(
    status({
      basePoints: 0,
      grantedPoints: 300,
      totalPoints: 300,
      usedPoints: 120,
      remainingPoints: 180,
    }),
  );
  assert.ok(m);
  assert.equal(m.basePoints, 0);
  assert.equal(m.grantedPoints, 300);
  assert.equal(m.totalPoints, 300);
  assert.equal(m.pctUsed, 40);
  assert.equal(m.level, 'ok');
});

// ── 3. The amber line — strictly BELOW 10% remaining ─────────────────────

test('exactly 10% remaining is still ok (the line is strict)', () => {
  const m = shapeHostPoolMeter(
    status({ usedPoints: 20_250, remainingPoints: 2_250 }), // 2,250 / 22,500 = 10%
  );
  assert.ok(m);
  assert.equal(m.level, 'ok');
});

test('one point below the 10% line flips to low', () => {
  const m = shapeHostPoolMeter(
    status({ usedPoints: 20_251, remainingPoints: 2_249 }),
  );
  assert.ok(m);
  assert.equal(m.level, 'low');
});

test('the low judgement uses raw ratios, not the rounded pct', () => {
  // 9.6% remaining rounds to pctRemaining=10 — the level must still be low.
  const m = shapeHostPoolMeter(
    status({ totalPoints: 10_000, usedPoints: 9_040, remainingPoints: 960 }),
  );
  assert.ok(m);
  assert.equal(m.pctRemaining, 10);
  assert.equal(m.level, 'low');
});

test('POOL_METER_LOW_PCT is the documented 10', () => {
  assert.equal(POOL_METER_LOW_PCT, 10);
});

// ── 4. Exhaustion ────────────────────────────────────────────────────────

test('zero remaining is exhausted, not merely low', () => {
  const m = shapeHostPoolMeter(
    status({ usedPoints: 22_500, remainingPoints: 0 }),
  );
  assert.ok(m);
  assert.equal(m.level, 'exhausted');
  assert.equal(m.pctUsed, 100);
  assert.equal(m.pctRemaining, 0);
});

// ── 5. Clamps — anomalies can never break the bar ────────────────────────

test('over-total usage clamps to the bar, never exceeds 100%', () => {
  const m = shapeHostPoolMeter(
    status({ usedPoints: 30_000, remainingPoints: 0 }),
  );
  assert.ok(m);
  assert.equal(m.usedPoints, 22_500);
  assert.equal(m.pctUsed, 100);
  assert.equal(m.level, 'exhausted');
});

test('an over-total remaining (shaping anomaly) clamps to total', () => {
  const m = shapeHostPoolMeter(
    status({ usedPoints: 0, remainingPoints: 99_999 }),
  );
  assert.ok(m);
  assert.equal(m.remainingPoints, 22_500);
  assert.equal(m.pctRemaining, 100);
});
