/**
 * 🔒 AN EMPTY PORTFOLIO LOOKS FINISHED — rendered, not grepped.
 *
 * Build 3 Lane E item 1 (owner 9 Nov: *"Portfolio does not look good empty"*), redrawn by the approved Portfolio
 * (owner 9 Nov, DECISION_LOG "PORTFOLIO PROTOTYPE APPROVED FOR BUILD 5") and owner 11 Nov "SUPPLIER ASKS b–e
 * ANSWERED" (c) *"yes"*: EVERY collection is kept; an empty one shows a greyed Example tile and ONE door, and On my
 * page's door is Upload — the device's picker IN PLACE ("UPLOAD OPENS THE DEVICE PICKER IN PLACE"), never a page.
 *
 *   1 · An answered-empty shop draws every section, each with the Example (the shared `ExamplePreview`) and at most
 *       one door.
 *   2 · On my page's Upload is a label around `<input type="file" accept="image/*">` — no link anywhere.
 *   3 · A REFUSED read says "Couldn't load" and never wears an Example (reads-are-honest).
 *   4 · A filled shop wears no Example at all, and its tiles carry the names on the photos.
 *   5 · Moodboard library and Song bank are drawn for their own shops only (the page asks the shared rules).
 * 🛡 SABOTAGE (seen RED, then restored — 2026-11-10): `unread ? '' : 'mt-[14px]'` kept, but `{!unread && sample ?` →
 *   `{sample ?` (red: 3); the page door `{ kind: 'upload', … }` → `{ kind: 'link', … href: '/vendor-dashboard/shop' }`
 *   (red: 2); `{!unread && door ?` drawing the door twice (red: 1).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createRequire } from 'node:module';
import { stripComments } from '@/lib/strip-comments';
import type { CollectionsInput } from '@/lib/supplier-collections';
import type { PortfolioGroups } from '@/lib/portfolio-groups';

/* The list sits beside server actions (the Video links editor saves through one) — stub `server-only`, as
   `every-empty-part-shows-an-example.test.ts` does, so the REAL component renders here. */
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

const EMPTY: CollectionsInput = {
  page: { photos: 0, videos: 0, shown: true },
  cards: { cards: 0, photos: 0, videos: 0 },
  albums: { photos: 0, events: 0 },
  own: { items: 0 },
  delivered: { couples: 0, items: 0 },
  instagram: { configured: true, connected: false, posts: 0, shown: 0 },
  moodboard: { allowed: true, looks: 0, declined: 0 },
};
const NONE: PortfolioGroups = { events: [], services: [], inspiration: [], stories: [] };
const FACTS = { vendorProfileId: 'v-test', storedRefs: [], free: 50, allowanceUnread: false, walletBalance: 0 };

async function draw(props: Record<string, unknown>): Promise<string> {
  const { CollectionsList } = await import('./_components/collections-list');
  const { renderToStaticMarkup } = await import('react-dom/server');
  return renderToStaticMarkup(
    React.createElement(CollectionsList, {
      input: EMPTY,
      gallery: null,
      groups: NONE,
      uploadFacts: FACTS,
      libraryOpen: true,
      songs: { count: 0, withVideo: 0 },
      ...props,
    } as never),
  );
}

