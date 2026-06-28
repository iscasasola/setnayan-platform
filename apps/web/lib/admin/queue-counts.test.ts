/**
 * Unit tests for the admin queue urgency logic — the ranking that drives the
 * command center order, the nav badge tone, and the topbar escalation pill.
 * Pure functions (clock passed in), so this proves the overdue / due-soon / ok
 * boundaries without a running app or live data. Run: pnpm test:unit.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  computeDueState,
  deriveQueueUrgency,
  type AdminQueueDigest,
} from './queue-counts';

const NOW = Date.parse('2026-06-28T12:00:00Z');
const hoursAgo = (h: number) => new Date(NOW - h * 3_600_000).toISOString();

test('computeDueState — empty / unknown states', () => {
  assert.equal(computeDueState({ count: null, oldestAt: null }, 24, NOW), 'unknown');
  assert.equal(computeDueState({ count: 0, oldestAt: null }, 24, NOW), 'clear');
  // open work but no timestamp to age from → unknown, never a false "ok".
  assert.equal(computeDueState({ count: 3, oldestAt: null }, 24, NOW), 'unknown');
});

test('computeDueState — overdue / due-soon / ok boundaries (sla 24h)', () => {
  assert.equal(computeDueState({ count: 1, oldestAt: hoursAgo(25) }, 24, NOW), 'overdue');
  // exactly at SLA counts as overdue (>=).
  assert.equal(computeDueState({ count: 1, oldestAt: hoursAgo(24) }, 24, NOW), 'overdue');
  // due-soon window is the last quarter: [18h, 24h).
  assert.equal(computeDueState({ count: 1, oldestAt: hoursAgo(20) }, 24, NOW), 'due-soon');
  assert.equal(computeDueState({ count: 1, oldestAt: hoursAgo(18) }, 24, NOW), 'due-soon');
  // just inside the comfortable zone.
  assert.equal(computeDueState({ count: 1, oldestAt: hoursAgo(17) }, 24, NOW), 'ok');
  assert.equal(computeDueState({ count: 1, oldestAt: hoursAgo(1) }, 24, NOW), 'ok');
});

test('deriveQueueUrgency — tallies overdue/due-soon and sums open work', () => {
  const digest: AdminQueueDigest = {
    disputes: { count: 2, oldestAt: hoursAgo(30) }, // sla 24 → overdue
    payments: { count: 1, oldestAt: hoursAgo(20) }, // sla 24 → due-soon
    help: { count: 3, oldestAt: hoursAgo(1) }, // sla 24 → ok
    verify: { count: 0, oldestAt: null }, // clear
    reviews: { count: null, oldestAt: null }, // unknown
  };
  const u = deriveQueueUrgency(digest, NOW);

  assert.equal(u.overdue, 1, 'one overdue queue');
  assert.equal(u.dueSoon, 1, 'one due-soon queue');
  assert.equal(u.totalOpen, 6, '2 + 1 + 3 + 0 open items');
  assert.equal(u.states.disputes, 'overdue');
  assert.equal(u.states.payments, 'due-soon');
  assert.equal(u.states.help, 'ok');
  assert.equal(u.states.verify, 'clear');
  assert.equal(u.states.reviews, 'unknown');
});

test('deriveQueueUrgency — ignores keys not in the queue metadata', () => {
  const digest = {
    'not-a-real-queue': { count: 99, oldestAt: hoursAgo(99) },
  } as unknown as AdminQueueDigest;
  const u = deriveQueueUrgency(digest, NOW);
  assert.equal(u.overdue, 0);
  assert.equal(u.totalOpen, 0);
  assert.deepEqual(u.states, {});
});
