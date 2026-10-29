/**
 * GUARD — Shop is the five sections of the approved supplier dashboard v13, each on ONE pinned row with its figures.
 *
 * Owner 2026-10-29 *"Approved."* (prototype `carry-2026-10-29/supplier-dashboard-proto/index.html`, Shop ▾): Details ·
 * Services · Page · Gallery · Analytics, one dropdown (any set of choices is ONE dropdown), each section's three figures
 * on its pinned row (DECISION_LOG "EVERY SUPPLIER-DASHBOARD PAGE: THE TOP ROWS COMPRESS INTO ONE PINNED ROW ON SCROLL").
 *
 *   1. ONE SOURCE: the five, in the prototype's order and words, in `shop-sections.ts`; the bar's page menu from 701 lists
 *      exactly them (never a copy).
 *   2. The row is the dropdown, never pills; it folds with the shared `usePinFold`; only the ▾ steps aside from 701.
 *   3. Every Shop screen hands the row ITS section's figures — read by that page, never typed (Gallery's albums screen
 *      is a sub-screen and draws the row without figures).
 *   4. An unread figure draws "—" with "couldn't load", never 0.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripComments } from '@/lib/strip-comments';
import { SHOP_SEGMENT_HREF, SHOP_SEGMENT_LABEL, SHOP_SEGMENT_ORDER } from './_components/shop-sections';
import { supplierPageMenuOf } from '../_components/supplier-page-menu';

(globalThis as unknown as { React: unknown }).React = React;

const HERE = dirname(fileURLToPath(import.meta.url));
const VD = join(HERE, '..');
const read = (rel: string) => stripComments(readFileSync(join(VD, rel), 'utf8'));

test('1 · the five sections, in the approved order and words — and the bar menu lists exactly them', () => {
  assert.deepEqual(
    SHOP_SEGMENT_ORDER.map((s) => SHOP_SEGMENT_LABEL[s]),
    ['Details', 'Services', 'Page', 'Gallery', 'Analytics'],
  );
  for (const s of SHOP_SEGMENT_ORDER) {
    const m = supplierPageMenuOf(SHOP_SEGMENT_HREF[s], null);
    assert.equal(m?.tab, 'Shop', `${s} does not name Shop`);
    assert.equal(m?.section, SHOP_SEGMENT_LABEL[s], `${s}: the bar menu names "${m?.section}"`);
    assert.deepEqual(m?.sections?.map((x) => x.label), SHOP_SEGMENT_ORDER.map((x) => SHOP_SEGMENT_LABEL[x]));
  }
  assert.doesNotMatch(read('_components/supplier-page-menu.tsx'), /\['services',\s*'page'/, 'the bar menu holds its own copy of the list');
});

test('2 · the row is ONE dropdown on a pinned, folding row — never pills; only the ▾ steps aside from 701', () => {
  const src = read('shop/_components/shop-segments.tsx');
  assert.doesNotMatch(src, /PillLink|PillTrack/, 'the sections are pills again — any set of choices is one dropdown');
  assert.match(src, /<PickMenu\b/, 'the ▾ is not the house PickMenu');
  assert.match(src, /usePinFold\(pinRef\)/, 'the row does not fold on scroll');
  assert.match(src, /data-pin-fold=""/);
  assert.match(src, /data-first-row=""/);
  assert.match(src, /className="sticky top-0/, 'the row is not pinned');
  // `data-shop-segmented` (what supplier-frame.css hides from 701) sits on the ▾'s own span — the figures stay.
  const at = src.indexOf('data-shop-segmented=""');
  const span = src.slice(src.lastIndexOf('<span', at), src.indexOf('</span>', at));
  assert.match(span, /<PickMenu/, 'data-shop-segmented is not on the ▾ itself — from 701 it would hide the figures too');
  assert.doesNotMatch(span, /PinFigures/);
});

const SCREENS: Array<[seg: string, file: string, maker: RegExp]> = [
  ['details', 'profile/_components/details-screen.tsx', /figures=\{detailsFigures\(/],
  ['services', 'shop/page.tsx', /figures=\{servicesFigures\(/],
  ['page', 'website/page.tsx', /figures=\{pageFigures\(/],
  ['gallery', 'collections/page.tsx', /figures=\{galleryFigures\(/],
  ['insights', 'performance/page.tsx', /figures=\{pinFigures\}/],
];

test('3 · every Shop screen hands its row its own section and its own figures', () => {
  let n = 0;
  for (const [seg, file, maker] of SCREENS) {
    const src = read(file);
    const rows = [...src.matchAll(new RegExp(`<ShopSegments\\s+on="${seg}"[^>]*>`, 'g'))].map((m) => m[0]);
    assert.ok(rows.length >= 1, `${file} draws no <ShopSegments on="${seg}">`);
    assert.ok(rows.some((r) => maker.test(r)), `${file}: the row carries no ${seg} figures`);
    n += 1;
  }
  assert.equal(n, SHOP_SEGMENT_ORDER.length, 'a section has no screen in this check');
  assert.match(read('performance/page.tsx'), /const pinFigures = analyticsFigures\(/, 'Analytics figures are not the funnel’s own counts');
  // The albums screen is Gallery's sub-screen: it lights Gallery.
  assert.match(read('collections/albums/page.tsx'), /<ShopSegments\s+on="gallery"/);
});

test('4 · an unread figure draws "—" and says so — never 0', async () => {
  const { renderToStaticMarkup } = await import('react-dom/server');
  const { PinFigures } = await import('../_components/pin-figures');
  const html = renderToStaticMarkup(
    React.createElement(PinFigures, {
      name: 'shop',
      label: 'Shop · Gallery',
      figures: [
        { key: 'photos', value: '48', word: 'photos', href: '/vendor-dashboard/collections' },
        { key: 'credits', value: null, word: 'credits left', href: '/vendor-dashboard/collections' },
      ],
    }),
  );
  assert.equal([...html.matchAll(/data-pin-door=""/g)].length, 2, 'a figure is not a fold door');
  assert.equal([...html.matchAll(/<a\b/g)].length, 2, 'a figure is not a link');
  assert.match(html, /data-shop-figure="credits"[^]*?—[^]*?credits left · <\/span>couldn’t load/, 'the unread figure does not say so (and which figure it is)');
  assert.doesNotMatch(html.slice(html.indexOf('data-shop-figure="credits"')), /data-pin-n="">0</, 'the unread figure reads 0');
});
