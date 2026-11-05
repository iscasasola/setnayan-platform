/**
 * the-loading-screen-never-blinks-the-names.test.ts — A HERO PART THAT ARRIVES WITH A BUILD IN OF ITS OWN IS NOT
 * DRAWN BY THE LOADING SCREEN FIRST (the 2026-10-15 Animate walk, F4 · L2).
 *
 * 🔴 Measured live on maria-and-jose: the loading screen drew the names, the real cover replaced them with a NEW
 * node whose Build in starts from opacity 0 — shown at 0.28 s, gone at 0.51 s, back at 1.24 s (WebKit 0.72 → 1.22 →
 * 1.94 s). Choice recorded in `_lib/hero-design-of.ts` `heroArrivingForSkeleton`: the loading screen keeps the part's
 * place but does not draw it (`data-el-waits`, ≤ 2.5 s), so the cover's own Build in is the first time it is seen.
 *
 *   (1) THE PARTS — exactly the hero parts with an In of their own, through the draft in the Maker; none without.
 *   (2) THE LOADING SCREEN marks those parts (the names' `<h1>`) and nothing else; the real masthead never does.
 *       Sabotage: the mark dropped from `el()` → red.
 *   (3) THE STYLESHEET hides a marked part only inside the motion gates (where the cover's Build in plays), for at
 *       most 2.5 s, by `visibility` (its place is kept — nothing jumps when the cover lands).
 *   (4) page.tsx hands the loading screen the parts from that one resolver.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { heroArrivingForSkeleton } from '../_lib/hero-design-of';
import type { InvitationWidgetRow } from '@/lib/invitation-widgets';

(globalThis as unknown as { React: unknown }).React = React;
const WEB = join(__dirname, '..', '..', '..');
const read = (rel: string) => readFileSync(join(WEB, rel), 'utf8');
const row = (type: string, config: unknown) => ({ widget_type: type, config_json: config }) as unknown as InvitationWidgetRow;

test('(1) the parts that arrive are exactly the hero parts with a Build in of their own', () => {
  const combo = { fade: true, blur: true, move: 'right', size: 'grow' };
  assert.deepEqual(heroArrivingForSkeleton([row('hero', { canvas: { elements: { names: { motion: { in: combo } } } } })], null), ['names']);
  assert.deepEqual(heroArrivingForSkeleton([row('hero', { canvas: { elements: { names: { motion: { in: { fade: true } }, color: '#112233' }, date: { motion: { during: 'drift' } } } } })], null), ['names'], 'a Drift alone is no arrival');
  assert.deepEqual(heroArrivingForSkeleton([row('hero', { canvas: { elements: { names: { color: '#112233' } } } })], null), []);
  assert.deepEqual(heroArrivingForSkeleton([row('greeting', {})], null), []);
  assert.deepEqual(heroArrivingForSkeleton([], null), []);
});

test('(2) the loading screen marks those parts; the real cover never does', async () => {
  const { renderToStaticMarkup } = await import('react-dom/server');
  const { InvitationSkeleton } = await import('./invitation-skeleton');
  const { PahinaMasthead } = await import('./pahina-masthead');
  for (const design of ['card', 'marquee', 'crest', 'letter'] as const) {
    const sk = renderToStaticMarkup(React.createElement(InvitationSkeleton, { displayName: 'Maria & Jose', monogramText: 'MJ', design, arriving: ['names'] }));
    const names = /<h1[^>]*data-hub-names=""[^>]*>/.exec(sk);
    assert.ok(names, `${design}: no names on the loading screen`);
    assert.match(names[0], /data-el-waits=""/, `${design}: the loading screen draws the names the cover will bring in`);
    assert.equal((sk.match(/data-el-waits=""/g) ?? []).length, 1, `${design}: a part with no Build in is held back too`);
    const plain = renderToStaticMarkup(React.createElement(InvitationSkeleton, { displayName: 'Maria & Jose', monogramText: 'MJ', design }));
    assert.doesNotMatch(plain, /data-el-waits/, `${design}: names with no Build in of their own are held back`);
    const real = renderToStaticMarkup(React.createElement(PahinaMasthead, { displayName: 'Maria & Jose', eventDate: null, design, elements: { names: { motion: { in: { fade: true } } } } } as never));
    assert.doesNotMatch(real, /data-el-waits/, `${design}: the real cover holds its own names back`);
  }
});

test('(3) the stylesheet hides a marked part only where the cover’s Build in plays, ≤ 2.5 s, keeping its place', () => {
  const css = read('app/globals.css');
  const kf = /@keyframes sn-el-waits \{\s*from,\s*to \{\s*visibility: hidden;\s*\}\s*\}/.exec(css);
  assert.ok(kf, 'the hold is not a visibility hold (its place must be kept)');
  const rules = [...css.matchAll(/\[data-el-waits\] \{\s*animation: sn-el-waits (\d+(?:\.\d+)?)s step-end;\s*\}/g)];
  assert.equal(rules.length, 2, 'the hold is not in both motion gates (with and without scroll timelines)');
  for (const r of rules) {
    assert.ok(Number(r[1]) <= 2.5, `the names may be held ${r[1]} s on a slow server`);
    const before = css.slice(0, r.index);
    const gate = Math.max(before.lastIndexOf('@supports (animation-timeline: view())'), before.lastIndexOf('@supports not (animation-timeline: view())'));
    assert.ok(gate >= 0 && /prefers-reduced-motion: no-preference/.test(before.slice(gate)), 'the hold is outside the motion gates — a guest who asked for stillness would see no names');
  }
  /* No other rule holds them back. */
  assert.equal((css.match(/\[data-el-waits\]/g) ?? []).length, 3, 'another rule reads data-el-waits');
});

test('(4) page.tsx hands the loading screen the parts from the one resolver', () => {
  const page = read('app/[slug]/page.tsx');
  assert.match(page, /heroArrivingForSkeleton\(widgets, draft\)/);
  assert.match(page, /arriving=\{skeletonArriving\}/);
});
