/**
 * the-discover-card-wears-the-cover.test.ts — 🖼 A DISCOVER EVENT CARD WEARS
 * THE EVENT'S LOOK, NOT ONLY ITS MONOGRAM.
 *
 * Owner, 2026-10-03, on the cale-ice card: *"why is the cover like this? it
 * should have adjusted."* Discover drew `card.cover` (the mark) and nothing
 * else, while the dashboard's card for the same event wore its hero.
 *
 * Held here:
 *   1. RENDERED — a card whose event has a hero photo draws that photo (the
 *      shelves' own card, `DiscoverEventCard`), the mark still
 *      under it; a card with no look draws the mark alone; a wake never wears
 *      a photo; a theme's still keeps the hub scrim.
 *   2. ONE RESOLVER — the cover is the dashboard card's: the loader asks
 *      `resolveEventPoster` and narrows with `sceneCoverFor`, never a second
 *      order; and it reads the hero + the Save-the-Date background it needs.
 *   3. ONLY LISTED PUBLIC EVENTS — the core never fills `scene`; the loader
 *      dresses the cards AFTER `selectDiscoverShelves` has applied the
 *      allow-list, so no unlisted event's photo is ever read here.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import { stripComments } from './strip-comments';
import { posterFor, sceneCoverFor } from './event-poster';
import { selectDiscoverShelves, type DiscoverEventCard, type DiscoverEventRow } from './discover-events-core';
import { DiscoverEventCard as EventCard } from '../app/_components/frontdoor/discover-event-card';
import { DiscoverEventCover } from '../app/_components/frontdoor/discover-event-cover';

// The components compile to classic `React.createElement` under tsx.
(globalThis as unknown as { React: unknown }).React = React;

const HERO = 'https://r2.example/hero/cale-ice.webp';
const STILL = 'https://media.example/velvet-poster.jpg';

const WEDDING = { solemn: false, twoPeople: true, eventWord: 'wedding' } as const;
const WAKE = { solemn: true, twoPeople: false, eventWord: 'wake' } as const;
const poster = (over: Partial<Parameters<typeof posterFor>[0]> = {}) =>
  posterFor({
    displayName: 'Cale & Ice',
    eventDate: '2026-12-12',
    venueName: null,
    words: WEDDING,
    theme: 'house',
    accent: null,
    heroSrc: null,
    ...over,
  });

function card(over: Partial<DiscoverEventCard> = {}): DiscoverEventCard {
  return {
    key: 'e1',
    href: '/cale-ice',
    title: 'Cale & Ice',
    typeLabel: 'Wedding',
    datePlate: 'Sat 12 Dec',
    cover: 'C&I',
    scene: null,
    host: null,
    regionLabel: null,
    relation: null,
    askHref: null,
    ...over,
  };
}

/** The real card, as the shelves render it (`<EventCard card={c} />`). */
function shelves(items: DiscoverEventCard[]): string {
  return items.map((c) => renderToStaticMarkup(React.createElement(EventCard, { card: c }))).join('');
}

// ─── 1 · RENDERED ───────────────────────────────────────────────────────────

test('a Discover card whose event has a hero photo renders that photo', () => {
  const scene = sceneCoverFor(poster({ heroSrc: HERO }));
  assert.ok(scene && scene.kind === 'photo' && scene.ground === 'hero', 'the hero did not win the cover');
  const html = shelves([card({ scene })]);
  assert.match(html, /data-discover-card/, 'the card did not render');
  assert.match(html, new RegExp(`<img[^>]*src="${HERO.replace(/[.]/g, '\\.')}"`), 'the hero photo is not on the card');
  assert.match(html, /data-discover-cover="hero"/);
  // The mark is still drawn underneath, so a photo that fails shows it.
  assert.match(html, /class="fd-mono-cover"[^>]*>C&amp;I</);
  // The date plate is still on the cover, after the photo (painted on top).
  assert.ok(html.indexOf('fd-date') > html.indexOf(HERO), 'the date plate must follow the photo');
});

test('a card whose event has chosen no look keeps the monogram, and nothing else', () => {
  assert.equal(sceneCoverFor(poster()), null, 'an event with nothing chosen must fall back to the mark');
  const html = shelves([card()]);
  assert.match(html, /data-discover-cover="mark"/);
  assert.match(html, /class="fd-mono-cover"[^>]*>C&amp;I</);
  assert.doesNotMatch(html, /<img/, 'a card with no look drew a picture');
});

