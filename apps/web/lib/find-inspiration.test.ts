/**
 * 💡 THE INSPIRATION BOX IN SUPPLIERS › FIND — owner 2026-10-29: *"where are the inspiration box"*; approved prototype
 * "Find at scale" v2 (each open category: Services · Inspiration, Part ▾, 24 photos at a time, a viewer that names
 * who made the photo).
 *
 *   1  a category's parts come from Admin › Categories (the snapshot) — hidden and system parts never show
 *   2  "All parts" is ONE read over every part of the category; a picked part reads only itself
 *   3  the gallery read takes several parts, validated and capped; a Studio call is unchanged
 *   4  no request at open: the parts ride the page's one batched read; photos are kept for the visit
 *   5  reads honest: a failed read says so (with Try again), never "no photos"
 *   6  switching views keeps Services mounted (no refetch) and the switch can pin (the body clips, it does not scroll)
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from '@/lib/strip-comments';
import {
  ALL_PARTS,
  FIND_INSPIRATION_PAGE,
  findInspirationPartsByTile,
  inspirationCountLine,
  inspirationReadKeys,
} from '@/lib/find-inspiration';
import { GALLERY_MAX_LIMIT, GALLERY_MAX_SLOT_KEYS, normalizeGalleryQuery } from '@/lib/moodboard-gallery';
import { fallbackInspirationParts, type InspirationPart, type InspirationPartsSnapshot } from '@/lib/inspiration-parts';

const read = (p: string) => stripComments(readFileSync(join(__dirname, '..', p), 'utf8'));
const VENDORS = 'app/dashboard/[eventId]/vendors';

const part = (p: Partial<InspirationPart> & { slotKey: string }): InspirationPart => ({
  label: p.slotKey,
  kind: 'part',
  homeCategoryId: 'catering',
  alsoCategoryIds: [],
  services: null,
  hidden: false,
  sortOrder: 0,
  ...p,
});

test('1 · a category’s parts are Admin › Categories’ parts — hidden and system parts never show', () => {
  const snap: InspirationPartsSnapshot = {
    source: 'db',
    parts: [
      part({ slotKey: 'dessert', label: 'Dessert wall', sortOrder: 3 }),
      part({ slotKey: 'buffet', label: 'Buffet table', sortOrder: 1 }),
      part({ slotKey: 'retired', hidden: true }),
      part({ slotKey: 'palette', kind: 'system', homeCategoryId: null }),
      part({ slotKey: 'table', homeCategoryId: 'stylist_decorator', alsoCategoryIds: ['catering'], sortOrder: 2 }),
    ],
  };
  const by = findInspirationPartsByTile(snap);
  assert.deepEqual(
    by.catering?.map((p) => p.slotKey),
    ['buffet', 'table', 'dessert'],
    'a category lists its parts in the admin’s order, "also from" included',
  );
  assert.deepEqual(by.stylist_decorator?.map((p) => p.slotKey), ['table']);
  assert.equal(by.catering?.some((p) => p.slotKey === 'retired'), false, 'a hidden part reached a couple');
  assert.equal(JSON.stringify(by).includes('palette'), false, 'the palette (a system part) became a supplier box');
  // The real seed reaches at least one category — a guard over an empty map would prove nothing.
  assert.ok(Object.keys(findInspirationPartsByTile(fallbackInspirationParts())).length > 0, 'no category has parts');
});

test('2 · "All parts" is ONE read over every part; a picked part reads only itself', () => {
  const parts = [
    { slotKey: 'a', label: 'A' },
    { slotKey: 'b', label: 'B' },
  ];
  assert.deepEqual(inspirationReadKeys(parts, ALL_PARTS), ['a', 'b']);
  assert.deepEqual(inspirationReadKeys(parts, 'b'), ['b']);
  assert.deepEqual(inspirationReadKeys(parts, 'gone'), ['a', 'b'], 'a part that left the list reads nothing');
  assert.equal(FIND_INSPIRATION_PAGE, GALLERY_MAX_LIMIT, 'the box asks for more than one read can return');
  assert.equal(inspirationCountLine(null, null, 'Catering'), '', 'an unread total printed a number');
  assert.equal(inspirationCountLine(0, null, 'Catering'), '0 photos · Catering');
  assert.equal(inspirationCountLine(1, 'Dessert wall', 'Catering'), '1 photo · Dessert wall');
});

test('3 · the gallery read takes several parts, validated and capped — a Studio call is unchanged', () => {
  const snap = fallbackInspirationParts();
  const keys = Object.values(findInspirationPartsByTile(snap)).flat().map((p) => p.slotKey);
  assert.ok(keys.length >= 2, 'the seed has too few supplier parts to test with');
  const q = normalizeGalleryQuery({ slotKey: 'ignored', slotKeys: [keys[0], 'not-a-part', keys[1], keys[0]], limit: 999 }, snap);
  assert.ok(q, 'a valid multi-part read was refused');
  assert.deepEqual(q.slotKeys, [keys[0], keys[1]], 'an unknown part rode into the read, or a repeat was kept');
  assert.equal(q.slotKey, keys[0]);
  assert.equal(q.limit, GALLERY_MAX_LIMIT, 'the cap no longer holds');
  assert.equal(normalizeGalleryQuery({ slotKey: keys[0], slotKeys: ['nope'] }, snap), null, 'all-invalid parts read anyway');
  const many = normalizeGalleryQuery({ slotKey: keys[0], slotKeys: Array.from({ length: 200 }, () => keys).flat() }, snap);
  assert.ok((many?.slotKeys?.length ?? 0) <= GALLERY_MAX_SLOT_KEYS);
  const studio = normalizeGalleryQuery({ slotKey: keys[0] }, snap);
  assert.equal(studio?.slotKeys, undefined, 'a Studio call grew a part list');
  const action = read('app/dashboard/[eventId]/studio/mood-board/actions.ts');
  const fetch = action.slice(action.indexOf('export async function fetchGalleryAssets('), action.indexOf('export async function applyGalleryPick('));
  assert.match(fetch, /query\.slotKeys \? gallery\.in\('asset_subtype', query\.slotKeys\) : gallery\.eq\('asset_subtype', query\.slotKey\)/);
  assert.match(fetch, /\.range\(query\.offset, query\.offset \+ query\.limit - 1\)/, 'the read lost its range');
});

test('4 · no request at open — the parts ride the page’s one batched read; photos are kept for the visit', () => {
  const page = read(`${VENDORS}/page.tsx`);
  const all = page.slice(page.indexOf('const [vendorsRead, eventCtx, photoMaps'), page.indexOf(']);', page.indexOf('const [vendorsRead, eventCtx, photoMaps')));
  assert.match(all, /getInspirationParts\(\)/, 'the parts are read outside the page’s one batch — a second wait');
  assert.match(page, /inspirationPartsByTile=\{findInspirationPartsByTile\(inspirationParts\)\}/);
  const box = read(`${VENDORS}/_components/find-inspiration.tsx`);
  assert.match(box, /fetchGalleryAssets\(input\)/, 'the box reads somewhere other than the shipped gallery read');
  // EVERY read — the first page and each next 24 — spans the category's parts in one call.
  const reads = [...box.matchAll(/\bread\(\{([^}]*)\}\)/g)].map((m) => m[1] ?? '');
  assert.equal(reads.length, 2, 'the box reads in a place this guard does not know');
  for (const r of reads) assert.match(r, /slotKeys: keys,/, 'All parts became one read per part');
  // …and each is looked up in the visit's answers first, and kept after.
  const looks = [...box.matchAll(/const kept = INSPIRATION_SEEN\.get\(key\);\s*if \(kept\) \{/g)];
  assert.equal(looks.length, 2, 'a second look asks again');
  assert.equal([...box.matchAll(/INSPIRATION_SEEN\.set\(key, page\)/g)].length, 2, 'an answer is not kept for the visit');
});

test('5 · reads honest — a failed read says so, never "no photos"', () => {
  const box = read(`${VENDORS}/_components/find-inspiration.tsx`);
  const failed = box.indexOf('failed && assets.length === 0');
  const empty = box.indexOf('total === 0');
  assert.ok(failed > 0 && empty > failed, 'a failed read can fall through to the empty sentence');
  assert.match(box, /We couldn’t load the photos just now\./);
  assert.match(box, /\.catch\(\(\) => \{\s*if \(!live\) return;\s*setFailed\(true\);/, 'a failed read is swallowed');
  assert.doesNotMatch(box, /INSPIRATION_SEEN\.set\([^)]*\)[^;]*catch/, 'a failed read is kept for the visit');
});

test('6 · switching keeps Services mounted, and the switch can pin under the head', () => {
  const bench = read(`${VENDORS}/_components/shortlist-categories.tsx`);
  assert.match(bench, /<div className="cat-svc" hidden=\{/, 'Services unmounts on Inspiration — switching back reads again');
  assert.match(bench, /\.slcat \.fold\.flat \.cat\.open>\.cat-collapse>\.cat-body\{overflow:clip\}/, 'the body scrolls — the switch can never pin');
  assert.match(
    bench,
    /\.slcat \.fold\.flat \.cat\.open \.cat-mode\{position:sticky;top:calc\(var\(--stick-h,150px\) \+ var\(--cat-head-h,0px\)\)/,
    'the switch does not pin directly under the head',
  );
});
