/**
 * 🔒 ONE HEADER FOR TODAY, SHOP AND PORTFOLIO (Build 3 Lane E item 10, owner 9 Nov: *"Today shop and portfolio initial
 * header should have the same height"*).
 *   1 · All three tabs mount the SAME part (`SupplierHero`) — never a second drawing of a head.
 *   2 · ONE height (208 px), 16 px gutters, the scrim, the placeholder caption "Sample photo · Upload yours".
 *   3 · Portfolio has ONE add door (item 3): the hero's Upload pill is gone; the hero offers Upload only as a placeholder.
 *   4 · Portfolio's thumb row is Shop's shape (item 4): Search photos · ⇅ · ＋ Add photos.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import React from 'react';
import { stripComments } from '@/lib/strip-comments';

// The parts use the classic JSX runtime under tsx — the house test setup (`every-supplier-top-row-is-one-selector`).
(globalThis as unknown as { React: unknown }).React = React;

const SUPPLIER = join(process.cwd(), 'app/vendor-dashboard');
const read = (rel: string) => stripComments(readFileSync(join(SUPPLIER, rel), 'utf8'));
const HERO = read('_components/supplier-hero.tsx');

test('1 · Today, Shop and Portfolio all mount the one hero', () => {
  for (const f of ['_components/today-cover.tsx', 'shop/_components/shop-cover.tsx', 'collections/_components/portfolio-view.tsx']) {
    const src = read(f);
    assert.match(src, /from '(?:\.\.\/)+_components\/supplier-hero'|from '\.\/supplier-hero'/, `${f} does not import the one hero`);
    assert.equal((src.match(/<SupplierHero\b/g) ?? []).length, 1, `${f} does not mount the one hero exactly once`);
  }
});

test('2 · one height, the gutters, the scrim and the sample caption live in the part', () => {
  assert.match(HERO, /export const SUPPLIER_HERO_HEIGHT_PX = 208;/);
  assert.match(HERO, /className="relative isolate h-\[208px\]/, 'the hero is not one fixed height');
  assert.match(HERO, /inset-x-4 top-3\.5/, 'the eyebrow row lost its 16 px gutters');
  assert.match(HERO, /bottom-4 left-4/, 'the title block lost its 16 px gutters');
  assert.match(HERO, /linear-gradient\(to top/, 'the legibility scrim is gone');
  assert.match(HERO, /Sample photo · Upload yours/, 'a placeholder could pass as the supplier’s own work');
});

test('2b · it renders: a photo wears its caption; a placeholder says it is a sample and offers Upload', async () => {
  const { renderToStaticMarkup } = await import('react-dom/server');
  const { SupplierHero } = await import('./supplier-hero');
  const photo = renderToStaticMarkup(
    React.createElement(SupplierHero, { eyebrow: 'Shop', title: 'SetnaProd', picture: { url: '/x.jpg', kind: 'photo' }, caption: 'Cover · Your page', upload: { href: '#u' } }),
  );
  assert.match(photo, /data-supplier-hero="photo"/);
  assert.match(photo, /Cover · Your page/);
  assert.doesNotMatch(photo, /Sample photo|data-supplier-hero-upload/, 'a real photo is captioned as a sample or offers Upload');
  const sample = renderToStaticMarkup(React.createElement(SupplierHero, { eyebrow: 'Shop', title: 'SetnaProd', picture: null, upload: { href: '#u' } }));
  assert.match(sample, /data-supplier-hero="placeholder"/);
  assert.match(sample, /\/placeholders\/vendor\.webp/);
  assert.match(sample, /Sample photo · Upload yours/);
  assert.match(sample, /data-supplier-hero-upload=""/);
});

test('3 · Portfolio has one add door: no Upload pill on the band', () => {
  const view = read('collections/_components/portfolio-view.tsx');
  assert.doesNotMatch(view, /data-portfolio-upload=""/, 'the hero’s Upload pill is back beside the thumb row’s ＋');
  // The hero's Upload is drawn ONLY while it is a placeholder (asserted in 2b); the thumb row's ＋ is the standing add.
  assert.match(view, /upload=\{\{ href: '#gallery-media' \}\}/);
  assert.equal((view.match(/'#gallery-media'/g) ?? []).length, 2, 'a third add door to the uploader appeared');
});

test('4 · Portfolio’s thumb row: Search photos · ⇅ (Sort, Show ▶) · ＋ Add photos', () => {
  const view = read('collections/_components/portfolio-view.tsx');
  assert.match(view, /<ThumbRow\b/);
  assert.match(view, /placeholder: 'Search photos'/);
  assert.match(view, /label: 'Add photos', href: '#gallery-media'/);
  assert.doesNotMatch(view, /Search portfolio/);
});
