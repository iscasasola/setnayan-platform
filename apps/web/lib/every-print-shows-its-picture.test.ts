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
 * 🎠 SINCE 2026-10-26 THE PICTURE IS THE SLIDE (owner: *"So we can make like a swipe carousel type where they can see the preview
 * larger"*; DECISION_LOG "APPROVED — PRINTS IS A SWIPE CAROUSEL"): the row's thumbnail and its tap-to-enlarge sheet are gone — each
 * print registers its slide (`prints-view-store.ts`) and the carousel draws its picture large (`studio-prints-carousel.tsx`). The
 * claims above are read off the SLIDES now: every print has its picture, the route its Download uses, at its paper's shape.
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
import { carouselAt, endSlides, slidesOf } from './prints-slides.test-helper';
import { stripComments } from './strip-comments';
import { PRINT_SET_KEYS } from './print-pieces';
import { FREE_PRINT_KEYS } from './maker-details-items';
import { freePrints } from './free-prints';
import { parsePrintPaper, previewPage, printPaperHeader, paperPageSrc, PRINT_PAPER_HEADER } from './print-paper';

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
  /* 🎟 Who View as ▾ lists (2026-10-17) — a guest print's free Download is that guest's file. */
  const passGuests = [{ id: '00000000-0000-4000-8000-000000000101', name: 'Ana Reyes', reply: 'attending' as const }];
  return { eventId: EVENT, slug: 'rosa-ben', theme, ownsPro, storeShell: false, previewVersion: '0123456789abcdef', passGuests, formats: { pass: formatFor('pass', null)!, invitation: formatFor('invitation', null)!, card: formatFor('card', null)! } };
}