/** Each section's own markup, by its `data-portfolio-section` key. */
function sections(html: string): Map<string, string> {
  const out = new Map<string, string>();
  const parts = html.split(/(?=<section aria-label="[^"]*" class="[^"]*" data-portfolio-section=")/);
  for (const p of parts) {
    const k = p.match(/^<section[^>]*data-portfolio-section="([^"]+)"/)?.[1];
    if (k) out.set(k, p);
  }
  return out;
}

const EMPTY_SECTIONS = ['page', 'cards', 'albums', 'own', 'delivered', 'instagram', 'moodboard', 'songs', 'stories', 'video'];

test('1 · an empty shop keeps EVERY section — each with its greyed Example and at most one door', async () => {
  const s = sections(await draw({}));
  for (const k of [...EMPTY_SECTIONS, 'more']) assert.ok(s.has(k), `the ${k} section is hidden for being empty`);
  for (const k of EMPTY_SECTIONS) {
    const sec = s.get(k)!;
    assert.match(sec, new RegExp(`data-portfolio-empty="${k}"`), `${k}: no placeholder tile with its honest line`);
    assert.match(sec, /data-example=""[\s\S]*>Example<[\s\S]*class="sn-example"/, `${k}: no greyed Example tile (the shared ExamplePreview)`);
    const doors = (sec.match(/data-portfolio-door=|data-portfolio-upload-/g) ?? []).length;
    assert.ok(doors <= 1, `${k}: an empty section draws ${doors} doors — one at most`);
  }
});

test('2 · On my page’s Upload opens the device picker IN PLACE — never a page', async () => {
  const page = sections(await draw({})).get('page')!;
  assert.match(
    page,
    /<label[^>]*data-portfolio-upload-page=""[^>]*>[\s\S]*?<input type="file" accept="image\/\*"/,
    'the empty On my page’s Upload is not a label around the device’s file picker',
  );
  assert.doesNotMatch(page.slice(page.indexOf('data-portfolio-empty="page"')), /href="/, 'the empty On my page’s door goes to a page');
  const src = stripComments(readFileSync(join(process.cwd(), 'app/vendor-dashboard/collections/page.tsx'), 'utf8'));
  assert.match(src, /uploadFacts=\{\{\s*vendorProfileId: d\.vendorId,/, 'the page does not hand the Upload door the uploader’s facts');
});

test('3 · a refused read says so — and never wears an Example', async () => {
  const s = sections(
    await draw({
      input: { ...EMPTY, own: null, delivered: null, instagram: null },
      groups: { events: null, services: null, inspiration: null, stories: null },
      songs: null,
    }),
  );
  for (const k of ['cards', 'albums', 'own', 'delivered', 'instagram', 'moodboard', 'songs', 'stories']) {
    const sec = s.get(k);
    assert.ok(sec, `${k}: a refused read hid the section`);
    assert.match(sec, new RegExp(`data-portfolio-unread="${k}"`), `${k}: a refused read does not say so`);
    assert.match(sec, /Couldn’t load this just now/, `${k}: a refused read reads like an empty one`);
    assert.doesNotMatch(sec, /data-example=/, `${k}: a refused read wears an Example — a sample would pass for the shop`);
  }
});

test('4 · a filled shop wears no Example, and its tiles carry names on the photos', async () => {
  const album = (key: string, title: string) => ({ key, title, line: '12 photos', urls: ['/a.jpg', '/b.jpg'], total: 12, href: null });
  const html = await draw({
    input: { ...EMPTY, page: { photos: 2, videos: 0, shown: true }, own: { items: 4 }, delivered: { couples: 1, items: 3 } },
    groups: { events: [album('e1', 'Santos wedding')], services: [album('s1', 'Photo booth')], inspiration: [album('i1', 'Reception styling')], stories: [{ eventId: 'e1', slug: 'santos', hostNames: 'Ana & Ben', line: '' }] },
    allPhotos: ['/a.jpg', '/b.jpg'],
    videoLinks: ['https://www.youtube.com/watch?v=aqz-KE-bpKQ'],
    songs: { count: 3, withVideo: 1 },
    moodboard: { looks: 2, declined: 0 },
  });
  const s = sections(html);
  for (const k of ['page', 'cards', 'albums', 'own', 'delivered', 'moodboard', 'songs', 'stories', 'video']) {
    assert.doesNotMatch(s.get(k)!, /data-example=/, `${k}: a filled section still wears an Example`);
    assert.match(s.get(k)!, new RegExp(`data-portfolio-tile="${k}"`), `${k}: a filled section draws no tile`);
  }
  for (const name of ['Santos wedding', 'Photo booth', 'Reception styling', 'Ana &amp; Ben']) assert.ok(html.includes(name), `the tile “${name}” has no name on its photo`);
});

test('5 · Moodboard library and Song bank — for their own shops only', async () => {
  const s = sections(await draw({ groups: { ...NONE, inspiration: 'off' }, songs: 'off' }));
  assert.ok(!s.has('moodboard'), 'a shop that supplies no looks is shown the Moodboard library');
  assert.ok(!s.has('songs'), 'a non-music shop is shown the Song bank');
  const page = stripComments(readFileSync(join(process.cwd(), 'app/vendor-dashboard/collections/page.tsx'), 'utf8'));
  assert.match(page, /isMusicToolCategory\(services\)/, 'the Song bank section is shown to non-music shops');
  assert.match(page, /d\.input\.moodboard && d\.input\.moodboard\.allowed/, 'the Moodboard library section ignores its access rule');
});
