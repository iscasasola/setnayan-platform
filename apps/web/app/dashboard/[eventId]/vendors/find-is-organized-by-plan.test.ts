/**
 * find-is-organized-by-plan.test.ts — 📋 FIND IS ORGANIZED AROUND WHAT THE COUPLE IS PLANNING.
 *
 * Owner 2026-11-12, verbatim: "Yes, build it" — on the approved prototype `suppliers-one-prototype-2026-11-12`
 * (Fable), with four answers: "Ask for a quote" is the ONE verb on cards and liked photos · the covered count counts
 * *"only the ones listed"* · 3 suggested cards and 4 idea photos · asking is never automatic (*"needs to press"*).
 *
 *   1  the pinned row: Find ▾ (each menu row with its meaning) · the count · the NEXT page · ⚙
 *   2  Find lists only the categories with someone in them (`listedOnly`), and the shell's Build N/M counts the same rows
 *   3  an opened category reads Booked → Asked → Liked ideas → Suggested for you → Ideas; booked → "✓ Done · Search again"
 *   4  "Suggested for you" is three cards and ONE "Search all <Category> (N) ›"; Ideas is four part tiles + "More ideas"
 *   5  a liked photo links to its shop and card, and its "Ask for a quote" is the card's own words — only on a press
 *   6  a brand-new event says so, with the way in
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from '@/lib/strip-comments';
import { SUPPLIERS_MODE_MEANING, SUPPLIERS_NEXT_MODE } from '@/lib/suppliers-shell';
import { buildFindInspiration, likedFromLine } from '@/lib/find-inspiration';
import type { InspirationPart } from '@/lib/inspiration-parts';

const read = (p: string) => stripComments(readFileSync(join(__dirname, p), 'utf8'));
const SHELL = read('_components/services-takeover.tsx');
const BENCH = read('_components/shortlist-categories.tsx');
const INSP = read('_components/find-inspiration.tsx');
const PAGE = read('page.tsx');

test('1 · the pinned row: Find ▾ with meanings · its count · the next page · ⚙', () => {
  assert.deepEqual(SUPPLIERS_NEXT_MODE, { find: 'build', build: 'booked', booked: 'find' });
  for (const m of ['find', 'build', 'booked'] as const) assert.ok(SUPPLIERS_MODE_MEANING[m].length > 0);
  const at = SHELL.indexOf('data-suppliers-stick=""');
  const row = SHELL.slice(SHELL.lastIndexOf('<div', at), SHELL.indexOf('<MenuSettingsButton', at));
  assert.match(row, /<ActionButton[\s\S]*?label=\{nextWords\}[\s\S]*?onClick=\{\(\) => goToBuildTab\(SUPPLIERS_MODE_TAB\[nextMode\]\)\}/, 'the row’s one action is not the next page');
  const opts = SHELL.slice(SHELL.indexOf('const faceOptions'), SHELL.indexOf('];', SHELL.indexOf('const faceOptions')));
  assert.equal((opts.match(/hint: SUPPLIERS_MODE_MEANING\./g) ?? []).length, 3, 'a menu row lost its one-line meaning');
});

test('2 · Find lists only the categories with someone in them — and Build N/M counts the same rows', () => {
  assert.match(BENCH, /pinnedTile: replan \? \(openTile \?\? initialOpenTile\) : initialOpenTile,/, 'a category opened from search does not show while open');
  assert.match(BENCH, /listedOnly: replan,/, 'Find lists empty categories again');
  assert.match(PAGE, /pinnedTile: sp\.open \?\? null,\s*starterTiles: \[[^\]]*\],\s*listedOnly: true,\s*\}\);\s*liveTallyBase\.ring/, 'Build N/M counts rows Find does not list');
});

test('3 · an opened category reads Booked → Asked → Liked ideas → Suggested for you → Ideas', () => {
  const at = (s: string) => {
    const i = BENCH.indexOf(s);
    assert.ok(i > -1, `missing: ${s}`);
    return i;
  };
  const order = [
    'data-find-planning=""',
    'data-find-part="booked"',
    'data-find-part="asked"',
    '<FindLikedIdeas',
    'data-find-done-search=""',
    'onSeeAll={searchHere}',
    'more={FIND_INSPIRATION_WORDS.moreIdeas}',
  ].map(at);
  assert.deepEqual([...order].sort((a, b) => a - b), order, 'the opened category is out of the approved order');
  assert.match(BENCH, /<MoreToCompare\s+suggest\s/, 'the category’s list is not "Suggested for you"');
  assert.match(BENCH, /\{replan && tileOpen && \(rowBooked \|\| coveredGroup\) \? \(\s*<button/, 'a booked category does not fold to "Done · Search again"');
});

test('4 · three suggestions and ONE "Search all"; four idea tiles and "More ideas"', () => {
  assert.match(BENCH, /const SUGGESTED_CARDS = 3;/);
  assert.match(BENCH, /pageOfClusters\(clusters, suggest \? SUGGESTED_CARDS : morePage\)/);
  assert.match(BENCH, /return `Search all \$\{label\} \(\$\{total\}\) ›`;/);
  assert.match(BENCH, /\{left > 0 && !suggest \? \(/, 'Suggested grew a "Show more"');
  assert.match(BENCH, /max=\{4\}/);
  assert.match(INSP, /\(board\.byTile\[tile\] \?\? \[\]\)\.slice\(0, max \?\? Infinity\)/);
});

test('5 · a liked photo links to its card; its Ask is the card’s own words, and only a press asks', () => {
  const part: InspirationPart = {
    slotKey: 'table',
    label: 'Table setting',
    kind: 'part',
    homeCategoryId: 'catering',
    alsoCategoryIds: [],
    services: null,
    hidden: false,
    sortOrder: 0,
  };
  const board = buildFindInspiration(
    [part],
    [
      { slotKey: 'table', imageUrl: 'a.jpg', fromSupplier: true, vendorProfileId: 'p1', vendorServiceId: 's1' },
      { slotKey: 'table', imageUrl: 'b.jpg', fromSupplier: true, vendorProfileId: 'p2', vendorServiceId: null },
      { slotKey: 'table', imageUrl: 'c.jpg', fromSupplier: false, vendorProfileId: null },
    ],
    new Set(['p1']),
    { shops: new Map([['p1', 'Kusina ni Lola'], ['p2', 'Hizon’s Catering']]), cards: new Map([['s1', 'Full buffet']]) },
  );
  assert.equal(board.read, 'ok');
  if (board.read !== 'ok') return;
  const liked = board.liked.catering ?? [];
  assert.equal(liked.length, 3);
  assert.equal(likedFromLine(liked[0]!), 'From Kusina ni Lola · Full buffet');
  assert.equal(liked[0]!.onList, true);
  assert.equal(likedFromLine(liked[1]!), 'From Hizon’s Catering', 'a photo with no card names its shop alone');
  assert.equal(liked[1]!.onList, false);
  assert.equal(likedFromLine(liked[2]!), null, 'a community photo names a shop');
  // A shop whose name could not be read is never named — the photo falls back to "Find who does this".
  const unread = buildFindInspiration([part], [{ slotKey: 'table', imageUrl: 'a.jpg', fromSupplier: true, vendorProfileId: 'p1', vendorServiceId: 's1' }], new Set(), null);
  if (unread.read === 'ok') assert.equal(likedFromLine(unread.liked.catering![0]!), null);
  // The words and control are the card's: cardVerbWords('ask') on an ActionButton.
  assert.match(INSP, /const ask = cardVerbWords\('ask'\);[\s\S]*?<ActionButton[\s\S]*?label=\{ask\.label\}[\s\S]*?onClick=\{\(\) => onAsk\(p\)\}/);
  // Never automatic: askLiked runs from the press, and from nothing else.
  assert.equal((BENCH.match(/askLiked\(/g) ?? []).length, 1, 'askLiked is called from somewhere other than the press');
  assert.match(BENCH, /onAsk=\{\(p\) => void askLiked\(p, t\.tile\)\}/);
});

test('6 · a brand-new event says so, with the way in', () => {
  assert.match(BENCH, /\{replan && !searching && benchRows\.length === 0 \? \(\s*<div className="slempty" data-find-empty="">/);
  assert.match(BENCH, /No suppliers yet\./);
  assert.match(BENCH, /A category shows here once you ask or book\s+someone in it\./);
});
