/**
 * 🔒 THE STORE'S NEW GRAPHS, WORDED ONCE (owner 23 Nov 2026, Supplier Store drawing v10) — each counts exactly what its
 * rows say. The pure half of `lib/vendor-store-graphs.ts`; the reads' honesty is pinned in
 * `app/vendor-dashboard/performance/the-store-graphs-are-honest.test.ts`.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  STORE_FIXED_WINDOW,
  STORE_GRAPH_KEYS,
  STORE_GRAPH_SOURCE,
  STORE_GRAPH_TITLE,
  followersLine,
  leadLine,
  missedLine,
  owedEmpty,
  owedLine,
  photosLine,
  repliedLine,
  revMonthLine,
  subStars,
  subStarsLine,
  topPhotos,
  typesLine,
  valueLine,
  whenAskLine,
  windowSeries,
} from './vendor-store-graphs';
import { heatGrid } from './vendor-inquiry-analytics';

// 23 Nov 2026, 10:00 Manila.
const NOW = Date.parse('2026-11-23T02:00:00Z');

test('twelve graphs, each titled and naming its data; the fixed windows are the drawing’s', () => {
  assert.equal(STORE_GRAPH_KEYS.length, 12);
  assert.ok(!(STORE_GRAPH_KEYS as readonly string[]).includes('albums'), 'Albums opened has no reader — it must not be built');
  for (const k of STORE_GRAPH_KEYS) {
    assert.ok(STORE_GRAPH_TITLE[k].length > 3, `${k} has no title`);
    assert.ok(STORE_GRAPH_SOURCE[k].length > 20, `${k} does not say what it reads`);
  }
  assert.deepEqual(Object.keys(STORE_FIXED_WINDOW).sort(), ['lead', 'owed', 'replied', 'revmonth', 'substars', 'types', 'value', 'whenask']);
  // The four that switch, as drawn: followers · saved · photos · missed.
  for (const k of ['followers', 'saved', 'photos', 'missed'] as const) assert.equal(STORE_FIXED_WINDOW[k], undefined);
});

test('a series buckets by Manila day (30) or month (12), and drops what falls outside', () => {
  const xs = ['2026-11-22T17:00:00Z' /* 23 Nov Manila */, '2026-11-23T01:00:00Z', '2026-10-01T00:00:00Z', '2025-01-01T00:00:00Z'];
  const d = windowSeries(xs, NOW, '30');
  assert.equal(d.values.length, 30);
  assert.equal(d.values[29], 2, 'both instants land on today (Manila)');
  assert.equal(d.total, 2, 'the 1 Oct instant is outside 30 days');
  const m = windowSeries(xs, NOW, '12');
  assert.equal(m.values.length, 12);
  assert.equal(m.total, 3, 'the 2025 instant is outside 12 months');
  assert.equal(m.labels[11], 'Nov');
  assert.equal(followersLine(d, '30'), '2 new followers in the last 30 days.');
  assert.equal(followersLine({ ...d, total: 1 }, '12'), '1 new follower in the last 12 months.');
});

test('photos: only photos still on the page count; the window cuts by day; ties go to the later photo', () => {
  const rows = [
    { photo_key: 'a', viewed_on: '2026-11-20' },
    { photo_key: 'a', viewed_on: '2026-11-21' },
    { photo_key: 'b', viewed_on: '2026-11-22' },
    { photo_key: 'b', viewed_on: '2026-09-01' },
    { photo_key: 'gone', viewed_on: '2026-11-22' },
  ];
  const w30 = topPhotos(rows, ['a', 'b'], '2026-10-25');
  assert.deepEqual(w30.top, [
    { key: 'a', views: 2 },
    { key: 'b', views: 1 },
  ]);
  assert.equal(w30.total, 3, 'a removed photo’s views never count');
  const w12 = topPhotos(rows, ['a', 'b'], '2025-11-23');
  assert.deepEqual(
    w12.top.map((p) => p.key),
    ['b', 'a'],
    'a tie goes to the later photo on the page',
  );
  assert.equal(photosLine(topPhotos([], ['a'], '2026-01-01'), '30'), 'No photo was opened in the last 30 days.');
  assert.match(photosLine(w30, '30'), /^Your top photo: 2 views in the last 30 days · 3 across your photos\.$/);
});

