/**
 * selectStuckEventIds — the pure "which events does the periodic NSFW heal
 * sweep" selection (Node built-in test runner, run via tsx).
 *
 * Guards the two properties that keep the cron-free global re-screen safe:
 *   1. GRACE WINDOW — a capture only seconds old (its first screenCapture may
 *      still be in flight) must NOT pull its event into the sweep, so the heal
 *      never fights a normal async screen. Only grace-aged rows count.
 *   2. BOUNDED + DEDUPED — distinct events only, oldest-first, capped at
 *      maxEvents so one opportunistic pass stays cheap (the rest drain next run).
 *
 * Run: `pnpm test:unit`  (CI: the "unit tests" step).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { selectStuckEventIds } from './nsfw-screen';

const MIN = 60_000;
const NOW = Date.parse('2026-07-22T12:00:00.000Z');
const iso = (msAgo: number) => new Date(NOW - msAgo).toISOString();
const GRACE = 15 * MIN;

test('selects a grace-aged unscreened event', () => {
  const out = selectStuckEventIds([{ event_id: 'E1', created_at: iso(20 * MIN) }], {
    nowMs: NOW,
    graceMs: GRACE,
    maxEvents: 25,
  });
  assert.deepEqual(out, ['E1']);
});

test('does NOT select a capture still inside the grace window (screen may be in flight)', () => {
  const out = selectStuckEventIds([{ event_id: 'E1', created_at: iso(30_000) }], {
    nowMs: NOW,
    graceMs: GRACE,
    maxEvents: 25,
  });
  assert.deepEqual(out, []);
});

test('boundary: exactly at the grace edge is NOT yet stuck; just past it is', () => {
  assert.deepEqual(
    selectStuckEventIds([{ event_id: 'E1', created_at: iso(GRACE) }], {
      nowMs: NOW,
      graceMs: GRACE,
      maxEvents: 25,
    }),
    [],
    'age == grace → still inside (strict >)',
  );
  assert.deepEqual(
    selectStuckEventIds([{ event_id: 'E1', created_at: iso(GRACE + 1) }], {
      nowMs: NOW,
      graceMs: GRACE,
      maxEvents: 25,
    }),
    ['E1'],
    'age > grace → stuck',
  );
});

test('dedupes to distinct events, preserving oldest-first input order', () => {
  const out = selectStuckEventIds(
    [
      { event_id: 'E1', created_at: iso(60 * MIN) },
      { event_id: 'E1', created_at: iso(50 * MIN) },
      { event_id: 'E2', created_at: iso(40 * MIN) },
      { event_id: 'E1', created_at: iso(30 * MIN) },
    ],
    { nowMs: NOW, graceMs: GRACE, maxEvents: 25 },
  );
  assert.deepEqual(out, ['E1', 'E2']);
});

test('caps at maxEvents (backlog drains over successive sweeps)', () => {
  const rows = Array.from({ length: 10 }, (_, i) => ({
    event_id: `E${i}`,
    created_at: iso(60 * MIN),
  }));
  const out = selectStuckEventIds(rows, { nowMs: NOW, graceMs: GRACE, maxEvents: 3 });
  assert.deepEqual(out, ['E0', 'E1', 'E2']);
});

test('skips rows with a missing/blank event_id or an unparseable timestamp', () => {
  const out = selectStuckEventIds(
    [
      { event_id: null, created_at: iso(60 * MIN) },
      { event_id: '', created_at: iso(60 * MIN) },
      { event_id: 'E1', created_at: null },
      { event_id: 'E1', created_at: 'not-a-date' },
      { event_id: 'E2', created_at: iso(60 * MIN) },
    ],
    { nowMs: NOW, graceMs: GRACE, maxEvents: 25 },
  );
  assert.deepEqual(out, ['E2']);
});

test('empty input → empty selection', () => {
  assert.deepEqual(
    selectStuckEventIds([], { nowMs: NOW, graceMs: GRACE, maxEvents: 25 }),
    [],
  );
});
