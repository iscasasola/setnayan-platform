/**
 * ⚡ FAST PRINT PREVIEWS — owner 2026-09-28: the boarding-pass preview in
 * Prints & Tickets took ~8 s. Each block holds one property, executed:
 *
 *   1 · a preview address carries the INPUTS' version, and the route answers
 *       a versioned address `immutable` — an unversioned one keeps its 60 s;
 *   2 · the version moves when any input moves — a Set's contents included
 *       (a Set JSONs as `{}`) — and with the build, and never for key order;
 *   3 · a piece's address carries ITS OWN size only, so picking a pass size
 *       leaves every other piece's address — and its cached picture — alone;
 *   4 · the first piece asks eagerly and high, the rest lazily and low — all
 *       in the page's HTML, so a cached piece paints before hydration; each
 *       warms its other sizes;
 *   5 · the Maker's on-screen SVG is smaller and draws the same shapes; the
 *       sample raster, the free thumbnails and the PDF are untouched.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import * as React from 'react';
import { stripComments } from './strip-comments';
import { renderSettled } from './render-settled.test-helper';
import {
  PREVIEW_IMMUTABLE,
  PREVIEW_UNVERSIONED,
  isPreviewVersion,
  previewCacheControl,
  printPreviewVersion,
} from './print-preview-cache';
import { compactScreenPath, renderPrintSvg } from './print-render-svg';
import { printPreviewLoad } from './print-preview-view';
import { PRINT_FORMATS, formatsFor } from './print-pieces';

(globalThis as unknown as { React: unknown }).React = React;

const WEB = join(__dirname, '..');

test('1 · a versioned preview is immutable; an unversioned one keeps its 60 s', () => {
  const v = printPreviewVersion({ a: 1 }, 'build-1');
  assert.ok(isPreviewVersion(v), v);
  assert.equal(previewCacheControl(v), PREVIEW_IMMUTABLE);
  assert.match(PREVIEW_IMMUTABLE, /max-age=31536000/);
  assert.match(PREVIEW_IMMUTABLE, /immutable/);
  assert.match(PREVIEW_IMMUTABLE, /^private,/, 'a couple’s preview is theirs — never a shared cache');
  for (const bad of [null, undefined, '', 'abc', 'ZZZZZZZZZZZZZZZZ', `${v}0`]) {
    assert.equal(previewCacheControl(bad), PREVIEW_UNVERSIONED, String(bad));
  }
  assert.match(PREVIEW_UNVERSIONED, /max-age=60\b/);
  // The route asks the ONE decision for both screen answers (SVG and the sample JPEG).
  const route = stripComments(readFileSync(join(WEB, 'app/api/hub-print/[piece]/route.ts'), 'utf8'));
  assert.ok(
    (route.match(/previewCacheControl\(url\.searchParams\.get\('v'\)\)/g) ?? []).length >= 2,
    'both on-screen answers take their cache header from the version',
  );
});

test('2 · the version follows the inputs — every input, the build, and not the key order', () => {
  const base = { event: { display_name: 'Rosa & Ben', event_date: '2026-10-30' }, passedAway: new Set(['g1']), blocks: [{ label: 'Ceremony' }] };
  const v = printPreviewVersion(base, 'b1');
  assert.equal(printPreviewVersion({ blocks: [{ label: 'Ceremony' }], passedAway: new Set(['g1']), event: { event_date: '2026-10-30', display_name: 'Rosa & Ben' } }, 'b1'), v, 'key order is not an input');
  assert.notEqual(printPreviewVersion({ ...base, event: { ...base.event, display_name: 'Rosa & Benjamin' } }, 'b1'), v);
  assert.notEqual(printPreviewVersion({ ...base, blocks: [{ label: 'Mass' }] }, 'b1'), v);
  assert.notEqual(printPreviewVersion({ ...base, passedAway: new Set(['g1', 'g2']) }, 'b1'), v, 'a Set’s contents reach the hash');
  assert.notEqual(printPreviewVersion(base, 'b2'), v, 'a new build draws anew');
});

/* ⚡ The print pieces load lazily (`launch/_components/details-lazy.tsx`).
   `renderSettled` waits on the loads themselves, never a clock — see
   `render-settled.test-helper.ts` for the CI failure that retired the old
   500ms retry loop. */

