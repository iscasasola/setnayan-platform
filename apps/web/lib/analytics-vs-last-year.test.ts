/**
 * 🔒 VS LAST YEAR + THREE YEARS (owner 21 Nov 2026, *"Yes, add it"* — DECISION_LOG "ANALYTICS "VS LAST YEAR" — YES").
 * The rules the owner approved, held on the pure module the cards read:
 *   · under 10 in either period → both counts, no percent, no line;
 *   · a shop under a year old → nothing;
 *   · a refused last year → "Couldn’t load", never a percent;
 *   · 30 days looks back 52 weeks (weekdays line up); 12 months one calendar year, the month cut to the same day;
 *   · three seasons, December → November, each counted to today's month and day; opens total as couples.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  COMPARE_FLOOR,
  buildCompareSeries,
  drawsLastYearLine,
  lastYearSpan,
  pctWord,
  shopIsAYearOld,
  vsLastYear,
  vsLastYearWords,
  yearSpans,
  yearsToShow,
  type InstantRow,
} from './analytics-vs-last-year';

const NOW = Date.parse('2026-11-21T04:00:00Z'); // 21 Nov 2026, noon in Manila

test('the floor is 10, and under it there is no percent and no line — both counts in words', () => {
  assert.equal(COMPARE_FLOOR, 10);
  const c = vsLastYear(4, 2, true);
  assert.deepEqual(c, { show: 'small', now: 4, then: 2 });
  assert.equal(drawsLastYearLine(c), false);
  assert.equal(vsLastYearWords(c, '30'), 'Same days last year: 2.');
  assert.equal(vsLastYearWords(c, '12'), 'Same months last year: 2.');
  // either side under the floor is enough
  assert.equal(vsLastYear(40, 9, true).show, 'small');
  assert.equal(vsLastYear(9, 40, true).show, 'small');
});

test('at or over 10 in both: a rounded percent, up green / down red / flat', () => {
  const up = vsLastYear(349, 284, true);
  assert.equal(up.show, 'pct');
  assert.equal(pctWord(up as never), '+23%');
  assert.equal(vsLastYearWords(up, '30'), '23% more than last year');
  assert.equal(drawsLastYearLine(up), true);
  const down = vsLastYear(88, 100, true);
  assert.equal(pctWord(down as never), '−12%');
  assert.equal(vsLastYearWords(down, '12'), '12% fewer than last year');
  const flat = vsLastYear(10, 10, true);
  assert.equal(pctWord(flat as never), '0%');
  assert.equal(vsLastYearWords(flat, '30'), 'the same as last year');
});

test('a shop under a year old, or a card that did not load, shows nothing; a refused last year says so', () => {
  assert.deepEqual(vsLastYear(349, 284, false), { show: 'none' });
  assert.deepEqual(vsLastYear(null, 284, true), { show: 'none' });
  const unread = vsLastYear(349, null, true);
  assert.deepEqual(unread, { show: 'unread' });
  assert.equal(drawsLastYearLine(unread), false);
  assert.match(vsLastYearWords(unread, '30'), /couldn’t load/i);
  assert.equal(shopIsAYearOld('2025-11-20T00:00:00Z', NOW), true);
  assert.equal(shopIsAYearOld('2025-12-01T00:00:00Z', NOW), false);
  assert.equal(shopIsAYearOld(null, NOW), false);
});

test('30 days looks back 52 weeks (the same weekday); 12 months one calendar year', () => {
  const s30 = lastYearSpan('30', NOW);
  assert.equal(new Date(s30.to).getUTCDay(), new Date(NOW).getUTCDay(), 'Saturdays line up with Saturdays');
  assert.equal((NOW - s30.to) / 86_400_000, 364);
  const s12 = lastYearSpan('12', NOW);
  assert.equal(new Date(s12.to).toISOString(), '2025-11-21T04:00:00.000Z');
});

test('three seasons, December → November, each to today’s month and day', () => {
  const y = yearSpans(NOW);
  assert.deepEqual(
    y.map((s) => s.label),
    ['2024', '2025', '2026'],
  );
  assert.equal(new Date(y[0]!.from).toISOString(), '2023-11-30T16:00:00.000Z', '1 Dec 2023, Manila midnight');
  assert.equal(new Date(y[2]!.to).toISOString(), '2026-11-21T16:00:00.000Z', 'to the end of 21 Nov, Manila');
  assert.equal(new Date(y[1]!.to).toISOString(), '2025-11-21T16:00:00.000Z', 'last season cut to the same day');
  // In December the season is the next year's, and a past season is cut to the same few days.
  const dec = yearSpans(Date.parse('2026-12-05T04:00:00Z'));
  assert.equal(dec[2]!.label, '2027');
  assert.equal(new Date(dec[1]!.to).toISOString(), '2025-12-05T16:00:00.000Z');
});

test('one set of rows → the lanes, last year’s lanes and totals, and the seasons; opens total as couples', () => {
  const rows: InstantRow[] = [
    { at: '2026-11-20T01:00:00Z', who: 'a' },
    { at: '2026-11-20T02:00:00Z', who: 'a' }, // the same couple twice — one couple, two opens
    { at: '2025-11-21T01:00:00Z', who: 'b' }, // 364 days before 20 Nov 2026 → last year's 30-day window
    { at: '2025-11-22T05:00:00Z', who: 'c' }, // after one calendar year back — not in last year's 12 months
    { at: '2024-06-01T00:00:00Z', who: 'd' }, // season 2024
  ];
  const couples = (r: readonly InstantRow[]) => new Set(r.map((x) => x.who)).size;
  const s = buildCompareSeries(rows, NOW, couples);
  assert.equal(s.day.length, 30);
  assert.equal(s.day[29]!.count, 0);
  assert.equal(s.day[28]!.count, 2, 'two opens on 20 Nov');
  assert.equal(s.lastYear.day.length, 30);
  assert.equal(s.lastYear.day.reduce((a, b) => a + b.count, 0), 2, 'b and c fall on the days 52 weeks back');
  assert.equal(s.lastYear.total['30'], 1, 'the total is the card’s own span moved back: c is after its end');
  assert.equal(s.lastYear.month[11]!.key, '2025-11-01');
  assert.equal(s.lastYear.month[11]!.count, 1, 'the month is cut to the same day: c (22 Nov 2025) is after it');
  assert.deepEqual(
    s.years.map((y) => y.label),
    ['2024', '2025', '2026'],
  );
  assert.equal(s.years[2]!.total, 1, 'this season: couple a, once');
  assert.equal(s.years[0]!.total, 1);
  assert.equal(s.years[0]!.months.length, 12);
  assert.equal(s.years[2]!.months[11], 2, 'November of this season, as opens');
});

test('the seasons shown are the ones the shop has lived in — none under two', () => {
  const s = buildCompareSeries([], NOW);
  assert.equal(yearsToShow(s.years, '2023-01-01T00:00:00Z', NOW).length, 3);
  assert.equal(yearsToShow(s.years, '2025-03-01T00:00:00Z', NOW).length, 2);
  assert.equal(yearsToShow(s.years, '2026-03-01T00:00:00Z', NOW).length, 0);
  assert.equal(yearsToShow(s.years, null, NOW).length, 0);
});
