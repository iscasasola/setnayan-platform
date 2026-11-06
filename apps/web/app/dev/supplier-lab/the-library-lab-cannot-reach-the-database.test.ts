/**
 * the-library-lab-cannot-reach-the-database.test.ts — 🧪 the inspiration library's lab round trip
 * (`/dev/supplier-lab?s=library` → lab Approve → `/dev/details-lab?look=1&studio=1&library=1`) holds no database, runs
 * the shipped gates, and refuses in production.
 *
 *   1 · the lab's server half imports no Supabase client and exports ONE function (one Vercel route), whose first
 *       statement refuses in production;
 *   2 · behaviour: a photo uploaded to a part through the lab is a DRAFT the couple cannot see, tagged with its own
 *       colours at upload; after the lab's Approve (even with no tags at all) the couple's Search ideas on THAT part lists
 *       it, credited to the shop — and another part's Search ideas does not; a part outside the shop's trades and an
 *       unticked rights box are refused with the shipped sentences;
 *   3 · the editor takes its writes from the page in the app (none handed in), so only the lab swaps them.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import sharp from 'sharp';
import { stripComments } from '@/lib/strip-comments';

{
  const Mod = require('node:module');
  const load = Mod._load;
  Mod._load = function (request: string, ...rest: unknown[]) {
    if (request === 'server-only' || request === 'client-only') return {};
    /* The lab fetches a shop photo from its own dev server; here that server is the repo's public/ folder. */
    if (request === 'next/headers') return { headers: async () => new Map([['host', 'lab.test']]) };
    return load.call(this, request, ...rest);
  };
}

const HERE = __dirname;
const WEB = join(HERE, '..', '..', '..');
const src = stripComments(readFileSync(join(HERE, 'library-lab-server.ts'), 'utf8'));

test('1 · no database client, one export, refused in production first', () => {
  assert.doesNotMatch(src, /supabase|createClient|createAdminClient|from '@\/lib\/r2'|hashAndScanVendorImages/, 'the lab reaches a database or storage');
  assert.equal((src.match(/^export\s+(?:async\s+)?(?:function|const)\s+\w+/gm) ?? []).length, 1, 'the lab exports more than one server action');
  const body = src.slice(src.indexOf('export async function libraryLab('));
  assert.match(body.slice(body.indexOf('{') + 1).trimStart(), /^if \(process\.env\.NODE_ENV === 'production'\) throw/, 'the production refusal is not the first statement');
});