test('a wake never wears a photo on Discover — its cover is the mark', () => {
  const scene = sceneCoverFor(poster({ words: WAKE, heroSrc: HERO }));
  assert.deepEqual(scene, { kind: 'quiet' });
  const html = renderToStaticMarkup(React.createElement(DiscoverEventCover, { card: card({ scene }) }));
  assert.match(html, /data-discover-cover="mark"/);
  assert.doesNotMatch(html, /<img/);
});

test("a theme's still is worn under the hub's own scrim", () => {
  const scene = sceneCoverFor(poster({ theme: 'velvet', themeStillSrc: STILL }));
  assert.ok(scene && scene.kind === 'theme');
  const html = renderToStaticMarkup(React.createElement(DiscoverEventCover, { card: card({ scene }) }));
  assert.match(html, new RegExp(`src="${STILL.replace(/[.]/g, '\\.')}"`));
  assert.match(html, /class="fd-event-scrim"/);
  assert.match(html, /--hub-scrim:/, 'the theme scrim tone did not reach the cover');
});

// ─── 2 · ONE RESOLVER ──────────────────────────────────────────────────────

const WEB = join(__dirname, '..');
const LOADER = stripComments(readFileSync(join(WEB, 'lib/discover-events.ts'), 'utf8'));
const CORE = stripComments(readFileSync(join(WEB, 'lib/discover-events-core.ts'), 'utf8'));
const SHELVES = stripComments(readFileSync(join(WEB, 'app/_components/frontdoor/front-door-discover.tsx'), 'utf8'));

test('the shelves render THIS card — the one the render tests above draw', () => {
  assert.match(SHELVES, /import \{ DiscoverEventCard as EventCard \} from '\.\/discover-event-card'/);
  assert.match(SHELVES, /<EventCard key=\{c\.key\} card=\{c\} \/>/);
  assert.doesNotMatch(SHELVES, /fd-mono-cover/, 'a second, mark-only cover came back into the shelves');
});

test("the cover is the dashboard card's: resolveEventPoster → sceneCoverFor, never a second order", () => {
  assert.match(LOADER, /await resolveEventPoster\(/, 'the loader no longer asks the one poster resolver');
  assert.match(LOADER, /sceneCoverFor\(poster\)/, 'the loader no longer narrows with sceneCoverFor');
  assert.doesNotMatch(LOADER, /posterFor\(|resolveHubLook\(|resolveThemeGround\(/, 'a second cover resolver appeared');
  const cols = /const COVER_COLUMNS =\s*'([^']*)'/.exec(LOADER)?.[1] ?? '';
  for (const c of ['std_background', 'landing_page_hero_image_url', 'invite_theme']) {
    assert.match(cols, new RegExp(`\\b${c}\\b`), `the cover read dropped ${c}`);
  }
  assert.match(LOADER, /renderableImageSrc\(\s*await displayUrlForStoredAsset\(resolveHero\(r\)\.photoRef\)/);
  assert.match(LOADER, /logQueryError\('discover-events\.covers'/, 'a refused cover read must be logged');
});

// ─── 3 · ONLY LISTED PUBLIC EVENTS ─────────────────────────────────────────

test('the core never fills a cover — and an unlisted event is never a card to dress', () => {
  assert.match(CORE, /\bscene: null,/, 'the core must leave the cover to the loader');
  assert.doesNotMatch(CORE, /\bscene:(?!\s*(?:null\b|SceneCover\b))/, 'the pure core decided a cover');
  const row = (over: Partial<DiscoverEventRow>): DiscoverEventRow => ({
    event_id: 'x',
    slug: 'x',
    display_name: 'X',
    event_date: '2026-12-12',
    event_end_date: null,
    event_date_precision: 'day',
    event_type: 'wedding',
    region: null,
    archived: false,
    landing_page_visibility: 'public',
    scheduled_launch_at: null,
    monogram_text: null,
    rsvp_ask_config: null,
    ...over,
  });
  const out = selectDiscoverShelves({
    events: [row({ event_id: 'pub' }), row({ event_id: 'unl', slug: 'unl', landing_page_visibility: 'unlisted' })],
    hostsByEvent: new Map(),
    people: new Map(),
    memberEventIds: new Set(),
    viewerRegion: null,
    todayISO: '2026-10-03',
    now: Date.parse('2026-10-03T04:00:00Z'),
  });
  assert.deepEqual(out.world.map((c) => [c.key, c.scene]), [['pub', null]]);
  // The loader dresses exactly the shelved cards, after the allow-list ran.
  const select = LOADER.indexOf('selectDiscoverShelves({');
  const dress = LOADER.indexOf('await dressCards(admin, [...shelves.people, ...shelves.world])');
  assert.ok(select > -1 && dress > select, 'covers must be read only for cards that passed selectDiscoverShelves');
});
