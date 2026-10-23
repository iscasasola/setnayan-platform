/**
 * GUARD — Home's Papic widget says one coverage line in three days (owner 2026-10-23): before the day the dates
 * ("Sat 12 Dec → Sun 13 Dec, 12 noon"), on the day "Open now →", after "Closed". The DAY decides, not the window.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { papicCoverageLine, papicDay } from './papic-widget';

// A Saturday 12 Dec 2026 event: window 12 Jun 00:00 → Sun 13 Dec 12:00 (Manila).
const win = { startDate: '2026-12-12', endIso: '2026-12-13T04:00:00.000Z' };
const at = (iso: string) => Date.parse(iso);

test('before the day: the dates, first day → the instant the cameras close', () => {
  const now = at('2026-11-01T02:00:00Z');
  const day = papicDay({ eventDate: '2026-12-12', ...win, nowMs: now });
  assert.equal(day, 'before');
  assert.equal(papicCoverageLine({ day, ...win }), 'Sat 12 Dec → Sun 13 Dec, 12 noon');
});

test('on the day (and the morning after, while open): "Open now →"', () => {
  assert.equal(papicDay({ eventDate: '2026-12-12', ...win, nowMs: at('2026-12-12T03:00:00Z') }), 'day');
  assert.equal(papicDay({ eventDate: '2026-12-12', ...win, nowMs: at('2026-12-13T02:00:00Z') }), 'day');
  assert.equal(papicCoverageLine({ day: 'day', ...win }), 'Open now →');
});

test('after the cameras close: "Closed"', () => {
  const day = papicDay({ eventDate: '2026-12-12', ...win, nowMs: at('2026-12-13T05:00:00Z') });
  assert.equal(day, 'after');
  assert.equal(papicCoverageLine({ day, ...win }), 'Closed');
});

test('an unreadable window says nothing — never a guessed date', () => {
  assert.equal(papicCoverageLine({ day: 'before', startDate: null, endIso: null }), null);
});
