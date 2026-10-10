/**
 * bench-bookable-days — the pure half of H6: which days are asked about, and
 * who leaves the bench search. The refusals themselves are proven against the
 * real booking path in tests/db/a-full-card-leaves-bench-search.db.test.ts.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  UNBOOKABLE_MAX_CARDS,
  UNBOOKABLE_MAX_DAYS,
  inBatches,
  leavesBenchSearch,
  refusalKey,
  suppliersWithNoBookingLeft,
  unbookableDateScope,
} from './bench-bookable-days';

test('a day-precise date asks about that one day', () => {
  assert.deepEqual(unbookableDateScope('2027-10-02', 'day'), ['2027-10-02']);
});

test('a month-only date asks about every day of that month — leap years included', () => {
  const oct = unbookableDateScope('2027-10-01', 'month')!;
  assert.equal(oct.length, 31);
  assert.equal(oct[0], '2027-10-01');
  assert.equal(oct[30], '2027-10-31');
  assert.equal(unbookableDateScope('2028-02-01', 'month')!.length, 29);
  assert.equal(unbookableDateScope('2027-02-01', 'month')!.length, 28);
  assert.equal(unbookableDateScope('2027-04-15', 'month')!.length, 30, 'any day of the month names the month');
  // Every month fits the function's cap.
  assert.ok(UNBOOKABLE_MAX_DAYS >= 31);
});

test('a year-only date, no date, or a malformed one asks nothing', () => {
  assert.equal(unbookableDateScope('2027-01-01', 'year'), null);
  assert.equal(unbookableDateScope(null, 'day'), null);
  assert.equal(unbookableDateScope('2027-10-02', null), null);
  assert.equal(unbookableDateScope('Oct 2 2027', 'day'), null);
  assert.equal(unbookableDateScope('2027-13-01', 'month'), null);
});

// ── "date/s" (owner 2026-10-10) — an event still choosing between days ──────
test('several candidate dates ask about each of them, once, in order', () => {
  // The shape the create flow writes: no settled day, the shortlist in the array.
  assert.deepEqual(
    unbookableDateScope(null, 'year', ['2027-11-20', '2027-10-02', '2027-11-20']),
    ['2027-10-02', '2027-11-20'],
  );
  assert.deepEqual(unbookableDateScope(null, null, ['2027-10-02']), ['2027-10-02']);
  // Anything that is not a calendar day is dropped, not guessed at.
  assert.deepEqual(unbookableDateScope(null, null, ['2027-10-02', 'soon', null, 7, '']), ['2027-10-02']);
});

test('a settled day wins over the candidates; the candidates win over a month', () => {
  // Same order as resolveProbeWindow (lib/build-date-window) — the bench reads
  // its free days and its hide from one precedence.
  assert.deepEqual(unbookableDateScope('2027-10-09', 'day', ['2027-10-02', '2027-11-20']), ['2027-10-09']);
  assert.deepEqual(unbookableDateScope('2027-10-01', 'month', ['2027-10-02', '2027-11-20']), ['2027-10-02', '2027-11-20']);
  // No candidates → exactly what it was before.
  assert.equal(unbookableDateScope('2027-10-01', 'month', [])!.length, 31);
  assert.equal(unbookableDateScope('2027-10-01', 'month', null)!.length, 31);
  assert.equal(unbookableDateScope('2027-01-01', 'year', []), null);
  assert.equal(unbookableDateScope(null, 'day', undefined), null);
});

test('more candidate dates than one ask accepts hides nobody', () => {
  const many = Array.from({ length: UNBOOKABLE_MAX_DAYS + 1 }, (_, i) => `2027-${String(1 + Math.floor(i / 28)).padStart(2, '0')}-${String(1 + (i % 28)).padStart(2, '0')}`);
  assert.equal(new Set(many).size, UNBOOKABLE_MAX_DAYS + 1);
  assert.equal(unbookableDateScope(null, null, many), null);
  assert.equal(unbookableDateScope(null, null, many.slice(0, UNBOOKABLE_MAX_DAYS))!.length, UNBOOKABLE_MAX_DAYS);
});

test('🔑 with candidate dates a supplier leaves only when refused on EVERY one of them', () => {
  const scope = unbookableDateScope(null, null, ['2027-10-02', '2027-11-20'])!;
  const cards = new Map([
    ['full-both-days', ['a']],
    ['open-on-the-second', ['b']],
    ['one-card-open', ['c1', 'c2']],
  ]);
  const refused = new Set([
    refusalKey('a', '2027-10-02'),
    refusalKey('a', '2027-11-20'),
    refusalKey('b', '2027-10-02'),
    refusalKey('c1', '2027-10-02'),
    refusalKey('c1', '2027-11-20'),
    refusalKey('c2', '2027-10-02'),
  ]);
  assert.deepEqual([...suppliersWithNoBookingLeft(cards, refused, scope)], ['full-both-days']);
});

const days = ['2027-10-01', '2027-10-02'];
const refusedAll = (cards: string[]) => new Set(cards.flatMap((c) => days.map((d) => refusalKey(c, d))));

test('a supplier leaves only when EVERY card is refused on EVERY day', () => {
  const cards = new Map([
    ['full', ['f1', 'f2']],
    ['one-card-open', ['o1', 'o2']],
    ['one-day-open', ['d1']],
  ]);
  const refused = refusedAll(['f1', 'f2', 'o1', 'd1']);
  refused.delete(refusalKey('d1', '2027-10-02'));
  assert.deepEqual([...suppliersWithNoBookingLeft(cards, refused, days)], ['full']);
});

test('no cards in scope, or no days in scope, hides nobody', () => {
  const refused = refusedAll(['a']);
  assert.equal(suppliersWithNoBookingLeft(new Map([['s', []]]), refused, days).size, 0);
  assert.equal(suppliersWithNoBookingLeft(new Map([['s', ['a']]]), refused, []).size, 0);
});

test('a supplier the couple already knows never leaves the search', () => {
  const gone = new Set(['s']);
  assert.equal(leavesBenchSearch({ vendorProfileId: 's', alreadyAdded: false, relationshipDepth: 0 }, gone), true);
  assert.equal(leavesBenchSearch({ vendorProfileId: 's', alreadyAdded: true, relationshipDepth: 0 }, gone), false);
  for (const depth of [1, 2, 3]) {
    assert.equal(leavesBenchSearch({ vendorProfileId: 's', alreadyAdded: false, relationshipDepth: depth }, gone), false);
  }
  assert.equal(leavesBenchSearch({ vendorProfileId: 't', alreadyAdded: false, relationshipDepth: 0 }, gone), false);
});

test('cards are asked about in batches the function accepts', () => {
  const ids = Array.from({ length: 250 }, (_, i) => `c${i}`);
  const batches = inBatches(ids, UNBOOKABLE_MAX_CARDS);
  assert.deepEqual(batches.map((b) => b.length), [100, 100, 50]);
  assert.deepEqual(batches.flat(), ids);
  assert.deepEqual(inBatches([], UNBOOKABLE_MAX_CARDS), []);
});
