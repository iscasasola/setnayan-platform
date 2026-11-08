/**
 * supplier-bar-is-today-clients-shop-portfolio.test.ts — G1 of THE ONE BUILD (renamed with `git mv` from
 * `vendor-bar-is-four.test.ts`, whose four-word part it replaces). The supplier's bar is **Today · Clients · Shop ·
 * Portfolio**, and nothing More (or the Hub tab) used to reach was lost on the way.
 *
 * ── THE RULING ──────────────────────────────────────────────────────────────
 * BARS LOCKED BY OWNER, 7 Nov 2026 (`SUPPLIER_DASHBOARD_BUILD_PLAN_2026-11-08.md`; THE ONE BUILD spec §1/§4): the bar is
 * Today · Clients · Shop · Portfolio. The Hub leaves the bar — its room stays, opened from Today's next event, "Events you
 * run" and the client page, and on the bar it lights Clients. "Customers" is called "Clients" (URL kept). Supersedes the
 * 2026-10-21 "Today · Customers · Shop · Hub" and its helper-gets-the-Hub-on-the-day rule.
 *
 * ── THE PROPERTIES (each asked of the code's OWN resolvers, never a copy) ───
 *   1. An owner's bar is exactly those four, in that order, in the web AND in the iPhone app, with the registry's
 *      default words applied (the registry wins over the code).
 *   2. The laptop rail says the same four words in the same order and opens the same rooms.
 *   3. No bar item, no rail row and no vendor registry slot routes to `/vendor-dashboard/on-the-day` any more.
 *   4. A helper (agent / viewer, or a role that could not be read) gets Today · Clients on EVERY day.
 *   5. EVERY ROUTE THE OLD MORE REACHED IS STILL REACHABLE (the frozen map below), now including the Hub through
 *      Today's own doors.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { Home, ShoppingBag, Store } from 'lucide-react';

import { VENDOR_BOTTOM_NAV_ITEMS, vendorBarItems } from './vendor-bottom-nav';
import { resolveVendorDestinations } from './vendor-nav-destinations';
import { supplierAvatarRows, scopedMemberAvatarRows } from './supplier-avatar-rows';
import { barItemsForShell } from '@/app/_components/nav/bottom-nav';
import { SHOP_SEGMENT_HREF } from '../shop/_components/shop-sections';
import { settingsMoreTools, SETTINGS_HELP_HREF, SUPPLIER_HELP_ROWS } from '../settings/settings-rows';
import { SUPPLIER_CHATS_HREF } from '../customers/anchors';
import { NAV_SLOT_DEFAULTS } from '@/lib/nav-registry-defaults';
import { isStoreShellWebOnlyPath } from '@/lib/store-shell';
import { stripComments } from '@/lib/strip-comments';
import type { NavSlotLite } from '@/lib/nav-registry-types';
import type { VendorTeamRole } from '@/lib/vendor-team';

const VD = join(import.meta.dirname, '..');
const read = (rel: string) => stripComments(readFileSync(join(VD, rel), 'utf8'));
const pathOf = (href: string) => href.split('#')[0]!.split('?')[0]!;

const WORDS = ['Today', 'Clients', 'Shop', 'Portfolio'];
const BAR_KEYS = ['profile', 'customers', 'shop', 'portfolio'];
const RAIL_KEYS = ['overview', 'customers', 'shop', 'portfolio'];

/** The registry's default words, as the layout hands them to the bar (`getNavSlotMap` with no overrides). */
const DEFAULT_SLOTS: Record<string, NavSlotLite> = Object.fromEntries(
  NAV_SLOT_DEFAULTS.map((d): [string, NavSlotLite] => [
    d.key,
    { label: d.label, icon: { kind: 'lucide', lucideName: d.lucideName ?? 'Circle', customRef: null, customUrl: null }, isHidden: false },
  ]),
);

/* ══ 1 · the bar is the four — web, app shell, registry words ══════════════ */