test('1+2 · every piece of the invitation set has its picture on its slide — the address its body draws, the route its Download saves from', async () => {
  const { PrintPieceEditor, PrintPieceBody, printPlan } = await import(`../${L}/maker-prints`);
  for (const [theme, pro] of [['house', false], ['abaca', false], ['abaca', true]] as const) {
    const i = await input(theme, pro);
    try {
      const slides = await slidesOf(PRINT_SET_KEYS.map((k) => React.createElement(PrintPieceEditor as never, { input: i, piece: k, studio: true } as never)));
      for (const k of PRINT_SET_KEYS) {
        const s = slides.get(k);
        const src = s?.paper?.src;
        assert.ok(src, `${theme}/${pro}: ${k}'s slide has no picture`);
        const body = await renderSettled(React.createElement(PrintPieceBody as never, { input: i, piece: k } as never));
        const bodySrc = unescape(body.match(/data-print-preview-src="([^"]+)"/)?.[1] ?? '');
        /* 🎟 The Event pass's picture is the guest View as ▾ picked (2026-10-17) — the body's own address with that guest added. */
        assert.equal(k === 'pass' ? src!.replace(/&pass_guest=[^&]+$/, '') : src, bodySrc, `${theme}/${pro}: ${k}'s slide is not the picture its body draws`);
        assert.equal(pathOf(src!), `/api/hub-print/${k}`, `${k}'s slide is not its own route`);
        /* Its Download (the menu and the story poster have none until they have something to print) saves from that same route. */
        const plan = printPlan(i);
        const file = k === 'pass' ? s!.guest?.one : s!.download;
        if (file) {
          assert.equal(pathOf(file.href), pathOf(src!), `${k}: its Download saves from a different route than its picture`);
          for (const href of [plan.classic(k), plan.q(k, 'print'), plan.q(k, 'sample')]) assert.equal(pathOf(href), pathOf(src!), `${k}: a file of its route is not its picture’s route`);
        } else assert.ok(k === 'menu' || k === 'story-poster', `${k}: no Download`);
        /* The paper's shape: the slide draws the picture at the piece's own proportions. */
        assert.ok((s!.paper!.aspect ?? 0) > 0, `${k}: the slide has no paper shape`);
      }
      const html = await carouselAt(PRINT_SET_KEYS.map((k) => ({ key: k, label: k, group: 'set' as const })), 'pass');
      assert.match(html, /data-prints-paper="pass"[^>]*style="aspect-ratio:1\.6+7/, 'the Event pass is not drawn at its calling-card shape');
    } finally {
      await endSlides();
    }
  }
});

test('1+2+3 · every print for the day — and the entrance chart, its own slide — has its picture; each is the route its Download uses', async () => {
  const { freePrintParts } = await import(`../${L}/maker-prints`);
  const parts = freePrintParts(EVENT, 'rosa-ben', await input('house', false), true) as Array<{ key: string; editor: React.ReactNode }>;
  assert.deepEqual(parts.map((p) => p.key), [...FREE_PRINT_KEYS], 'the free group and the details items disagree');
  try {
    const slides = await slidesOf(parts.map((p) => p.editor));
    const { chartAddresses } = await import(`../${L}/print-paper`);
    for (const p of parts) {
      const s = slides.get(p.key);
      assert.ok(s, `${p.key} has no slide`);
      const fp = freePrints(EVENT, 'rosa-ben', { version: '0123456789abcdef' }).find((x) => x.key === p.key)!;
      if (p.key === 'seating-chart') {
        /* 🪧 3 · the chart is its own slide: its own pick, its own picture, its own Download. */
        assert.ok(s!.chart, 'the chart is not its own slide');
        const at = (chartAddresses as (r: string, p: unknown, d: string) => { preview: string; pdf: string })(s!.chart!.route, { layout: 'table', size: s!.chart!.defaultSize }, s!.chart!.defaultSize);
        assert.match(at.preview, /\/seating\/print\?chart=table&format=preview$/);
        assert.equal(pathOf(at.pdf), pathOf(at.preview), 'the chart’s Download and its picture are different routes');
        continue;
      }
      assert.equal(s!.paper?.src, unescape(fp.preview), `${p.key}: the slide is not the print's own preview address`);
      const files = [s!.download, s!.guest?.one, ...(s!.choice?.options ?? [])].filter(Boolean) as Array<{ href: string }>;
      assert.ok(files.length >= 1, `${p.key}: no Download`);
      for (const sv of fp.saves) assert.equal(pathOf(sv.href), pathOf(s!.paper!.src), `${p.key}: its picture comes from ${pathOf(s!.paper!.src)} but a Download from ${pathOf(sv.href)}`);
    }
    /* The chart's size ▾ and Chart ▾ are on its slide (prototype: "Chart ▾ (By table · A to Z) · A2 ▾"); the pack never carries it. */
    const html = await carouselAt(parts.map((p) => ({ key: p.key, label: p.key, group: 'day' as const })), 'seating-chart');
    const tools = html.slice(html.indexOf('data-prints-tools="phone"'), html.indexOf('data-prints-tools="desk"'));
    assert.match(tools, /data-chart-size-picker=""/, 'the chart has no size ▾');
    assert.match(tools, /data-chart-layout-picker=""/, 'the chart has no Chart ▾ (By table · A to Z)');
    assert.doesNotMatch(JSON.stringify(slides.get('seating-pack')), /chart=|Entrance chart/, 'the pack still saves (or draws) the entrance chart — two places for one sheet');
  } finally {
    await endSlides();
  }
  assert.ok(!freePrints(EVENT, 'rosa-ben').find((x) => x.key === 'seating-pack')!.saves.some((sv) => /chart=/.test(sv.href)), 'the pack still saves the entrance chart');
  assert.ok(freePrints(EVENT, 'x').every((fp) => fp.aspect > 0 && fp.paper), 'a free print has no paper shape');
});

test('2 · print-paper.tsx and the carousel show the routes’ pictures — neither draws a print of its own nor asks data of its own', () => {
  for (const f of ['print-paper.tsx', 'studio-prints-carousel.tsx']) {
    const src = read(`${L}/${f}`);
    assert.doesNotMatch(src, /from '@\/lib\/(?:print-layout|print-render-svg|print-render-pdf|print-report|print-seating-pack|print-entrance-chart|print-guest-registry|seat-plan-preview-svg|qr|print-set\.server)'/, `${f} imports a print renderer — a second drawing of a print`);
    assert.doesNotMatch(src, /<svg\b|<path\b|<rect\b|<text\b|createElementNS/, `${f} draws a picture itself`);
    assert.doesNotMatch(src, /supabase|createClient|'use server'/, `${f} reads data of its own`);
  }
  const src = read(`${L}/print-paper.tsx`);
  /* The picture is fetched from the address it was handed, and only that address (page N is the same address with `page=`). */
  assert.match(src, /fetch\(src, \{ credentials: 'same-origin'/);
  assert.equal((src.match(/\bfetch\(/g) ?? []).length, 1, 'more than one fetch — a second way to a picture');
  const carousel = read(`${L}/studio-prints-carousel.tsx`);
  assert.equal((carousel.match(/\bfetch\(/g) ?? []).length, 0, 'the carousel fetches a picture of its own');
  assert.match(carousel, /paperPageSrc\(src, page\)/, 'page N is not the same route');
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

test('5 · the pictures and the carousel ride the ONE lazy Studio door — not one byte in the Maker’s first load', () => {
  for (const f of ['maker-prints.tsx', 'maker-details.tsx', 'details-lazy.tsx', 'maker-shell.tsx', 'details-workspace.tsx', 'soft-post.tsx', 'maker-page.tsx']) {
    const src = read(`${L}/${f}`).replace(/^import type [^;]*;$/gm, '');
    assert.doesNotMatch(src, /from '\.\/(?:print-paper|studio-prints-carousel)'/, `${f} imports the pictures statically`);
  }
  assert.match(read(`${L}/studio-tools.tsx`), /from '\.\/print-paper'/, 'the Studio door does not carry the pictures');
  assert.match(read(`${L}/studio-tools.tsx`), /from '\.\/studio-prints-carousel'/, 'the Studio door does not carry the carousel');
  assert.match(read(`${L}/maker-prints.tsx`), /<StudioTool\s+part="print-head"[\s\S]{0,200}paper=\{paper\}/, 'a set piece’s head is drawn without its picture');
});

test('6 · the paper header round-trips (encoded — a “·” never meets a header), a page is clamped', () => {
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
});
