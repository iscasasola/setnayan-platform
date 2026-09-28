/**
 * theme-print-previews-wear-the-theme.test.ts — owner 2026-09-28, verbatim,
 * pointing at the Maker's Details page: *"can you place the themes here? and a
 * quick preview of what the page, prints looks like?"*
 *
 * Each theme on Details previews the couple's prints IN THAT THEME. The prints
 * are drawn by the one print route (`/api/hub-print/<piece>`), which picks the
 * theme with `printThemeFor(event, url.searchParams.get('theme'))`. So:
 *
 *   1 · every print preview NAMES its theme — even the couple's own, because a
 *       drafted pick is not the live column the route would otherwise read;
 *   2 · the cache key is the print inputs' hash (`v`), so each theme's picture
 *       is its own address and is answered `immutable` — never a per-render
 *       stamp, which caches nothing;
 *   3 · the route still reads the param by that name (the other half of 1).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { THEME_PRINT_PIECES, themePrintSrc } from './maker-theme-tiles';
import { isPreviewVersion, previewCacheControl, PREVIEW_IMMUTABLE } from './print-preview-cache';
import { stripComments } from './strip-comments';

const V = '0123456789abcdef';

test('1 · a print preview requests the theme it previews — every theme, every piece', () => {
  for (const piece of THEME_PRINT_PIECES) {
    for (const theme of ['house', 'vintage', 'abaca']) {
      const src = themePrintSrc('e-1', piece, theme, V);
      const u = new URL(src, 'https://x.test');
      assert.equal(u.pathname, `/api/hub-print/${piece}`);
      assert.equal(u.searchParams.get('theme'), theme, `${piece} in ${theme} asked for another theme`);
      assert.equal(u.searchParams.get('mode'), 'screen');
      assert.equal(u.searchParams.get('event'), 'e-1');
    }
  }
  assert.deepEqual([...THEME_PRINT_PIECES], ['invitation', 'details']);
});

test('2 · each theme is its own cached address, answered immutable', () => {
  const a = themePrintSrc('e-1', 'invitation', 'house', V);
  const b = themePrintSrc('e-1', 'invitation', 'vintage', V);
  assert.notEqual(a, b, 'two themes share one cached picture');
  const v = new URL(a, 'https://x.test').searchParams.get('v');
  assert.ok(isPreviewVersion(v));
  assert.equal(previewCacheControl(v), PREVIEW_IMMUTABLE);
  // No hash (the read failed): no `v` at all — the route's 60 s, never a stamp.
  assert.equal(new URL(themePrintSrc('e-1', 'details', 'house', null), 'https://x.test').searchParams.has('v'), false);
});

test('3 · the print route still takes the theme from `theme=`', () => {
  const route = stripComments(readFileSync(join(__dirname, '..', 'app', 'api', 'hub-print', '[piece]', 'route.ts'), 'utf8'));
  assert.match(route, /printThemeFor\(printEvent, url\.searchParams\.get\('theme'\)\)/);
});
