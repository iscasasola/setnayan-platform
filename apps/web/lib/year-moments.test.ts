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
  // A relationship anchor now ALSO surfaces the next monthsary (nearer, so it
  // sorts first) — pick the yearly anniversary out by kind.
  const moments = buildYearMoments([ev], '2026-07-12', { includeHolidays: false });
  const m = moments.find((x) => x.kind === 'anniversary')!;
  assert.equal(m.label, 'Your 9th anniversary together');
  assert.equal(m.isMilestone, false); // 9th is an ordinary year
});

test('a relationship anchor surfaces the next MONTHSARY as a quiet line', () => {
  const ev: MomentEvent = { ...base, anchor_date: '2024-02-14', anchor_origin: 'relationship', recurs: true };
  const moments = buildYearMoments([ev], '2026-07-13', { includeHolidays: false });
  const ms = moments.find((x) => x.kind === 'monthsary');
  assert.ok(ms, 'expected a monthsary moment');
  assert.equal(ms.label, 'Your 29th monthsary');
  assert.equal(ms.dateISO, '2026-07-14');
  assert.equal(ms.isMilestone, false); // stays a quiet line, never a nudge
});

test('the monthsary SKIPS the year marks (12/24 → the anniversary owns that date)', () => {
  // On 2026-02-01 the next monthsary would be the 24th (= the 2nd anniversary,
  // same date) → skipped; only the yearly anniversary line remains.
  const ev: MomentEvent = { ...base, anchor_date: '2024-02-14', anchor_origin: 'relationship', recurs: true };
  const moments = buildYearMoments([ev], '2026-02-01', { includeHolidays: false });
  assert.equal(moments.find((x) => x.kind === 'monthsary'), undefined);
  assert.ok(moments.some((x) => x.kind === 'anniversary' && x.label === 'Your 2nd anniversary together'));
});

test('a WEDDING-origin anchor gets no monthsary (monthsaries are relationship-only)', () => {
  const ev: MomentEvent = { ...base, anchor_date: '2020-06-30', anchor_origin: 'wedding', recurs: true };
  const moments = buildYearMoments([ev], '2026-07-12', { includeHolidays: false });
  assert.equal(moments.some((x) => x.kind === 'monthsary'), false);
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
  // event 'b' (relationship) now also emits its next monthsary (2026-07-30),
  // which sorts ahead of the two anniversaries.
  assert.deepEqual(moments.map((m) => m.dateISO), ['2026-07-30', '2026-08-30', '2027-01-17']);
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

test('a recurring birthday names its kind ("— birthday") when the title omits it', () => {
  const ev: MomentEvent = {
    ...base, event_id: 'b1', event_type: 'birthday', display_name: 'Lolo Ramon',
    event_date: '2026-02-03', recurs: true,
  };
  const m = first([ev], '2026-07-12', { includeHolidays: false });
  assert.equal(m.kind, 'recurring');
  assert.equal(m.label, 'Lolo Ramon — birthday');
});

test('a recurring birthday keeps its title when it already says "birthday"', () => {
  const ev: MomentEvent = {
    ...base, event_id: 'b2', event_type: 'birthday', display_name: "Ana's 18th Birthday",
    event_date: '2026-02-03', recurs: true,
  };
  const m = first([ev], '2026-07-12', { includeHolidays: false });
  assert.equal(m.label, "Ana's 18th Birthday");
});

test('a recurring birthday with a birth anchor COUNTS the age ("Nth birthday")', () => {
  // A date is only a time-gap measure — the count is safe to show (owner
  // 2026-07-13). Lolo Ramon, born 1957-02-03, turns 70 on his next birthday.
  const ev: MomentEvent = {
    ...base, event_id: 'b3', event_type: 'birthday', display_name: 'Lolo Ramon',
    event_date: '2026-02-03', anchor_date: '1957-02-03', anchor_origin: 'birthday', recurs: true,
  };
  const m = first([ev], '2026-07-12', { includeHolidays: false });
  assert.equal(m.dateISO, '2027-02-03');
  assert.equal(m.label, 'Lolo Ramon — 70th birthday');
});

test('a recurring pet birthday counts its age the same way', () => {
  const ev: MomentEvent = {
    ...base, event_id: 'p1', event_type: 'birthday', display_name: 'Rocky',
    event_date: '2026-09-01', anchor_date: '2021-09-01', anchor_origin: 'birthday', recurs: true,
  };
  const m = first([ev], '2026-07-12', { includeHolidays: false });
  assert.equal(m.label, 'Rocky — 5th birthday');
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
