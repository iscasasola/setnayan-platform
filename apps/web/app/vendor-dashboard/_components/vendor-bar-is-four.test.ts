/**
 * vendor-bar-is-four.test.ts — the supplier's bar is **Today · Customers · Shop ·
 * Hub**, and nothing More used to hold was lost on the way.
 *
 * ── THE RULING ──────────────────────────────────────────────────────────────
 * Owner, verbatim, 2026-10-21: *"Yes to all"* — to the supplier-dashboard audit
 * (`shots-2026-10-21/supplier-dash-audit/AUDIT.md`), items 5 and 6:
 *   5. the bar becomes Today · Customers · Shop · Hub, NO More (the couple's four,
 *      #6725); Settings lives under the profile picture; Hub = the Event Hub;
 *   6. a crew helper gets the Hub on the day (the scanner), beside Today and
 *      Customers — a door, not wider data.
 * It supersedes DECISION_LOG 2026-10-01 answer 1 and 2026-10-08 answer 1.
 *
 * ── THE PROPERTIES (each asked of the code's OWN resolvers, never a copy) ───
 *   1. An owner's bar is exactly those four, in that order, in the web AND in the
 *      iPhone app (the store shell's `barItemsForShell` drops none of them), and
 *      with the admin registry's default words applied (the registry wins over
 *      the code, so its words are the ones a supplier reads).
 *   2. The laptop rail says the same four words in the same order.
 *   3. A helper (agent / viewer, or a role that could not be read) gets Today ·
 *      Customers on a normal day and Today · Customers · Hub on an event day —
 *      on the bar and the rail alike.
 *   4. EVERY ROUTE THE OLD MORE REACHED IS STILL REACHABLE from the new shape:
 *      in one tap from what is always on screen (the bar, the top bar's envelope
 *      and bell, the profile picture's sheet) or in two (a Shop segment, a
 *      Settings row) — a redirect stub counting only if it lands on one of them.
 *      The old map is FROZEN below as it stood on `origin/main` before the cut —
 *      it is the thing being checked against, so it must not be derived from the
 *      code that replaced it.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { VENDOR_BOTTOM_NAV_ITEMS, vendorBarItems } from './vendor-bottom-nav';
import { resolveVendorDestinations } from './vendor-nav-destinations';
import { supplierAvatarRows, scopedMemberAvatarRows } from './supplier-avatar-rows';
import { barItemsForShell } from '@/app/_components/nav/bottom-nav';
import { SHOP_SEGMENT_HREF } from '../shop/_components/shop-segments';
import { settingsMoreTools, SETTINGS_HELP_HREF, SUPPLIER_HELP_ROWS } from '../settings/settings-rows';
import { customerLandingHref } from '../customers/anchors';
import { NAV_SLOT_DEFAULTS } from '@/lib/nav-registry-defaults';
import { isStoreShellWebOnlyPath } from '@/lib/store-shell';
import { stripComments } from '@/lib/strip-comments';
import type { NavSlotLite } from '@/lib/nav-registry-types';
import type { VendorTeamRole } from '@/lib/vendor-team';

const VD = join(import.meta.dirname, '..');
const read = (rel: string) => stripComments(readFileSync(join(VD, rel), 'utf8'));
const pathOf = (href: string) => href.split('#')[0]!.split('?')[0]!;

const WORDS = ['Today', 'Customers', 'Shop', 'Hub'];
const BAR_KEYS = ['profile', 'customers', 'shop', 'onday'];

/** The registry's default words, as the layout hands them to the bar (`getNavSlotMap` with no overrides). */
const DEFAULT_SLOTS: Record<string, NavSlotLite> = Object.fromEntries(
  NAV_SLOT_DEFAULTS.map((d): [string, NavSlotLite] => [
    d.key,
    { label: d.label, icon: { kind: 'lucide', lucideName: d.lucideName ?? 'Circle', customRef: null, customUrl: null }, isHidden: false },
  ]),
);

/* ══ 1 · the bar is the four — web, app shell, registry words ══════════════ */

test('an owner’s bar is Today · Customers · Shop · Hub — on the web and in the iPhone app', () => {
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
  }
  // Each tab and its rail row open the same room.
  const bar = vendorBarItems({ role: 'admin' }).map((i) => pathOf(i.href));
  const rail = resolveVendorDestinations({ role: 'admin' }).map((r) => pathOf(r.href));
  assert.deepEqual(rail, bar, 'a tab and its rail row open different rooms');
});

/* ══ 3 · a helper: Today · Customers, plus the Hub on the day ══════════════ */

test('a helper gets Today · Customers — and the Hub on an event day only, on the bar and the rail', () => {
  const roles: (VendorTeamRole | null)[] = ['agent', 'viewer', null];
  for (const role of roles) {
    for (const storeShell of [false, true]) {
      const plain = barItemsForShell(vendorBarItems({ role, navSlots: DEFAULT_SLOTS }), storeShell);
      const day = barItemsForShell(vendorBarItems({ role, navSlots: DEFAULT_SLOTS, eventToday: true }), storeShell);
      assert.deepEqual(plain.map((i) => i.label), ['Today', 'Customers'], `${role ?? 'unread role'}: a normal day`);
      assert.deepEqual(day.map((i) => i.label), ['Today', 'Customers', 'Hub'], `${role ?? 'unread role'}: an event day — the scanner is in the Hub`);
    }
    assert.deepEqual(resolveVendorDestinations({ role }).map((r) => r.label), ['Today', 'Customers']);
    assert.deepEqual(resolveVendorDestinations({ role, eventToday: true }).map((r) => r.label), ['Today', 'Customers', 'Hub']);
  }
  // The day never takes anything from an owner, and never adds Shop for a helper.
  assert.deepEqual(vendorBarItems({ role: 'owner', eventToday: true }).map((i) => i.key), BAR_KEYS);
  assert.ok(!vendorBarItems({ role: 'viewer', eventToday: true }).some((i) => i.key === 'shop'), 'a helper got Shop');
});

test('wiring: the layout asks the day for a helper only, fails closed, and hands it to the bar AND the rail', () => {
  const layout = read('layout.tsx');
  assert.match(layout, /const eventToday =\s*vendorProfile\?\.vendor_profile_id && !canManageVendor\(vendorRole\)/, 'the day is read for owners too (they pay a read for nothing) or not gated on the role');
  assert.match(layout, /hasDayToday\(days, phTodayIso\(\)\)\)\s*\.catch\(\(\) => false\)/, 'an unreadable day must hide the helper’s Hub, not show it');
  assert.match(layout, /<VendorBottomNav[\s\S]*?eventToday=\{eventToday\}/, 'the bar is not told the day');
  assert.match(layout, /<VendorRailContext[\s\S]*?eventToday=\{eventToday\}/, 'the rail is not told the day');
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
  assert.match(layout, /<UnreadMessagesBadge[\s\S]*?href=\{customerLandingHref\('messages'\)\}/, 'premise: the envelope lands on Messages');
  return new Set([
    ...vendorBarItems({ role: 'owner' }).map((i) => i.href),
    customerLandingHref('messages'),
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

test('🔑 every route the old More reached is reachable from Today · Customers · Shop · Hub', () => {
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
