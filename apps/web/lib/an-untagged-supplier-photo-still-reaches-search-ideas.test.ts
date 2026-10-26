/**
 * an-untagged-supplier-photo-still-reaches-search-ideas.test.ts — 🌱🖼 AN APPROVED SUPPLIER PHOTO IS NEVER INVISIBLE FOR
 * WANT OF A COLOUR TAG (controller on PR #6655, 2026-10-19; owner goal *"create more inspirations faster"*).
 *
 * The couple's gallery used to withhold a supplier photo with no tagged colour ranges, and suppliers do not tag
 * colours — so an approved, credited photo reached nobody: a success-shaped nothing. Held four ways:
 *
 *   1 · an approved `supplier_gallery` row with ZERO ranges reaches Search ideas for EVERY couple part — shown,
 *       credited, with a servable image URL, and with no invented colour;
 *   2 · "Matches my colours" never hides it, and ranks it after the photos that match;
 *   3 · saving it works: `applyGalleryPick` reads its colours off its own pixels (the shipped extractor's bucketing,
 *       server-side) — and the extractor returns what the pixels hold, never cream padding;
 *   4 · it is the fallback, not the path: every supplier upload (a file, or one of the shop's own photos — both go
 *       through `storeScreenedAsset`) is tagged with its own colours at upload.
 *
 * Sabotaged, seen red, restored (see the PR body): the no-colour withholding put back → 1 · the filter hides untagged
 * photos again → 2 · the pick refuses an untagged photo → 3 · the extractor pads with cream → 3 · the upload stops
 * writing the auto ranges → 4.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import sharp from 'sharp';
import { stripComments } from './strip-comments';

{
  const Mod = require('node:module');
  const load = Mod._load;
  Mod._load = function (request: string, ...rest: unknown[]) {
    if (request === 'server-only' || request === 'client-only') return {};
    return load.call(this, request, ...rest);
  };
}

import { shapeGalleryPage, normalizeGalleryQuery, MOODBOARD_SLOT_TRADES, type RawGalleryRow } from './moodboard-gallery';
import { libraryPhotoParts } from './inspiration-slots';
import { canonicalServicesForTile } from './vendor-counts';
import { fallbackInspirationParts } from './inspiration-parts';

const WEB = join(__dirname, '..');
const code = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));
const fnBody = (src: string, head: string) => {
  const at = src.indexOf(head);
  assert.ok(at >= 0, `${head} is gone`);
  return src.slice(at, src.indexOf('\n}\n', at));
};

test('1 · an approved supplier photo with zero colour ranges reaches Search ideas on every couple part, credited', () => {
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://lab.supabase.test';
  const parts = libraryPhotoParts(fallbackInspirationParts());
  assert.ok(parts.length >= 20);
  for (const p of parts) {
    const services = canonicalServicesForTile(MOODBOARD_SLOT_TRADES[p.key][0]!);
    const row: RawGalleryRow = {
      asset_id: `untagged-${p.key}`,
      label: 'Untagged',
      storage_path: `moodboard-library/u1/${p.key}.jpg`,
      vendor_profile_id: 'V1',
      shop: { business_name: 'Bloom & Vine', services },
      ranges: [],
      is_event_linked: false,
    };
    const q = normalizeGalleryQuery({ slotKey: p.key }, fallbackInspirationParts());
    assert.ok(q, `${p.label}: Search ideas cannot ask for ${p.key}`);
    const page = shapeGalleryPage(q!.slotKey, [row], fallbackInspirationParts());
    assert.equal(page.withheld, 0, `${p.label}: an untagged approved photo was withheld — invisible to every couple`);
    assert.equal(page.assets.length, 1, `${p.label}: the untagged photo did not reach Search ideas`);
    const a = page.assets[0]!;
    assert.deepEqual(a.swatches, [], `${p.label}: an untagged photo was given colours it does not have`);
    assert.match(a.credit, /^Bloom & Vine · /, `${p.label}: not credited`);
    assert.equal(a.imageUrl, `https://lab.supabase.test/storage/v1/object/public/moodboard-library/u1/${p.key}.jpg`, `${p.label}: the picture is a bucket path, not a URL`);
  }
  /* Older rows' URLs and site paths pass through untouched. */
  const legacy = shapeGalleryPage('flowers', [{ asset_id: 'x', label: '', storage_path: 'https://cdn/x.webp', vendor_profile_id: 'V1', shop: { business_name: 'B', services: [] }, ranges: [], is_event_linked: false }], fallbackInspirationParts());
  assert.equal(legacy.assets[0]!.imageUrl, 'https://cdn/x.webp');
});

