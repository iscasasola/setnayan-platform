/**
 * every-print-shows-its-picture.test.ts — STUDIO › PRINTS: EVERY PRINT ROW SHOWS ITS REAL PICTURE, AND THE PICTURE IS THE ROUTE'S
 * (owner 2026-10-14, verbatim: *"i cannot see what the different prints look like"*; approved prototype
 * `prototypes/maker_prints_previews_2026-10-14_fable.html`, and on its open question: *the entrance seating chart is its own row*).
 *
 * THE CLAIMS, each read off what is DRAWN (the pieces rendered as Studio draws them) or the source that draws it:
 *   1. every print row of Studio › Prints — each piece of the invitation set, each print for the day, the entrance chart — carries a
 *      thumbnail (`data-print-thumb`), and a print without one goes red;
 *   2. a thumbnail's picture is the SAME route the row's Save downloads from (no second renderer) — the set pieces' is the very address
 *      their body draws (`PrintPieceBody`); and `print-paper.tsx` draws no print itself;
 *   3. the entrance seating chart is its OWN row — its own item, its own thumbnail and Save; the pack no longer carries it;
 *   4. the page-1 picture routes take `?page=N` and say their paper beside the picture (`x-print-paper`), from the layouts' own numbers;
 *   5. the thumbnails and the sheet ride the ONE lazy Studio door — never the Maker's first load;
 *   6. the paper header round-trips, and the box keeps the paper's shape.
 *
 * SABOTAGE (each seen RED, then restored — see the PR): a set piece's head without `paper` · a free print's head without `paper` · a
 * thumbnail pointed at another address · a print drawn inside print-paper.tsx · the chart's saves put back on the pack · a route's
 * preview drawing `docs[0]` again · print-paper imported statically by a first-load Maker file.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { renderSettled } from './render-settled.test-helper';
import { stripComments } from './strip-comments';
import { PRINT_SET_KEYS } from './print-pieces';
import { FREE_PRINT_KEYS } from './maker-details-items';
import { freePrints } from './free-prints';
import { parsePrintPaper, previewPage, printPaperHeader, printThumbSize, paperPageSrc, PRINT_PAPER_HEADER } from './print-paper';

(globalThis as unknown as { React: unknown }).React = React;
{
  const Mod = require('node:module');
  const load = Mod._load;
  Mod._load = function (request: string, ...rest: unknown[]) {
    if (request === 'server-only' || request === 'client-only') return {};
    return load.call(this, request, ...rest);
  };
}

const WEB = join(__dirname, '..');
const L = 'app/dashboard/[eventId]/launch/_components';
const read = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));
const EVENT = '11111111-2222-4333-8444-555555555555';
const unescape = (s: string) => s.replace(/&amp;/g, '&');
const pathOf = (href: string) => unescape(href).split('?')[0]!;

async function input(theme: string, ownsPro: boolean) {
  const { formatFor } = await import('./print-pieces');
  return { eventId: EVENT, slug: 'rosa-ben', theme, ownsPro, storeShell: false, previewVersion: '0123456789abcdef', formats: { pass: formatFor('pass', null)!, invitation: formatFor('invitation', null)!, card: formatFor('card', null)! } };
}

/** Every thumbnail drawn, by its row's item: its picture's address. */
const thumbsIn = (html: string) => Object.fromEntries([...html.matchAll(/data-print-thumb="([^"]+)" data-print-thumb-src="([^"]+)"/g)].map((m) => [m[1]!, unescape(m[2]!)]));
/** How many Saves are drawn (`PrintSaveButton` wraps each in `<span data-print-save>`). */
const savesDrawn = (html: string) => (html.match(/<span data-print-save=/g) ?? []).length;

test('1+2 · every piece of the invitation set has its picture in its head — the address its body draws, the route its Save downloads from', async () => {
  const { PrintPieceEditor, PrintPieceBody, printPlan } = await import(`../${L}/maker-prints`);
  for (const [theme, pro] of [['house', false], ['abaca', false], ['abaca', true]] as const) {
    const i = await input(theme, pro);
    for (const k of PRINT_SET_KEYS) {
      const html = await renderSettled(React.createElement(PrintPieceEditor as never, { input: i, piece: k, studio: true } as never));
      const thumbs = thumbsIn(html);
      assert.ok(thumbs[k], `${theme}/${pro}: ${k}'s head has no picture`);
      const body = await renderSettled(React.createElement(PrintPieceBody as never, { input: i, piece: k } as never));
      const bodySrc = unescape(body.match(/data-print-preview-src="([^"]+)"/)?.[1] ?? '');
      assert.equal(thumbs[k], bodySrc, `${theme}/${pro}: ${k}'s thumbnail is not the picture its body draws`);
      assert.equal(pathOf(thumbs[k]!), `/api/hub-print/${k}`, `${k}'s thumbnail is not its own route`);
      /* Its Saves (the menu and the story poster have none until they have something to print) download from that same route. */
      const plan = printPlan(i);
      if (savesDrawn(html) > 0) {
        for (const href of [plan.classic(k), plan.q(k, 'print'), plan.q(k, 'sample')]) assert.equal(pathOf(href), pathOf(thumbs[k]!), `${k}: a Save downloads from a different route than its picture`);
      } else assert.ok(k === 'menu' || k === 'story-poster', `${k}: no Save drawn`);
      /* The size ▾ stays in the head (the shipped Form row), the picture beside it. */
      assert.match(html, /data-print-paper-head="[^"]+"[\s\S]*?data-form-rows="print-(?:size|head)"/, `${k}: the picture is not beside the row`);
    }
  }
});

