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

// UPDATED ON PURPOSE (owner 2026-11-19, "simple (no header)" · "portfolio simpler approved"): Portfolio has NO header any more, so it
// mounts no hero. Today and Shop still mount the one hero, exactly once each.
test('1 · Today and Shop mount the one hero; Portfolio has no header', () => {
  assert.doesNotMatch(read('collections/_components/portfolio-view.tsx'), /<SupplierHero\b/, 'Portfolio has a header again');
  for (const f of ['_components/today-cover.tsx', 'shop/_components/shop-cover.tsx']) {
    const src = read(f);
    assert.match(src, /from '(?:\.\.\/)+_components\/supplier-hero'|from '\.\/supplier-hero'/, `${f} does not import the one hero`);
    assert.equal((src.match(/<SupplierHero\b/g) ?? []).length, 1, `${f} does not mount the one hero exactly once`);
  }
});

test('2 · one height, the gutters, the scrim and the sample caption live in the part', () => {
  assert.match(HERO, /export const SUPPLIER_HERO_HEIGHT_PX = 208;/);
  // 208 px whenever its lines fit; in flow, so a long sub row grows it instead of drawing over the eyebrow (W1 F3).
  assert.match(HERO, /className="relative isolate flex min-h-\[208px\] flex-none flex-col overflow-hidden rounded-b-3xl px-4 pb-4 pt-3\.5/, 'the hero lost its one height or its 16 px gutters');
  assert.doesNotMatch(HERO, /\babsolute (?:inset-x-4|left-4|right-4|bottom-4|top-16)\b/, 'a hero line is absolutely placed again — it can draw over another');
  assert.match(HERO, /className="mt-auto pt-2" data-supplier-hero-foot=""/, 'the title block is not pinned to the bottom');
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

// UPDATED ON PURPOSE (owner 2026-11-19, "simple (no header)" · "portfolio simpler approved"): there is no band, so no Upload on it. The
// ONE add is the device's picker in place (＋ when the search matches nothing, and an empty Row 1's Upload).
test('3 · Portfolio has one add door: the device picker in place — no band, no link to a page', () => {
  const view = read('collections/_components/portfolio-view.tsx');
  assert.doesNotMatch(view, /data-portfolio-upload=""/, 'a hero Upload pill is back');
  assert.doesNotMatch(view, /'#gallery-media'/, 'the add went back to a link');
  assert.match(view, /<PortfolioUploadDoor facts=\{uploadFacts\}/, 'the add is not the shipped device-picker door');
});

// UPDATED ON PURPOSE (owner 2026-11-19, "simple (no header)" · "portfolio simpler approved") · "just one: show and sort": the row is
// Search or add · ONE Show-and-sort round (held in full by `collections/the-portfolio-is-simpler.test.ts`).
test('4 · Portfolio’s thumb row: Search or add · one Show-and-sort round', () => {
  const view = read('collections/_components/portfolio-view.tsx');
  assert.match(view, /<ThumbRow\b/);
  assert.match(view, /placeholder: 'Search or add'/);
  assert.match(view, /label: 'Sort',/);
  assert.doesNotMatch(view, /Search portfolio/);
});
