/**
 * Unit suite for the Story's day-window bound (Node built-in test runner, run
 * via tsx — `pnpm test:unit`). Pure + no DB — the DB-level regression against
 * the full replayed schema + the new bucket-count RPC lives in
 * tests/db/story-day-timeline-bounds.db.test.ts.
 *
 * The load-bearing invariants (03 §3 · 08 steps 0.2 + 0.4):
 *   • a dateless event resolves to `null` (unbounded read, unchanged prior
 *     behaviour) rather than throwing or silently emptying everything;
 *   • the window is Manila calendar days, not a bare UTC date slice — run
 *     under BOTH Asia/Manila and a west-of-Greenwich zone;
 *   • a stray event_end_date before event_date collapses to a single day
 *     rather than reading backwards;
 *   • allocateChapterCounts never lets a multi-day split exceed the shared
 *     cap, and gives every non-empty day at least one chapter when there's
 *     room for it.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { storyDayWindow, storyDayList, manilaDayOf, allocateChapterCounts } from './story-day-window';

for (const tz of ['Asia/Manila', 'America/Los_Angeles', 'Pacific/Auckland']) {
  test(`[TZ=${tz}] storyDayWindow: single-day event bounds to that Manila day`, () => {
    const prevTz = process.env.TZ;
    process.env.TZ = tz;
    try {
      const win = storyDayWindow('2027-02-13', null);
      assert.ok(win);
      assert.equal(win!.startDate, '2027-02-13');
      assert.equal(win!.endDate, '2027-02-13');
      assert.equal(win!.days, 1);
      assert.equal(win!.startIso, '2027-02-13T00:00:00+08:00');
      assert.equal(win!.endIso, '2027-02-13T23:59:59+08:00');
    } finally {
      process.env.TZ = prevTz;
    }
  });

  test(`[TZ=${tz}] storyDayWindow: multi-day event spans event_date..event_end_date inclusive`, () => {
    const prevTz = process.env.TZ;
    process.env.TZ = tz;
    try {
      const win = storyDayWindow('2027-02-13', '2027-02-14');
      assert.ok(win);
      assert.equal(win!.days, 2);
      assert.equal(win!.startIso, '2027-02-13T00:00:00+08:00');
      assert.equal(win!.endIso, '2027-02-14T23:59:59+08:00');
      assert.deepEqual(storyDayList(win!), ['2027-02-13', '2027-02-14']);
    } finally {
      process.env.TZ = prevTz;
    }
  });
}

test('storyDayWindow: no event_date → null (read stays unbounded, matches prior behaviour)', () => {
  assert.equal(storyDayWindow(null, null), null);
  assert.equal(storyDayWindow(undefined, '2027-02-14'), null);
});

test('storyDayWindow: a stray event_end_date before event_date collapses to a single day', () => {
  const win = storyDayWindow('2027-02-13', '2027-02-01'); // bad data, end < start
  assert.ok(win);
  assert.equal(win!.startDate, '2027-02-13');
  assert.equal(win!.endDate, '2027-02-13');
  assert.equal(win!.days, 1);
});

test('manilaDayOf: a Manila-1am capture on day 2 is NEVER day 1, even though its UTC date is day 1', () => {
  // 2027-02-14T01:00+08:00 == 2027-02-13T17:00Z — the exact class of bug a bare
  // UTC date slice would get wrong.
  assert.equal(manilaDayOf('2027-02-14T01:00:00+08:00'), '2027-02-14');
  assert.notEqual(manilaDayOf('2027-02-14T01:00:00+08:00'), '2027-02-13');
});

test('manilaDayOf: null/unparseable input → null', () => {
  assert.equal(manilaDayOf(null), null);
  assert.equal(manilaDayOf('not a date'), null);
});

test('allocateChapterCounts: never exceeds the shared cap', () => {
  const out = allocateChapterCounts([50, 3, 1], 10);
  assert.equal(out.reduce((a, b) => a + b, 0) <= 10, true);
});

test('allocateChapterCounts: every non-empty day gets at least 1 when days ≤ cap', () => {
  const out = allocateChapterCounts([50, 3, 1], 10);
  assert.ok(out.every((n) => n >= 1), 'every non-empty group has ≥1 chapter');
  // The 1-item day can never get more than its own 1 item.
  assert.equal(out[2], 1);
});

test('allocateChapterCounts: an empty day gets zero, never a phantom chapter', () => {
  const out = allocateChapterCounts([50, 0, 3], 10);
  assert.equal(out[1], 0);
});

test('allocateChapterCounts: a single day gets the whole cap (matches pre-multi-day behaviour)', () => {
  const out = allocateChapterCounts([120], 10);
  assert.equal(out[0], 10);
});

test('allocateChapterCounts: proportional split roughly follows share', () => {
  // Day 1 has 9× day 2's captures → should get noticeably more chapters.
  const out = allocateChapterCounts([90, 10], 10);
  assert.ok(out[0]! > out[1]!, 'the bigger day gets more chapters');
  assert.equal(out[0]! + out[1]!, 10);
});
