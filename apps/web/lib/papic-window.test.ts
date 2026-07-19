/**
 * Unit suite for the Papic capture-window resolver (Node built-in test runner,
 * run via tsx — `pnpm test:unit`).
 *
 * The load-bearing invariants (owner 2026-06-26):
 *   • DAYS is calendar-inclusive (Mon→Fri = 5) — it sets the bill multiplier.
 *   • travel = free range, day 1 → end of trip.
 *   • non-travel = end PINNED to event_date: may extend BEFORE, never AFTER.
 *   • a NULL stored window falls back to legacy single-day (1 day, anchored).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  inclusiveDays,
  resolvePapicWindow,
  resolveStoredWindow,
  manilaDate,
  manilaEndOfDayIso,
  isTravelEventType,
} from './papic-window';

test('inclusiveDays counts calendar-inclusive, floored at 1', () => {
  assert.equal(inclusiveDays('2026-06-12', '2026-06-12'), 1);
  assert.equal(inclusiveDays('2026-06-12', '2026-06-14'), 3);
  assert.equal(inclusiveDays('2026-06-08', '2026-06-12'), 5); // Mon→Fri
  // Reversed / garbage inputs never go below 1.
  assert.equal(inclusiveDays('2026-06-14', '2026-06-12'), 1);
  assert.equal(inclusiveDays(null, '2026-06-12'), 1);
});

test('travel: free range, day 1 → end of trip, days = full span', () => {
  const r = resolvePapicWindow({
    eventType: 'travel',
    eventDate: '2026-07-01', // ignored for travel
    startDate: '2026-07-10',
    startTime: '09:00',
    endDate: '2026-07-15',
  });
  assert.ok(r.ok);
  if (r.ok) {
    assert.equal(r.window.days, 6);
    assert.equal(r.window.startDate, '2026-07-10');
    assert.equal(r.window.endDate, '2026-07-15');
    assert.match(r.window.startIso, /2026-07-10T09:00:00\+08:00/);
    assert.equal(r.window.endIso, manilaEndOfDayIso('2026-07-15'));
  }
});

test('travel: end before start is rejected', () => {
  const r = resolvePapicWindow({
    eventType: 'travel',
    eventDate: null,
    startDate: '2026-07-15',
    endDate: '2026-07-10',
  });
  assert.equal(r.ok, false);
  if (!r.ok) assert.equal(r.error, 'start_after_end');
});

test('wedding: a same-day window is 1 day, end pinned to event_date', () => {
  const r = resolvePapicWindow({
    eventType: 'wedding',
    eventDate: '2026-12-20',
    startDate: '2026-12-20',
    startTime: '14:00',
    endDate: '2026-12-25', // must be ignored — end is pinned
  });
  assert.ok(r.ok);
  if (r.ok) {
    assert.equal(r.window.days, 1);
    assert.equal(r.window.endDate, '2026-12-20');
    assert.equal(r.window.endIso, manilaEndOfDayIso('2026-12-20'));
  }
});

test('wedding: extending BEFORE the event day adds days', () => {
  const r = resolvePapicWindow({
    eventType: 'wedding',
    eventDate: '2026-12-20',
    startDate: '2026-12-18', // capture the prep two days early
  });
  assert.ok(r.ok);
  if (r.ok) {
    assert.equal(r.window.days, 3); // 18, 19, 20 inclusive
    assert.equal(r.window.endDate, '2026-12-20');
  }
});

test('wedding: starting AFTER the event day is rejected (cannot cover it)', () => {
  const r = resolvePapicWindow({
    eventType: 'wedding',
    eventDate: '2026-12-20',
    startDate: '2026-12-21',
  });
  assert.equal(r.ok, false);
  if (!r.ok) assert.equal(r.error, 'end_after_event_date');
});

test('non-travel without an event_date errors', () => {
  const r = resolvePapicWindow({
    eventType: 'birthday',
    eventDate: null,
    startDate: '2026-12-18',
  });
  assert.equal(r.ok, false);
  if (!r.ok) assert.equal(r.error, 'missing_event_date');
});

test('birthday (anchored, non-wedding) behaves like wedding — end pinned', () => {
  const r = resolvePapicWindow({
    eventType: 'birthday',
    eventDate: '2026-09-09',
    startDate: '2026-09-09',
  });
  assert.ok(r.ok);
  if (r.ok) assert.equal(r.window.days, 1);
});

test('resolveStoredWindow: window set → inclusive days', () => {
  const w = resolveStoredWindow({
    windowStart: '2026-07-10T09:00:00+08:00',
    windowEnd: '2026-07-15T23:59:59+08:00',
    eventDate: '2026-07-01',
  });
  assert.equal(w.days, 6);
  assert.equal(w.startIso, '2026-07-10T09:00:00+08:00');
});

test('resolveStoredWindow: no window → legacy single day anchored to event_date', () => {
  const w = resolveStoredWindow({
    windowStart: null,
    windowEnd: null,
    eventDate: '2026-12-20',
  });
  assert.equal(w.days, 1);
  assert.equal(manilaDate(w.startIso), '2026-12-20');
  assert.equal(w.endIso, manilaEndOfDayIso('2026-12-20'));
});

test('resolveStoredWindow: no window + no date → 1 day, null bounds', () => {
  const w = resolveStoredWindow({ windowStart: null, windowEnd: null, eventDate: null });
  assert.equal(w.days, 1);
  assert.equal(w.startIso, null);
  assert.equal(w.endIso, null);
});

test('isTravelEventType is case-insensitive', () => {
  assert.equal(isTravelEventType('travel'), true);
  assert.equal(isTravelEventType('Travel'), true);
  assert.equal(isTravelEventType('wedding'), false);
  assert.equal(isTravelEventType(null), false);
});
