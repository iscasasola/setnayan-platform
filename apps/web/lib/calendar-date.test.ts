/**
 * A DATE column names a DAY. These tests RUN the formatter in four world
 * timezones, because "it works" and "it works where I ran it" are the same
 * sentence until you check.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { formatCalendarDate, formatEventDate } from './events';

const ZONES = ['UTC', 'Asia/Manila', 'America/New_York', 'America/Los_Angeles', 'Pacific/Honolulu'];

function inEveryZone(fn: () => string): string[] {
  const out: string[] = [];
  const before = process.env.TZ;
  for (const tz of ZONES) {
    process.env.TZ = tz;
    out.push(fn());
  }
  process.env.TZ = before;
  return out;
}

test('a calendar date renders the same day everywhere on earth', () => {
  // The live defect: a 12 December due date read "Dec 11" in New York, Los
  // Angeles and Honolulu — one day early, on a vendor payment deadline.
  const rendered = inEveryZone(() =>
    formatCalendarDate('2026-12-12', { year: 'numeric', month: 'short', day: 'numeric' }),
  );
  assert.equal(new Set(rendered).size, 1, `differed by zone: ${JSON.stringify(rendered)}`);
  assert.match(rendered[0]!, /Dec 12/);
});

test('the first of a month does not slip into the previous month', () => {
  // The worst case: 1 January reads as 31 December of the PREVIOUS YEAR.
  const rendered = inEveryZone(() => formatCalendarDate('2027-01-01'));
  assert.equal(new Set(rendered).size, 1);
  assert.match(rendered[0]!, /January 1, 2027/);
});

test('formatEventDate agrees with it — one rule, not two', () => {
  const a = inEveryZone(() => formatEventDate('2026-12-12'));
  assert.equal(new Set(a).size, 1, 'formatEventDate must be zone-independent too');
});

test('a full timestamp is not mangled by the calendar formatter', () => {
  // Defensive: someone will pass one eventually. It should read the day part,
  // not return empty or throw.
  assert.match(formatCalendarDate('2026-12-12T15:30:00.000Z'), /December 12, 2026/);
});

test('empty and unreadable input yield nothing, never "Invalid Date"', () => {
  for (const v of ['', null, undefined, 'not a date']) {
    assert.equal(formatCalendarDate(v as string), '');
  }
});
