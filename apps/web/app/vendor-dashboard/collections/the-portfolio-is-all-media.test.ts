/**
 * 🔒 THE PORTFOLIO IS ALL MEDIA (THE ONE BUILD, lane C4 — A3 §5 guard 6 + spec §10 #24).
 *   1 · Its sections are the shipped collections (`collectionRows`) — never rows named after clients; no "Search
 *       portfolio". (Since the approved Portfolio, owner 9 Nov: the "Everything" filter is dropped and who-sees-it is
 *       in the ⚙ — `the-portfolio-is-collections.test.ts`.)
 *   2 · An album OPENS INTO THE BODY (the one panel) with the "+N" tile past what was loaded; the pick for Show is its
 *       own control — one dropdown in the ⚙, no longer a ✓ per row (approved (5)).
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
const GROUPS = read('_components/portfolio-groups.tsx');
const DATA = read('collections-data.ts');

test('1 · the shipped collections, no search', () => {
  assert.match(LIST, /Object\.fromEntries\(collectionRows\(input\)/, 'the sections are not the shipped collections');
  assert.doesNotMatch(VIEW + LIST, /Search portfolio/);
  assert.match(VIEW, /<CollectionsList\b/);
});

test('2 · an album opens into the body with its "+N"; the pick for Show is its own control (the ⚙ dropdown)', () => {
  assert.match(DATA, /export const ALBUM_PREVIEW = 9;/);
  assert.match(GROUPS, /grid grid-cols-3/);
  assert.match(GROUPS, /const more = photos \? photos\.total - photos\.urls\.length : 0;/);
  assert.match(GROUPS, /\+\{formatCount\(more\)\}/);
  assert.match(SETTINGS, /dataAttr="data-portfolio-show-pick"/, 'the pick for Show is not its own control');
});

test('3 · Show is greyed until a pick, and draws nothing but the photos', () => {
  assert.match(VIEW, /const canShow = Boolean\(album && album\.urls\.length > 0\);/);
  // Both Show doors are greyed until a pick: the pinned row's button, and the thumb row's ⇅ menu row "Show ▶" (Lane E
  // item 4 moved the ▶ inside the one dropdown) — it says "pick an album first" and does nothing until one is picked.
  assert.equal([...VIEW.matchAll(/disabled=\{!canShow\}/g)].length, 1, 'the pinned row’s Show is live before an album is picked');
  assert.match(VIEW, /if \(k === 'show'\) \{\s*if \(canShow\) setShowing\(true\);/, 'the thumb row’s Show ▶ opens before an album is picked');
  assert.match(VIEW, /'Show ▶ · pick an album first'/);
  assert.doesNotMatch(SHOW, />[^<{]*(₱|price|Edit|Delete|Remove|caption)[^<]*</i, 'Show draws a price, an edit or a caption');
  assert.doesNotMatch(SHOW, /<(form|input|ActionButton)\b|formatPhp|priceText/, 'Show carries a control or a price');
});

test('4 · uploads compress; the ⚙ types no storage price', () => {
  assert.match(read('../shop/_components/portfolio-form.tsx'), /\n\s*compressImage\n/);
  assert.match(read('../shop/_components/editable-row.tsx'), /\n\s*compressImage\n/);
  assert.match(SETTINGS, /Not on sale yet/);
  assert.doesNotMatch(SETTINGS, /₱\s?\d|\b\d+\s?GB\b/, 'a storage price or size is typed into the ⚙');
});
