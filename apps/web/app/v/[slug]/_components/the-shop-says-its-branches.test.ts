/**
 * "Also in <city> · <city>" — the shop's other branches under the reach line (owner 2026-11-13, verbatim:
 * "Show the branches as needed"). RENDER-LEVEL: the shared `ShopBranchesLine` is painted (renderToStaticMarkup)
 * so an empty or teasing line cannot hide behind a passing rule.
 *
 * SABOTAGE PERFORMED AND UNDONE: `shopAlsoInLine` returning "Also in " for an empty list turned the 0-branch
 * case red; dropping the HQ-city skip turned the duplicate case red.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { ShopBranchesLine } from './shop-branches-line';
import { shopAlsoInLine } from '@/lib/shop-page-plan';

// tsx compiles .tsx with the classic runtime, so the component's JSX needs a global React (as the categories test does).
(globalThis as unknown as { React: unknown }).React = React;

const paint = (cities: Array<string | null>, hqCity: string | null = 'Tagaytay') =>
  renderToStaticMarkup(React.createElement(ShopBranchesLine, { cities, hqCity }));

test('a shop with 0 branches draws nothing at all — no empty "Also in"', () => {
  assert.equal(paint([]), '');
  assert.equal(shopAlsoInLine([]), null);
});

test('a shop with 2 branches says "Also in A · B"', () => {
  const html = paint(['Lipa', 'Batangas City']);
  assert.match(html, /data-shop-branches/);
  assert.match(html, /Also in Lipa · Batangas City/);
  assert.equal(shopAlsoInLine(['Lipa', 'Batangas City']), 'Also in Lipa · Batangas City');
});

test('branches with no city, a repeat, or the shop\'s own city add nothing — never a made-up place', () => {
  assert.equal(paint([null, '  ']), '');
  assert.equal(shopAlsoInLine(['Lipa', 'lipa', ' Tagaytay ', null], 'Tagaytay'), 'Also in Lipa');
  assert.equal(shopAlsoInLine(['Tagaytay'], 'Tagaytay'), null);
});

test('the public shop page mounts the shared line from the paid-branch read, and logs a failed read', async () => {
  const { readFileSync } = await import('node:fs');
  const { join, dirname } = await import('node:path');
  const { fileURLToPath } = await import('node:url');
  const page = readFileSync(join(dirname(fileURLToPath(import.meta.url)), '..', 'page.tsx'), 'utf8');
  assert.match(page, /<ShopBranchesLine\s+cities=\{publicBranches\.map\(\(b\) => b\.branchCity\)\}/);
  assert.doesNotMatch(page, /fetchPublicVendorBranches\([^)]*\)\.catch\(\(\) => \[\]\)/);
});
