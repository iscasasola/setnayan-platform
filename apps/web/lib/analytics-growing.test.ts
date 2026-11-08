/**
 * Shop › Analytics — the harvested bucket helpers, the 13-week strip, the price rail and the "What's ahead" line
 * (lib/analytics-growing.ts, from #7338, owner-approved 6 Nov 2026). Cases carried verbatim from #7338's own test.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { aheadLine, bucketInstants, dayBuckets, monthBuckets, ordinal, railMarker, stripMarks, stripMonths } from './analytics-growing';

test('the What’s ahead line — never a zero for an unread read', () => {
  assert.equal(aheadLine({ bookedDays: 0, waitingCouples: 0, waitingDates: 0 }), 'Nothing booked ahead · no couples waiting');
  assert.equal(aheadLine({ bookedDays: 4, waitingCouples: 3, waitingDates: 2 }), '4 days booked ahead · 3 couples waiting on 2 dates');
  assert.equal(aheadLine({ bookedDays: 1, waitingCouples: 1, waitingDates: 1 }), '1 day booked ahead · 1 couple waiting on 1 date');
  assert.equal(aheadLine(null), 'Couldn’t load');
});

test('ordinals', () => {
  assert.deepEqual([1, 2, 3, 4, 11, 12, 13, 21, 22, 45, 101].map(ordinal), ['1st', '2nd', '3rd', '4th', '11th', '12th', '13th', '21st', '22nd', '45th', '101st']);
});

test('buckets are Manila days and months, oldest first, matching the booked series’ keys', () => {
  const now = Date.parse('2026-11-06T02:00:00Z'); // 10:00 Manila, 6 Nov
  const days = dayBuckets(now, 30);
  assert.equal(days.length, 30);
  assert.deepEqual(days[29], { key: '2026-11-06', label: '6 Nov', count: 0 });
  assert.equal(days[0]!.key, '2026-10-08');
  const months = monthBuckets(now, 12);
  assert.deepEqual(months.map((m) => m.label).join(''), 'DecJanFebMarAprMayJunJulAugSepOctNov');
  assert.equal(months[0]!.key, '2025-12-01');
  // 23:30 UTC on 5 Nov is 07:30 on 6 Nov in Manila
  const b = bucketInstants(['2026-11-05T23:30:00Z', '2026-11-05T15:00:00Z', '2020-01-01T00:00:00Z', 'nonsense'], days, 'day');
  assert.equal(b[29]!.count, 1);
  assert.equal(b[28]!.count, 1);
  assert.equal(b.reduce((s, x) => s + x.count, 0), 2, 'an instant outside the window is dropped, never folded into an edge');
});

test('the 13-week strip and the price rail', () => {
  const m = stripMarks('2026-11-06', [{ date: '2026-11-15', bookings: 1 }, { date: '2026-11-29', bookings: 2 }, { date: '2027-06-01', bookings: 1 }], [{ date: '2026-12-13' }]);
  assert.deepEqual(m, { booked: [{ at: 9, many: false }, { at: 23, many: true }], waiting: [37] });
  assert.deepEqual(stripMonths('2026-11-06'), ['Nov', '', '', '', 'Dec', '', '', '', 'Jan', '', '', '', '']);
  assert.equal(railMarker(38000, { lowPhp: 25000, highPhp: 65000 }, 45), 45);
  assert.equal(railMarker(null, { lowPhp: 1, highPhp: 2 }, null), null);
  assert.equal(railMarker(10, { lowPhp: 25, highPhp: 65 }, null), 0);
});
