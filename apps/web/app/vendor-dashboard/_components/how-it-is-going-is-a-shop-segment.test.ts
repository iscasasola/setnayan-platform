/**
 * how-it-is-going-is-a-shop-segment.test.ts — owner "Yes to all", 2026-10-21,
 * item 2 of `shots-2026-10-21/supplier-dash-audit/AUDIT.md`.
 *
 * ── WHAT WAS WRONG ──────────────────────────────────────────────────────────
 * Shop's third segment, "How it is going", opened `/vendor-dashboard/performance`
 * — a page that drew NO Shop segments and lit the MORE tab (`/performance` sat in
 * `VENDOR_MORE_MATCH`, not in Shop's `activeMatch`). A supplier tapped Shop and
 * landed on a page whose bar said More, with no way back but the bar.
 *
 * ── THE PROPERTY ────────────────────────────────────────────────────────────
 *   1. EVERY Shop segment's address lights Shop and only Shop — on the phone bar
 *      (asked through the bar's OWN matcher, `bottomNavItemMatches`) and on the
 *      laptop rail (asked through the rail's OWN candidate list and resolver).
 *      Derived from `SHOP_SEGMENT_HREF`, so a fourth segment is covered the day
 *      it is added.
 *   2. Every page a segment opens draws the Shop switcher with ITS segment on,
 *      on every return path that renders the page (the tier upsell included).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { SHOP_SEGMENT_HREF, type ShopSegment } from '../shop/_components/shop-segments';
import { bottomNavItemMatches } from '@/app/_components/nav/bottom-nav';
import { activeRailKey } from '@/app/_components/frontdoor/rail-active';
import { VENDOR_BOTTOM_NAV_ITEMS } from './vendor-bottom-nav';
import { resolveVendorDestinations, vendorRailCandidates, VENDOR_SHOP_EXTRA_MATCH } from './vendor-nav-destinations';
import { stripComments } from '@/lib/strip-comments';

const VD = join(import.meta.dirname, '..');
const pathOf = (href: string) => href.split('#')[0]!.split('?')[0]!;

/** Which bar tabs a URL lights, by the bar's own rule. */
const barLit = (path: string) => VENDOR_BOTTOM_NAV_ITEMS.filter((i) => bottomNavItemMatches(path, i)).map((i) => i.key);

/** Which rail row a URL lights, by the rail's own candidates and resolver. */
const railLit = (path: string) =>
  activeRailKey(vendorRailCandidates(resolveVendorDestinations({ role: 'admin' }), { key: '__plan', href: '/vendor-dashboard/subscription' }), path);

const SEGMENT_ROUTES = [...new Set([...Object.values(SHOP_SEGMENT_HREF), ...VENDOR_SHOP_EXTRA_MATCH].map(pathOf))];

test('every Shop segment lights Shop, and only Shop, on the phone bar', () => {
  assert.ok(SEGMENT_ROUTES.includes('/vendor-dashboard/performance'), 'premise: How it is going is /performance');
  for (const path of SEGMENT_ROUTES) {
    assert.deepEqual(barLit(path), ['shop'], `${path} lights ${JSON.stringify(barLit(path))} on the bar — a Shop segment must light Shop`);
  }
});

test('every Shop segment lights Shop on the laptop rail', () => {
  for (const path of SEGMENT_ROUTES) {
    assert.equal(railLit(path), 'shop', `${path} lights "${railLit(path)}" on the rail — a Shop segment must light Shop`);
  }
});

/** The page file a segment address renders. */
function pageFor(path: string): string {
  return join(VD, path.replace(/^\/vendor-dashboard\/?/, ''), 'page.tsx');
}

test('every page a Shop segment opens draws the Shop switcher with that segment on', () => {
  for (const [seg, href] of Object.entries(SHOP_SEGMENT_HREF) as [ShopSegment, string][]) {
    const src = stripComments(readFileSync(pageFor(pathOf(href)), 'utf8'));
    const on = (src.match(new RegExp(`<ShopSegments\\s+on="${seg}"`, 'g')) ?? []).length;
    assert.ok(on >= 1, `${href} draws no <ShopSegments on="${seg}"> — the supplier lands with no way back to Shop`);
  }
});

test('How it is going keeps the switcher on the tier upsell too — every page-rendering return', () => {
  const src = stripComments(readFileSync(join(VD, 'performance', 'page.tsx'), 'utf8'));
  // The two returns that draw a page: the tier upsell and the full page.
  const upsell = src.slice(src.indexOf('canSeePerformanceTrends(tier)'), src.indexOf('<VendorTierGate'));
  assert.match(upsell, /<ShopSegments\s+on="insights"/, 'the tier upsell lost the Shop switcher');
  const head = src.indexOf('How is my business doing</h1>');
  assert.ok(head > 0, 'premise: the page heading moved');
  const full = src.slice(src.lastIndexOf('return (', head), head);
  assert.match(full, /<ShopSegments\s+on="insights"/, 'the full page lost the Shop switcher');
});
