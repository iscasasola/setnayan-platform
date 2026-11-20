/**
 * GUARD — the front page's first photo stays the first thing the phone fetches.
 *
 * It is the LCP element of `/` on a phone (measured 2026-11-13: `/marketing/2026-11-04/hero-wedding.webp`). 🔁 MOVED
 * 20 Nov 2026: the 4 Nov hero turned six slides (`front-door-hero.tsx`); the 20 Nov front page
 * (prototypes/front_page_home_2026-11-19 v5) leads with ONE inset photo, drawn in `front-door-anchor.tsx`. The same
 * two rules hold it fast, each a one-word edit from regressing silently:
 *
 *   • it is a plain server-rendered <img> with its `src` in the HTML — nothing waits for script;
 *   • `fetchPriority="high"`, and never `loading="lazy"` (a lazy LCP image is fetched only after layout).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from '@/lib/strip-comments';

const src = stripComments(readFileSync(join(__dirname, 'front-door-anchor.tsx'), 'utf8'));
const img = src.slice(src.indexOf('<img'), src.indexOf('/>', src.indexOf('<img')));

test('the first photo is a server <img> with its src in the HTML', () => {
  assert.ok(img.length > 20, 'premise: the first-screen <img> moved — re-anchor this guard');
  assert.match(img, /src=\{marketingPhoto\('hero-wedding'\)\}/, 'the first photo must carry its src on the server');
  assert.doesNotMatch(src, /^\s*['"]use client['"]/m, 'the first screen became a client module — its photo would wait for script');
});

test('the first photo is fetched at high priority', () => {
  assert.match(img, /fetchPriority="high"/);
});

test('the first photo is never lazy-loaded', () => {
  assert.doesNotMatch(img, /loading=/, 'loading="lazy" on the LCP image delays it until after layout');
});