test('an owner’s bar is Today · Clients · Shop · Portfolio — on the web and in the iPhone app', () => {
  for (const role of ['owner', 'admin'] as const) {
    for (const navSlots of [undefined, DEFAULT_SLOTS]) {
      const items = vendorBarItems({ role, navSlots });
      assert.deepEqual(items.map((i) => i.key), BAR_KEYS, `${role}: the bar's keys`);
      assert.deepEqual(items.map((i) => i.label), WORDS, `${role}${navSlots ? ' (registry words)' : ''}: the bar's words`);
      // The store shell = the iPhone app. Its bar drops any tab whose door is web-only; none of the four may be.
      assert.deepEqual(barItemsForShell(items, true).map((i) => i.key), BAR_KEYS, `${role}: the app shell's bar is not the four`);
    }
  }
  assert.equal(VENDOR_BOTTOM_NAV_ITEMS.length, 4, 'the bar grew a fifth tab');
  assert.ok(!VENDOR_BOTTOM_NAV_ITEMS.some((i) => /more/i.test(i.key) || /more/i.test(i.label)), 'More is back on the bar');
});

test('no tab is a web-only door in the app shell', () => {
  for (const i of VENDOR_BOTTOM_NAV_ITEMS) {
    assert.equal(isStoreShellWebOnlyPath(pathOf(i.href)), false, `${i.href} is refused in the iPhone app — the tab would vanish there`);
  }
});

/* ══ 2 · the rail says the same four ═══════════════════════════════════════ */

test('the laptop rail says the same four words, in the same order', () => {
  for (const navSlots of [undefined, DEFAULT_SLOTS]) {
    const rows = resolveVendorDestinations({ role: 'admin', navSlots });
    assert.deepEqual(rows.map((r) => r.label), WORDS, `the rail${navSlots ? ' (registry words)' : ''} disagrees with the bar`);
    assert.deepEqual(rows.map((r) => r.key), RAIL_KEYS, 'the rail’s keys');
  }
  // Each tab and its rail row open the same room.
  const bar = vendorBarItems({ role: 'admin' }).map((i) => pathOf(i.href));
  const rail = resolveVendorDestinations({ role: 'admin' }).map((r) => pathOf(r.href));
  assert.deepEqual(rail, bar, 'a tab and its rail row open different rooms');
});

/* ══ 2b · Today wears the shop's icon, never a house ═════════════════════ */

// Owner, verbatim, 2026-10-24: "Shop icon not home icon on Shop's Dashboard Today."
// Asked of what is DRAWN — the code's tab AND the registry's slot (the registry
// wins, so a code-only change would leave the house on every real bar) — on the
// bar and the rail alike. Today must also stay distinguishable from the Shop tab.
test('Today wears the storefront (Store), not a house — bar and rail, code and registry', () => {
  for (const navSlots of [undefined, DEFAULT_SLOTS]) {
    const where = navSlots ? 'registry default' : 'code';
    const bar = vendorBarItems({ role: 'owner', navSlots });
    const today = bar.find((i) => i.key === 'profile');
    const shop = bar.find((i) => i.key === 'shop');
    assert.equal(today?.icon, Store, `the bar's Today (${where}) is not the storefront`);
    assert.notEqual(today?.icon, Home, `the bar's Today (${where}) still wears a house`);
    assert.notEqual(today?.icon, shop?.icon, `the bar's Today and Shop (${where}) wear the same icon`);
    const rail = resolveVendorDestinations({ role: 'admin', navSlots });
    assert.equal(rail[0]?.label, 'Today');
    assert.equal(rail[0]?.icon, Store, `the rail's Today (${where}) is not the storefront`);
  }
  // The Shop tab keeps its bag — the two must not collapse into one glyph.
  assert.equal(VENDOR_BOTTOM_NAV_ITEMS.find((i) => i.key === 'shop')?.icon, ShoppingBag);
});

/* ══ 3 · the Hub has no tab — anywhere ════════════════════════════════════ */