async function paintPrints(previewVersion: string | null, pass = 'boarding'): Promise<string> {
  // Prints & Tickets folded into Details (2026-09-28): each piece is an item, its
  // picture drawn by `PrintPieceBody` — here all seven, the first one first.
  const { PrintPieceBody } = await import('../app/dashboard/[eventId]/launch/_components/maker-prints');
  const { PRINT_SET_KEYS } = await import('./print-pieces');
  const first = (f: string) => Object.values(PRINT_FORMATS).find((x) => x.for === f)!;
  const input = {
    eventId: 'E1',
    slug: 'rosa-ben',
    theme: 'vintage' as const,
    ownsPro: true,
    storeShell: false,
    previewVersion,
    formats: { pass: PRINT_FORMATS[pass as keyof typeof PRINT_FORMATS], invitation: first('invitation'), card: first('card') } as never,
  };
  return renderSettled(
    React.createElement(
      React.Fragment,
      null,
      PRINT_SET_KEYS.map((k, i) => React.createElement(PrintPieceBody, { key: k, input, piece: k, priority: i === 0 })),
    ),
  );
}

const previews = (html: string) =>
  [...html.matchAll(/data-print-piece="([a-z]+)"[\s\S]*?data-print-preview-src="([^"]+)"/g)].map((m) => ({
    piece: m[1]!,
    src: m[2]!.replace(/&amp;/g, '&'),
  }));

test('3 · each preview carries the version and ITS OWN size only', async () => {
  const v = printPreviewVersion({ x: 1 }, 'b');
  const boarding = previews(await paintPrints(v, 'boarding'));
  const train = previews(await paintPrints(v, 'train'));
  assert.equal(boarding.length, 7, JSON.stringify(boarding.map((p) => p.piece)));
  for (const p of boarding) assert.match(p.src, new RegExp(`[?&]v=${v}(&|$)`), `${p.piece} carries the version`);
  const pass = boarding.find((p) => p.piece === 'pass')!;
  assert.match(pass.src, /pass_format=boarding/);
  assert.doesNotMatch(pass.src, /invitation_format|card_format/);
  const inv = boarding.find((p) => p.piece === 'invitation')!;
  assert.doesNotMatch(inv.src, /pass_format/, 'the invitation’s address does not move with the pass size');
  // THE PROPERTY: picking another pass size changes the pass preview's address
  // and NO other — every other picture is served from the cache it is in.
  const changed = boarding.filter((p, i) => p.src !== train[i]!.src).map((p) => p.piece);
  assert.deepEqual(changed, ['pass']);
  // No version (the read failed) — the addresses still work, as before.
  for (const p of previews(await paintPrints(null))) assert.doesNotMatch(p.src, /[?&]v=/);
});

test('4 · the first preview asks eagerly and high; the rest lazily and low; each warms its other sizes', async () => {
  assert.deepEqual(printPreviewLoad(true), { loading: 'eager', fetchPriority: 'high' });
  assert.deepEqual(printPreviewLoad(false), { loading: 'lazy', fetchPriority: 'low' });
  const html = await paintPrints(printPreviewVersion({ x: 1 }, 'b'));
  assert.equal((html.match(/data-print-preview="first"/g) ?? []).length, 1, 'exactly one piece goes first');
  const imgs = [...html.matchAll(/<img[^>]*src="\/api\/hub-print\/[a-z]+\?[^"]*mode=screen[^"]*"[^>]*>/g)].map((m) => m[0]);
  // Every preview is an <img> in the HTML — none waits for a script to be asked for.
  assert.equal(imgs.length, 7, `${imgs.length} preview images in the HTML`);
  assert.equal(imgs.filter((t) => /fetchpriority="high"/i.test(t) && /loading="eager"/.test(t)).length, 1);
  assert.equal(imgs.filter((t) => /fetchpriority="low"/i.test(t) && /loading="lazy"/.test(t)).length, 6);
  // The pass warms its other sizes — and only its own family's.
  const pass = /data-print-piece="pass"[\s\S]*?data-print-prefetch="([^"]*)"/.exec(html)?.[1] ?? '';
  const warmed = pass.replace(/&amp;/g, '&').split(' ').filter(Boolean);
  assert.equal(warmed.length, formatsFor('pass').length - 1, pass);
  // A piece without its own size picker warms nothing (it would only add requests).
  const entourage = /data-print-piece="entourage"[\s\S]*?data-print-prefetch="([^"]*)"/.exec(html)?.[1];
  assert.equal(entourage, '', 'the entourage has no size picker of its own — nothing to warm');
  for (const u of warmed) {
    assert.match(u, /\/api\/hub-print\/pass\?/);
    assert.doesNotMatch(u, /pass_format=boarding/, 'not the size already on screen');
  }
});

