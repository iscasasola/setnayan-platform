/**
 * 🔁 EVERY BOTTOM MENU REMEMBERS WHERE YOU LEFT IT (owner 2026-11-13, a universal rule across the whole app):
 * *"tapping a menu when you are at a different menu will jump to your page's last state while pressing it when you are
 * at that menu will jump to the top."* The rule (`lib/tab-memory.ts`) and that every bottom bar goes through it.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  TAB_MEMORY_PREFIX,
  createPaneMemory,
  isTabFirstState,
  parseTabState,
  recallTab,
  rememberTab,
  requestRestore,
  tabHref,
  tabRoot,
  takeRestore,
} from './tab-memory';
import { stripComments } from './strip-comments';

function fakeStore() {
  const m = new Map<string, string>();
  return {
    getItem: (k: string) => m.get(k) ?? null,
    setItem: (k: string, v: string) => void m.set(k, v),
    removeItem: (k: string) => void m.delete(k),
    m,
  };
}
const throwing = {
  getItem: () => {
    throw new Error('blocked');
  },
  setItem: () => {
    throw new Error('blocked');
  },
  removeItem: () => {
    throw new Error('blocked');
  },
};

const guests = { href: '/dashboard/e1/guests' };
const underGuests = (p: string) => p === '/dashboard/e1/guests' || p.startsWith('/dashboard/e1/guests/');

test('another tab → its LAST state: the page you left it on', () => {
  const s = fakeStore();
  rememberTab(guests.href, { path: '/dashboard/e1/guests/abc?view=seat', y: 640 }, s);
  const r = recallTab(guests.href, s);
  assert.deepEqual(r, { path: '/dashboard/e1/guests/abc?view=seat', y: 640 });
  assert.equal(tabHref(guests, false, r, underGuests), '/dashboard/e1/guests/abc?view=seat');
});

test('the tab you are on → its FIRST state: always its own page', () => {
  const r = { path: '/dashboard/e1/guests/abc', y: 640 };
  assert.equal(tabHref(guests, true, r, underGuests), guests.href);
  // Already on its own page → no navigation, scroll to the top. Under it (or another query) → go to its own page.
  assert.equal(isTabFirstState('/dashboard/e1/guests', guests), true);
  assert.equal(isTabFirstState('/dashboard/e1/guests/abc', guests), false);
  assert.equal(isTabFirstState('/dashboard/e1/guests?view=seat', guests), false);
});

test('nothing remembered, or a memory that no longer belongs to the tab → the tab\'s own page', () => {
  assert.equal(tabHref(guests, false, null, underGuests), guests.href);
  assert.equal(tabHref(guests, false, { path: '/dashboard/e2/guests', y: 0 }, underGuests), guests.href);
});

test('each tab is its own memory — two events\' Guests are two tabs; a query does not split one', () => {
  const s = fakeStore();
  rememberTab('/dashboard/e1/guests', { path: '/dashboard/e1/guests/a', y: 1 }, s);
  rememberTab('/dashboard/e2/guests', { path: '/dashboard/e2/guests/b', y: 2 }, s);
  assert.equal(recallTab('/dashboard/e1/guests', s)?.path, '/dashboard/e1/guests/a');
  assert.equal(recallTab('/dashboard/e2/guests', s)?.path, '/dashboard/e2/guests/b');
  assert.equal(tabRoot('/dashboard/e1/vendors?tab=build'), '/dashboard/e1/vendors');
  assert.equal(recallTab('/dashboard/e1/guests?x=1', s)?.path, '/dashboard/e1/guests/a');
  assert.ok([...s.m.keys()].every((k) => k.startsWith(TAB_MEMORY_PREFIX)));
});

test('the scroll comes back once, and only on the page it was asked for', () => {
  const s = fakeStore();
  requestRestore({ path: '/vendor-dashboard/customers?c=9', y: 820 }, s);
  assert.equal(takeRestore('/vendor-dashboard/shop', s), null, 'a different page does not take it');
  assert.equal(takeRestore('/vendor-dashboard/customers?c=9', s), 820);
  assert.equal(takeRestore('/vendor-dashboard/customers?c=9', s), null, 'once');
  requestRestore({ path: '/admin', y: 0 }, s);
  assert.equal(s.m.size, 0, 'a page left at its top asks nothing back');
});

test('blocked or garbage storage never breaks a tab — it just opens on its own page', () => {
  assert.doesNotThrow(() => rememberTab(guests.href, { path: '/x', y: 1 }, throwing));
  assert.equal(recallTab(guests.href, throwing), null);
  assert.equal(takeRestore('/x', throwing), null);
  assert.equal(recallTab(guests.href, null), null);
  assert.equal(parseTabState('not json'), null);
  assert.equal(parseTabState(JSON.stringify({ path: '//evil.example/x', y: 1 })), null, 'never another site');
  assert.equal(parseTabState(JSON.stringify({ path: 'https://evil.example', y: 1 })), null);
  assert.deepEqual(parseTabState(JSON.stringify({ path: '/a', y: -5 })), { path: '/a', y: 0 });
});

test('a bar that switches panes: another pane comes back where you left it, the one you are on goes to the top', () => {
  const p = createPaneMemory();
  assert.deepEqual(p.switchPane('/ana-ben', 'home', 'schedule', 900), { y: 0 }, 'first visit opens at the top');
  assert.deepEqual(p.switchPane('/ana-ben', 'schedule', 'home', 300), { y: 900 }, 'home comes back at 900');
  assert.deepEqual(p.switchPane('/ana-ben', 'home', 'schedule', 50), { y: 300 });
  assert.equal(p.switchPane('/ana-ben', 'schedule', 'schedule', 300), 'top');
  assert.deepEqual(p.switchPane('/cara-dan', 'schedule', 'home', 0), { y: 0 }, 'another event is another page');
});

// ── every bottom bar goes through the rule ───────────────────────────────────────────────────────────────────────
const NAV = stripComments(readFileSync(join(__dirname, '../app/_components/nav/bottom-nav.tsx'), 'utf8'));
const HUB = stripComments(readFileSync(join(__dirname, '../app/[slug]/_components/hub/hub-shell.tsx'), 'utf8'));

test('the shared bar (couple · supplier · admin · account) — every tab cell carries the remembered href', () => {
  const tab = NAV.slice(NAV.indexOf('function BottomNavTab('));
  assert.match(tab, /const href = tabHref\(item, active, remembered, \(path\) => bottomNavItemMatches\(path, item\)\);/);
  assert.match(tab, /<Link\s+href=\{href\}/, 'the Link uses the rule\'s href, not the bare item.href');
  // Re-tap: a page's own handler first (Clients, Home), else first state → top.
  assert.match(tab, /else if \(active\) \{\s*if \(isTabFirstState\(window\.location\.pathname \+ window\.location\.search, item\)\) \{\s*e\.preventDefault\(\);\s*scrollToTop\(\);/);
  assert.match(tab, /else if \(remembered && href === remembered\.path\) requestRestore\(remembered\);/);
  assert.match(NAV, /const memory = useTabMemory\(items, pathname, isActive\);/);
  assert.match(NAV, /remembered=\{memory\[tabRoot\(item\.href\)\] \?\? null\}/);
});

test('the event site\'s bars — both frames switch panes through the rule, never a bare jump to the top', () => {
  assert.match(HUB, /landPane\(active, key, \(\) => go\(key, 'push'\)\);/, 'the stage frame');
  assert.match(HUB, /landPane\(activeRef\.current, tab, \(\) => \{\s*showTab\(tab\);\s*go\(tab, 'push'\);/, 'the page frame');
  assert.doesNotMatch(HUB, /if \(tab !== activeRef\.current\) \{\s*showTab\(tab\);/, 'the old always-to-the-top tap is gone');
});
