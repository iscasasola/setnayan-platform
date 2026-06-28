/**
 * Unit test for the digest email's lane rollup — the pure content logic the
 * cron-free flush builds its email from. (The flush's scheduling/claim path is
 * IO-bound and verified by the runSocialFlush pattern it mirrors; this pins the
 * per-lane open/overdue aggregation.)
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { rollupByLane } from './digest-content';
import { deriveQueueUrgency, type AdminQueueDigest } from './queue-counts';

const NOW = Date.parse('2026-06-28T12:00:00Z');
const hoursAgo = (h: number) => new Date(NOW - h * 3_600_000).toISOString();

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