test('no bar item, no rail row and no vendor registry slot routes to the Hub room', () => {
  const HUB = /\/vendor-dashboard\/on-the-day/;
  for (const role of ['owner', 'admin', 'agent', 'viewer', null] as const) {
    for (const i of vendorBarItems({ role, navSlots: DEFAULT_SLOTS })) {
      assert.ok(!HUB.test(i.href) && i.key !== 'onday', `${role ?? 'unread role'}: the bar still carries the Hub (${i.key})`);
    }
    for (const r of resolveVendorDestinations({ role })) {
      assert.ok(!HUB.test(r.href) && r.key !== 'on-the-day', `${role ?? 'unread role'}: the rail still carries the Hub (${r.key})`);
    }
  }
  const slots = NAV_SLOT_DEFAULTS.filter((d) => d.key.startsWith('vendor.') && HUB.test(d.route ?? ''));
  assert.deepEqual(slots.map((d) => d.key), [], 'a vendor registry slot still routes to the Hub room');
  assert.ok(NAV_SLOT_DEFAULTS.some((d) => d.key === 'vendor.sidebar.portfolio'), 'the Portfolio rail slot is missing');
  assert.ok(NAV_SLOT_DEFAULTS.some((d) => d.key === 'vendor.bottom-nav.portfolio'), 'the Portfolio bar slot is missing');
});

/* ══ 4 · a helper: Today · Clients, every day ══════════════════════════════ */

test('a helper gets Today · Clients — on every day, on the bar and the rail', () => {
  const roles: (VendorTeamRole | null)[] = ['agent', 'viewer', null];
  for (const role of roles) {
    for (const storeShell of [false, true]) {
      const bar = barItemsForShell(vendorBarItems({ role, navSlots: DEFAULT_SLOTS }), storeShell);
      assert.deepEqual(bar.map((i) => i.label), ['Today', 'Clients'], `${role ?? 'unread role'}: the helper's bar`);
    }
    assert.deepEqual(resolveVendorDestinations({ role }).map((r) => r.label), ['Today', 'Clients']);
  }
  assert.ok(!vendorBarItems({ role: 'viewer' }).some((i) => i.key === 'shop' || i.key === 'portfolio'), 'a helper got Shop or Portfolio');
});

test('wiring: the layout no longer reads the event day or the events you run for the nav', () => {
  const layout = read('layout.tsx');
  assert.doesNotMatch(layout, /eventToday|hasDayToday|runsEvents/, 'the layout still pays a read for a Hub tab that is gone');
  assert.match(layout, /<VendorBottomNav\b/, 'premise: the layout still draws the bar');
  assert.match(layout, /<VendorRailContext\b/, 'premise: the layout still draws the rail');
});

/* ══ 4 · every route the old More reached is still reachable ═══════════════ */

/**
 * The OLD More, frozen as it stood on `origin/main` @ f6b8a6bbc9 before the cut
 * (`lib/vendor-more-rows.ts`): its five rows' hrefs, then the rooms that lit it
 * (`VENDOR_MORE_MATCH`). ⛔ Never derive this from the new code — it is the
 * baseline the new code is checked against.
 */
const OLD_MORE_MAP: readonly string[] = [
  // VENDOR_MORE_ROWS
  '/vendor-dashboard/on-the-day',
  '/vendor-dashboard/customers?seg=people&open=messages#customer-tools',
  '/vendor-dashboard/performance',
  '/vendor-dashboard/settings',
  '/vendor-dashboard/settings#more-tools',
  // VENDOR_MORE_MATCH
  '/vendor-dashboard/more',
  '/vendor-dashboard/demand',
  '/vendor-dashboard/notifications',
  '/vendor-dashboard/help',
];

/** What is one tap away on every supplier page, for an owner. */
function oneTap(): Set<string> {
  const layout = read('layout.tsx');
  const bell = /<UnreadBellBadge[\s\S]*?href="([^"]+)"/.exec(layout)?.[1];
  assert.ok(bell, 'premise: the top bar’s bell has an href');
  assert.match(layout, /<UnreadMessagesBadge[\s\S]*?href=\{SUPPLIER_CHATS_HREF\}/, 'premise: the envelope lands on Chats');
  return new Set([
    ...vendorBarItems({ role: 'owner' }).map((i) => i.href),
    SUPPLIER_CHATS_HREF,
    bell,
    ...supplierAvatarRows().map((r) => r.href),
  ]);
}

