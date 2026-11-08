/**
 * the-bar-is-laid-out-by-its-tabs.test.ts — 📐 THE BAR IS LAID OUT BY ITS TABS (THE ONE BUILD guard G2, 8 Nov 2026).
 *
 * The v107 rule, held for the two bars THE ONE BUILD re-cut: the bottom bar's grid has exactly as many columns as it
 * has tabs — the supplier's four (Today · Clients · Shop · Portfolio) are quarters, the couple's five are fifths, a
 * three-tab bar is thirds. A bar whose column count is written down separately from its tabs goes wrong the day a
 * tab leaves (the Hub just did) and leaves a blank slot or a squeezed one.
 *
 * The generic 3/4/5 render is already held by `the-phone-bar-is-anchored.test.ts` ("🕳 one column per tab"); this
 * file adds the REAL supplier roster and the counts as a property of the shared `BottomNav`.
 *
 * 🛡 SABOTAGE (seen RED, then restored — 2026-11-08): `BottomNavFlat`'s `const n = Math.min(items.length, 6)` set to
 * `const n = 4` (red: the 3- and 5-tab bars).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import React, { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { Home, Users, Store, Images, Globe } from 'lucide-react';

import { BottomNav } from './bottom-nav';
import type { BottomNavItem } from './types';
import { VENDOR_BOTTOM_NAV_ITEMS } from '@/app/vendor-dashboard/_components/vendor-bottom-nav';

(globalThis as unknown as { React: unknown }).React = React;

const BASE = '/dashboard/S89E-TESTEVENT';
const EVENT_BAR: BottomNavItem[] = [
  { key: 'home', label: 'Today', icon: Home, href: BASE, activeMatch: BASE, activeMatchExact: true },
  { key: 'guests', label: 'Guests', icon: Users, href: `${BASE}/guests`, activeMatch: `${BASE}/guests` },
  { key: 'explore', label: 'Suppliers', icon: Store, href: `${BASE}/vendors`, activeMatch: `${BASE}/vendors` },
  { key: 'memories', label: 'Memories', icon: Images, href: `${BASE}/memories`, activeMatch: `${BASE}/memories` },
  { key: 'launch', label: 'Hub', icon: Globe, href: `${BASE}/launch`, activeMatch: `${BASE}/launch` },
];

function columns(items: BottomNavItem[]): { declared: number; cells: number } {
  const html = renderToStaticMarkup(createElement(BottomNav, { items }));
  const cols = /grid-template-columns:repeat\((\d+), minmax\(0, 1fr\)\)/.exec(html);
  assert.ok(cols, 'the bar no longer declares repeat(n, …) — this guard cannot read its grid');
  return { declared: Number(cols[1]), cells: (html.match(/<li>/g) ?? []).length };
}

test('3, 4 and 5 tabs lay out as 3, 4 and 5 columns', () => {
  for (const n of [3, 4, 5]) {
    const g = columns(EVENT_BAR.slice(0, n));
    assert.equal(g.declared, n, `${n} tabs drew repeat(${g.declared}, …)`);
    assert.equal(g.cells, n, `${n} tabs drew ${g.cells} cells`);
  }
});

test('the supplier bar is four tabs in four columns — Today · Clients · Shop · Portfolio', () => {
  assert.deepEqual(VENDOR_BOTTOM_NAV_ITEMS.map((i) => i.label), ['Today', 'Clients', 'Shop', 'Portfolio']);
  assert.deepEqual(columns(VENDOR_BOTTOM_NAV_ITEMS), { declared: 4, cells: 4 });
});
