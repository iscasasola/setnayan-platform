/**
 * 🔒 The analytics sheet's line (lib/shop-analytics-series.ts): this period so far vs the SAME SPAN of the one before,
 * Manila days, cumulative; an unread series is null (never a flat zero); an empty "before" is "new", never "+∞%".
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { changeWord, periodLine, seriesSinceIso, SERIES_CARDS } from './shop-analytics-series';

const NOW = Date.parse('2026-11-09T02:00:00Z'); // 10:00 Manila, 9 Nov 2026

test('by month: this month to the 9th vs last month to the 9th, cumulative', () => {
  const l = periodLine(['2026-11-01T03:00:00Z', '2026-11-08T03:00:00Z', '2026-11-20T03:00:00Z', '2026-10-02T03:00:00Z', '2026-10-25T03:00:00Z'], 'month', NOW)!;
  assert.equal(l.now.length, 9, 'up to today only');
  assert.equal(l.total, 2, 'a future instant is not counted');
  assert.equal(l.ghost.length, 31, 'October in full');
  assert.equal(l.ghost[30], 2);
  assert.equal(l.prevSameSpan, 1, 'only 2 Oct is inside the same span');
  assert.equal(l.change, '+100%');
  assert.deepEqual(l.axis, ['Day 1', 'Day 15', 'Day 30']);
  assert.equal(l.vs, 'last month');
});

test('Manila calendar: 23:30 UTC on 31 Oct is 1 Nov in Manila', () => {
  const l = periodLine(['2026-10-31T23:30:00Z'], 'month', NOW)!;
  assert.equal(l.total, 1);
  assert.equal(l.ghost[30], 0);
});

test('a plain date (booked_date) counts on that Manila day', () => {
  const l = periodLine(['2026-11-03'], 'month', NOW)!;
  assert.equal(l.now[2], 1);
});

test('by quarter and by year', () => {
  const q = periodLine(['2026-10-05T03:00:00Z', '2026-07-05T03:00:00Z'], 'quarter', NOW)!;
  assert.equal(q.total, 1);
  assert.equal(q.prevSameSpan, 1);
  assert.equal(q.change, 'same');
  assert.deepEqual(q.axis, ['Oct', 'Nov', 'Dec']);
  const y = periodLine(['2026-03-05T03:00:00Z', '2025-12-05T03:00:00Z'], 'year', NOW)!;
  assert.equal(y.now.length, 11, 'Jan → Nov');
  assert.equal(y.ghost.length, 12);
  assert.equal(y.total, 1);
  assert.equal(y.prevSameSpan, 0, 'December 2025 is after the same span');
  assert.equal(y.change, 'new');
});

test('honest words: unread is null, nothing either time is no change line, an empty before is "new"', () => {
  assert.equal(periodLine(null, 'month', NOW), null);
  assert.equal(periodLine([], 'month', NOW)!.change, null);
  assert.equal(changeWord(3, 0), 'new');
  assert.equal(changeWord(2, 4), '−50%');
  assert.equal(seriesSinceIso(NOW), '2024-12-31T16:00:00.000Z');
  assert.deepEqual([...SERIES_CARDS], ['ahead', 'deals', 'worth'], 'price and compare are snapshots — no line');
});
