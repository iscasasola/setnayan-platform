/**
 * every-tab-keeps-its-last-view.test.ts — 🔁 EVERY BOTTOM-BAR TAB: ANOTHER TAB = ITS LAST VIEW; THE TAB YOU ARE ON =
 * ITS TOP, IN ONE TAP (owner 9 Nov 2026, DECISION_LOG row 44a4c660 — "tapping home returns you to your last view on
 * home" — widened 13 Nov: "this should apply to any menu").
 *
 *   1 · the rules (`tab-memory.ts`), run over a plain map: a tab's last address AND scroll come back; a deep link or a
 *       redirect is not "your last view"; a re-tap forgets the kept view; bars never answer for each other.
 *   2 · ONE mechanism: the shared `BottomNav` wires it, and every bar (account · event · supplier · admin) draws that
 *       bar — no bar keeps a memory of its own beside it.
 *   3 · the re-tap: the page answers first, else the bar scrolls up in place (already on the first screen) or opens the
 *       first screen. Home keeps its own answer (the top of the section you are in).
 *   4 · 👆👆 THE ONE DOUBLE TAP (owner 13 Nov 2026): already on Home, the first tap = the top at once, a second within
 *       TWIN_TAP_MS = your shop's Today at its last view; mirrored from Today to Home. No shop = no switch; a tab you
 *       are not on = no switch; no other tab carries a twin.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripComments } from '@/lib/strip-comments';
import {
  TAB_RESTORE_KEY,
  TWIN_TAP_MS,
  forgetTabView,
  isTwinTap,
  markTabRestore,
  reselectInPlace,
  saveTabView,
  tabDoor,
  takeTabRestore,
} from './tab-memory';
import { accountBarItems } from '@/app/dashboard/(launcher)/_components/account-bottom-nav';
import { vendorBarItems } from '@/app/vendor-dashboard/_components/vendor-bottom-nav';
import { HOME_HREF } from '@/lib/home-segments';

const WEB = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const src = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));

function memStore() {
  const m = new Map<string, string>();
  return {
    getItem: (k: string) => (m.has(k) ? m.get(k)! : null),
    setItem: (k: string, v: string) => void m.set(k, v),
    removeItem: (k: string) => void m.delete(k),
  };
}

test('1 · another tab opens its last view — the address AND the scroll', () => {
  const s = memStore();
  // On Home › People, scrolled; then tap Discover.
  saveTabView(s, HOME_HREF, { href: '/dashboard?seg=people', y: 812.4 });
  assert.equal(tabDoor(s, HOME_HREF), '/dashboard?seg=people', 'Home does not open the section you left');
  assert.equal(tabDoor(s, '/'), '/', 'a tab never visited opens its own address');
  // Tap Home from Discover: the scroll comes back once Home is drawn, once.
  markTabRestore(s, HOME_HREF);
  assert.equal(takeTabRestore(s, HOME_HREF, '/dashboard?seg=people'), 812, 'Home did not come back to the place you were');
  assert.equal(s.getItem(TAB_RESTORE_KEY), null, 'the restore mark was not consumed');
  assert.equal(takeTabRestore(s, HOME_HREF, '/dashboard?seg=people'), null, 'a second draw scrolled again');
  // Landing somewhere else (a redirect), or on another tab, is not "your last view".
  markTabRestore(s, HOME_HREF);
  assert.equal(takeTabRestore(s, HOME_HREF, '/dashboard?seg=people&person=S89U-ABCDEFGHJK'), null);
  markTabRestore(s, HOME_HREF);
  assert.equal(takeTabRestore(s, '/', '/dashboard?seg=people'), null);
  // Supplier bar: Clients keeps its own place.
  saveTabView(s, '/vendor-dashboard/customers', { href: '/vendor-dashboard/customers?view=calendar', y: 240 });
  assert.equal(tabDoor(s, '/vendor-dashboard/customers'), '/vendor-dashboard/customers?view=calendar');
  // A stored address that is not this app's own path is never followed.
  s.setItem('sn-tab-view:/vendor-dashboard/shop', JSON.stringify({ href: '//evil.example', y: 1 }));
  assert.equal(tabDoor(s, '/vendor-dashboard/shop'), '/vendor-dashboard/shop');
});

test('2 · the tab you are on: its top, in one tap — and the kept view is forgotten', () => {
  const s = memStore();
  saveTabView(s, '/dashboard/E/guests', { href: '/dashboard/E/guests?view=table', y: 900 });
  forgetTabView(s, '/dashboard/E/guests');
  assert.equal(tabDoor(s, '/dashboard/E/guests'), '/dashboard/E/guests', 'a re-tap left the old view to come back to');
  assert.equal(reselectInPlace('/dashboard/E/guests', '/dashboard/E/guests'), true, 'on the first screen the bar must scroll in place');
  assert.equal(reselectInPlace('/dashboard/E/guests?view=table', '/dashboard/E/guests'), false, 'deeper in, the bar must open the first screen');
});

test('3 · ONE mechanism: the shared bar wires it, every bar draws the shared bar, no bar keeps its own', () => {
  const nav = src('app/_components/nav/bottom-nav.tsx');
  assert.match(nav, /const memory = useTabMemory\(items, /, 'the shared bar no longer keeps tab memory');
  assert.match(nav, /door=\{memory\.door\(item\)\}/);
  assert.match(nav, /href=\{door\}/, 'a tab no longer opens its last view');
  assert.match(nav, /if \(active\) onReselect\(e\);\s*else onGo\(\);/, 'a tap no longer splits into re-tap (top) and go (last view)');
  const hook = nav.slice(nav.indexOf('function useTabMemory('), nav.indexOf('function BottomNavTab('));
  assert.match(hook, /addEventListener\('scroll', onScroll/, 'the scroll is no longer kept');
  assert.match(hook, /takeTabRestore\(s, activeTab, at\)/, 'an opened tab\'s scroll is no longer put back');
  assert.match(hook, /forgetTabView\(window\.sessionStorage, it\.href\);[\s\S]*?dispatchTabReselect[\s\S]*?reselectInPlace\(/, 're-tap: forget, ask the page, else top/first screen');
  // Every storage touch guarded — a private window must never break a bar.
  const tries = hook.match(/\btry \{/g)?.length ?? 0;
  assert.ok(tries >= 5, `${tries} try blocks around the bar's storage`);
  for (const bar of [
    'app/dashboard/(launcher)/_components/account-bottom-nav.tsx',
    'app/dashboard/[eventId]/_components/customer-bottom-nav.tsx',
    'app/vendor-dashboard/_components/vendor-bottom-nav.tsx',
    'app/admin/_components/admin-bottom-nav.tsx',
  ]) {
    const code = src(bar);
    assert.match(code, /<BottomNav items=\{/, `${bar} no longer draws the shared bar`);
    assert.ok(!/sessionStorage|scrollTo\(/.test(code), `${bar} keeps a tab memory of its own beside the shared one`);
  }
  // Home keeps its own re-tap answer (the top of the section you are in) — and no second memory of the section.
  const home = src('app/dashboard/(launcher)/_components/home-segment-bar.tsx');
  assert.match(home, /useTabReselect\(\s*'home',\s*useCallback\(\(\) => \{\s*toTop\(\);\s*return true;/);
  assert.ok(!/setItem\(HOME_LAST_SEG_KEY,/.test(home), 'Home keeps a second memory of the section beside the bar\'s');
});

test('4 · the one double tap: Home ⇄ your shop, only on the tab you are on, only with a shop', () => {
  const t0 = 1_000_000;
  // First tap on Home (already on Home): no previous re-tap → the top, at once (never a switch, never a wait).
  assert.equal(isTwinTap(null, HOME_HREF, '/vendor-dashboard', t0), false, 'the first tap switched instead of going to the top');
  // Second tap within the window → the switch.
  const first = { tab: HOME_HREF, at: t0 };
  assert.equal(isTwinTap(first, HOME_HREF, '/vendor-dashboard', t0 + 180), true, 'a quick second tap did not open the shop');
  assert.equal(isTwinTap(first, HOME_HREF, '/vendor-dashboard', t0 + TWIN_TAP_MS + 1), false, 'a slow second tap switched');
  // No shop → no twin → just the top.
  assert.equal(isTwinTap(first, HOME_HREF, undefined, t0 + 100), false, 'no shop, yet the double tap switched');
  // The previous re-tap was on ANOTHER tab (a tab you were not on just became the one you are on): no switch.
  assert.equal(isTwinTap({ tab: '/', at: t0 }, HOME_HREF, '/vendor-dashboard', t0 + 100), false);
  // The twins: Home → shop only with a shop; Today → Home; nobody else.
  const home = accountBarItems(['home', 'discover'], { hasShop: true });
  assert.equal(home.find((i) => i.key === 'home')?.twin, '/vendor-dashboard');
  assert.equal(home.find((i) => i.key === 'discover')?.twin, undefined);
  assert.equal(accountBarItems(['home', 'discover']).find((i) => i.key === 'home')?.twin, undefined, 'no shop, yet Home carries a twin');
  const sup = vendorBarItems({ role: 'owner' });
  assert.equal(sup.find((i) => i.key === 'profile')?.twin, HOME_HREF, 'Today no longer double-taps back to Home');
  assert.deepEqual(sup.filter((i) => i.twin).map((i) => i.key), ['profile'], 'another supplier tab grew a double tap');
  // The twin opens its LAST view and puts its scroll back; it is reached only from a re-tap on the tab you are on.
  const nav = src('app/_components/nav/bottom-nav.tsx');
  const hook = nav.slice(nav.indexOf('function useTabMemory('), nav.indexOf('function BottomNavTab('));
  assert.match(hook, /reselect: \(it: BottomNavItem, e: ReactMouseEvent\) => \{[\s\S]*?isTwinTap\(lastRetap\.current, it\.href, it\.twin, now\)/);
  assert.match(hook, /to = tabDoor\(s, it\.twin\);\s*markTabRestore\(s, it\.twin\);[\s\S]*?router\.push\(to\)/, 'the twin does not open at its last view');
  assert.match(hook, /go: \(it: BottomNavItem\) => \{\s*lastRetap\.current = null;/, 'a tap on another tab can become half of a double tap');
  // Accessible: the tab stays a real link (`href={door}`) whose single tap is the whole behaviour; the double tap is a shortcut.
});
