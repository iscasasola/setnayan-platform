/**
 * 🔎 WHEN THE SHORTLIST HAS NO MATCH (walk 13 Nov 2026) — "SetnaProd" (a marketplace shop) and "Mobile bar" (a
 * category not yet on the event) offered only "Add … as your own supplier", and the no-match line outlived the cleared
 * box. See `./bench-search-fallback.ts`.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { categoryHitsFor, shopHitTile, CATEGORY_HITS_MAX } from './bench-search-fallback';
import { stripComments } from '@/lib/strip-comments';

const HERE = import.meta.dirname;
const BENCH = stripComments(readFileSync(join(HERE, 'shortlist-categories.tsx'), 'utf8'));
const THUMB = stripComments(readFileSync(join(HERE, 'find-thumb-row.tsx'), 'utf8'));

test('a category name matches every typed word, in order, capped', () => {
  const rows = [{ label: 'Mobile Bar' }, { label: 'Photo Booth' }, { label: 'Coffee bar' }];
  assert.deepEqual(categoryHitsFor('mobile bar', rows).map((r) => r.label), ['Mobile Bar']);
  assert.deepEqual(categoryHitsFor('  BAR ', rows).map((r) => r.label), ['Mobile Bar', 'Coffee bar']);
  assert.deepEqual(categoryHitsFor('', rows), []);
  assert.equal(categoryHitsFor('a', Array.from({ length: 9 }, () => ({ label: 'a' }))).length, CATEGORY_HITS_MAX);
});

test('a shop hit opens its service already on the event, else one the page draws, else nothing', () => {
  assert.equal(shopHitTile(['photobooth', 'mobile_bar'], new Set(['mobile_bar']), new Set(['photobooth', 'mobile_bar'])), 'mobile_bar');
  assert.equal(shopHitTile(['mobile_bar'], new Set(), new Set(['mobile_bar'])), 'mobile_bar');
  assert.equal(shopHitTile(['nope'], new Set(), new Set(['mobile_bar'])), null);
  assert.equal(shopHitTile(null, new Set(), new Set()), null);
});

test('the bench offers categories and marketplace shops under the no-match line, and both stay on the page', () => {
  assert.match(BENCH, /const shortlistMissed = searching && !drawnHit;/, 'a hit that is not drawn counted as a hit');
  assert.match(BENCH, /categoryHitsFor\(q, poolRows\.map/);
  assert.match(BENCH, /void searchMarketplaceForBench\(eventId, q\)/);
  assert.match(BENCH, /onClick=\{\(\) => openCategoryHit\(h\.tile\)\}/);
  assert.match(BENCH, /onClick=\{\(\) => openShopHit\(tile, r\.name\)\}/);
  // A category hit is the "Add a category" picker's own add; a shop hit opens its row and searches it by name.
  assert.match(BENCH, /const openCategoryHit = [\s\S]*?addTileToPlan\(pool\.t\.tile, pool\.f\.folder, pool\.f\.slug\)/);
  assert.match(BENCH, /const openShopHit = [\s\S]*?goToCategory\(tile\);[\s\S]*?setBoxText\(name\);/);
  assert.match(BENCH, /preset=\{thumbPreset\}/);
});

test('the ✕ empties the list at once, so the no-match line goes with the words', () => {
  assert.match(THUMB, /onClear: \(\) => \{\s*said\.current = '';\s*setText\(''\);\s*onSearch\(''\);/);
});