test('2 · supplier adds → draft → approved → the couple’s Search ideas on that part lists it, credited; elsewhere it does not', async () => {
  const prevKey = process.env.ANTHROPIC_API_KEY;
  delete process.env.ANTHROPIC_API_KEY;
  const prevCwd = process.cwd();
  process.chdir(WEB);
  const prevFetch = globalThis.fetch;
  globalThis.fetch = (async (url: string | URL) => {
    const path = new URL(String(url)).pathname;
    try {
      return new Response(new Uint8Array(readFileSync(join(WEB, 'public', path))), { status: 200 });
    } catch {
      return new Response('', { status: 404 });
    }
  }) as typeof fetch;
  try {
    const { libraryLab } = await import('./library-lab-server');
    await libraryLab({ op: 'reset' });
    const jpeg = await sharp({ create: { width: 64, height: 64, channels: 3, background: '#7A8B6F' } }).jpeg().toBuffer();
    const form = (slot: string, warranted = true, file: Blob | null = new Blob([new Uint8Array(jpeg)], { type: 'image/jpeg' })) => {
      const fd = new FormData();
      if (file) fd.set('file', new File([file], 'chairs.jpg', { type: 'image/jpeg' }));
      fd.set('label', 'Our cross-back chairs');
      fd.set('assetType', 'supplier_gallery');
      fd.set('assetSubtype', slot);
      if (warranted) fd.set('rightsWarranted', '1');
      return fd;
    };
    await assert.rejects(() => libraryLab({ op: 'upload' }, form('chairs', false)), /confirm you hold the rights/);
    await assert.rejects(() => libraryLab({ op: 'upload' }, form('bride')), /don’t cover Bridal gown/, 'a stylist was let onto the gown shelf');

    const up = (await libraryLab({ op: 'upload' }, form('chairs'))) as { assetId: string; textScreen: string };
    assert.equal(up.textScreen, 'unavailable', 'the lab claimed it read the text it cannot read');
    type Page = { assets: { assetId: string; credit: string; swatches: string[] }[]; total: number };
    const gallery = (slotKey: string) => libraryLab({ op: 'gallery', slotKey }) as Promise<Page>;
    assert.equal((await gallery('chairs')).total, 0, 'a draft reached the couple');

    /* Tagged at upload with the photo's own colour (a flat #7A8B6F square reads as itself, never as cream). */
    const ranges = Object.values((up as unknown as { colorRanges: Record<number, { sampledHex: string }> }).colorRanges);
    assert.ok(ranges.length > 0, 'the upload arrived untagged');
    /* Within a JPEG's rounding of #7A8B6F (the photo travels as a JPEG). */
    const near = (hex: string) => [1, 3, 5].every((i, k) => Math.abs(parseInt(hex.slice(i, i + 2), 16) - [0x7a, 0x8b, 0x6f][k]!) <= 4);
    assert.ok(near(ranges[0]!.sampledHex), `the photo's own colour was not read: ${ranges.map((r) => r.sampledHex)}`);

    await libraryLab({ op: 'approve', assetId: up.assetId });
    /* Even with its tags cleared, an approved photo still reaches the couple (shown untagged, never withheld). */
    await libraryLab({ op: 'tags', assetId: up.assetId, map: {} });
    const untagged = await gallery('chairs');
    assert.equal(untagged.total, 1);
    assert.equal(untagged.assets.length, 1, 'an approved photo with no colours was hidden from the couple');
    assert.deepEqual(untagged.assets[0]!.swatches, [], 'an untagged photo was given invented colours');

    await libraryLab({ op: 'tags', assetId: up.assetId, map: { 1: { slotId: 1, sampledHex: '#7A8B6F', toleranceDe: 12 } } });
    const page = await gallery('chairs');
    assert.equal(page.assets.length, 1);
    assert.equal(page.assets[0]!.assetId, up.assetId);
    assert.equal(page.assets[0]!.credit, 'Bloom & Vine Styling · Stylist / Decorator', 'not credited to the shop by its trade');
    assert.equal((await gallery('stage')).total, 0, 'the chairs photo leaked onto another part');

    /* From the shop's own photos: a ref on the shop's list is taken; a made-up one is refused before anything is read. */
    const shop = form('lights', true, null);
    shop.set('shopPhotoRef', '/realstories/jack-jill-g1.jpg');
    const fromShop = (await libraryLab({ op: 'upload' }, shop)) as { assetId: string };
    assert.ok(fromShop.assetId);
    const stranger = form('lights', true, null);
    stranger.set('shopPhotoRef', '/realstories/not-ours.jpg');
    await assert.rejects(() => libraryLab({ op: 'upload' }, stranger), /isn’t one of your shop’s photos/);
  } finally {
    process.chdir(prevCwd);
    globalThis.fetch = prevFetch;
    if (prevKey !== undefined) process.env.ANTHROPIC_API_KEY = prevKey;
  }
});

test('3 · in the app the editor runs the shipped writes — only the lab hands in others', () => {
  const page = stripComments(readFileSync(join(WEB, 'app/vendor-dashboard/moodboard-library/page.tsx'), 'utf8'));
  const mount = page.slice(page.indexOf('<StylistLibraryEditor'), page.indexOf('/>', page.indexOf('<StylistLibraryEditor')));
  assert.doesNotMatch(mount, /actions=/, 'the app hands the editor stand-in writes');
  const editor = stripComments(readFileSync(join(WEB, 'app/vendor-dashboard/moodboard-library/_components/stylist-library-editor.tsx'), 'utf8'));
  assert.match(editor, /const SHIPPED_ACTIONS: StylistLibraryActions = \{ uploadStylistAsset, importEditorialMediaToGallery, saveStylistColorRanges, deleteStylistAsset \}/);
});
