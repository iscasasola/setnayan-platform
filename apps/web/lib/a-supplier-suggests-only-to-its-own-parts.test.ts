/**
 * a-supplier-suggests-only-to-its-own-parts.test.ts — 🤝🖼 SUPPLIER PHOTO SUGGESTIONS, the property on the screens (owner
 * 2026-10-19, DECISION_LOG "SUPPLIERS ADD INSPIRATION BY THEIR CATEGORY — EVERY PART, ATTIRE INCLUDED" + "FIVE
 * CONTROLLER RECOMMENDATIONS APPROVED" item 4; prototype `supplier_inspiration_suggestions_2026-10-19.html`). The
 * database half is `tests/db/a-supplier-suggests-only-to-its-own-parts.db.test.ts`.
 *
 *   1 · THE OWNER'S EXAMPLES, through the one map: bouquets are the florist's ALONE; the attire boards go to the attire
 *       trades and to nobody else; Stage is never a florist's.
 *   2 · THE SUPPLIER'S BOARD, DRAWN: a florist's board carries "Suggest a photo" on exactly its own parts (counted, per
 *       part) — none on Stage, none on Cake — its own lane first, "Look only" on a lane with nothing of its own; a
 *       stylist's carries it on the room and never on a bouquet; the page hands the board the one map's answer.
 *   3 · KEEP NEVER REPLACES SILENTLY: a Keep with no free place and no photo named ASKS — and the Palette consults that
 *       answer before it sends anything.
 *   4 · The couple's notice and lines say what the prototype says.
 *
 * Sabotaged, seen red, restored (see the PR body).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from './strip-comments';
import { libraryPhotoParts } from './inspiration-slots';
import { suggestablePartsForShop, supplierTradeWord } from './inspiration-suggestion-parts';
import { buildSupplierBoard, firstOwnPart, ownLaneWords } from './supplier-suggest-board';
import { canonicalServicesForTile } from './vendor-counts';
import { WEDDING_TILE_LABEL, type WeddingTile } from './taxonomy';
import { coupleCountLine, keepPlan, suggestionNoticeTitle, supplierCountLine, supplierRoleLine } from './inspiration-suggestions';

(globalThis as unknown as { React: unknown }).React = React;
{
  const Mod = require('node:module');
  const load = Mod._load;
  Mod._load = function (request: string, ...rest: unknown[]) {
    if (request === 'server-only' || request === 'client-only') return {};
    return load.call(this, request, ...rest);
  };
}

const WEB = join(__dirname, '..');
const code = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));
const TILES = Object.keys(WEDDING_TILE_LABEL) as WeddingTile[];
const keysFor = (tile: WeddingTile) => new Set(suggestablePartsForShop(canonicalServicesForTile(tile)).map((p) => p.key));
const ATTIRE_KEYS = libraryPhotoParts().filter((p) => p.group === 'attire').map((p) => p.key);
const ATTIRE_TILES: WeddingTile[] = ['brides_attire', 'grooms_attire', 'womens_attire', 'mens_attire', 'filipiniana_barongs', 'hmua'];

test('1 · bouquets are the florist’s alone; attire boards the attire trades’ alone; Stage is never a florist’s', () => {
  const florist = keysFor('florist');
  for (const k of ['bridal_bouquet', 'entourage_bouquets', 'centrepieces', 'flower_accents']) assert.ok(florist.has(k), `a florist cannot suggest to ${k}`);
  for (const k of ['stage', 'ceiling', 'backdrop', 'tunnel', 'cake', ...ATTIRE_KEYS]) assert.ok(!florist.has(k), `a florist may suggest to ${k}`);
  for (const t of TILES) {
    if (t === 'florist') continue;
    const k = keysFor(t);
    assert.ok(!k.has('bridal_bouquet') && !k.has('entourage_bouquets'), `a ${WEDDING_TILE_LABEL[t]} shop may suggest a bouquet`);
    if (!ATTIRE_TILES.includes(t)) for (const a of ATTIRE_KEYS) assert.ok(!k.has(a), `a ${WEDDING_TILE_LABEL[t]} shop may suggest to the attire board ${a}`);
  }
  assert.ok(keysFor('brides_attire').has('bride'), 'a gown designer cannot suggest to Bridal gown');
  assert.ok(keysFor('stylist_decorator').has('stage'), 'a stylist cannot suggest to Stage');
});

test('2 · the supplier’s board draws “Suggest a photo” on exactly the shop’s own parts — its lanes first, the rest “Look only”', async () => {
  const { renderToStaticMarkup } = await import('react-dom/server');
  const { SupplierSuggestBoard } = await import('../app/vendor-dashboard/clients/[eventId]/_components/supplier-suggest-board');
  const FIVE = ['#5B4A6B', '#D9C4CF', '#A9834B', '#F7F2EC', '#7A8B6F'];
  const draw = (tile: WeddingTile) => {
    const services = canonicalServicesForTile(tile);
    const parts = suggestablePartsForShop(services);
    const board = buildSupplierBoard({ palette: { reception: FIVE }, five: FIVE, photosBySlot: {}, suggestable: new Set(parts.map((p) => p.key)) });
    const noop = async () => ({ status: 'ok' as const });
    const html = renderToStaticMarkup(
      React.createElement(SupplierSuggestBoard, {
        eventId: 'e',
        couple: 'Lab couple',
        eventLine: null,
        roleLine: supplierRoleLine(supplierTradeWord(services, firstOwnPart(board)), ownLaneWords(board)),
        board,
        mine: [],
        actions: { suggest: noop as never, withdraw: noop, listShopPhotos: async () => ({ photos: [], failed: false }) },
      }),
    );
    return { html, keys: new Set(parts.map((p) => p.key)), board };
  };
  for (const tile of ['florist', 'stylist_decorator', 'brides_attire', 'cake'] as WeddingTile[]) {
    const { html, keys, board } = draw(tile);
    const buttons = [...html.matchAll(/data-suggest-button="([a-z_]+)"/g)].map((m) => m[1]!);
    const drawn = [board.main, ...board.lanes.flatMap((l) => l.parts)].map((p) => p.slotKey);
    assert.deepEqual(new Set(buttons), new Set(drawn.filter((k) => keys.has(k))), `a ${WEDDING_TILE_LABEL[tile]} board offers Suggest on the wrong parts`);
    for (const b of buttons) assert.equal(buttons.filter((x) => x === b).length, 1, `${b} carries Suggest more than once`);
    assert.ok(buttons.length > 0, `a ${WEDDING_TILE_LABEL[tile]} board offers Suggest nowhere`);
    /* Its own lanes first; a lane with nothing of its own says so. */
    const firstLookOnly = board.lanes.findIndex((l) => l.lookOnly);
    assert.ok(firstLookOnly === -1 || board.lanes.slice(firstLookOnly).every((l) => l.lookOnly), 'a lane of the shop’s own sits under a “Look only” lane');
    for (const l of board.lanes) {
      const lookOnly = !l.parts.some((p) => keys.has(p.slotKey));
      assert.equal(l.lookOnly, lookOnly, `${l.title}: “Look only” is ${l.lookOnly} for a ${WEDDING_TILE_LABEL[tile]}`);
      assert.equal(html.includes(`data-suggest-lane="${l.key}"`), true);
    }
  }
  const florist = draw('florist');
  assert.ok(!/data-suggest-button="stage"/.test(florist.html) && !/data-suggest-button="cake"/.test(florist.html), 'a florist board offers Suggest on Stage or Cake');
  assert.equal(florist.board.lanes[0]!.key, 'flowers', 'the florist’s own lane is not first');
  assert.match(florist.html, /You are their florist — you can add photos to/);
  assert.ok(!/data-suggest-lane="attire"/.test(florist.html), 'a florist’s board lists the attire boards');

  /* The page hands the board the one map's answer for the signed-in shop — never a list of its own. */
  const page = code('app/vendor-dashboard/clients/[eventId]/mood-board/page.tsx');
  assert.match(page, /const suggestParts = suggestablePartsForShop\(profile\.services\);/);
  assert.match(page, /suggestable: new Set\(suggestParts\.map\(\(p\) => p\.key\)\)/);
  const parts = code('lib/inspiration-suggestion-parts.ts');
  assert.match(parts, /libraryPhotoParts\(\)\.filter\(\(p\) => slotUploadVerdict\(p\.key, services\)\.allowed\)/, 'the suggestable parts are not the library’s own verdict');
});