test('1+2+3 · every print for the day — and the entrance chart, its own row — has its picture; each is the route its Save uses', async () => {
  const { freePrintParts } = await import(`../${L}/maker-prints`);
  const parts = freePrintParts(EVENT, 'rosa-ben', undefined, true) as Array<{ key: string; editor: React.ReactNode }>;
  assert.deepEqual(parts.map((p) => p.key), [...FREE_PRINT_KEYS], 'the free group and the details items disagree');
  for (const p of parts) {
    const html = await renderSettled(React.createElement('div', null, p.editor));
    const thumbs = thumbsIn(html);
    assert.ok(thumbs[p.key], `${p.key}'s row has no picture`);
    assert.ok(savesDrawn(html) >= 1, `${p.key}: no Save drawn`);
    const fp = freePrints(EVENT, 'rosa-ben').find((x) => x.key === p.key)!;
    assert.equal(thumbs[p.key], unescape(fp.preview), `${p.key}: the thumbnail is not the print's own preview address`);
    for (const s of fp.saves) assert.equal(pathOf(s.href), pathOf(thumbs[p.key]!), `${p.key}: its picture comes from ${pathOf(thumbs[p.key]!)} but its Save from ${pathOf(s.href)}`);
  }
  /* 🪧 3 · the chart is its own row: its own item, its own picture, its own Save — and the pack no longer saves it. */
  const chart = parts.find((p) => p.key === 'seating-chart')!;
  const chartHtml = await renderSettled(React.createElement('div', null, chart.editor));
  assert.match(chartHtml, /data-studio-chart=""/, 'the chart is not its own row');
  assert.match(thumbsIn(chartHtml)['seating-chart']!, /\/seating\/print\?chart=table&format=preview$/);
  assert.match(chartHtml, /data-pill-selector="chart-layout"/, 'By table | A to Z is not the two-way pill');
  assert.match(chartHtml, /data-chart-size-picker=""/, 'the chart has no size ▾');
  const pack = parts.find((p) => p.key === 'seating-pack')!;
  const packHtml = await renderSettled(React.createElement('div', null, pack.editor));
  assert.doesNotMatch(packHtml, /chart=|Entrance chart/, 'the pack still saves (or draws) the entrance chart — two rows for one sheet');
  assert.ok(!freePrints(EVENT, 'rosa-ben').find((x) => x.key === 'seating-pack')!.saves.some((sv) => /chart=/.test(sv.href)), 'the pack still saves the entrance chart');
  assert.ok(freePrints(EVENT, 'x').every((fp) => fp.aspect > 0 && fp.paper), 'a free print has no paper shape');
});

