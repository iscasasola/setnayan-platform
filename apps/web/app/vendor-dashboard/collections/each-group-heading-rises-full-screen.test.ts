/**
 * 🔒 EACH PORTFOLIO GROUP HEADING RISES ITS GROUP FULL SCREEN (Build 6 run list item 6).
 *
 * Owner 10 Nov, DECISION_LOG "FULLY ANIMATED MOSTLY MEANS RISE FULL SCREEN": every tappable block on a dashboard — Shop,
 * Today, Clients, PORTFOLIO — rises full screen from where it sits through the ONE shipped motion, and closing falls back
 * into the same block. On Portfolio the blocks are the group headings (On my page · Service cards · Albums by event · …).
 *
 *   1 · RENDERED: every titled head except "More" is ONE button that says it opens a screen (`aria-haspopup="dialog"`) —
 *       never a link that jumps to a page, never a head that opens nothing. Nothing is risen before a press.
 *   2 · THE ONE RISE: the head's press mounts the shared `RiseScreen` (the one motion, `lib/rise-motion.ts` /
 *       `lib/rise-screen.ts` — the press is the origin, ✕ plays the reverse into the head), titled by the group, its
 *       line the count; no motion of its own in the section (no BodyPanel, no portal, no `.animate`).
 *   3 · EVERY GROUP HAS A RISE: each `<PortfolioSection` in the list passes `rise={riseOf(…)}` (More: `rise={null}`).
 *   4 · THE GROUP AS A FULL-SCREEN GRID: a photo group rises into the full-bleed 3-column grid with EVERY photo (not the
 *       rail's first 12); an album group into each album under its own name and count; inside the risen screen a rail
 *       WRAPS on the 16-px gutters instead of scrolling sideways (so an empty group keeps its finished empty look).
 * 🛡 SABOTAGE (each seen RED, then restored — 2026-11-12): head `onClick={() => setRisen(true)}` → `onClick={() => {}}`
 *   (red: 2); `rise={riseOf(` on Albums by event → `rise={null}` (red: 1, 3); PhotoGrid for On my page fed
 *   `allPhotos.slice(0, 12)` (red: 4); the wrapped rail's `flex-wrap` dropped (red: 4).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { stripComments } from '@/lib/strip-comments';
import type { CollectionsInput } from '@/lib/supplier-collections';

(globalThis as unknown as { React: unknown }).React = React;
{
  type ModT = { _load: (request: string, ...rest: unknown[]) => unknown };
  const Mod = (createRequire(import.meta.url)('node:module') as { Module: ModT }).Module;
  const load = Mod._load;
  Mod._load = function (this: unknown, request: string, ...rest: unknown[]) {
    if (request === 'server-only' || request === 'client-only') return {};
    return load.call(this, request, ...rest);
  };
}

const HERE = dirname(fileURLToPath(import.meta.url));
const read = (rel: string) => stripComments(readFileSync(join(HERE, rel), 'utf8'));
const SECTIONS = read('_components/portfolio-sections.tsx');
const LIST = read('_components/collections-list.tsx');
const GROUPS = read('_components/portfolio-groups.tsx');

const INPUT: CollectionsInput = {
  page: { photos: 14, videos: 0, shown: true },
  cards: { cards: 1, photos: 2, videos: 0 },
  albums: { photos: 2, events: 1 },
  own: { items: 4 },
  delivered: { couples: 1, items: 3 },
  instagram: { configured: true, connected: false, posts: 0, shown: 0 },
  moodboard: { allowed: true, looks: 1, declined: 0 },
};
const album = (key: string, title: string) => ({ key, title, line: '12 photos', urls: ['/a.jpg', '/b.jpg'], total: 12, href: null });
const PHOTOS = Array.from({ length: 14 }, (_, i) => `/p${i}.jpg`);

test('1 · every titled head (but More) is one button that opens a screen — nothing risen before a press', async () => {
  const { CollectionsList } = await import('./_components/collections-list');
  const { renderToStaticMarkup } = await import('react-dom/server');
  const html = renderToStaticMarkup(
    React.createElement(CollectionsList, {
      input: INPUT,
      gallery: null,
      groups: { events: [album('e1', 'Santos wedding')], services: [album('s1', 'Photo booth')], inspiration: [album('i1', 'Reception styling')], stories: [{ eventId: 'e1', slug: 'santos', hostNames: 'Ana & Ben', line: '' }] },
      allPhotos: PHOTOS,
      libraryOpen: true,
      videoLinks: ['https://www.youtube.com/watch?v=aqz-KE-bpKQ'],
      songs: { count: 3, withVideo: 1 },
      moodboard: { looks: 1, declined: 0 },
    } as never),
  );
  const ids = [...html.matchAll(/data-portfolio-section="([^"]+)"/g)].map((m) => m[1]!);
  assert.ok(ids.length >= 10, `anti-vacuity: only ${ids.length} sections drawn`);
  for (const id of ids) {
    const heads = [...html.matchAll(new RegExp(`<(\\w+)[^>]*data-portfolio-open="${id}"[^>]*>`, 'g'))];
    if (id === 'more') {
      assert.equal(heads.length, 0, 'More is a plain heading — it has nothing of its own to rise');
      continue;
    }
    assert.equal(heads.length, 1, `${id}: the group heading is not one opener`);
    assert.equal(heads[0]![1], 'button', `${id}: the group heading is a link that jumps to a page — it must rise full screen`);
    assert.match(heads[0]![0], /aria-haspopup="dialog"/, `${id}: the heading does not say it opens a screen`);
  }
  assert.doesNotMatch(html, /data-rise-screen=/, 'a group is risen before anybody pressed its heading');
});

test('2 · the press mounts THE one RiseScreen — titled by the group, its line the count, ✕ puts it back', () => {
  assert.match(SECTIONS, /import \{ RiseScreen \} from '@\/app\/_components\/rise\/rise-screen';/, 'the group does not rise through the ONE screen');
  assert.match(SECTIONS, /<button type="button" onClick=\{\(\) => setRisen\(true\)\}[^>]*data-portfolio-open=\{id\}>/, 'the heading’s press does not rise its group');
  assert.match(
    SECTIONS,
    /\{rise && risen \? \(\s*<RiseScreen title=\{title\} line=\{rise\.line\} onClose=\{\(\) => setRisen\(false\)\} data=\{`portfolio-\$\{id\}`\}>/,
    'the risen group is not the shared RiseScreen titled by the group, or ✕ does not fall back',
  );
  // The motion is the ONE rise — the section carries none of its own.
  assert.doesNotMatch(SECTIONS, /<BodyPanel\b|createPortal|\.animate\(|position:\s*['"]?fixed/, 'the section draws a rise of its own');
});

test('3 · every group in the list has a rise; More alone has none', () => {
  // Each section's source, from its tag to the next (the album and count groups are one template each).
  const tags = LIST.split(/(?=<PortfolioSection\b)/).slice(1).map((t) => t.slice(0, 900));
  assert.ok(tags.length >= 9, `anti-vacuity: ${tags.length} sections in the list`);
  for (const t of tags) {
    if (/id="more"/.test(t)) assert.match(t, /rise=\{null\}/, 'More rises');
    else assert.match(t, /rise=\{riseOf\(/, `a group heading does not rise: ${t.slice(0, 80)}`);
  }
  assert.doesNotMatch(LIST, /\bonOpen=\{/, 'a group heading still opens the old way (a link or the body panel)');
});

test('4 · risen, the group is a full-screen grid of EVERY photo; albums under their names; rails wrap', async () => {
  // On my page rises with every photo, not the rail's first twelve.
  assert.match(LIST, /<PhotoGrid photos=\{pagePhotos\} data="page" \/>/, 'On my page does not rise into its photo grid');
  assert.match(LIST, /const pagePhotos: OpenedPhotos = \{[^}]*urls: allPhotos, total: allPhotos\.length/, 'the risen page grid is not every photo');
  assert.match(LIST, /<AlbumGrids data=\{id\}/, 'an album group does not rise into its albums');
  assert.match(SECTIONS, /if \(useContext\(InRise\)\)\s*return \(\s*<div className="flex flex-wrap items-start gap-2\.5 px-4 pb-1\.5"/, 'a rail inside the risen group still scrolls sideways');
  assert.match(SECTIONS, /<InRise\.Provider value>\{rise\.body \?\? children\}<\/InRise\.Provider>/, 'a group without a grid of its own does not rise its own rail');

  const { PhotoGrid, AlbumGrids } = await import('./_components/portfolio-groups');
  const { renderToStaticMarkup } = await import('react-dom/server');
  const grid = renderToStaticMarkup(React.createElement(PhotoGrid, { photos: { title: 'On my page', sub: '14 photos', urls: PHOTOS, total: 14, href: null }, data: 'page' }));
  assert.match(grid, /class="grid grid-cols-3 gap-\[2px\]" data-collection-grid="" data-bleed=""/, 'the risen grid is not the full-bleed 3-column grid');
  assert.equal((grid.match(/<img /g) ?? []).length, 14, 'the risen grid does not hold every photo');
  const albums = renderToStaticMarkup(
    React.createElement(AlbumGrids, { data: 'albums', albums: [{ key: 'e1', title: 'Santos wedding', sub: '12 photos', urls: ['/a.jpg'], total: 12, href: null }, { key: 'e2', title: 'Cruz debut', sub: '3 photos', urls: ['/b.jpg'], total: 3, href: null }] }),
  );
  for (const name of ['Santos wedding', 'Cruz debut']) assert.ok(albums.includes(name), `a risen album lost its name: ${name}`);
  assert.equal((albums.match(/data-collection-grid=""/g) ?? []).length, 2, 'each album is not its own grid');
  // One grid, shared with the opened collection — never a second copy.
  assert.equal((GROUPS.match(/data-collection-grid=""/g) ?? []).length, 1, 'a second photo grid was drawn beside PhotoGrid');
});