test('3 · Keep never replaces silently — with no free place and no photo named it ASKS, and the Palette asks first', () => {
  assert.deepEqual(keepPlan([], null), { kind: 'ask' });
  assert.deepEqual(keepPlan([3], null), { kind: 'keep' });
  assert.deepEqual(keepPlan([], 2), { kind: 'replace', position: 2 });
  const studio = code('app/dashboard/[eventId]/studio/mood-board/_components/mood-board-studio.tsx');
  const fn = studio.slice(studio.indexOf('const keep = async ('), studio.indexOf('const undoKeep = async ('));
  /* The FIRST thing a Keep does is ask the plan, and an 'ask' opens the sheet and returns — unconditionally. */
  const first = fn.slice(fn.indexOf('=> {') + 4).trimStart();
  assert.match(
    first,
    /^if \(keepPlan\(freeIn\(sg\.slotKey\), replace\)\.kind === 'ask'\) \{\s*setSheet\(\{ kind: 'full', s: sg \}\);\s*return;\s*\}/,
    'a Keep on a full part does not stop at the “already has 3 photos” sheet before anything else',
  );
  assert.ok(fn.indexOf('keepInspirationSuggestion(') > fn.indexOf("kind === 'ask'"), 'the Palette sends a Keep before asking which photo a full part replaces');
  /* "Keep all three for now" sends nothing — it only closes the sheet. */
  const sheet = studio.slice(studio.indexOf("sheet?.kind === 'full'"));
  assert.match(sheet, /label=\{FULL_SHEET_KEEP_ALL\} onClick=\{\(\) => setSheet\(null\)\}/);
  assert.equal((sheet.slice(0, sheet.indexOf('</StudioSheet>')).match(/void keep\(sg, p\)/g) ?? []).length, 1, 'each photo of the sheet must replace exactly its own place');
});

test('4 · the words: the notice, the counts and the role line', () => {
  assert.equal(suggestionNoticeTitle(2), '2 suggestions from your suppliers');
  assert.equal(suggestionNoticeTitle(1), '1 suggestion from your suppliers');
  assert.equal(coupleCountLine(3, [null, null, 'Bloom & Co.']), '3 photos · 1 from Bloom & Co.');
  assert.equal(coupleCountLine(0, []), 'No photos yet');
  assert.equal(supplierCountLine(0, 1), 'Waiting to be kept');
  assert.equal(supplierCountLine(0, 0), 'No photos yet');
  assert.equal(supplierRoleLine('Florist', ['Flowers']), 'You are their florist — you can add photos to Flowers.');
});
