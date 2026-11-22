/**
 * ☁️ "COPY THIS EVENT TO GOOGLE DRIVE" — a supplier, per event (owner 2026-11-22). What this holds:
 *
 *   1. PER-EVENT SCOPE — one press copies exactly what ONE shop stores for ONE event: never another event's file,
 *      never another shop's, never a link, never an album photo still unscreened or taken down.
 *   2. NO DUPLICATES — the same stored object is one Drive copy per event, however many times it was filed and however
 *      many times Copy is pressed (the shipped ledger's rule, applied here before it ever reaches the database).
 *   3. HONEST — a failure is never "done", a refused read is never "nothing to copy".
 *   4. THE COUPLE'S DRIVE IS NEVER FED A SHOP'S FILE — every couple read in lib/drive-copy.ts says owner IS NULL.
 *   5. THE SHOP COMES FROM THE SESSION — the copy route never takes a shop id from the request.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  bucketOfStoredRef,
  copyResultWords,
  copyStatusOf,
  copiedSoFarLine,
  newCopyFiles,
  shopDriveBackPath,
  supplierEventCopyFiles,
  withParam,
  type ShopAlbumRow,
  type ShopEventFileRow,
} from './supplier-drive-copy';

const SHOP = '11111111-1111-4111-8111-111111111111';
const OTHER_SHOP = '22222222-2222-4222-8222-222222222222';
const EVENT = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const OTHER_EVENT = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const ref = (n: string, shop = SHOP) => `r2://setnayan-thread-files/supplier-files/${shop}/${n}.jpg`;

function file(over: Partial<ShopEventFileRow> & { file_id: string }): ShopEventFileRow {
  return {
    event_id: EVENT,
    vendor_profile_id: SHOP,
    grp: 'service',
    file_name: `${over.file_id}.jpg`,
    mime: 'image/jpeg',
    size_bytes: 100,
    portfolio_ref: null,
    supplier_media: { r2_ref: ref(over.file_id), mime: 'image/jpeg', size_bytes: 100 },
    ...over,
  };
}
function album(over: Partial<ShopAlbumRow> & { photo_id: string }): ShopAlbumRow {
  return {
    event_id: EVENT,
    vendor_profile_id: SHOP,
    r2_object_key: `r2://setnayan-media/papic/vendor-${SHOP}/portfolio/${EVENT}/${over.photo_id}.jpg`,
    hidden_at: null,
    nsfw_checked: true,
    created_at: '2026-11-22T00:00:00Z',
    ...over,
  };
}

test('1 · one event, one shop: other events, other shops, links, unscreened and taken-down album photos are never copied', () => {
  const out = supplierEventCopyFiles({
    shopId: SHOP,
    eventId: EVENT,
    files: [
      file({ file_id: 'kept' }),
      file({ file_id: 'doc', grp: 'booking', file_name: 'Contract.pdf', supplier_media: { r2_ref: ref('doc'), mime: 'application/pdf', size_bytes: 9 } }),
      file({ file_id: 'mapped', grp: 'linked', supplier_media: null, portfolio_ref: `r2://setnayan-media/vendors/${SHOP}/p.jpg` }),
      file({ file_id: 'other-event', event_id: OTHER_EVENT }),
      file({ file_id: 'other-shop', vendor_profile_id: OTHER_SHOP, supplier_media: { r2_ref: ref('x', OTHER_SHOP), mime: null, size_bytes: null } }),
      file({ file_id: 'a-link', grp: 'links', supplier_media: null }),
      file({ file_id: 'chat-only', grp: 'booking', supplier_media: null }),
    ],
    album: [
      album({ photo_id: 'shown' }),
      album({ photo_id: 'unscreened', nsfw_checked: false }),
      album({ photo_id: 'taken-down', hidden_at: '2026-11-21T00:00:00Z' }),
      album({ photo_id: 'elsewhere', event_id: OTHER_EVENT }),
      album({ photo_id: 'not-ours', vendor_profile_id: OTHER_SHOP }),
    ],
  });
  assert.deepEqual(
    out.map((f) => [f.sourceRef, f.artifactType]),
    [
      ['kept', 'supplier_files'],
      ['doc', 'supplier_files'],
      ['mapped', 'supplier_files'],
      ['shown', 'supplier_album'],
    ],
  );
  assert.equal(out[1]!.fileName, 'Contract.pdf');
  assert.equal(out[1]!.mimeType, 'application/pdf');
});

test('2 · no duplicates: the same object filed twice is one copy, and a second press records nothing new', () => {
  const twice = supplierEventCopyFiles({
    shopId: SHOP,
    eventId: EVENT,
    files: [file({ file_id: 'a' }), file({ file_id: 'a-again', supplier_media: { r2_ref: ref('a'), mime: 'image/jpeg', size_bytes: 100 } })],
    album: [],
  });
  assert.equal(twice.length, 1, 'one stored object = one Drive copy');

  const first = newCopyFiles(twice, new Set());
  assert.equal(first.length, 1);
  const recorded = new Set(first.map((f) => f.r2ObjectKey));
  assert.deepEqual(newCopyFiles(twice, recorded), [], 'pressing Copy again records nothing new');

  // A new file on the event is the only thing the next press adds.
  const more = [...twice, ...supplierEventCopyFiles({ shopId: SHOP, eventId: EVENT, files: [file({ file_id: 'b' })], album: [] })];
  assert.deepEqual(newCopyFiles(more, recorded).map((f) => f.sourceRef), ['b']);
});

test('the bucket is read from the ref, and a bucket that is not ours is refused', () => {
  const ours = { all: ['setnayan-media', 'setnayan-thread-files'], media: 'setnayan-media' };
  assert.equal(bucketOfStoredRef(ref('a'), ours), 'setnayan-thread-files');
  assert.equal(bucketOfStoredRef('papic/vendor-x/portfolio/e/a.jpg', ours), 'setnayan-media');
  assert.equal(bucketOfStoredRef('r2://someone-elses-bucket/a.jpg', ours), null);
});

test('3 · honest words: failures are never "done", a refused read is never "nothing to copy"', () => {
  assert.equal(copyStatusOf({ total: 4, copied: 4, failed: 0, remaining: 0 }), 'done');
  assert.equal(copyStatusOf({ total: 4, copied: 3, failed: 1, remaining: 0 }), 'some_failed');
  assert.equal(copyStatusOf({ total: 4, copied: 1, failed: 0, remaining: 3 }), 'copying');
  assert.equal(copyStatusOf({ total: 4, copied: 3, failed: 0, remaining: 0 }), 'some_failed', 'a file neither copied nor failed is not done');

  const partial = copyResultWords({ ok: true, status: 'some_failed', since: '', total: 4, copied: 3, failed: 1, remaining: 0 });
  assert.equal(partial.tone, 'bad');
  assert.match(partial.words, /couldn’t be copied/);
  const unread = copyResultWords({ ok: false, reason: 'unread' });
  const nothing = copyResultWords({ ok: true, status: 'nothing_to_copy' });
  assert.notEqual(unread.words, nothing.words);
  assert.equal(unread.tone, 'bad');
  assert.match(unread.words, /couldn’t read/);
  assert.equal(copyResultWords({ ok: true, status: 'done', since: '', total: 1, copied: 1, failed: 0, remaining: 0 }).words, '1 file in your Google Drive');
  assert.equal(copiedSoFarLine({ total: 0, copied: 0 }), null);
  assert.equal(copiedSoFarLine({ total: 5, copied: 2 }), '2 of 5 files copied to your Google Drive');
});

test('the way back after Google stays inside the supplier console', () => {
  const fallback = `/vendor-dashboard/clients/${EVENT}?tab=files`;
  assert.equal(shopDriveBackPath(`/vendor-dashboard/on-the-day/live/${EVENT}/papic#portfolio`, EVENT), `/vendor-dashboard/on-the-day/live/${EVENT}/papic#portfolio`);
  for (const bad of ['https://evil.example/x', '//evil.example/vendor-dashboard', '/dashboard/x', '/vendor-dashboardx', '/vendor-dashboard/\\evil', null]) {
    assert.equal(shopDriveBackPath(bad, EVENT), fallback, String(bad));
  }
  assert.equal(withParam('/vendor-dashboard/a?tab=files#portfolio', 'drive_copy', 'start'), '/vendor-dashboard/a?tab=files&drive_copy=start#portfolio');
});

const WEB = join(__dirname, '..');
const read = (p: string) => readFileSync(join(WEB, p), 'utf8');

test('4 · the couple\'s Drive path never reads a shop\'s rows', () => {
  const src = read('lib/drive-copy.ts');
  assert.match(src, /shopId \? q\.eq\('vendor_profile_id', shopId\) : q\.is\('vendor_profile_id', null\)/);
  for (const fn of ['export async function runDriveCopyBatch', 'async function ensureFolderRow', 'async function countPending']) {
    const start = src.indexOf(fn);
    assert.ok(start >= 0, fn);
    const body = src.slice(start, src.indexOf('\n}\n', start));
    assert.match(body, /byOwner\(/, `${fn} scopes its drive_copy_* reads by owner`);
  }
  assert.match(read('lib/papic-drive-copy-retry.ts'), /\.is\('vendor_profile_id', null\)[\s\S]*\.is\('vendor_profile_id', null\)/, 'the retry sweep re-drives couple rows only');
});

test('5 · the copy route resolves the shop from the session, never from the request', () => {
  const src = read('app/api/vendor/drive-copy/route.ts');
  assert.match(src, /fetchOwnVendorProfile\(supabase, user\.id\)/);
  assert.match(src, /shopId: profile\.vendor_profile_id/);
  assert.doesNotMatch(src, /body\?\.(vendor_profile_id|shop)/);
});
