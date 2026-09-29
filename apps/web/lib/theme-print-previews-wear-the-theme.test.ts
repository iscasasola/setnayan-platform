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
import { isPreviewVersion, previewCacheControl, PREVIEW_IMMUTABLE, samplePreviewCacheControl } from './print-preview-cache';
import { stripComments } from './strip-comments';
import { renderSettled } from './render-settled.test-helper';

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

// ═══ The sample door — the gallery's prints, the same for every couple ═══
test('4 · the sample door can only ever draw the pinned sample, on screen, and is shared', () => {
  const route = stripComments(readFileSync(join(__dirname, '..', 'app', 'api', 'hub-print', '[piece]', 'route.ts'), 'utf8'));
  const mod = stripComments(readFileSync(join(__dirname, 'print-sample-door.server.ts'), 'utf8'));
  const start = mod.indexOf('export async function sampleView(');
  assert.ok(start > 0, 'the sample door moved — re-anchor this guard');
  const door = mod.slice(start);
  const end = route.indexOf('export async function GET(');
  // The event comes ONLY from the tour's pinned read — never from the request.
  assert.match(door, /const sampleId = await findSampleEventId\(\);/);
  assert.doesNotMatch(door, /searchParams\.get\('event'\)/, 'the sample door reads an event from the request');
  assert.match(door, /loadPrintSet\(sampleId, /);
  assert.equal([...door.matchAll(/loadPrintSet\(/g)].length, 1);
  // On-screen pictures of three pieces only — never a PDF, passes or the set.
  assert.match(mod, /export const SAMPLE_PIECES = \['invitation', 'details', 'pass'\] as const;/);
  assert.doesNotMatch(mod, /print-render-pdf|renderPrintPdf|renderImposedPdf|loadGuestPasses/, 'the sample door can make a file');
  assert.match(door, /url\.searchParams\.get\('mode'\) !== 'screen'/);
  assert.match(door, /samplePreviewCacheControl\(url\.searchParams\.get\('v'\)\)/);
  // It is asked before the host gate, and only by `sample=1`.
  const get = route.slice(end);
  assert.ok(
    get.indexOf("if (url.searchParams.get('sample') === '1') return sampleView(rawPiece, url);") < get.indexOf('await gate('),
    'the sample door sits behind the host gate, or is asked another way',
  );
  // The pinned read is still pinned.
  const sample = stripComments(readFileSync(join(__dirname, '..', 'app', 'tour', '_lib', 'sample-event.ts'), 'utf8'));
  assert.match(sample, /\.eq\('is_sample', true\)\s*\.eq\('slug', SAMPLE_SLUG\)/);
  assert.match(sample, /data\.is_sample !== true \|\| data\.slug !== SAMPLE_SLUG\) return null;/);
});

test('5 · a sample picture is public (one render for every couple); a couple’s stays private', () => {
  assert.equal(samplePreviewCacheControl(V), 'public, max-age=31536000, immutable');
  assert.match(samplePreviewCacheControl(null), /^public, max-age=300/);
  assert.match(previewCacheControl(V), /^private/);
});

/* ⚡ The print pieces load lazily (`launch/_components/details-lazy.tsx`).
   `renderSettled` waits on the loads themselves, never a clock — see
   `render-settled.test-helper.ts` for the CI failure that retired the old
   500ms retry loop. */

test('6 · Details draws the couple’s own prints in the theme being edited — named in every address, drafted or not', async () => {
  const React = (await import('react')).default;
  (globalThis as unknown as { React: unknown }).React = React;
  const { PrintPieceBody, PrintSetBody } = await import('../app/dashboard/[eventId]/launch/_components/maker-prints');
  const { PRINT_FORMATS, PRINT_SET_KEYS } = await import('./print-pieces');
  const first = (f: string) => Object.values(PRINT_FORMATS).find((x) => x.for === f)!;
  const input = {
    eventId: 'E1',
    slug: 'ana-ben',
    theme: 'velvet' as const,
    ownsPro: false,
    storeShell: false,
    previewVersion: V,
    formats: { pass: first('pass'), invitation: first('invitation'), card: first('card') } as never,
  };
  const html = await renderSettled(
    React.createElement(
      React.Fragment,
      null,
      ...PRINT_SET_KEYS.map((k) => React.createElement(PrintPieceBody, { key: k, input, piece: k })),
      React.createElement(PrintSetBody, { key: 'set', input }),
    ),
  );
  const srcs = [...html.matchAll(/(?:src|data-print-preview-src)="(\/api\/hub-print\/[^"]+)"/g)].map((m) => m[1]!.replace(/&amp;/g, '&'));
  assert.ok(srcs.length >= PRINT_SET_KEYS.length * 2, `${srcs.length} print addresses`);
  for (const s of srcs) assert.match(s, /[?&]theme=velvet(&|$)/, `${s} does not ask for the theme being edited`);
});
