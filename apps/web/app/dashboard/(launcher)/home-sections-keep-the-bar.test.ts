/**
 * home-sections-keep-the-bar.test.ts — 🚫🔄 BARS NEVER RELOAD ON HOME (owner 17 Nov 2026: *"navigation bars should
 * not load with the screen. we don't want the full screen refresh everytime"*; DECISION_LOG 17 Nov "Every dashboard
 * build ships at its best speed").
 *
 * Since the tab row went (owner 17 Nov, "Yes, all 3"), Home's sections are switched from ONE place — the pinned row's
 * "Events ▾" picker (and its doors). This holds the chain that keeps the bar, the rail and the top bar on screen,
 * the SAME DOM nodes, while only the section swaps:
 *
 *   1 · every section is an address on `/dashboard` itself (`?seg=…`) — the SAME route, so App Router keeps every
 *       layout above it mounted, and the account bar is one of the layout's children;
 *   2 · the bar, the rail and the top bar are drawn by `(launcher)/layout.tsx` — never by the page or by Home's own
 *       pieces, which are swapped on every switch;
 *   3 · the switch is CLIENT navigation (`router.push` / `<Link>`), never `window.location`, a plain `<a href>` or a
 *       whole-page `router.refresh()`.
 *
 * 🔑 A PROPERTY OF THE ROUTER, HELD AT ITS INPUTS. App Router preserves a layout's DOM across a navigation that stays
 * under it; that is the mechanism, and these three are the only ways a Home change could step outside it.
 * ⚠ NOT HELD HERE, AND NOT TRUE TODAY: Home → Discover. `/` (`app/page.tsx`) and `/dashboard` share no layout below
 * the root, so that tap mounts a new bar (the view-transition slide hides it). Moving the two under one layout is a
 * structural change outside a reposition build — raised to the owner in the PR, not papered over here.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { stripComments } from '@/lib/strip-comments';
import { HOME_SEG_ORDER, homeSegHref } from '@/lib/home-segments';

const HERE = dirname(fileURLToPath(import.meta.url));
const WEB = join(HERE, '..', '..', '..');
const src = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));

const HOME_PIECES = [
  'app/dashboard/(launcher)/_components/home-profile.tsx',
  'app/dashboard/(launcher)/_components/home-pin.tsx',
  'app/dashboard/(launcher)/_components/home-segment-bar.tsx',
  'app/dashboard/(account)/library/_components/memories-thumb.tsx',
];

test('1 · every section of Home is an address on /dashboard itself — the same route, the same layout', () => {
  for (const seg of HOME_SEG_ORDER) {
    const href = homeSegHref(seg);
    const u = new URL(href, 'https://setnayan.com');
    assert.equal(u.pathname, '/dashboard', `${seg} opens ${href} — a different route, so the layout and its bar remount`);
  }
});

test('2 · the bar, the rail and the top bar are the layout\'s — Home\'s page and pieces draw none of them', () => {
  const layout = src('app/dashboard/(launcher)/layout.tsx');
  assert.match(layout, /<AccountBarSlot\b/, 'the account bar left the layout');
  assert.match(layout, /<AppRailShell\b/, 'the rail and the top bar left the layout');
  for (const rel of ['app/dashboard/(launcher)/page.tsx', ...HOME_PIECES]) {
    const code = src(rel);
    assert.ok(
      !/<AccountBarSlot\b|<AccountBottomNav\b|<AppRailShell\b|<BottomDock\b|<BottomNav\b/.test(code),
      `${rel} draws a bar of its own — it is swapped on every section switch, so that bar would remount`,
    );
  }
});

test('3 · a section switch is client navigation — no window.location, no plain <a href>, no whole-page refresh', () => {
  const pin = src('app/dashboard/(launcher)/_components/home-pin.tsx');
  assert.match(pin, /const router = useRouter\(\);/, 'the pinned row no longer navigates with the router');
  assert.match(pin, /router\.push\(href, \{ scroll: false \}\);/, 'the pinned row\'s picker and doors no longer push on the client');
  for (const rel of HOME_PIECES) {
    const code = src(rel);
    assert.ok(!/window\.location(?:\.href)?\s*=|location\.assign\(|location\.replace\(/.test(code), `${rel} sets window.location — a full reload`);
    assert.ok(!/<a\s[^>]*href=/.test(code), `${rel} draws a plain <a href> — a full reload (use <Link>)`);
    assert.ok(!/router\.refresh\(\)/.test(code), `${rel} refreshes the whole page`);
  }
});
