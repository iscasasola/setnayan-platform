/**
 * the-overview-band-wears-the-hub-cover.test.ts
 *
 * ⚖ Owner, 2026-09-29 (DECISION_LOG, "THE OVERVIEW'S WEDDING DAY TILE WEARS THE
 * EVENT HUB'S OWN BACKGROUND"), pointing at the event Overview's dark "THE
 * WEDDING DAY" tile, whose band showed the stock `/event-types/wedding.webp`
 * under a random blue/violet grade: *"this needs to adapt to the background of
 * the event hub"*.
 *
 * The band (`EventScene`) now asks the ONE poster resolver the home card asks
 * (`resolveEventPoster` → `sceneCoverFor`): hero photo → Save-the-Date
 * background → the theme's still; a wake is quiet; the stock photo is the LAST
 * fallback, only for an event that has chosen nothing. This file EXECUTES the
 * order and the render, and pins the wiring a render cannot see.
 *
 * 🪤 `globalThis.React` is set before DYNAMIC imports — tsconfig `"jsx": "preserve"`.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { posterFor, sceneCoverFor, type SceneCover } from './event-poster';
import { stripComments } from './strip-comments';

(globalThis as unknown as { React: unknown }).React = React;

const WEB = join(dirname(fileURLToPath(import.meta.url)), '..');
const src = (p: string) => stripComments(readFileSync(join(WEB, p), 'utf8'));

const WEDDING = { solemn: false, twoPeople: true, eventWord: 'wedding' } as const;
const WAKE = { solemn: true, twoPeople: false, eventWord: 'wake' } as const;
const base = {
  displayName: 'Maria & Jose',
  eventDate: '2026-12-18',
  venueName: 'Sta. Clara Chapel',
  words: WEDDING,
  theme: 'house' as const,
  accent: null as unknown,
  heroSrc: null as string | null,
};

const HERO = 'https://r2.example/own-hero.webp';
const STD_BG = 'https://r2.example/std-bg.webp';
const STILL = 'https://media.example/velvet-still.jpg';
const STOCK = '/event-types/wedding.webp';

/* ── THE ORDER — the resolver's answer, read for a band ─────────────────── */

// Read through a widened parameter: `assert.equal(c?.kind, …)` narrows `c`,
// and a second `kind` test on the narrowed value no longer compiles.
const srcOf = (c: SceneCover | null) => (c && c.kind !== 'quiet' ? c.src : null);
const groundOf = (c: SceneCover | null) => (c && c.kind !== 'quiet' ? c.ground : null);
const scrimOf = (c: SceneCover | null) => (c && c.kind !== 'quiet' ? c.legibility?.['--hub-scrim'] : null);

test('the couple’s hero photo is the band, over their background and their theme', () => {
  const c = sceneCoverFor(
    posterFor({ ...base, theme: 'velvet', heroSrc: HERO, backgroundSrc: STD_BG, themeStillSrc: STILL }),
  );
  assert.equal(c?.kind, 'photo');
  assert.equal(srcOf(c), HERO);
  assert.equal(groundOf(c), 'hero');
});

test('no hero: the Save-the-Date background the hub shows is the band', () => {
  const c = sceneCoverFor(posterFor({ ...base, theme: 'velvet', backgroundSrc: STD_BG, themeStillSrc: STILL }));
  assert.equal(srcOf(c), STD_BG);
  assert.equal(groundOf(c), 'background');
});

test('no photo at all: the theme’s still, in the theme’s own measured veil', () => {
  const c = sceneCoverFor(posterFor({ ...base, theme: 'velvet', themeStillSrc: STILL }));
  assert.equal(c?.kind, 'theme');
  assert.equal(srcOf(c), STILL);
  assert.match(
    scrimOf(c) ?? '',
    /^rgba\(\d+, \d+, \d+, [01]\.\d\d\)$/,
    'the tint is the Event Hub legibility veil, parsed values only',
  );
});

test('NOTHING CHOSEN → null, so the stock photo is only ever the last fallback', () => {
  assert.equal(sceneCoverFor(posterFor(base)), null);
  // A poster that could not be resolved keeps the caller's previous cover.
  assert.equal(sceneCoverFor(null), null);
  assert.equal(sceneCoverFor(undefined), null);
});

test('a wake is quiet — even with a hero photo and a background set', () => {
  const c = sceneCoverFor(posterFor({ ...base, words: WAKE, heroSrc: HERO, backgroundSrc: STD_BG }));
  assert.deepEqual(c, { kind: 'quiet' });
});

/* ── THE RENDER — cover over stock, stock only when nothing ─────────────── */