/**
 * What is one tap further — but ONLY behind a door that is itself one tap away:
 * Shop's segments if Shop is on the bar, every Settings row (its rooms, its More
 * tools fold, Help) if Settings is reachable. A room is never counted as
 * reachable because something inside it links somewhere.
 */
function twoTaps(one: ReadonlySet<string>): Set<string> {
  const onePaths = new Set([...one].map(pathOf));
  const out = new Set<string>();
  // Today's own doors (the bar's first tab): its next-event / event-day links and "Events you run" open the Hub room —
  // the Hub's doors since it left the bar (THE ONE BUILD; `the-hub-has-doors-without-a-tab.test.ts` holds them).
  if (onePaths.has('/vendor-dashboard')) {
    for (const f of ['_components/supplier-today-first-screen.tsx', '_components/events-you-run-rows.tsx']) {
      for (const m of read(f).matchAll(/['"`](\/vendor-dashboard\/[a-z-]+)(?=['"`/?#$])/g)) out.add(m[1]!);
    }
  }
  if (onePaths.has(pathOf(SHOP_SEGMENT_HREF.services))) for (const h of Object.values(SHOP_SEGMENT_HREF)) out.add(h);
  if (onePaths.has('/vendor-dashboard/settings')) {
    const settings = read('settings/settings-view.tsx') + read('settings/page.tsx');
    for (const m of settings.matchAll(/href="([^"]+)"/g)) out.add(m[1]!);
    const tools = settingsMoreTools({ hasMoodboardLibraryAccess: true, hasMusicRepertoireAccess: true, storeShell: false });
    for (const t of tools.flatMap((g) => g.tools)) out.add(t.href);
    out.add(SETTINGS_HELP_HREF);
    for (const r of SUPPLIER_HELP_ROWS) out.add(r.href);
    // The More tools fold is a place of its own — counted only while Settings carries its anchor.
    if (/id="more-tools"/.test(settings)) out.add('/vendor-dashboard/settings#more-tools');
  }
  return out;
}

/** Where a redirect stub sends you, read from its page — or null when the page is a real screen. */
function stubTarget(path: string): string | null {
  const file = join(VD, path.replace(/^\/vendor-dashboard\/?/, ''), 'page.tsx');
  if (!existsSync(file)) return null;
  const src = stripComments(readFileSync(file, 'utf8'));
  if (/return\s*\(?\s*</.test(src)) return null; // it draws something — a real screen
  return /redirect\(\s*[`'"]([^`'"$]+)/.exec(src)?.[1] ?? null;
}

test('🔑 every route the old More reached is reachable from Today · Clients · Shop · Portfolio', () => {
  const one = oneTap();
  const near = new Set([...one, ...twoTaps(one)]);
  const nearPaths = new Set([...near].map(pathOf));
  // The ONE route whose anchor matters: More tools is a fold, not a page.
  const has = (href: string) => (href.includes('#more-tools') ? near.has(href) : nearPaths.has(pathOf(href)));
  const lost: string[] = [];
  for (const href of OLD_MORE_MAP) {
    if (has(href)) continue;
    const to = stubTarget(pathOf(href));
    if (to && has(to)) continue;
    lost.push(to ? `${href} (→ ${to})` : href);
  }
  assert.deepEqual(lost, [], `reached through More before the cut and reachable from nowhere now: ${lost.join(', ')}`);
  // Premise: the stubs really are stubs, so the loop above is not passing them by accident.
  assert.equal(stubTarget('/vendor-dashboard/more'), '/vendor-dashboard/settings');
  assert.ok(stubTarget('/vendor-dashboard/demand')?.startsWith('/vendor-dashboard/performance'));
  assert.equal(stubTarget('/vendor-dashboard/settings'), null, 'premise: Settings is a real screen');
});

test('a helper still reaches Settings — the profile picture’s sheet is their only door to it', () => {
  assert.ok(scopedMemberAvatarRows().some((r) => r.href === '/vendor-dashboard/settings'));
});
