/**
 * Unit suite for the Year-view moments builder. Invariants: recurring
 * anniversaries derive off anchor_date, on-platform weddings surface their own
 * anniversary (past) or a countdown (future), holidays recur, milestones flag
 * for a nudge, and the rolling-year window + soonest-first sort hold. Zero PII —
 * no birthdate path exists here (that's the counsel-gated dependent layer).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  buildYearMoments,
  ordinal,
  CALENDAR_HOLIDAYS,
  type MomentEvent,
  type YearMoment,
} from './year-moments';

/** First moment, asserted present (keeps noUncheckedIndexedAccess happy). */
function first(events: MomentEvent[], today: string, opts?: Parameters<typeof buildYearMoments>[2]): YearMoment {
  const m = buildYearMoments(events, today, opts)[0];
  assert.ok(m, 'expected at least one moment');
  return m;
}

const base: MomentEvent = {
  event_id: 'e1',
  event_type: 'anniversary',
  display_name: 'Our Anniversary',
  event_date: null,
  anchor_date: null,
  anchor_origin: null,
  recurs: false,
  archived: false,
};

test('ordinal: 1st, 2nd, 3rd, 11th, 21st, 25th', () => {
  assert.equal(ordinal(1), '1st');
  assert.equal(ordinal(2), '2nd');
  assert.equal(ordinal(3), '3rd');
  assert.equal(ordinal(11), '11th');
  assert.equal(ordinal(21), '21st');
  assert.equal(ordinal(25), '25th');
});

test('recurring anniversary derives off anchor_date with the right ordinal + label', () => {
  const ev: MomentEvent = { ...base, anchor_date: '2026-01-17', anchor_origin: 'wedding', recurs: true };
  const m = first([ev], '2026-07-12', { includeHolidays: false });
  assert.equal(m.kind, 'anniversary');
  assert.equal(m.dateISO, '2027-01-17');
  assert.equal(m.label, 'Your 1st wedding anniversary');
  assert.equal(m.isMilestone, true); // 1st is a milestone
  assert.equal(m.eventId, 'e1');
});

test('relationship-origin anniversary reads "together"', () => {
  const ev: MomentEvent = { ...base, anchor_date: '2018-02-14', anchor_origin: 'relationship', recurs: true };
  const m = first([ev], '2026-07-12', { includeHolidays: false });
  assert.equal(m.label, 'Your 9th anniversary together');
  assert.equal(m.isMilestone, false); // 9th is an ordinary year
});

test('silver anniversary (25th) is a milestone', () => {
  const ev: MomentEvent = { ...base, anchor_date: '2001-06-30', anchor_origin: 'wedding', recurs: true };
  const m = first([ev], '2026-01-01', { includeHolidays: false });
  assert.equal(m.label, 'Your 25th wedding anniversary');
  assert.equal(m.isMilestone, true);
});

test('an on-platform wedding in the PAST surfaces its own anniversary', () => {
  const ev: MomentEvent = {
    ...base, event_id: 'w1', event_type: 'wedding', display_name: 'Carlo & Bianca',
    event_date: '2026-01-17', recurs: false,
  };
  const m = first([ev], '2026-07-12', { includeHolidays: false });
  assert.equal(m.kind, 'anniversary');
  assert.equal(m.label, 'Your 1st wedding anniversary');
  assert.equal(m.dateISO, '2027-01-17');
});

test('an upcoming wedding surfaces a countdown, not an anniversary', () => {
  const ev: MomentEvent = {
    ...base, event_id: 'w2', event_type: 'wedding', display_name: 'Carlo & Bianca',
    event_date: '2026-11-20', recurs: false,
  };
  const m = first([ev], '2026-07-12', { includeHolidays: false });
  assert.equal(m.kind, 'wedding');
  assert.equal(m.dateISO, '2026-11-20');
  assert.ok(m.label.includes('your wedding'));
  assert.equal(m.isMilestone, true);
});

test('holidays recur and are included by default', () => {
  const moments = buildYearMoments([], '2026-07-12');
  const labels = moments.map((m) => m.label);
  assert.ok(labels.includes('Christmas'));
  assert.ok(labels.includes("Valentine's Day"));
  const xmas = moments.find((m) => m.label === 'Christmas')!;
  assert.equal(xmas.dateISO, '2026-12-25');
  const vday = moments.find((m) => m.label === "Valentine's Day")!;
  assert.equal(vday.dateISO, '2027-02-14'); // Feb 14 has passed in July → next year
});

test('CALENDAR_HOLIDAYS carries no memorial/death entry (guardrail)', () => {
  assert.ok(!CALENDAR_HOLIDAYS.some((h) => /undas|memorial|death|luksa|all souls/i.test(h.label)));
});

test('moments are sorted soonest-first and windowed to a rolling year', () => {
  const evs: MomentEvent[] = [
    { ...base, event_id: 'a', anchor_date: '2026-01-17', anchor_origin: 'wedding', recurs: true }, // Jan 17 2027
    { ...base, event_id: 'b', anchor_date: '2020-08-30', anchor_origin: 'relationship', recurs: true }, // Aug 30 2026
  ];
  const moments = buildYearMoments(evs, '2026-07-12', { includeHolidays: false });
  assert.deepEqual(moments.map((m) => m.dateISO), ['2026-08-30', '2027-01-17']);
  // all within a year
  assert.ok(moments.every((m) => m.daysUntil >= 0 && m.daysUntil <= 366));
});

test('a recurring generic event (travel with yearly toggle) surfaces next occurrence', () => {
  const ev: MomentEvent = {
    ...base, event_id: 't1', event_type: 'travel', display_name: 'Family Trip',
    event_date: '2026-05-03', recurs: true,
  };
  const m = first([ev], '2026-07-12', { includeHolidays: false });
  assert.equal(m.kind, 'recurring');
  assert.equal(m.dateISO, '2027-05-03'); // May 3 passed in July → next year
  assert.equal(m.label, 'Family Trip');
  assert.equal(m.eventId, 't1');
});

test('a NON-recurring generic event produces no moment', () => {
  const ev: MomentEvent = {
    ...base, event_id: 't2', event_type: 'travel', display_name: 'One-off Trip',
    event_date: '2027-05-03', recurs: false,
  };
  assert.equal(buildYearMoments([ev], '2026-07-12', { includeHolidays: false }).length, 0);
});

test('archived events produce no moments', () => {
  const ev: MomentEvent = { ...base, anchor_date: '2026-01-17', anchor_origin: 'wedding', recurs: true, archived: true };
  assert.equal(buildYearMoments([ev], '2026-07-12', { includeHolidays: false }).length, 0);
});
