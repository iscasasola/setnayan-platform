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
 *      shelves' own card, `DiscoverEventCard`), the mark still under it; a
 *      Classic public event with no hero draws the dashboard's PAPER
 *      INVITATION CARD (owner 2026-10-03, ruling A) — never in place of a
 *      photo; a card whose look could not be read draws the mark alone; a wake
 *      never wears a photo or the card; a theme's still keeps the hub scrim.
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
import Module from 'node:module';

// The components compile to classic `React.createElement` under tsx.
(globalThis as unknown as { React: unknown }).React = React;

// The paper card is `<EventPoster>`, whose styles are a CSS module. Outside Next
// a `.css` import cannot load, so each class name maps to itself — the markup
// is what is asserted, never the stylesheet.
(Module as unknown as { _extensions: Record<string, (m: { exports: unknown }) => void> })._extensions['.css'] = (m) => {
  const classes = new Proxy({}, { get: (_t, k) => (typeof k === 'string' ? k : undefined) });
  m.exports = { __esModule: true, default: classes };
};
// Loaded AFTER the `.css` hook above, so not a static import.
const { DiscoverEventCard: EventCard } = require('../app/_components/frontdoor/discover-event-card') as typeof import('../app/_components/frontdoor/discover-event-card');
const { DiscoverEventCover } = require('../app/_components/frontdoor/discover-event-cover') as typeof import('../app/_components/frontdoor/discover-event-cover');

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
    paper: null,
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

/** What the loader hands the card for an `invitation` poster (`dressCards`). */
const paperOf = (p: ReturnType<typeof posterFor>) => ({ poster: p, markText: 'C & I', markSvg: null, markPlays: false });

test('a Classic public event with no hero draws the dashboard\'s paper invitation card on Discover', () => {
  // cale-ice in production, 2026-10-03: Classic, no hero photo, a Save-the-Date
  // background that Classic never shows. The poster is the invitation card.
  const p = poster({ theme: 'house', heroSrc: null, backgroundSrc: null, eventDate: '2026-12-18' });
  assert.equal(p.kind, 'invitation');
  assert.equal(sceneCoverFor(p), null, 'Classic must not wear a picture');
  const html = shelves([card({ paper: paperOf(p) })]);
  assert.match(html, /data-discover-cover="paper"/, 'the card did not take the paper cover');
  assert.match(html, /class="fd-paper"/);
  // The dashboard card's own words, from the same poster facts: the names,
  // the mark in its circle, and the date.
  assert.match(html, />Cale</, 'the first name is not on the card');
  assert.match(html, />Ice</, 'the second name is not on the card');
  assert.match(html, />C &amp; I</, 'the mark is not in the card');
  assert.match(html, /18 December 2026/, 'the date is not on the card');
  assert.doesNotMatch(html, /<img/, 'a Classic card drew a picture');
  // The date plate is still on top of the card.
  assert.ok(html.indexOf('fd-date') > html.indexOf('fd-paper'), 'the date plate must follow the card');
});

test('the paper card never displaces a picture', () => {
  const scene = sceneCoverFor(poster({ heroSrc: HERO }));
  const html = shelves([card({ scene, paper: paperOf(poster()) })]);
  assert.match(html, /data-discover-cover="hero"/);
  assert.doesNotMatch(html, /fd-paper/);
});

test('a card whose look could not be read keeps the monogram, and nothing else', () => {
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

test('the paper card is drawn by <EventPoster> from the same poster, only for an invitation poster', () => {
  assert.match(LOADER, /else if \(poster\?\.kind === 'invitation'\)/, 'the paper card must be the invitation poster only');
  assert.match(LOADER, /resolveEventMonogramSvg\(r\)/, 'the mark must be read through the gate');
  assert.match(LOADER, /logoPlaysFor\(r\.event_id, markSvg\)/);
  const cols = /const COVER_COLUMNS =\s*'([^']*)'/.exec(LOADER)?.[1] ?? '';
  for (const c of ['monogram_custom_svg', 'monogram_uploaded_svg']) {
    assert.match(cols, new RegExp(`\\b${c}\\b`), `the cover read dropped ${c}`);
  }
  const COVER = stripComments(readFileSync(join(WEB, 'app/_components/frontdoor/discover-event-cover.tsx'), 'utf8'));
  assert.match(COVER, /<EventPoster\b[\s\S]*?markPlays=\{paper\.markPlays\}/, 'the cover must draw the dashboard poster');
  const CSS = readFileSync(join(WEB, 'app/_components/frontdoor/front-door.css'), 'utf8');
  assert.match(CSS, /\.fd-thumb-event \{\s*aspect-ratio: 3 \/ 4;/, 'the event cover lost the poster shape');
});

// ─── 3 · ONLY LISTED PUBLIC EVENTS ─────────────────────────────────────────

test('the core never fills a cover — and an unlisted event is never a card to dress', () => {
  assert.match(CORE, /\bscene: null,/, 'the core must leave the cover to the loader');
  assert.match(CORE, /\bpaper: null,/, 'the core must leave the paper card to the loader');
  assert.doesNotMatch(CORE, /\bpaper:(?!\s*(?:null\b|DiscoverPaper\b))/, 'the pure core decided a paper card');
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
  assert.deepEqual(out.world.map((c) => [c.key, c.scene, c.paper]), [['pub', null, null]]);
  // The loader dresses exactly the shelved cards, after the allow-list ran.
  const select = LOADER.indexOf('selectDiscoverShelves({');
  const dress = LOADER.indexOf('await dressCards(admin, [...shelves.people, ...shelves.world])');
  assert.ok(select > -1 && dress > select, 'covers must be read only for cards that passed selectDiscoverShelves');
});
