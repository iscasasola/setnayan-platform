/**
 * inspiration-lives-in-find.test.ts — 💡 R5 · THE INSPIRATION BOX LIVES IN SUPPLIERS › FIND.
 *
 * Owner 2026-10-28 (DECISION_LOG "INSPIRATION LIVES IN SUPPLIERS › FIND" *"on find"*, "INSPIRATION IN FIND — FINAL FRAMES
 * A–F APPROVED"); prototype `prototypes/inspiration_in_find_2026-10-28/`. This PR builds frames A, B and C plus the ✎
 * sheet's looks; D–F (save → auto-inquiry, the supplier's card, the mixed carousel) are the next build.
 *
 *   1 · THE FACTS — the board is the couple's photos filed by part; each category's strip holds the parts that live in
 *       it (`partCategories`), "On your list" only for a photo from a shop in the couple's picks, "from your suppliers"
 *       for every gallery pick; a hidden or system part never makes a strip; a refused read is `unread`, never 0.
 *   2 · THE WORDS — "24 photos · 6 parts · 3 from your suppliers"; an empty board invites, a refused one says so.
 *   3 · IT REACHES THE RENDER — row A draws its line and its ⓘ; strip B draws the parts, ＋ Add a part last; a category
 *       with no parts draws nothing; an unread board says so in the strip.
 *   4 · IT IS WIRED — Find draws row A after the roll-up and strip B first in an opened category; the page reads the
 *       board once and hands it in; `?board=1` opens the SHIPPED `InspirationBoard` (moved, not redrawn) in the house
 *       sheet; the ✎ sheet nests each service's looks in `data-find-looks`.
 *
 * Sabotage (2026-11-06, each seen red, then restored): `onList` read from every gallery pick → 1 red · the unread arm
 * returning an empty board → 1 + 2 red · the strip drawn for a category with no parts → 3 red · row A removed from
 * Find → 4 red · the sheet's `looksForService` dropped → 4 red.
 *
 * Run: cd apps/web && node --import tsx --test lib/inspiration-lives-in-find.test.ts
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { stripComments } from './strip-comments';
import type { InspirationPart } from './inspiration-parts';
import {
  FIND_INSPIRATION_WORDS as W,
  buildFindInspiration,
  findBoardHref,
  inspirationRowLine,
  looksForService,
  type FindInspirationPhoto,
} from './find-inspiration';
import { FindInspirationRow, FindInspirationStrip } from '../app/dashboard/[eventId]/vendors/_components/find-inspiration';

(globalThis as unknown as { React: unknown }).React = React;
const WEB = join(__dirname, '..');
const code = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));
const EID = 'S89E-ABCDEFGHIJ';

const part = (slotKey: string, label: string, home: string | null, more: Partial<InspirationPart> = {}): InspirationPart => ({
  slotKey,
  label,
  kind: 'part',
  homeCategoryId: home,
  alsoCategoryIds: [],
  services: [],
  hidden: false,
  sortOrder: 0,
  ...more,
});
const PARTS: InspirationPart[] = [
  part('bouquet', 'Bouquet', 'florist', { services: ['bridal_bouquet'] }),
  part('arch', 'Arch', 'stylist', { alsoCategoryIds: ['florist'], services: ['arch_styling'] }),
  part('centrepieces', 'Centrepieces', 'florist', { services: ['bridal_bouquet', 'table_florals'] }),
  part('cake', 'Cake', 'cake', { services: ['cake'] }),
  part('secret', 'Hidden part', 'lights', { hidden: true }),
  part('palette', 'Palette', null, { kind: 'system' }),
];
const photo = (slotKey: string, i: number, shop: string | null = null, fromSupplier = shop !== null): FindInspirationPhoto => ({
  slotKey,
  imageUrl: `https://example.test/${slotKey}-${i}.jpg`,
  fromSupplier,
  vendorProfileId: shop,
});
const PHOTOS = [
  photo('bouquet', 1, 'bloom'),
  photo('bouquet', 2),
  photo('arch', 1, 'petal'),
  photo('cake', 1),
  photo('cake', 2, null, true), // a gallery pick whose shop can no longer be read
  photo('palette', 1),
];
const ON_LIST = new Set(['bloom']);

test('1 · the facts — parts by category, On your list, from your suppliers; a refused read is never an empty board', () => {
  const b = buildFindInspiration(PARTS, PHOTOS, ON_LIST);
  assert.equal(b.read, 'ok');
  if (b.read !== 'ok') return;
  assert.equal(b.photos, 6);
  assert.equal(b.parts, 3, 'parts with photos: bouquet · arch · cake (the palette is a system part)');
  assert.equal(b.fromSuppliers, 3, 'every gallery pick counts — even one whose shop cannot be read');
  assert.deepEqual(b.covers, PHOTOS.slice(0, 3).map((p) => p.imageUrl));
  assert.deepEqual((b.byTile.florist ?? []).map((p) => p.slotKey), ['bouquet', 'arch'], 'florist holds its own part and the arch it also supplies');
  assert.deepEqual((b.byTile.stylist ?? []).map((p) => p.slotKey), ['arch']);
  const bouquet = b.byTile.florist!.find((p) => p.slotKey === 'bouquet')!;
  assert.equal(bouquet.count, 2);
  assert.equal(bouquet.cover, PHOTOS[0]!.imageUrl);
  assert.equal(bouquet.onList, true, 'a photo from a shop in the picks is "On your list"');
  assert.equal(b.byTile.stylist![0]!.onList, false, 'a shop NOT in the picks is not "On your list"');
  assert.ok(!b.partTiles.includes('lights'), 'a hidden part makes a strip');
  assert.ok(b.partTiles.includes('florist') && b.partTiles.includes('cake') && b.partTiles.includes('stylist'));
  assert.deepEqual(looksForService(b, 'bridal_bouquet').map((l) => l.slotKey), ['bouquet']);
  assert.deepEqual(looksForService(b, 'nothing'), []);
  assert.deepEqual(buildFindInspiration(PARTS, null, ON_LIST), { read: 'unread' });
  assert.deepEqual(looksForService(buildFindInspiration(PARTS, null, ON_LIST), 'bridal_bouquet'), []);
});

test('2 · the words — the row’s line, an empty board, a refused one', () => {
  assert.equal(inspirationRowLine(buildFindInspiration(PARTS, PHOTOS, ON_LIST)), '6 photos · 3 parts · 3 from your suppliers');
  assert.equal(inspirationRowLine(buildFindInspiration(PARTS, [photo('cake', 1)], ON_LIST)), '1 photo · 1 part');
  assert.equal(inspirationRowLine(buildFindInspiration(PARTS, [], ON_LIST)), W.emptyRow);
  assert.equal(inspirationRowLine(buildFindInspiration(PARTS, null, ON_LIST)), W.unread);
  assert.doesNotMatch(W.unread, /\b0\b/);
  for (const v of Object.values(W)) assert.doesNotMatch(v, /celebration|website/i, `"${v}" breaks the house words`);
  assert.equal(findBoardHref(EID), `/dashboard/${EID}/vendors?board=1`);
});

test('3 · it reaches the render — row A, strip B, ＋ Add a part last, nothing for a category with no parts', () => {
  const b = buildFindInspiration(PARTS, PHOTOS, ON_LIST);
  const row = renderToStaticMarkup(React.createElement(FindInspirationRow, { board: b, href: findBoardHref(EID) }));
  assert.match(row, /data-find-inspiration-row=""/);
  assert.match(row, />Your inspiration board</);
  assert.match(row, />6 photos · 3 parts · 3 from your suppliers</);
  assert.match(row, /data-explain="find-inspiration"/, 'row A has no ⓘ');
  assert.equal((row.match(/<img /g) ?? []).length, 3, 'the photo stack is not three covers');
  const strip = renderToStaticMarkup(React.createElement(FindInspirationStrip, { board: b, tile: 'florist', href: findBoardHref(EID) }));
  const order = [...strip.matchAll(/data-find-inspiration-(part="[a-z_]+"|add="")/g)].map((m) => m[1]);
  assert.deepEqual(order, ['part="bouquet"', 'part="arch"', 'add=""'], 'the strip is not its parts, then ＋ Add a part');
  assert.match(strip, />On your list</);
  assert.match(strip, />2 photos</);
  assert.match(strip, />Inspiration</);
  // A category with parts but no photos still offers ＋ Add a part; one with no parts at all draws nothing.
  const empty = renderToStaticMarkup(React.createElement(FindInspirationStrip, { board: buildFindInspiration(PARTS, [], ON_LIST), tile: 'florist', href: '#' }));
  assert.match(empty, /data-find-inspiration-add=""/);
  assert.doesNotMatch(empty, /See all/);
  assert.equal(renderToStaticMarkup(React.createElement(FindInspirationStrip, { board: b, tile: 'lights', href: '#' })), '');
  assert.equal(renderToStaticMarkup(React.createElement(FindInspirationStrip, { board: null, tile: 'florist', href: '#' })), '');
  const unread = renderToStaticMarkup(React.createElement(FindInspirationStrip, { board: { read: 'unread' }, tile: 'florist', href: '#' }));
  assert.match(unread, /role="alert"/);
  assert.ok(unread.includes(W.unread.replace(/’/g, '’')));
});

test('4 · it is wired — Find draws A and B, the page reads once, ?board=1 opens the shipped board, the ✎ sheet nests looks', () => {
  const sc = code('app/dashboard/[eventId]/vendors/_components/shortlist-categories.tsx');
  const roll = sc.indexOf('<BenchRollUp folders={folders} standings={standings} />');
  const rowA = sc.indexOf('<FindInspirationRow board={inspiration} href={findBoardHref(eventId)} />');
  assert.ok(roll > 0 && rowA > roll, 'row A is not drawn right after the roll-up');
  const body = sc.indexOf('<div className="cat-body">');
  const strip = sc.indexOf('<FindInspirationStrip board={inspiration} tile={t.tile} href={findBoardHref(eventId)} />');
  assert.ok(body > 0 && strip > body && strip < sc.indexOf('<div className="rail">', body), 'strip B is not first in the opened category, above its suppliers');
  assert.match(sc, /inspiration=\{inspiration\}/, 'the ✎ sheet is not handed the board');

  const page = code('app/dashboard/[eventId]/vendors/page.tsx');
  assert.match(page, /const findInspirationRead = readFindInspiration\(supabase, eventId, new Set\(marketplaceIds\)\)\.catch\(/);
  assert.match(page, /inspiration=\{findInspiration\}/);
  assert.match(page, /\{sp\.board === '1' \? \(\s*<InspirationBoardSheet>[\s\S]*?<InspirationBoardBody eventId=\{eventId\} \/>/);

  const editor = code('app/dashboard/[eventId]/studio/mood-board/_components/mood-board-editor.tsx');
  const fn = editor.slice(editor.indexOf('export async function InspirationBoardBody'));
  assert.match(fn.slice(0, 700), /<InspirationBoard\s+eventId=\{eventId\}\s+initial=\{board\.studio\.inspirations\}/, 'the board was redrawn, not moved');

  const sheet = code('app/dashboard/[eventId]/vendors/_components/find-services-sheet.tsx');
  assert.match(sheet, /const looks = looksForService\(inspiration, service\.key\);/);
  assert.match(sheet, /data-find-looks=\{service\.key\}/);
  assert.match(sheet, /draft\.has\(service\.key\) \? 'opacity-40' : ''/, 'a look is not greyed while its service is unticked');
});
