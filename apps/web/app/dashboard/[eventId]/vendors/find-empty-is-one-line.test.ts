import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from '@/lib/strip-comments';
import { findNoneListedWords, moreToCompareEmpty } from '@/lib/explore-info-copy';
import { FIND_NONE_LISTED, findEmptyWords } from '@/lib/supplier-find-empty';
import { routes } from '@/lib/routes';

/**
 * 🧹 FIND, A CATEGORY WITH NO SUPPLIERS (OLD-SMALL, MASTER-PLAN B18; owner R3, 27 Nov 2026: "we want this to be a
 * fixed app, not an app with guidelines on what should be here"). An empty category on Find said "nothing" three
 * times ("Nobody asked yet." · LIKED IDEAS "Nothing liked for X yet." · TO COMPARE "Nobody else to compare in X
 * yet."); the search sheet promised "we'll show them the moment they join Setnayan"; the category page said "Check
 * back soon"; a new event explained the page in a paragraph. Now every surface says ONE line, from ONE place
 * (`findNoneListedWords`), and its action is the screen's own: Find's ONE add is the thumb row's ＋ (owner 2026-10-13),
 * so the open category adds no second button; the category page has a single ActionButton into Find.
 */

const DIR = join(process.cwd(), 'app/dashboard/[eventId]/vendors');
const read = (rel: string) => stripComments(readFileSync(join(DIR, rel), 'utf8'));
const BENCH = read('_components/shortlist-categories.tsx');
const LIKED = read('_components/find-inspiration.tsx');
const SHEET = read('_components/category-search-overlay.tsx');
const PAGE = read('categories/page.tsx');

const BANNED = [/check back/i, /the moment they join/i, /A category shows here once/i, /Nobody asked yet/, /Nothing liked for/];

test('one line, from one place', () => {
  assert.equal(findNoneListedWords('Lights & Sounds'), 'No Lights & Sounds supplier on Setnayan yet.');
  assert.equal(moreToCompareEmpty('Florist', '', false), findNoneListedWords('Florist'));
  assert.equal(findEmptyWords('none_listed', null, 'Florist'), findNoneListedWords('Florist'));
  for (const re of BANNED) assert.doesNotMatch(FIND_NONE_LISTED, re);
});

test('no Find surface explains, promises or repeats itself', () => {
  for (const [name, src] of Object.entries({ BENCH, LIKED, SHEET, PAGE })) {
    for (const re of BANNED) assert.doesNotMatch(src, re, `${name} still says ${re}`);
  }
});

test('the open category: its list says the line, with no heading over nothing; nothing liked draws nothing', () => {
  assert.match(BENCH, /moreToCompareEmpty\(label, moreQ, hasOwn\)/);
  assert.match(BENCH, /\{noneListed \? null : \(\s*<div className="morehead">/);
  assert.match(BENCH, /t\.vendors\.length > 0 \? \(\s*<p className="planh" data-find-planning="">/);
  assert.match(LIKED, /if \(liked\.length === 0\) return null;/);
  assert.doesNotMatch(LIKED, /data-find-liked-empty/);
  // Find's ONE add stays the thumb row's ＋ — the empty category grows no button of its own.
  assert.doesNotMatch(BENCH, /data-find-none-listed[^>]*>[\s\S]{0,400}<ActionButton/);
});

test('the search sheet and the category page say the same line', () => {
  assert.match(SHEET, /findNoneListedWords\(label\)/);
  assert.match(PAGE, /findEmptyWords\(empty, res\.hiddenForDateScope, openTile\.label\)/);
});

test('the category page: one action, a real door into Find with this category open', () => {
  const block = PAGE.slice(PAGE.indexOf('data-find-empty={empty}'), PAGE.indexOf('<ul className="mt-2">'));
  assert.equal((block.match(/<ActionButton\b/g) ?? []).length, 1);
  assert.match(block, /href=\{routes\.dashboard\.vendors\.findCategory\(eventId, openTile\.tile\)\}/);
  assert.equal(
    routes.dashboard.vendors.findCategory('S89E-X', 'lights_sound'),
    '/dashboard/S89E-X/vendors?tab=shortlist&open=lights_sound',
  );
});