test('5 · the screen SVG is smaller and draws the same shapes', () => {
  const d = 'M12.784 0H562.651Q575.43 0 575.43 12.78L575.43 12.78V219.66L20 20L20 20Z';
  const c = compactScreenPath(d);
  assert.equal(c, 'M12.8 0H562.7Q575.4 0 575.4 12.8V219.7L20 20Z');
  // A path it cannot read is left exactly as drawn.
  assert.equal(compactScreenPath('m1 1l2 2'), 'm1 1l2 2');
  // A stroked path keeps its every segment (a dot on a stroke is ink).
  const svg = renderPrintSvg(
    {
      piece: 'pass',
      w: 100,
      h: 50,
      diePath: 'M0 0H100V50H0Z',
      ops: [
        { t: 'path', d: 'M1.234 1L1.234 1L5 5Z', fill: '#000' },
        { t: 'path', d: 'M1.234 1L1.234 1', stroke: '#000' },
      ],
    } as never,
    {},
    { compact: true },
  );
  assert.match(svg, /<path d="M1\.2 1L5 5Z" fill="#000"\/>/);
  assert.match(svg, /<path d="M1\.234 1L1\.234 1" fill="none" stroke="#000"/);
  // Only the Maker's on-screen answer asks for it — the sample raster does not.
  const route = stripComments(readFileSync(join(WEB, 'app/api/hub-print/[piece]/route.ts'), 'utf8'));
  // (The view is laid out once and handed over: its tappable boxes ride beside it — `the-print-only-words-are-tappable.test.ts`.)
  assert.match(route, /const view = layoutPieceView\(piece as PrintSetKey, \{ \.\.\.input, format: formatParam\(piece\) \}\);\s*const svg = renderPrintSvg\(view, set\.images, \{ compact: true \}\)/);
  // The print file never passes through here.
  const pdf = readFileSync(join(WEB, 'lib/print-render-pdf.ts'), 'utf8');
  assert.doesNotMatch(pdf, /compactScreenPath|print-render-svg/);
});

test('6 · the version and the drawing read the SAME inputs — one reader, no side reads', () => {
  const src = stripComments(readFileSync(join(WEB, 'lib/print-set.server.ts'), 'utf8'));
  const body = (name: string) => {
    const at = src.indexOf(`export async function ${name}(`);
    assert.ok(at >= 0, `${name} is gone — re-anchor this guard`);
    const next = src.indexOf('\nexport ', at + 10);
    return src.slice(at, next < 0 ? undefined : next);
  };
  const draw = body('loadPrintSet');
  const version = body('printInputsVersion');
  assert.match(draw, /readPrintSetInputs\(admin, eventId, event\)/);
  assert.match(version, /readPrintSetInputs\(admin, eventId, event\)/);
  assert.match(version, /resolveEventQrLook\(/, 'the QR look is drawn on every piece — it is in the version');
  // A reader called by the drawing but not through `readPrintSetInputs` would
  // change the picture without changing its address.
  for (const reader of ['readBlocks', 'readEntourage', 'readGiftLines', 'readCatererMenu', 'readRsvpHosts', 'resolveStdFinalizedVenues', 'resolveEventOwnerSlug', '.from(']) {
    assert.ok(!draw.includes(reader), `loadPrintSet reads ${reader} on the side — route it through readPrintSetInputs`);
  }
  // …and the Maker hands the version to the panel, with the access folded in.
  const page = stripComments(readFileSync(join(WEB, 'app/dashboard/[eventId]/launch/page.tsx'), 'utf8'));
  // (Details' prints since the fold, 2026-09-28 — the same key, handed in as the prints' input.)
  assert.match(page, /previewVersion: printInputs \? printPreviewVersion\(\{ printInputs, ownsPro: printPro, storeShell \}\) : null,/);
});
