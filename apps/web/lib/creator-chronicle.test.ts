/**
 * Unit suite for the chronicle — what day a chapter is about, what number it
 * carries, and how the years group (Node built-in runner via `pnpm test:unit`).
 *
 * The load-bearing claims, each one a bug that shipped or nearly did:
 *   • the number follows the DAY IT HAPPENED, not the day it was typed;
 *   • an undated chapter gets NO number and sits at the tail;
 *   • day strings are compared as strings — a December day never reads as
 *     November because the reader's clock is west of Greenwich.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  chronicleDay,
  groupChronicleByYear,
  rankChronicle,
} from './creator-chronicle';

test('chronicleDay takes the author’s own answer first', () => {
  assert.equal(
    chronicleDay({
      happenedOn: '2019-05-04',
      eventDate: '2026-12-18',
      publishedAt: '2026-08-12',
    }),
    '2019-05-04',
  );
});

test('chronicleDay prefers the celebration over the publish date', () => {
  assert.equal(
    chronicleDay({ eventDate: '2019-05-04', publishedAt: '2026-08-12 15:50:28+00' }),
    '2019-05-04',
  );
});

test('chronicleDay falls back to the publish day for a standalone chapter', () => {
  assert.equal(
    chronicleDay({ eventDate: null, publishedAt: '2026-08-12 15:50:28.405235+00' }),
    '2026-08-12',
  );
});

test('chronicleDay returns null for an unpublished standalone chapter', () => {
  assert.equal(chronicleDay({ eventDate: null, publishedAt: null }), null);
  assert.equal(chronicleDay({ eventDate: '', publishedAt: 'not a date' }), null);
});

test('a chapter about no celebration files under the day it HAPPENED, not the day it was typed', () => {
  // The whole reason `happened_on` exists: without it a 2019 trip written up
  // today lands in 2026.
  const days = [
    chronicleDay({ happenedOn: '2019-07-01', publishedAt: '2026-08-20' }),
    chronicleDay({ happenedOn: null, publishedAt: '2026-08-20' }),
  ];
  assert.deepEqual(days, ['2019-07-01', '2026-08-20']);
});

test('THE NUMBER RESTARTS EACH YEAR — like episodes inside a season', () => {
  const { numberByIndex, yearByIndex } = rankChronicle([
    '2026-12-18', // 2026's third
    '2026-02-02', // 2026's first
    '2019-05-04', // 2019's first
    '2026-06-06', // 2026's second
  ]);
  assert.equal(numberByIndex.get(2), 1, '2019 starts again at 1');
  assert.equal(numberByIndex.get(1), 1, 'and so does 2026');
  assert.equal(numberByIndex.get(3), 2);
  assert.equal(numberByIndex.get(0), 3);
  assert.equal(yearByIndex.get(2), '2019');
});

test('ADDING AN OLD MEMORY MOVES ONLY ITS OWN YEAR', () => {
  // The reason numbering is per-year and not across a life: a number somebody
  // has already read must not change because of something in another year.
  const before = rankChronicle(['2026-02-02', '2026-06-06']);
  const after = rankChronicle(['2026-02-02', '2026-06-06', '2019-05-04']);
  assert.equal(before.numberByIndex.get(0), after.numberByIndex.get(0));
  assert.equal(before.numberByIndex.get(1), after.numberByIndex.get(1));
  assert.equal(after.numberByIndex.get(2), 1, 'the old memory opens its own year');
});

test('THE REGRESSION THIS EXISTS FOR: writing up an old day does not make it the newest chapter', () => {
  // Published newest-first, as every stored chapter list arrives:
  //   [0] the 2026 wedding, published in June
  //   [1] the 2019 engagement, written up LAST (published August)
  const days = [
    chronicleDay({ eventDate: '2026-12-18', publishedAt: '2026-06-01' }),
    chronicleDay({ eventDate: '2019-05-04', publishedAt: '2026-08-12' }),
  ];
  const { numberByIndex, newestFirst } = rankChronicle(days);
  assert.equal(numberByIndex.get(1), 1, 'the 2019 engagement opens 2019');
  assert.equal(numberByIndex.get(0), 1, 'the 2026 wedding opens 2026');
  assert.deepEqual(newestFirst, [0, 1], 'reading order is newest day first');
});

test('an undated chapter carries no number and sits at the tail', () => {
  const { numberByIndex, yearByIndex, newestFirst } = rankChronicle([
    null,
    '2026-12-18',
    '2024-02-02',
  ]);
  assert.equal(numberByIndex.has(0), false);
  assert.equal(yearByIndex.has(0), false);
  assert.equal(numberByIndex.get(2), 1, '2024 opens with its own Chapter 1');
  assert.equal(numberByIndex.get(1), 1, 'and 2026 opens with its own');
  assert.deepEqual(newestFirst, [1, 2, 0]);
});

test('a day is compared as a string, never through a Date', () => {
  // 2026-12-12 parsed as a Date is midnight UTC = the 11th in Manila-minus
  // timezones. Ranking must not care where the reader is.
  const { numberByIndex, yearByIndex } = rankChronicle(['2026-12-12', '2026-12-11']);
  assert.equal(numberByIndex.get(1), 1);
  assert.equal(numberByIndex.get(0), 2);
  assert.equal(yearByIndex.get(0), '2026');
});

test('ties keep the caller order', () => {
  const { numberByIndex } = rankChronicle(['2026-08-01', '2026-08-01']);
  assert.equal(numberByIndex.get(0), 1);
  assert.equal(numberByIndex.get(1), 2);
});

test('groupChronicleByYear blocks by year, newest first, undated last', () => {
  const items = [
    { t: 'wedding', day: '2026-12-18' },
    { t: 'engagement', day: '2019-05-04' },
    { t: 'reception', day: '2026-02-02' },
    { t: 'draft', day: null as string | null },
  ];
  const blocks = groupChronicleByYear(items, (i) => i.day);
  assert.deepEqual(
    blocks.map((b) => b.year),
    ['2026', '2019', null],
  );
  assert.deepEqual(
    blocks[0]!.entries.map((e) => e.item.t),
    ['wedding', 'reception'],
  );
  assert.equal(blocks[0]!.entries[0]!.number, 2, 'the 2026 wedding is 2026’s second');
  assert.equal(blocks[1]!.entries[0]!.number, 1);
  assert.equal(blocks[2]!.entries[0]!.number, null, 'an undated chapter has no number');
});

test('one chapter is Chapter 1 — the number never starts at 0', () => {
  const { numberByIndex } = rankChronicle(['2026-08-01']);
  assert.equal(numberByIndex.get(0), 1);
});

/**
 * Ported from `rankChaptersByPublishedAt`, which this replaced. The lesson is
 * older than the chronicle and must not be lost with it: the profile read
 * orders `published_at` DESC and **Postgres DESC is NULLS FIRST**, so
 * `chapters[0]` is NOT reliably the newest chapter.
 */
test('NULLS FIRST trap — an undated row leading the list is NOT the newest', () => {
  const { newestFirst, numberByIndex } = rankChronicle([
    null, // Postgres DESC puts this first; index 0 would be the wrong answer.
    '2026-03-01',
    '2026-01-01',
  ]);
  assert.equal(newestFirst[0], 1, 'the newest DATED row leads, not index 0');
  assert.equal(numberByIndex.has(0), false, 'an undated row gets no number');
  assert.equal(numberByIndex.get(2), 1);
  assert.equal(numberByIndex.get(1), 2);
});

test('an unparseable date is treated as undated, not as epoch 0', () => {
  const days = [chronicleDay({ publishedAt: 'not-a-date' }), '2026-01-01'];
  const { numberByIndex, newestFirst } = rankChronicle(days);
  assert.equal(numberByIndex.has(0), false);
  assert.equal(newestFirst[0], 1);
});

test('nothing dated → no numbers at all, and the input order survives', () => {
  const { numberByIndex, newestFirst } = rankChronicle([null, null]);
  assert.equal(numberByIndex.size, 0);
  assert.deepEqual(newestFirst, [0, 1]);
});
