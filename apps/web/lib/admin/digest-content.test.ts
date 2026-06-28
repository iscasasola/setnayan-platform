/**
 * Unit test for the digest email's lane rollup — the pure content logic the
 * cron-free flush builds its email from. (The flush's scheduling/claim path is
 * IO-bound and verified by the runSocialFlush pattern it mirrors; this pins the
 * per-lane open/overdue aggregation.)
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { rollupByLane, sendThresholdMs } from './digest-content';
import { deriveQueueUrgency, type AdminQueueDigest } from './queue-counts';

const NOW = Date.parse('2026-06-28T12:00:00Z');
const hoursAgo = (h: number) => new Date(NOW - h * 3_600_000).toISOString();

test('sendThresholdMs — today 08:00 Manila as a UTC instant', () => {
  // 12:00 UTC = 20:00 Manila on 2026-06-28 → window opened at 08:00 Manila,
  // which is 00:00 UTC the same day. now is well past it.
  const t = sendThresholdMs(NOW);
  assert.equal(new Date(t).toISOString(), '2026-06-28T00:00:00.000Z');
  assert.ok(NOW >= t, 'noon UTC is after the 08:00-Manila window');
});

test('sendThresholdMs — before 08:00 Manila → threshold is in the future', () => {
  // 23:00 UTC on the 27th = 07:00 Manila on the 28th (before 8am). The window
  // for the 28th (00:00 UTC) is still ahead, so the digest must NOT fire yet.
  const before = Date.parse('2026-06-27T23:00:00Z');
  const t = sendThresholdMs(before);
  assert.equal(new Date(t).toISOString(), '2026-06-28T00:00:00.000Z');
  assert.ok(before < t, '07:00 Manila is before the 08:00-Manila window');
});

test('rollupByLane — groups open + overdue by lane, skips empty lanes, ordered', () => {
  const digest: AdminQueueDigest = {
    disputes: { count: 2, oldestAt: hoursAgo(30) }, // trust, sla 24 → overdue
    'force-majeure': { count: 1, oldestAt: hoursAgo(1) }, // trust, → ok
    payments: { count: 3, oldestAt: hoursAgo(1) }, // money, → ok
    verify: { count: 0, oldestAt: null }, // growth, clear → skipped
  };
  const urgency = deriveQueueUrgency(digest, NOW);
  const lanes = rollupByLane(digest, urgency);

  // LANE_ORDER is trust → money → growth → support; growth/support have no open
  // work, so they drop out.
  assert.deepEqual(
    lanes.map((l) => l.lane),
    ['trust', 'money'],
  );
  const trust = lanes.find((l) => l.lane === 'trust')!;
  assert.equal(trust.open, 3, '2 disputes + 1 force-majeure');
  assert.equal(trust.overdue, 1, 'only disputes is overdue');
  const money = lanes.find((l) => l.lane === 'money')!;
  assert.equal(money.open, 3);
  assert.equal(money.overdue, 0);
});

test('rollupByLane — empty when nothing open', () => {
  const digest: AdminQueueDigest = {
    disputes: { count: 0, oldestAt: null },
    payments: { count: null, oldestAt: null },
  };
  const urgency = deriveQueueUrgency(digest, NOW);
  assert.deepEqual(rollupByLane(digest, urgency), []);
});