test('when couples ask: Sunday is the last row; the busiest block is named', () => {
  const grid = heatGrid([
    { dow: 0, hr: 19, count: 5 }, // Sunday 7pm
    { dow: 6, hr: 10, count: 2 }, // Saturday 10am
  ]);
  assert.ok(grid);
  assert.equal(grid![6]![6], 5);
  assert.equal(grid![5]![3], 2);
  assert.equal(whenAskLine(grid!), 'Most inquiries arrive on Sunday, 6p–9p · 7 in the last 12 months.');
  assert.equal(heatGrid([]), null, 'no inquiry is no grid — the card draws the Example, never an empty heat');
});

test('missed: a zero is a real answer; otherwise the never-answered are named', () => {
  assert.equal(missedLine({ declined: 0, unansweredOverSla: 0, selfReportedNoResponse: 0, waitlisted: 0 }, '30'), 'No inquiry slipped in the last 30 days.');
  assert.equal(missedLine({ declined: 1, unansweredOverSla: 2, selfReportedNoResponse: 0, waitlisted: 1 }, '12'), '4 inquiries slipped in the last 12 months · 2 never answered.');
});

test('money: pesos through lib/php.ts; owed names overdue and unset amounts', () => {
  const v = valueLine([
    { key: 'a', label: 'Oct', php: 50000 },
    { key: 'b', label: 'Nov', php: 25000 },
  ]);
  assert.match(v, /^₱75,000 booked in the last 12 months · most in Oct \(₱50,000\)\.$/);
  const o = { receivedPhp: 10000, toComePhp: 5000, overdue: 1, unresolved: 2, bookings: 3 };
  assert.equal(owedLine(o), '₱10,000 received · ₱5,000 still to come in, across 3 bookings · 1 overdue · 2 with no amount set.');
  assert.equal(owedEmpty({ receivedPhp: 0, toComePhp: 0, overdue: 0, unresolved: 0, bookings: 0 }), true);
  assert.equal(owedEmpty({ receivedPhp: 0, toComePhp: 0, overdue: 0, unresolved: 1, bookings: 1 }), false, 'a plan with no amount set is not "nothing"');
});

test('lead, kinds and reviews are worded from their own numbers', () => {
  assert.equal(leadLine({ bookedWithDateCount: 9, avgLeadDays: 200, medianLeadDays: 181.6 }), 'Couples book you about 182 days before their event — the middle of 9 dated bookings.');
  assert.equal(typesLine({ kinds: [{ key: 'wedding', label: 'Wedding', count: 7 }], total: 9, atLeast: true }), '9+ events completed through Setnayan · most are Wedding (7).');
  assert.equal(
    revMonthLine([
      { key: 'a', label: 'Oct', count: 2 },
      { key: 'b', label: 'Nov', count: 1 },
    ]),
    '3 reviews in the last 12 months · 1 this month.',
  );
  assert.equal(repliedLine({ replied: 3, total: 4 }), 'You answered 3 of 4 reviews.');
});

test('the part ratings average every valid review and skip a broken row', () => {
  const s = subStars([
    { rating_communication: 5, rating_quality: 5, rating_value: 4, rating_on_time: 5 },
    { rating_communication: 3, rating_quality: 5, rating_value: 4, rating_on_time: 1 },
    { rating_communication: null, rating_quality: 5, rating_value: 5, rating_on_time: 5 },
  ]);
  assert.equal(s.n, 2);
  assert.deepEqual(s.avg, { communication: 4, quality: 5, value: 4, on_time: 3 });
  assert.equal(subStarsLine(s, (k) => k), 'Highest on quality (5.0), lowest on on_time (3.0) · 2 reviews.');
});
