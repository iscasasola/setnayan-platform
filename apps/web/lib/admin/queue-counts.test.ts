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
  ADMIN_QUEUE_META,
  type AdminQueueDigest,
  type AdminQueueDigestRow,
} from './queue-counts';

const NOW = Date.parse('2026-06-28T12:00:00Z');
const hoursAgo = (h: number) => new Date(NOW - h * 3_600_000).toISOString();

// A complete digest (all metadata queues present) — mirrors what
// getAdminQueueDigest always returns in prod (every key, count maybe null).
const fullDigest = (fill: () => AdminQueueDigestRow): AdminQueueDigest =>
  Object.fromEntries(Object.keys(ADMIN_QUEUE_META).map((k) => [k, fill()]));

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

test('deriveQueueUrgency — distinguishes genuinely-clear from a degraded read', () => {
  // Every queue reports 0 → genuinely all-clear (no unknowns).
  const clear = deriveQueueUrgency(
    fullDigest(() => ({ count: 0, oldestAt: null })),
    NOW,
  );
  assert.equal(clear.totalOpen, 0);
  assert.equal(clear.unknownCount, 0, 'all-zero is genuinely clear');

  // Every queue count is null → read failed; must NOT look like all-clear.
  const degraded = deriveQueueUrgency(
    fullDigest(() => ({ count: null, oldestAt: null })),
    NOW,
  );
  assert.equal(degraded.totalOpen, 0);
  assert.ok(degraded.unknownCount > 0, 'all-null is degraded, not clear');
});

/**
 * A queue with no clock never goes red.
 *
 * 🚨 THE NOISE THIS REMOVES. Partnerships carried a 72-hour promise, but its
 * rows wait on the RECIPIENT VENDOR to accept or decline — the only admin
 * control is a veto. No admin action could ever meet that deadline, so every
 * solo admin was shown a permanently red past-promise row. The same noise that
 * got payouts taken off this list, arriving by a different route.
 *
 * 🔑 A DEADLINE ON SOMEONE ELSE'S DECISION IS PERMANENT RED. The row still
 * shows its count, so nothing is hidden — it just stops claiming a promise
 * nobody made.
 */
test('a queue with no clock is never late, however old its oldest item', () => {
  const ancient = new Date(Date.now() - 400 * 24 * 3_600_000).toISOString();
  assert.equal(computeDueState({ count: 5, oldestAt: ancient }, null, Date.now()), 'ok');
});

test('a clockless queue with nothing in it still reads as clear', () => {
  assert.equal(computeDueState({ count: 0, oldestAt: null }, null, Date.now()), 'clear');
});

test('an unmeasured clockless queue is still unknown, not ok', () => {
  // `null` count means we could not read it. Reporting that as "fine" is the
  // same lie the work-list drawer had to be fixed for.
  assert.equal(computeDueState({ count: null, oldestAt: null }, null, Date.now()), 'unknown');
});

test('partnerships is the queue that carries no clock', () => {
  // Named explicitly: if someone re-adds an SLA here, they should have to
  // delete this line and read why it existed.
  assert.equal(
    ADMIN_QUEUE_META['vendor-partnerships']?.slaHours,
    null,
    'partnerships waits on the recipient vendor — an admin deadline on it can only ever be red',
  );
});

test('every other queue still has a clock', () => {
  // "No clock" must stay the rare, argued exception rather than a habit.
  const clockless = Object.entries(ADMIN_QUEUE_META)
    .filter(([, m]) => m.slaHours === null)
    .map(([k]) => k);
  assert.deepEqual(clockless, ['vendor-partnerships'], `unexpected clockless queues: ${clockless.join(', ')}`);
});