test('2 · “Matches my colours” never hides an untagged photo, and draws it after the matches', () => {
  const picker = code('app/dashboard/[eventId]/studio/mood-board/_components/gallery-picker.tsx');
  assert.match(picker, /const untagged = \(a: GalleryAsset\) => a\.swatches\.length === 0;/);
  assert.match(picker, /const hiddenAsset = \(a: GalleryAsset\) => Boolean\(studio && matchMine && !untagged\(a\) && !photoMatchesColours\(a\.swatches, studio\.mainFive\)\);/, 'the filter hides an untagged photo');
  assert.match(picker, /const shown = studio && matchMine \? \[\.\.\.assets\.filter\(\(a\) => !untagged\(a\)\), \.\.\.assets\.filter\(untagged\)\] : assets;/, 'untagged photos are not ranked after the matches');
  assert.match(picker, /\{shown\.map\(\(asset\) => \{/, 'the grid does not draw the ranked list');
  assert.doesNotMatch(picker, /carries no sampled colours|or its colours\./, 'the picker still tells couples untagged photos are hidden');
});

test('3 · saving an untagged photo reads its colours off its own pixels — and the extractor never invents one', async () => {
  const body = fnBody(code('app/dashboard/[eventId]/studio/mood-board/actions.ts'), 'export async function applyGalleryPick(');
  const shapedAt = body.indexOf('shapeGalleryPage(');
  const readAt = body.indexOf('await extractPaletteFromBytes(bytes)');
  const insertAt = body.indexOf(".from('event_inspiration_assets').insert(");
  assert.ok(shapedAt > 0 && readAt > shapedAt && insertAt > readAt, 'an untagged photo’s colours are not read before the board row is written');
  assert.match(body, /if \(shaped\.swatches\.length === 0\) \{/);
  assert.match(body, /asset = \{ \.\.\.shaped, swatches: Array\.from\(\{ length: 6 \}, \(_, i\) => read\[i % read\.length\]!\) \};/);

  const { extractPaletteFromBytes, autoColourRanges } = await import('./extract-palette.server');
  const two = await sharp({ create: { width: 40, height: 40, channels: 3, background: '#7A8B6F' } })
    .composite([{ input: await sharp({ create: { width: 40, height: 12, channels: 3, background: '#B22222' } }).png().toBuffer(), top: 0, left: 0 }])
    .png()
    .toBuffer();
  const hexes = await extractPaletteFromBytes(new Uint8Array(two));
  /* Most common first: the green field, then the red band (the downscale's blended edge pixels trail after). */
  assert.deepEqual(hexes.slice(0, 2), ['#7A8B6F', '#B22222'], `the photo's two colours were not what came back first: ${hexes}`);
  const CREAM = ['#F8F1E7', '#E2D5C0', '#C9A87C', '#9B7A4F', '#5C3A1E', '#2B1810'];
  assert.ok(!hexes.some((h) => CREAM.includes(h)), 'the server extractor padded with the Canvas path’s cream defaults');
  const blank = await sharp({ create: { width: 20, height: 20, channels: 3, background: '#FFFFFF' } }).png().toBuffer();
  assert.deepEqual(await extractPaletteFromBytes(new Uint8Array(blank)), [], 'a photo with no readable colour came back with invented ones');
  assert.deepEqual(await extractPaletteFromBytes(new Uint8Array([1, 2, 3])), [], 'unreadable bytes came back with colours');
  const map = await autoColourRanges(new Uint8Array(two));
  assert.ok(Object.keys(map).length >= 2 && Object.keys(map).length <= 6);
  assert.deepEqual(map[1], { slotId: 1, sampledHex: '#7A8B6F', toleranceDe: 15, regionLabel: 'Auto' });
});

test('4 · every supplier upload is tagged with its own colours at upload (file and shop photo share one door)', () => {
  const actions = code('app/vendor-dashboard/moodboard-library/actions.ts');
  const store = fnBody(actions, 'async function storeScreenedAsset(');
  const insertRow = store.indexOf(".from('moodboard_library_assets')\n    .insert(");
  const readColours = store.indexOf('colorRanges = await autoColourRanges(args.bytes);');
  const writeColours = store.indexOf(".from('moodboard_asset_color_ranges').insert(rangeRows)");
  assert.ok(insertRow > 0 && readColours > insertRow && writeColours > readColours, 'the upload no longer writes the photo’s own colours with its row');
  assert.match(store, /if \(isGalleryRow\) \{\s*colorRanges = await autoColourRanges\(args\.bytes\);/);
  /* Both photo sources reach that one door. */
  const upload = fnBody(actions, 'export async function uploadStylistAsset(');
  assert.match(upload, /: await readShopOwnPhoto\(profile, shopPhotoRef!\);/);
  assert.equal((upload.match(/await storeScreenedAsset\(\{/g) ?? []).length, 1);
});