async function scene(cover: SceneCover | null, ownPhotoSrc: string | null = null): Promise<string> {
  const { EventScene } = await import('@/app/dashboard/(launcher)/_components/event-scene');
  const { renderToStaticMarkup } = await import('react-dom/server');
  return renderToStaticMarkup(
    React.createElement(EventScene, {
      eventId: 'S89E-TEST000001',
      eventType: 'wedding',
      photoSrc: STOCK,
      ownPhotoSrc,
      cover,
    }),
  );
}
// next/image rewrites the src (`/_next/image?url=%2Fevent-types%2Fwedding.webp…`).
const hasStock = (html: string) => html.includes('event-types%2Fwedding.webp') || html.includes(STOCK);

test('a cover is DRAWN instead of the stock photo, under the hub veil, the white-title scrim last', async () => {
  const cover = sceneCoverFor(posterFor({ ...base, theme: 'velvet', themeStillSrc: STILL }));
  const html = await scene(cover);
  assert.ok(html.includes(STILL), 'the theme still is the band');
  assert.ok(!hasStock(html), 'the stock type photo must not be drawn under a cover');
  assert.match(html, /data-scene-cover="theme"/);
  assert.match(html, /--hub-scrim:rgba\(/, 'the Event Hub veil reaches the band');
  const last = html.lastIndexOf('<span');
  assert.match(html.slice(last), /from-ink\/90/, 'the legibility scrim stays the LAST layer');
});

test('a cover outranks the own-hero fallback path too (the resolver already chose)', async () => {
  const cover = sceneCoverFor(posterFor({ ...base, theme: 'velvet', backgroundSrc: STD_BG }));
  const html = await scene(cover, null);
  assert.ok(html.includes(STD_BG));
  assert.ok(!hasStock(html));
});

test('the stock photo is drawn ONLY when the event has nothing', async () => {
  const html = await scene(null);
  assert.ok(hasStock(html), 'nothing chosen → the stock type photo, the last fallback');
  assert.doesNotMatch(html, /data-scene-cover/);
});

test('a wake’s band is still: no image, no stock, no per-event colour grade', async () => {
  const html = await scene({ kind: 'quiet' }, HERO);
  assert.match(html, /data-scene-cover="quiet"/);
  assert.doesNotMatch(html, /<img/);
  assert.ok(!hasStock(html));
  assert.doesNotMatch(html, /hsla?\(/, 'no hue wash on a solemn band');
});

/* ── THE WIRING — both surfaces ask the one resolver ────────────────────── */

test('the Overview focal band is handed the resolver’s cover, and reads the columns it needs', () => {
  const focal = src('app/dashboard/[eventId]/_components/event-dashboard.tsx');
  assert.match(focal, /sceneCoverFor\(\s*await resolveEventPoster\(/, 'the focal asks the one resolver');
  assert.match(focal, /cover=\{sceneCover\}/, 'and hands its answer to the band');
  const lean = /const leanSelect =\s*'([^']*)'/.exec(focal)?.[1] ?? '';
  for (const col of ['landing_page_hero_image_url', 'std_background', 'invite_theme', 'monogram_color']) {
    assert.ok(new RegExp(`\\b${col}\\b`).test(lean), `the focal's lean select stopped reading ${col}`);
  }
  assert.match(focal, /\n\s*ownHeroSrc,\n\s*\)\.catch\(\(\) => null\)/, 'the own hero reaches the resolver; a failure keeps the band');
});

test('every glass card on the home board wears the same cover', () => {
  const board = src('app/dashboard/(launcher)/page.tsx');
  assert.match(board, /cover=\{sceneCoverFor\(scenePoster\)\}/, 'the glass card hands the cover to its band');
  const cards = board.match(/<GlassEventCard\b[\s\S]*?\/>/g) ?? [];
  assert.ok(cards.length >= 5, `expected the five board shelves' cards, saw ${cards.length}`);
  for (const card of cards) {
    assert.ok(
      /poster=\{posterById\.get\(event\.event_id\)\}/.test(card) ||
        /scenePoster=\{posterById\.get\(event\.event_id\)\}/.test(card),
      `a board card wears the stock photo instead of the hub cover:\n${card.slice(0, 200)}`,
    );
  }
  for (const shelf of ['happeningNow', 'unwritten', 'written', 'putAway']) {
    assert.match(
      board,
      new RegExp(`planningPosters\\([\\s\\S]{0,400}\\.\\.\\.(?:\\(showPutAway \\? )?${shelf}\\b`),
      `the ${shelf} shelf's covers are not resolved`,
    );
  }
});
