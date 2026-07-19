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

test('a NEW relationship surfaces its next monthsary through year one', () => {
  // Together since Feb 14 2026; on Jul 13 the next monthsary is the 5th (Jul 14).
  const ev: MomentEvent = { ...base, anchor_date: '2026-02-14', anchor_origin: 'relationship', recurs: true };
  const ms = buildYearMoments([ev], '2026-07-13', { includeHolidays: false }).find((x) => x.kind === 'monthsary');
  assert.ok(ms, 'expected a monthsary moment');
  assert.equal(ms.label, 'Your 5th monthsary');
  assert.equal(ms.dateISO, '2026-07-14');
  assert.equal(ms.isMilestone, false); // stays a quiet line, never a nudge
});

test('monthsaries STOP after the first year (month 12 = the anniversary)', () => {
  // Together since 2+ years ago → no monthsary; only the yearly anniversary.
  const past: MomentEvent = { ...base, anchor_date: '2024-02-14', anchor_origin: 'relationship', recurs: true };
  const m1 = buildYearMoments([past], '2026-07-13', { includeHolidays: false });
  assert.equal(m1.find((x) => x.kind === 'monthsary'), undefined);
  assert.ok(m1.some((x) => x.kind === 'anniversary'));
  // On the exact 12th month, the monthsary is skipped (that date IS the 1st anniversary).
  const twelve: MomentEvent = { ...base, anchor_date: '2025-07-14', anchor_origin: 'relationship', recurs: true };
  const m2 = buildYearMoments([twelve], '2026-07-01', { includeHolidays: false });
  assert.equal(m2.find((x) => x.kind === 'monthsary'), undefined);
});

test('a NEW marriage surfaces a wedding monthsary through year one', () => {
  // Married Mar 1 2026; on Jul 13 the next wedding monthsary is the 5th (Aug 1),
  // alongside the upcoming 1st anniversary.
  const ev: MomentEvent = {
    ...base, event_id: 'w3', event_type: 'wedding', display_name: 'Carlo & Bianca',
    event_date: '2026-03-01', recurs: false,
  };
  const moments = buildYearMoments([ev], '2026-07-13', { includeHolidays: false });
  const ms = moments.find((x) => x.kind === 'monthsary');
  assert.ok(ms, 'expected a wedding monthsary');
  assert.equal(ms.label, 'Your 5th wedding monthsary');
  assert.equal(ms.dateISO, '2026-08-01');
  assert.ok(moments.some((x) => x.kind === 'anniversary' && x.label === 'Your 1st wedding anniversary'));
});

test('an OLD marriage gets no monthsary (only the yearly anniversary)', () => {
  const ev: MomentEvent = {
    ...base, event_id: 'w4', event_type: 'wedding', display_name: 'Old Pair',
    event_date: '2020-06-30', recurs: false,
  };
  const moments = buildYearMoments([ev], '2026-07-12', { includeHolidays: false });
  assert.equal(moments.some((x) => x.kind === 'monthsary'), false);
});

test('a NEW born surfaces monthly milestones through year one', () => {
  // Baby Mateo born Feb 14 2026 → on Jul 13 he is in his 5th month (Jul 14),
  // alongside the upcoming 1st birthday.
  const ev: MomentEvent = {
    ...base, event_id: 'bb1', event_type: 'birthday', display_name: 'Baby Mateo',
    event_date: '2026-02-14', anchor_date: '2026-02-14', anchor_origin: 'birthday', recurs: true,
  };
  const moments = buildYearMoments([ev], '2026-07-13', { includeHolidays: false });
  const ms = moments.find((x) => x.kind === 'monthsary');
  assert.ok(ms, 'expected a newborn monthsary');
  assert.equal(ms.label, 'Baby Mateo — 5th month');
  assert.equal(ms.dateISO, '2026-07-14');
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
  // A <1yr wedding also emits its wedding monthsary (nearer, sorts first) — pick
  // the anniversary out by kind.
  const m = buildYearMoments([ev], '2026-07-12', { includeHolidays: false }).find((x) => x.kind === 'anniversary')!;
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
  // Both anchors are past their first year, so no monthsary — just the two
  // anniversaries (event 'a' is a wedding-origin ANNIVERSARY record, not a
  // wedding event, so it never emits a marriage monthsary either).
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
