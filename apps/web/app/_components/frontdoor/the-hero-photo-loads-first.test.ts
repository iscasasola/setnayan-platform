/**
 * GUARD — the front page's first hero photo stays the first thing the phone fetches.
 *
 * It is the LCP element of `/` on a phone (measured 2026-11-13 with a PerformanceObserver on a production build at
 * 412×823: `IMG` · `/marketing/2026-11-04/hero-wedding.webp`). Three things keep it fast and each is a one-word edit
 * away from regressing silently — nothing throws, the page looks the same, and only the LCP moves:
 *
 *   • it is in the SERVER HTML — slide 0 is drawn without waiting for the idle "arm" that gives the other five their
 *     `src` (a hydration-gated `src` cannot start downloading until the page's JavaScript has run);
 *   • `fetchPriority="high"` for slide 0 and `"low"` for the others;
 *   • no `loading="lazy"` (a lazy LCP image is fetched only after layout).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from '@/lib/strip-comments';

const src = stripComments(readFileSync(join(__dirname, 'front-door-hero.tsx'), 'utf8'));
const img = src.slice(src.indexOf('<img'), src.indexOf('/>', src.indexOf('<img')));

test('slide 0 renders its <img> on the server, before the idle arm', () => {
  assert.ok(img.length > 20, 'premise: the hero <img> moved — re-anchor this guard');
  assert.match(src, /\{i === 0 \|\| armed \? \(/, 'slide 0 must not wait for `armed`');
});

test('slide 0 is fetched at high priority, the rest at low', () => {
  assert.match(img, /fetchPriority=\{i === 0 \? 'high' : 'low'\}/);
});

test('the hero photo is never lazy-loaded', () => {
  assert.doesNotMatch(img, /loading=/, 'loading="lazy" on the LCP image delays it until after layout');
});
