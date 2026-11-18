/**
 * days-to-go-is-one-calculation.test.ts — 🔒 W4 B4 (18 Nov 2026): Home said "212 days to go" and Schedule "213" for the
 * same 19 Jun 2027. Schedule subtracted CALENDAR days (`daysBetween`); Home uses the countdown's rule (whole days of
 * REAL time left, `daysToGo`). One number now: `daysToGoCount` in lib/countdown-target.ts, read by both.
 *
 * SABOTAGE: put `daysBetween(` back in the Schedule page's `daysToGo` → test 2 red; make `daysToGoCount` count calendar
 * days → test 1 red (213).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { daysToGo, daysToGoCount } from './countdown-target';
import { stripComments } from './strip-comments';

const WEB = join(import.meta.dirname, '..');
const read = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));

// 18 Nov 2026, 12:00 in Manila (UTC+8): 212 whole days and a half until the start of 19 Jun 2027 — the calendar says 213.
const NOW = Date.UTC(2026, 10, 18, 4, 0);

test('1 · the number is whole days of real time left — 212, never the calendar 213 — and equals what Home says', () => {
  assert.equal(daysToGoCount('2027-06-19', 'Asia/Manila', NOW), 212);
  const home = daysToGo('2027-06-19', 'Asia/Manila', NOW);
  assert.deepEqual(home, { kind: 'days', days: 212 });
});

test('1b · tomorrow, today and past read as 1, 0 and negative; an unreadable date is null', () => {
  assert.equal(daysToGoCount('2026-11-19', 'Asia/Manila', NOW), 1);
  assert.equal(daysToGoCount('2026-11-18', 'Asia/Manila', NOW), 0);
  assert.equal(daysToGoCount('2026-11-16', 'Asia/Manila', NOW), -2);
  assert.equal(daysToGoCount('not a date', 'Asia/Manila', NOW), null);
  assert.equal(daysToGoCount(null, null, NOW), null);
});

test('2 · Schedule reads the shared calculation and keeps no calendar-day copy of it', () => {
  const page = read('app/dashboard/[eventId]/schedule/page.tsx');
  assert.match(page, /const daysLeft = eventDateKey \? daysToGoCount\(/, 'Schedule no longer reads daysToGoCount');
  assert.doesNotMatch(page, /daysBetween\(/, 'Schedule counts calendar days again');
});
