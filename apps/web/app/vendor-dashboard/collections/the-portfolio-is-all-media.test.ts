/**
 * 🔒 THE PORTFOLIO IS ALL MEDIA (THE ONE BUILD, lane C4 — A3 §5 guard 6 + spec §10 #24).
 *   1 · Its rows are the shipped collections (`collectionRows`) — never rows named after clients; the filter is
 *       COLLECTION_FILTERS; no "Search portfolio".
 *   2 · An album OPENS IN PLACE: 3 columns, first 9, the last tile "+N"; the ✓ circle is the separate pick for Show.
 *   3 · Show is greyed until an album is picked, and draws no price, edit or delete control.
 *   4 · The portfolio and logo uploaders compress in the browser; the ⚙ shows no storage price.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripComments } from '@/lib/strip-comments';

const HERE = dirname(fileURLToPath(import.meta.url));
const read = (rel: string) => stripComments(readFileSync(join(HERE, rel), 'utf8'));
const VIEW = read('_components/portfolio-view.tsx');
const LIST = read('_components/collections-list.tsx');
const SHOW = read('_components/portfolio-show.tsx');
const SETTINGS = read('_components/portfolio-settings.tsx');
const DATA = read('collections-data.ts');

test('1 · the shipped collections, the shipped filter, no search', () => {
  assert.match(LIST, /const rows = collectionRows\(/);
  assert.match(LIST, /COLLECTION_FILTERS\.map/);
  assert.doesNotMatch(VIEW + LIST, /Search portfolio/);
  assert.match(VIEW, /<CollectionsList\b/);
});

test('2 · an album opens in place — 3 columns, first 9, "+N"; ✓ is its own control', () => {
  assert.match(DATA, /export const ALBUM_PREVIEW = 9;/);
  assert.match(LIST, /grid grid-cols-3/);
  assert.match(LIST, /\+\{\(preview\.total - shown\.length\)/);
  assert.match(LIST, /aria-expanded=\{open\}/);
  assert.match(LIST, /data-collection-pick=\{r\.key\}/, 'the pick for Show is not its own control');
});

test('3 · Show is greyed until a pick, and draws nothing but the photos', () => {
  assert.match(VIEW, /disabled=\{!canShow\}/);
  assert.doesNotMatch(SHOW, />[^<{]*(₱|price|Edit|Delete|Remove|caption)[^<]*</i, 'Show draws a price, an edit or a caption');
  assert.doesNotMatch(SHOW, /<(form|input|ActionButton)\b|formatPhp|priceText/, 'Show carries a control or a price');
});

test('4 · uploads compress; the ⚙ types no storage price', () => {
  assert.match(read('../shop/_components/gallery-media.tsx'), /\n\s*compressImage\n/);
  assert.match(read('../shop/_components/editable-row.tsx'), /\n\s*compressImage\n/);
  assert.match(SETTINGS, /Not on sale yet/);
  assert.doesNotMatch(SETTINGS, /₱\s?\d|\b\d+\s?GB\b/, 'a storage price or size is typed into the ⚙');
});
