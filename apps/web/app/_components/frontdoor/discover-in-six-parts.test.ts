/**
 * discover-in-six-parts.test.ts — DISCOVER IN SIX PARTS (owner 16 Nov; DECISION_LOG "Discover in six parts",
 * rulings 41057aae · 45fd9c21 · 448fd3c1 · a85b0260; drawing `prototypes/discover_six_parts_2026-11-16/`).
 *
 * One claim per test, each sabotaged once and the occurrence counted before → after (see the PR body):
 *   1 · signed out, `/` is the front door only — a search, the supplier view or a See-all view sends the visitor to
 *       sign in and back to the same address; a bare `/` does not.
 *   2 · the six parts sit in the owner's order, after the viewer's own events and the upcoming shelves.
 *   3 · the See-all doors open on `/` on keys the supplier view does not read.
 *   4 · Discover is verified-only — the shop gate, the service cards and the supplier view — and its Filters no
 *       longer offers a "Verified only" switch that would be a lie.
 *   5 · Inspiration shows only what a verified shop already shows, fails closed on the listing gate, and never
 *       selects a name or the event it came from.
 *   6 · "Save to Mood Board" is a link, drawn only where it can land.
 *   7 · each shelf says in one line when it is empty or could not load.
 *   8 · zero new server actions.
 *
 * Comments are stripped through the real lexer (`lib/strip-comments.ts`) so a docblock that NAMES a rule can never
 * satisfy it.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import * as React from 'react';
import { stripComments } from '@/lib/strip-comments';
import {
  discoverViewOf,
  INSPIRATION_SEE_ALL_HREF,
  SERVICE_CARDS_SEE_ALL_HREF,
  signedOutRedirect,
  STORIES_SEE_ALL_HREF,
} from '@/lib/discover-six-parts';
import { DISCOVER_SHOP_GATE, LIVE_SHOP_GATE } from '@/lib/live-shops';
import { DISCOVER_SUPPLIER_PARAM_KEYS } from '@/lib/discover-suppliers';

// The components compile with the classic JSX runtime under tsx — the house idiom (an-empty-shelf-is-one-line).
(globalThis as unknown as { React: unknown }).React = React;

const WEB = join(import.meta.dirname, '..', '..', '..');
const raw = (rel: string) => readFileSync(join(WEB, rel), 'utf8');
const src = (rel: string) => stripComments(raw(rel));

const DOOR = src('app/_components/frontdoor/front-door.tsx');
const SHELVES = src('app/_components/frontdoor/discover-six-parts.tsx');
const DATA = src('app/_components/frontdoor/discover-six-parts-data.ts');
const VIEW = src('app/(shell)/explore/_lib/marketplace-view.tsx');
const DRAWER = src('app/(shell)/explore/_components/filter-drawer.tsx');

// ── 1 · SIGNED OUT ────────────────────────────────────────────────────────────

test('1 · signed out, only a bare `/` draws the front door; every other ask goes to sign in and back', () => {
  assert.equal(signedOutRedirect({}), null, 'a bare `/` must draw the promotional front door');
  assert.equal(signedOutRedirect({ q: '   ' }), null, 'an empty search is not a search');
  for (const [name, params] of [
    ['a search', { q: 'florist' }],
    ['the supplier view', { browse: '1' }],
    ['Event stories, See all', { stories: '1' }],
    ['Inspiration, See all', { inspiration: '1', part: 'bouquet' }],
  ] as const) {
    const to = signedOutRedirect(params);
    assert.ok(to, `${name} drew the feed for a stranger instead of asking them to sign in`);
    const next = new URL(to!, 'https://x.test').searchParams.get('next') ?? '';
    for (const [k, v] of Object.entries(params)) {
      assert.ok(next.includes(`${k}=${encodeURIComponent(v).replace(/%20/g, '+')}`) || next.includes(`${k}=${v}`),
        `${name}: sign-in does not come back to the same address (next=${next})`);
    }
  }
  // …and the door actually asks it, for signed-out visitors only.
  assert.match(DOOR, /if \(!account\.signedIn\) \{\s*const to = signedOutRedirect\(/, 'the front door stopped asking');
  assert.match(DOOR, /if \(to\) redirect\(to\);/, 'the front door asks and then draws the feed anyway');
});

// ── 2 · THE ORDER ─────────────────────────────────────────────────────────────

test('2 · the six parts sit in the owner\'s order, after the viewer\'s events', () => {
  const order = [
    '<DiscoverEventShelves',
    '<PeopleToFollowShelf',
    'afterShops=',
    '<ServiceCardsShelf',
    '<EventStoriesShelf',
    '<ArticlesShelf',
    '<InspirationShelf',
  ];
  const at = order.map((tag) => DOOR.indexOf(tag));
  at.forEach((i, n) => assert.notEqual(i, -1, `${order[n]} is gone from Discover`));
  for (let n = 1; n < at.length; n += 1) {
    assert.ok(at[n]! > at[n - 1]!, `${order[n]} now comes before ${order[n - 1]}`);
  }
  // Suppliers (part 2) is the feed's own block, between the two slots.
  const FEED = src('app/_components/frontdoor/front-door-feed.tsx');
  const before = FEED.indexOf('{beforeShops}');
  const suppliers = FEED.indexOf('<span>Suppliers</span>');
  const after = FEED.indexOf('{afterShops}');
  assert.ok(before !== -1 && suppliers > before && after > suppliers, 'Suppliers is no longer part 2');
  // Retired: New uploads and Trending.
  assert.ok(!/New uploads|Trending/.test(FEED), 'a retired shelf came back');
});

// ── 3 · SEE ALL ──────────────────────────────────────────────────────────────

test('3 · the See-all doors open on `/`, on keys the supplier view never reads', () => {
  assert.equal(STORIES_SEE_ALL_HREF, '/?stories=1');
  assert.equal(INSPIRATION_SEE_ALL_HREF, '/?inspiration=1');
  assert.equal(SERVICE_CARDS_SEE_ALL_HREF, '/?browse=1');
  for (const k of ['stories', 'inspiration', 'occasion', 'order', 'part']) {
    assert.ok(!(DISCOVER_SUPPLIER_PARAM_KEYS as readonly string[]).includes(k), `the supplier view reads "${k}" too`);
  }
  assert.deepEqual(discoverViewOf({}), { kind: 'feed' });
  assert.deepEqual(discoverViewOf({ stories: '1', occasion: 'debut', order: 'most_read' }), {
    kind: 'stories', occasion: 'debut', order: 'newest',
  }, 'an unknown sort must fall back to Newest — Most read waits on a read count');
  assert.deepEqual(discoverViewOf({ inspiration: '1', part: '' }), { kind: 'inspiration', part: null });
  for (const name of ['STORIES_SEE_ALL_HREF', 'INSPIRATION_SEE_ALL_HREF', 'SERVICE_CARDS_SEE_ALL_HREF']) {
    assert.match(SHELVES, new RegExp(`href=\\{${name}\\}`), `the ${name} door is gone from its shelf`);
  }
});

// ── 4 · VERIFIED ONLY ─────────────────────────────────────────────────────────

test('4 · Discover is verified-only everywhere it lists a shop', () => {
  for (const [k, v] of Object.entries(LIVE_SHOP_GATE)) {
    assert.equal((DISCOVER_SHOP_GATE as Record<string, unknown>)[k], v, `Discover's gate dropped ${k}`);
  }
  assert.equal(DISCOVER_SHOP_GATE.verification_state, 'verified');
  assert.match(DATA, /fetchMarketplaceServiceCards\(admin, \{ limit, verifiedOnly: true \}\)/, 'service cards: not verified-only');
  assert.match(DATA, /\.match\(gate\)/, 'inspiration: the shop gate is not applied');
  assert.match(DATA, /DISCOVER_SHOP_GATE\)\.map\(\(\[k, v\]\) => \[`shop\.\$\{k\}`, v\]\)/, 'inspiration: not Discover\'s gate');
  assert.match(VIEW, /verifiedOnly: surface === 'discover'/, 'the supplier view\'s cards are not verified-only on Discover');
  assert.match(VIEW, /if \(filters\.verifiedOnly \|\| surface === 'discover'\)/, 'the supplier view\'s shops are not verified-only on Discover');
});

test('4b · Discover\'s Filters no longer offers "Verified only" — it is always on there', () => {
  assert.match(DRAWER, /verifiedToggle = true/, 'the switch must stay on /explore, where it is a real choice');
  assert.match(DRAWER, /\{verifiedToggle \? \(/, 'the switch is drawn unconditionally');
  const offs = (VIEW + DOOR).match(/verifiedToggle: false/g) ?? [];
  assert.equal(offs.length, 2, `expected both Discover drawers to hide the switch, found ${offs.length}`);
});

// ── 5 · INSPIRATION ───────────────────────────────────────────────────────────

test('5 · Inspiration shows what a verified shop already shows — never a name, never the event', () => {
  const select = DATA.match(/\.select\('([^']+)'\)/)?.[1] ?? '';
  assert.ok(select.includes('asset_id'), 'could not read the inspiration select');
  for (const banned of ['source_event_id', 'source_suggestion_id', 'guest', 'couple', 'owner_name']) {
    assert.ok(!select.includes(banned), `the inspiration read selects ${banned}`);
  }
  for (const pred of [".eq('asset_type', 'supplier_gallery')", ".not('approved_at', 'is', null)", ".is('retired_at', null)", ".is('rejected_at', null)"]) {
    assert.ok(DATA.includes(pred), `the inspiration read lost ${pred}`);
  }
  // 🛑 fail closed: no listing answer drops every Files tag.
  assert.match(DATA, /keep \? keep\(r\) : !r\.event_file_id/, 'the listing gate fails OPEN');
  assert.match(DATA, /readTagEventLines\(/, 'the type · venue · month line no longer comes from the shared reader');
});

// ── 6 · SAVE IS A LINK ───────────────────────────────────────────────────────

test('6 · "Save to Mood Board" lands only where it can', async () => {
  const { moodBoardSaveHref } = await import('./discover-six-parts');
  assert.equal(moodBoardSaveHref({ eventId: 'S89E-ABC', count: 1 }), '/dashboard/S89E-ABC/studio/mood-board');
  assert.equal(moodBoardSaveHref({ eventId: null, count: 3 }), '/dashboard');
  assert.equal(moodBoardSaveHref({ eventId: null, count: 0 }), null, 'Discover never creates an event to save into');
  assert.match(SHELVES, /\{saveHref \? \(\s*<Link href=\{saveHref\}/, 'Save is drawn without a place to land');
});

// ── 7 · ONE LINE WHEN EMPTY ───────────────────────────────────────────────────

test('7 · every new shelf says, in one line, that it is empty or could not load', async () => {
  const { renderToStaticMarkup } = await import('react-dom/server');
  const m = await import('./discover-six-parts');
  const html = (el: React.ReactElement) => renderToStaticMarkup(el);
  const cases: Array<[string, string, RegExp]> = [
    ['service cards, unavailable', html(React.createElement(m.ServiceCardsShelf, { shelf: { status: 'unavailable' } })), /couldn’t load/],
    ['service cards, empty', html(React.createElement(m.ServiceCardsShelf, { shelf: { status: 'ok', items: [] } })), /No verified supplier/],
    ['stories, unavailable', html(React.createElement(m.EventStoriesShelf, { stories: null })), /couldn’t load/],
    ['stories, empty', html(React.createElement(m.EventStoriesShelf, { stories: [] })), /first event stories/],
    ['articles', html(React.createElement(m.ArticlesShelf)), /Articles are coming soon/],
    ['inspiration, unavailable', html(React.createElement(m.InspirationShelf, { shelf: { status: 'unavailable' }, saveHref: null })), /couldn’t load/],
    ['inspiration, empty', html(React.createElement(m.InspirationShelf, { shelf: { status: 'ok', items: [] }, saveHref: null })), /verified suppliers/],
  ];
  for (const [name, out, line] of cases) {
    assert.match(out, line, `${name}: no one-line message`);
    assert.ok(!/data-discover-see-all/.test(out), `${name}: a See-all door opens onto nothing`);
  }
});

// ── 8 · NO SERVER ACTIONS ─────────────────────────────────────────────────────

test('8 · zero new server actions', () => {
  for (const rel of [
    'app/_components/frontdoor/discover-six-parts.tsx',
    'app/_components/frontdoor/discover-six-parts-data.ts',
    'lib/discover-six-parts.ts',
    'lib/marketplace-service-card-faces.ts',
  ]) {
    assert.ok(!/['"]use server['"]/.test(raw(rel)), `${rel} declares a server action`);
  }
});
