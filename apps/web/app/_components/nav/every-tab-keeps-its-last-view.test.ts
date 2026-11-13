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
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripComments } from '@/lib/strip-comments';
import {
  TAB_RESTORE_KEY,
  forgetTabView,
  markTabRestore,
  readTabView,
  reselectInPlace,
  saveTabView,
  tabDoor,
  tabScope,
  takeTabRestore,
} from './tab-memory';

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
  const acct = tabScope(['home', 'discover']);
  // On Home › People, scrolled; then tap Discover.
  saveTabView(s, acct, 'home', { href: '/dashboard?seg=people', y: 812.4 });
  assert.equal(tabDoor(s, acct, 'home', '/dashboard?hub=1'), '/dashboard?seg=people', 'Home does not open the section you left');
  assert.equal(tabDoor(s, acct, 'discover', '/'), '/', 'a tab never visited opens its own address');
  // Tap Home from Discover: the scroll comes back once Home is drawn, once.
  markTabRestore(s, acct, 'home');
  assert.equal(takeTabRestore(s, acct, 'home', '/dashboard?seg=people'), 812, 'Home did not come back to the place you were');
  assert.equal(s.getItem(TAB_RESTORE_KEY), null, 'the restore mark was not consumed');
  assert.equal(takeTabRestore(s, acct, 'home', '/dashboard?seg=people'), null, 'a second draw scrolled again');
  // Landing somewhere else (a redirect) is not "your last view".
  markTabRestore(s, acct, 'home');
  assert.equal(takeTabRestore(s, acct, 'home', '/dashboard?seg=people&person=S89U-ABCDEFGHJK'), null);
  // Supplier bar: Clients keeps its own place, apart from the account bar's.
  const sup = tabScope(['today', 'customers', 'shop', 'hub']);
  saveTabView(s, sup, 'customers', { href: '/vendor-dashboard/customers?view=calendar', y: 240 });
  assert.equal(tabDoor(s, sup, 'customers', '/vendor-dashboard/customers'), '/vendor-dashboard/customers?view=calendar');
  assert.equal(readTabView(s, acct, 'customers'), null, 'one bar answered for another');
  // A stored address that is not this app's own path is never followed.
  s.setItem(`sn-tab-view:${sup}:shop`, JSON.stringify({ href: '//evil.example', y: 1 }));
  assert.equal(tabDoor(s, sup, 'shop', '/vendor-dashboard/shop'), '/vendor-dashboard/shop');
});

test('2 · the tab you are on: its top, in one tap — and the kept view is forgotten', () => {
  const s = memStore();
  const ev = tabScope(['home', 'guests', 'studio', 'chat']);
  saveTabView(s, ev, 'guests', { href: '/dashboard/E/guests?view=table', y: 900 });
  forgetTabView(s, ev, 'guests');
  assert.equal(tabDoor(s, ev, 'guests', '/dashboard/E/guests'), '/dashboard/E/guests', 'a re-tap left the old view to come back to');
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
  assert.match(hook, /takeTabRestore\(s, scope, activeKey, here\)/, 'a tapped tab\'s scroll is no longer put back');
  assert.match(hook, /forgetTabView\(window\.sessionStorage, scope, it\.key\);[\s\S]*?dispatchTabReselect[\s\S]*?reselectInPlace\(/, 're-tap: forget, ask the page, else top/first screen');
  // Every storage touch guarded — a private window must never break a bar.
  const touches = hook.match(/window\.sessionStorage/g)?.length ?? 0;
  const tries = hook.match(/\btry \{/g)?.length ?? 0;
  assert.ok(touches > 0 && tries >= 4, `${touches} storage touches, ${tries} try blocks`);
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
