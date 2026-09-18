/**
 * A LINK INTO A MY-SHOP PANEL OPENS IT — AREA-VENDOR, 2026-09-19.
 *
 * The four My Shop panels always started closed and nothing read the address,
 * so three doors landed on a shut fold:
 *   · Instagram's OAuth callback → `#gallery-media` + the connect RESULT, both
 *     inside the closed Website panel (a supplier who connected Instagram was
 *     told nothing either way);
 *   · the Website tab's "Edit page";
 *   · Performance's "Add recent photos".
 * And the Website tab printed "Open live" for a page couples got a 404 on,
 * because it decided "live" from ONE of the two columns `isShopLive` reads.
 *
 * Every door is checked from where it is DECLARED (the route, the page, the
 * recommendation), so moving the anchor without the map turns this red.
 *
 * 🪤 `globalThis.React` before the DYNAMIC import — tsconfig sets
 * `"jsx": "preserve"`, so components compile to bare `React.createElement`.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripComments } from '@/lib/strip-comments';
import { panelForHash } from './_components/manage-tiles-hash';
import { buildGrowthRecs } from '@/lib/vendor-growth-recs';

(globalThis as unknown as { React: unknown }).React = React;

const HERE = dirname(fileURLToPath(import.meta.url));
const WEB = join(HERE, '..', '..', '..');
const src = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));
const hashOf = (href: string) => (href.includes('#') ? href.slice(href.indexOf('#')) : '');

test('the Instagram callback’s landing anchor opens the panel that holds it', () => {
  const route = src('app/api/vendor/instagram/callback/route.ts');
  const m = route.match(/IG_SECTION_HASH\s*=\s*['"`]([^'"`]+)['"`]/);
  assert.ok(m, 'IG_SECTION_HASH not found in the callback route');
  assert.equal(panelForHash(m[1]), 'website');
  // …and the element with that id really lives in the Website editor.
  assert.match(src('app/vendor-dashboard/shop/_components/website-editor.tsx'), new RegExp(`id="${m[1]!.slice(1)}"`));
});

test('a page carrying the Instagram result renders the Website panel OPEN', async () => {
  assert.match(
    src('app/vendor-dashboard/shop/page.tsx'),
    /<ManageTiles\s+initialOpen=\{igFlash \? 'website' : null\}/,
    'My Shop does not open the Website panel when it carries an Instagram result',
  );
  const { renderToStaticMarkup } = await import('react-dom/server');
  const { ManageTiles } = await import('./_components/manage-tiles');
  const props = {
    completionPct: 80,
    verifyLabel: '2 fields left',
    teamLabel: '1',
    teamSub: '',
    branchLabel: '0',
    branchSub: '',
    profilePanel: React.createElement('p', null, 'PROFILE-BODY'),
    websitePanel: React.createElement('p', null, 'WEBSITE-BODY'),
    teamPanel: null,
    branchPanel: null,
  };
  const shut = renderToStaticMarkup(React.createElement(ManageTiles, props));
  const open = renderToStaticMarkup(React.createElement(ManageTiles, { ...props, initialOpen: 'website' as const }));
  const expanded = (html: string) => (html.match(/aria-expanded="true"/g) ?? []).length;
  assert.equal(expanded(shut), 0, 'floor: nothing open by default');
  assert.equal(expanded(open), 1, 'initialOpen did not open the Website tile');
  assert.match(open, /aria-expanded="true"[^>]*>\s*<p[^>]*>Website<\/p>/, 'the open tile is not Website');
});

test('the panels follow the address — on load and on every hash change', () => {
  const tiles = src('app/vendor-dashboard/shop/_components/manage-tiles.tsx');
  assert.match(tiles, /panelForHash\(window\.location\.hash\)/, 'ManageTiles never reads the hash');
  assert.match(tiles, /addEventListener\('hashchange'/, 'ManageTiles ignores later hash changes');
});

test('"Edit page" on the Website tab opens the Website panel', () => {
  const page = src('app/vendor-dashboard/website/page.tsx');
  const m = page.match(/href="([^"]+)"[^>]*>\s*<SquarePen[^>]*\/>\s*Edit page/);
  assert.ok(m, '"Edit page" link not found');
  assert.equal(panelForHash(hashOf(m[1]!)), 'website', `"Edit page" goes to ${m[1]}`);
});

test('"Add recent photos" goes to the gallery, open', () => {
  const rec = buildGrowthRecs(null).find((r) => r.key === 'add_photos');
  assert.ok(rec, 'no add_photos recommendation');
  assert.equal(panelForHash(hashOf(rec.ctaHref)), 'website', `add_photos goes to ${rec.ctaHref}`);
});

test('the Website tab says "live" only when couples can see the page', () => {
  const page = src('app/vendor-dashboard/website/page.tsx');
  assert.match(page, /live = isShopLive\(/, 'live is not decided by isShopLive');
  assert.match(page, /\{live \? 'Open live' : 'Open preview'\}/, '"Open live" is printed regardless');
  assert.match(page, /\{live \? null : \(\s*<p\s+data-not-live-notice/, 'no notice for a page only the owner can see');
});