test('2 · print-paper.tsx shows the routes’ pictures — it draws no print of its own and asks no data of its own', () => {
  const src = read(`${L}/print-paper.tsx`);
  assert.doesNotMatch(src, /from '@\/lib\/(?:print-layout|print-render-svg|print-render-pdf|print-report|print-seating-pack|print-entrance-chart|print-guest-registry|seat-plan-preview-svg|qr|print-set\.server)'/, 'print-paper imports a print renderer — a second drawing of a print');
  assert.doesNotMatch(src, /<svg\b|<path\b|<rect\b|<text\b|createElementNS/, 'print-paper draws a picture itself');
  assert.doesNotMatch(src, /supabase|createClient|'use server'/, 'print-paper reads data of its own');
  /* The picture is fetched from the address it was handed, and only that address (page N is the same address with `page=`). */
  assert.match(src, /fetch\(src, \{ credentials: 'same-origin'/);
  assert.equal((src.match(/\bfetch\(/g) ?? []).length, 1, 'more than one fetch — a second way to a picture');
  assert.match(src, /paperPageSrc\(paper\.src, page\)/, 'page N is not the same route');
});

test('4 · the page-1 picture routes draw page N and say their paper beside the picture', () => {
  const routes: Array<[string, RegExp]> = [
    ['app/api/hub-print/[piece]/route.ts', /renderPrintSvg\(docs\[page - 1\]!, images\)/],
    ['app/dashboard/[eventId]/seating/print/route.ts', /renderPrintSvg\(docs\[page - 1\]!, \{\}\)/],
    ['app/dashboard/[eventId]/seating/caterer/route.ts', /renderPrintSvg\(docs\[page - 1\]!, \{\}\)/],
  ];
  for (const [file, draws] of routes) {
    const src = read(file);
    assert.match(src, /previewPage\((?:url\.searchParams|params|new URL\(req\.url\)\.searchParams), docs\.length\)/, `${file} does not read ?page=N`);
    assert.match(src, draws, `${file} still draws page 1 whatever was asked`);
    assert.match(src, /printPaperHeader\(/, `${file} says nothing about its paper`);
  }
  const chart = read('app/dashboard/[eventId]/seating/print/route.ts');
  assert.match(chart, /fits: result\.ok,\s*suggest: result\.ok \? null : result\.suggest,\s*tooFull: result\.ok \? null : entranceChartTooBigWords\(/, 'the chart does not say whether its names fit — in its own words');
  assert.match(read('app/dashboard/[eventId]/seating/export/route.ts'), /printPaperHeader\(/);
  /* The set pieces: one picture shows every side, so the pages to flip stay 1 — the sides are said, never flipped to a page that does not exist. */
  assert.match(read('app/api/hub-print/[piece]/route.ts'), /printPaperHeader\(\{ pages: 1, page: 1, sides: Math\.max\(1, sides\) \}\)/);
});

test('5 · the pictures and the sheet ride the ONE lazy Studio door — not one byte in the Maker’s first load', () => {
  for (const f of ['maker-prints.tsx', 'maker-details.tsx', 'details-lazy.tsx', 'maker-shell.tsx', 'details-workspace.tsx', 'soft-post.tsx', 'maker-page.tsx']) {
    const src = read(`${L}/${f}`).replace(/^import type [^;]*;$/gm, '');
    assert.doesNotMatch(src, /from '\.\/print-paper'/, `${f} imports print-paper statically`);
  }
  assert.match(read(`${L}/studio-tools.tsx`), /from '\.\/print-paper'/, 'the Studio door does not carry the pictures');
  assert.match(read(`${L}/maker-prints.tsx`), /<StudioTool\s+part="print-head"[\s\S]{0,200}paper=\{paper\}/, 'a set piece’s head is drawn without its picture');
});

test('6 · the paper header round-trips (encoded — a “·” never meets a header), a page is clamped, the box keeps the paper’s shape', () => {
  const h = printPaperHeader({ pages: 3, page: 2, how: '84 guests on 3 A4 pages — the reception desk list, A to Z', empty: null, fits: false, suggest: 'a2', tooFull: ['84 names don’t fit on A3 at a size guests can read.'] });
  assert.match(h[PRINT_PAPER_HEADER]!, /^[\x21-\x7e]+$/, 'the header is not plain ASCII');
  assert.deepEqual(parsePrintPaper(h[PRINT_PAPER_HEADER]), { pages: 3, page: 2, how: '84 guests on 3 A4 pages — the reception desk list, A to Z', empty: null, fits: false, suggest: 'a2', tooFull: ['84 names don’t fit on A3 at a size guests can read.'] });
  assert.equal(parsePrintPaper(null), null);
  assert.equal(parsePrintPaper('%7Bbroken'), null);
  assert.deepEqual(parsePrintPaper(encodeURIComponent(JSON.stringify({ pages: 2, page: 9 })))?.page, 2, 'a page past the last is not clamped');
  const p = (q: string) => new URLSearchParams(q);
  assert.equal(previewPage(p(''), 4), 1);
  assert.equal(previewPage(p('page=3'), 4), 3);
  assert.equal(previewPage(p('page=99'), 4), 4);
  assert.equal(previewPage(p('page=-2'), 4), 1);
  assert.equal(previewPage(p('page=abc'), 4), 1);
  assert.equal(paperPageSrc('/x?a=1', 1), '/x?a=1');
  assert.equal(paperPageSrc('/x?a=1', 3), '/x?a=1&page=3');
  assert.deepEqual(printThumbSize(210 / 297), { w: 51, h: 72 }, 'an A4 page is not upright in its box');
  assert.deepEqual(printThumbSize(420 / 297), { w: 72, h: 51 }, 'an A3 landscape plan is not wide in its box');
  assert.deepEqual(printThumbSize(null), { w: 72, h: 72 });
});
