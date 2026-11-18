/**
 * 🛡 DISCOVER'S PINNED ROW (walker D2a/D2b/D2c on live f8f278f, 18 Nov 2026; approved 28 Oct, drawn in
 * `user_dashboard_clean_2026-11-17_fable.html`). Red on main: the module, the row and its wiring do not exist there, and
 * the Suppliers heading carries neither "verified only" nor an always-there "See all".
 * SABOTAGE: count a refused shelf as 0 · drop `followingOnly` · gate "See all" on `liveShopCount` again → red.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { stripComments } from '@/lib/strip-comments';
import type { DiscoverEventCard } from '@/lib/discover-events-core';
import {
  DISCOVER_PARTS,
  discoverFollowingHref,
  discoverFollowingOn,
  discoverUpcomingCount,
} from '@/lib/discover-pin';

const WEB = join(import.meta.dirname, '..');
const src = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));
const card = (key: string) => ({ key }) as DiscoverEventCard;
const ok = (...keys: string[]) => ({ status: 'ok' as const, items: keys.map(card) });
const refused = { status: 'unavailable' as const };

test('D2a · "N upcoming" counts the events the shelves read, each once', () => {
  assert.equal(discoverUpcomingCount(ok('a', 'b'), ok('b', 'c', 'd'), false), 4);
  assert.equal(discoverUpcomingCount(ok(), ok(), false), 0, 'a measured nothing is 0');
});

test('D2a · a refused read is "couldn\'t count" (null), never 0', () => {
  assert.equal(discoverUpcomingCount(refused, ok('a'), false), null);
  assert.equal(discoverUpcomingCount(ok('a'), refused, false), null);
  assert.equal(discoverUpcomingCount(null, refused, false), null);
});

test('D2a · with Following on, only the people you follow count — the world shelf cannot make it fail', () => {
  assert.equal(discoverUpcomingCount(ok('a', 'b'), refused, true), 2);
  assert.equal(discoverUpcomingCount(refused, ok('a'), true), null);
  assert.equal(discoverUpcomingCount(null, ok('a'), true), null);
});

test('D2a · the toggle is one parameter, and its press goes the other way', () => {
  assert.equal(discoverFollowingOn({ following: '1' }), true);
  assert.equal(discoverFollowingOn({ following: ['1'] }), true);
  assert.equal(discoverFollowingOn({ following: 'yes' }), false);
  assert.equal(discoverFollowingOn({}), false);
  assert.equal(discoverFollowingHref(false), '/?following=1');
  assert.equal(discoverFollowingHref(true), '/');
});

test('D2a · every part the picker lists is a mark the page draws', () => {
  const page = [
    'app/_components/frontdoor/front-door.tsx',
    'app/_components/frontdoor/front-door-feed.tsx',
    'app/_components/frontdoor/front-door-discover.tsx',
    'app/_components/frontdoor/discover-six-parts.tsx',
  ]
    .map(src)
    .join('\n');
  for (const p of DISCOVER_PARTS) {
    for (const sel of p.selector.split(',')) {
      const m = sel.trim().match(/^\[([\w-]+)(?:="([^"]+)")?\]$/);
      assert.ok(m, `${p.key}: unreadable selector ${sel}`);
      const needle = m[2] ? `${m[1]}="${m[2]}"` : `${m[1]}=""`;
      assert.ok(page.includes(needle), `${p.key}: the page no longer draws ${needle}`);
    }
  }
});

test('D2a · the row is the shared PinnedRow, drawn on the signed-in feed only, from reads already made', () => {
  const row = src('app/_components/frontdoor/discover-pin.tsx');
  assert.match(row, /<PinnedRow\b/);
  assert.match(row, /buttonText: 'Discover'/);
  assert.match(row, /word: 'upcoming'/);
  assert.match(row, /note=\{upcoming === null \? 'Couldn’t count upcoming' : null\}/);
  assert.match(row, /gear=\{<HomeGear \/>\}/);
  const fd = src('app/_components/frontdoor/front-door.tsx');
  assert.match(fd, /hubShell && account\.signedIn && discover \? \(\s*<DiscoverPinnedRow upcoming=\{discoverUpcomingCount\(discover\.people, discover\.world, following\)\}/);
  assert.match(fd, /<DiscoverEventShelves discover=\{discover\} followingOnly=\{following\} \/>/);
  const shelves = src('app/_components/frontdoor/front-door-discover.tsx');
  assert.match(shelves, /\{followingOnly && people \? null : \(\s*<section aria-labelledby="discover-world"/);
});

test('D2b + D2c · Suppliers says "verified only" and always has its "See all" when it shows a shop', () => {
  const feed = src('app/_components/frontdoor/front-door-feed.tsx');
  const head = feed.slice(feed.indexOf('data-discover-part="suppliers"'), feed.indexOf('</h2>', feed.indexOf('data-discover-part="suppliers"')));
  assert.match(head, /<span className="fd-meta" data-discover-verified-only="">verified only<\/span>/);
  assert.match(head, /\{shops\.length > 0 \? \(\s*<Link href="\/\?browse=1"[^>]*data-discover-see-all="">\s*See all →/);
  assert.doesNotMatch(head, /liveShopCount/, '"See all" hides again whenever every open shop fits on the shelf');
});
