/**
 * EVERY SUPPLIER PHOTO IS MARKED — THE SERVER PATHS (Seal and plate, owner-approved 2026-11-04 · Build 6 Lane L,
 * owner 10 Nov: "yes build 6").
 *
 * The BROWSER paths (every `<FileUpload pathPrefix={`vendors/…`}>`) are held by `the-supplier-mark-is-wired.test.ts`.
 * This file holds the paths with no browser: the one server door (`publishMarkedSupplierPhoto`), who must use it, and
 * the backfill plan for photos published before the mark existed.
 *
 *   1 · the door FAILS CLOSED: a mark (or shop read) that throws publishes nothing; the public copy is only ever the
 *       marked bytes; the clean copy is stored before anything public is written; a stored clean copy wins (no
 *       double mark on a re-run); a key outside the shop's folder writes nothing.
 *   2 · SCAN: every server file that writes to R2 is either the door, a caller of the door, or named below with the
 *       reason it is not a supplier photo. A NEW writer fails this test until somebody decides which it is.
 *   3 · the album → page publish and the Instagram re-host go through the door and keep no raw-copy path.
 *   4 · the backfill plan: unpaired photos in the shop's own folder are planned once; clips and foreign refs never.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { stripComments } from './strip-comments';
import { cleanCopyKeyFor, publishMarkedSupplierPhoto, type PublishDeps } from './supplier-photo-publish.server';
import { describeBackfill, planSupplierPhotoBackfill } from './supplier-photo-backfill';

const ROOT = process.cwd();
const code = (rel: string) => stripComments(fs.readFileSync(path.join(ROOT, rel), 'utf8'));

const SHOP = '11111111-2222-3333-4444-555555555555';
const SPEC = { kind: 'supplier' as const, verified: false, shopName: 'Bloom', slug: 'bloom', hasLogo: false };

function fakeDeps(over: Partial<PublishDeps> = {}, stored: Uint8Array | null = null) {
  const log: string[] = [];
  const deps: PublishDeps = {
    getOriginal: async (k) => (log.push(`getOriginal ${k}`), stored),
    putOriginal: async (k, b) => void log.push(`putOriginal ${k} ${b[0]}`),
    putPublic: async (k, b) => void log.push(`putPublic ${k} ${b[0]}`),
    specFor: async () => (log.push('specFor'), { spec: SPEC, logoPng: null }),
    mark: async (b) => (log.push(`mark ${b[0]}`), Buffer.from([9])),
    normalise: async () => (log.push('normalise'), Buffer.from([5])),
    pair: async (r) => void log.push(`pair ${r.public_ref} ${r.mark_kind}`),
    ...over,
  };
  return { deps, log };
}

/* ── 1 · the door ───────────────────────────────────────────────────────── */

test('the door: clean copy first, then the mark, then ONLY the marked bytes go public, then the pairing', async () => {
  const { deps, log } = fakeDeps();
  const key = `vendors/${SHOP}/portfolio/from-album/a.jpg`;
  const out = await publishMarkedSupplierPhoto({ vendorProfileId: SHOP, publicKey: key, bytes: new Uint8Array([1]) }, deps);
  const orig = cleanCopyKeyFor(key);
  assert.deepEqual(log, [`getOriginal ${orig}`, 'normalise', `putOriginal ${orig} 5`, 'specFor', 'mark 5', `putPublic ${key} 9`, `pair r2://setnayan-media/${key} setnayan`]);
  assert.equal(out.publicRef, `r2://setnayan-media/${key}`);
  assert.equal(out.originalRef, `r2://setnayan-vendor-verification/vendor-originals/${SHOP}/server/portfolio/from-album/a.jpg`);
});

test('SABOTAGE-PROVEN: a stored clean copy is the source — a re-run never marks the marked bytes again', async () => {
  const { deps, log } = fakeDeps({}, new Uint8Array([7]));
  await publishMarkedSupplierPhoto({ vendorProfileId: SHOP, publicKey: `vendors/${SHOP}/ig/x.jpg`, bytes: new Uint8Array([9]) }, deps);
  assert.ok(!log.some((l) => l.startsWith('putOriginal')), 'the stored clean copy was overwritten');
  assert.ok(log.includes('mark 7'), 'the mark was not drawn from the stored clean copy');
});

test('SABOTAGE-PROVEN: FAIL-CLOSED — a mark, a shop read or a clean-copy write that throws publishes NOTHING', async () => {
  for (const over of [
    { mark: async () => Promise.reject(new Error('no fonts')) },
    { specFor: async () => Promise.reject(new Error('shop unreadable')) },
    { putOriginal: async () => Promise.reject(new Error('r2 down')) },
    { mark: async () => Buffer.alloc(0) },
  ] satisfies Partial<PublishDeps>[]) {
    const { deps, log } = fakeDeps(over);
    await assert.rejects(publishMarkedSupplierPhoto({ vendorProfileId: SHOP, publicKey: `vendors/${SHOP}/ig/x.jpg`, bytes: new Uint8Array([1]) }, deps));
    assert.ok(!log.some((l) => l.startsWith('putPublic') || l.startsWith('pair')), `published after a failure: ${log.join(' · ')}`);
  }
});

test('the door refuses a key outside the shop\'s own folder, before anything is read or written', async () => {
  for (const key of ['vendors/someone-else/portfolio/a.jpg', `papic/vendor-${SHOP}/portfolio/a.jpg`, `vendors/${SHOP}/../x/a.jpg`]) {
    const { deps, log } = fakeDeps();
    await assert.rejects(publishMarkedSupplierPhoto({ vendorProfileId: SHOP, publicKey: key, bytes: new Uint8Array([1]) }, deps));
    assert.ok(!log.some((l) => l.startsWith('put') || l.startsWith('pair')), key);
  }
});

test('a verified shop\'s photo is paired as verified (the re-mark job reads mark_kind)', async () => {
  const { deps, log } = fakeDeps({ specFor: async () => ({ spec: { ...SPEC, verified: true }, logoPng: null }) });
  await publishMarkedSupplierPhoto({ vendorProfileId: SHOP, publicKey: `vendors/${SHOP}/ig/x.jpg`, bytes: new Uint8Array([1]) }, deps);
  assert.ok(log.at(-1)?.endsWith(' verified'));
});

test('the door itself never catches — a caught failure is an unmarked photo', () => {
  const src = code('lib/supplier-photo-publish.server.ts');
  const body = src.slice(src.indexOf('export async function publishMarkedSupplierPhoto'), src.indexOf('export function defaultDeps'));
  assert.doesNotMatch(body, /\bcatch\b/);
  assert.ok(body.indexOf('await deps.mark(') < body.indexOf('await deps.putPublic('), 'the public copy is written before the mark');
  assert.ok(body.indexOf('await deps.putOriginal(') < body.indexOf('await deps.putPublic('), 'the public copy exists before its clean copy');
  assert.match(body, /await deps\.putPublic\(publicKey, marked\)/, 'the public copy must be the MARKED bytes');
});

/* ── 2 · every server writer is classified ──────────────────────────────── */

/** Server files that write to R2 and are NOT a supplier's public photo — each with why. */
const NOT_A_SUPPLIER_PHOTO: Record<string, string> = {
  'app/admin/app-performance/actions.ts': 'admin performance snapshots',
  'app/admin/menus/actions.ts': 'admin-authored menu artwork',
  'app/admin/moodboard-library/actions.ts': 'the Setnayan template library (admin-authored, Setnayan-marked)',
  'app/admin/settings/actions.ts': 'platform settings assets',
  'app/admin/studio/_surfaces/moodboard-library-surface.tsx': 'the admin template library surface',
  'app/api/samahan/story/route.ts': 'a community story, not a shop',
  'app/api/vendor/papic-portfolio-import/route.ts': 'the PRIVATE album lane (papic/vendor-…); it reaches the page only through the 7-day publish, which is the door',
  'app/papic/buy/actions.ts': 'a couple\'s Papic purchase',
  'app/vendor-dashboard/contracts/actions.ts': 'a private contract PDF (vendor-contracts bucket)',
  'app/vendor-dashboard/moodboard-library/actions.ts': 'Inspiration: marked on the server with the Seal and plate (watermarkImageBytes + shopMarkFacts)',
  'app/vendor-dashboard/moodboard-library/page.tsx': 'the Inspiration page (its writes are the actions above)',
  'lib/face-blur.ts': 'event wall derivatives (guests\' faces blurred)',
  'lib/old-photo-copies.server.ts': 'web copies of EVENT covers (media_web_copy_candidates)',
  'lib/pabuya-qr-store.server.ts': 'a couple\'s gift QR',
  'lib/papic-derivatives.ts': 'Papic event-photo derivatives',
  'lib/papic-ingest-fidelity.ts': 'Papic event-photo ingest',
  'lib/papic-upload-intents.server.ts': 'Papic capture intents',
  'lib/r2.ts': 'the storage client itself',
  'lib/social/recap-post.ts': 'a Setnayan social post image',
  'lib/std-bg-image.ts': 'a couple\'s Save-the-Date background',
  'lib/std-video-gate.ts': 'a couple\'s Save-the-Date video',
  'lib/storage.ts': 'the presign helpers a browser upload uses (held by the-supplier-mark-is-wired.test.ts)',
  'lib/supabase-unread-error-scan.ts': 'a source scanner that names these calls, writes nothing',
  'lib/uploads.ts': 'the presign helpers a browser upload uses (held by the-supplier-mark-is-wired.test.ts)',
};

const WRITES = /\b(r2Upload|r2Copy)\(|new PutObjectCommand\(|\.storage\.from/;

function walk(dir: string, out: string[] = []): string[] {
  for (const e of fs.readdirSync(path.join(ROOT, dir), { withFileTypes: true })) {
    const rel = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (e.name === 'node_modules' || e.name.startsWith('.')) continue;
      walk(rel, out);
    } else if (/\.(ts|tsx)$/.test(e.name) && !/\.(test|fixture)\.tsx?$/.test(e.name)) out.push(rel);
  }
  return out;
}

test('SABOTAGE-PROVEN: every server R2 writer is the door, uses the door, or says why it is not a supplier photo', () => {
  const unclassified: string[] = [];
  const writers = new Set<string>();
  for (const file of [...walk('app'), ...walk('lib')]) {
    const raw = fs.readFileSync(path.join(ROOT, file), 'utf8');
    if (!WRITES.test(raw)) continue;
    writers.add(file);
    if (file === 'lib/supplier-photo-publish.server.ts') continue;
    if (/publishMarkedSupplierPhoto\(/.test(stripComments(raw))) continue;
    if (NOT_A_SUPPLIER_PHOTO[file]) continue;
    unclassified.push(file);
  }
  assert.deepEqual(unclassified, [], 'a new R2 writer — route a supplier photo through publishMarkedSupplierPhoto, or add it to NOT_A_SUPPLIER_PHOTO with why');
  const stale = Object.keys(NOT_A_SUPPLIER_PHOTO).filter((f) => !writers.has(f));
  assert.deepEqual(stale, [], 'an exemption names a file that no longer writes — remove it');
  // A file that builds a supplier's public key and writes raw bytes is never exempt.
  for (const file of writers) {
    const src = stripComments(fs.readFileSync(path.join(ROOT, file), 'utf8'));
    if (file === 'lib/supplier-photo-publish.server.ts') continue;
    if (/[`'"]vendors\/\$\{/.test(src)) {
      assert.match(src, /publishMarkedSupplierPhoto\(/, `${file} writes under vendors/… without the mark`);
    }
  }
});

/* ── 3 · the two server publishes ───────────────────────────────────────── */

test('SABOTAGE-PROVEN: an album photo reaches the page MARKED — never a raw copy, and a failure keeps it waiting', () => {
  const s = code('lib/supplier-page-notice.server.ts');
  const body = s.slice(s.indexOf('export async function publishDueSupplierPagePhotos('));
  assert.doesNotMatch(s, /r2Copy/, 'the raw album copy is back');
  assert.match(body, /await publishMarkedSupplierPhoto\(\{ vendorProfileId: n\.vendor_profile_id, publicKey: to\.key, bytes: album\.bytes \}\);\s*\} catch \(err\) \{\s*console\.error\([^)]*\);\s*continue;/);
  // A guest's Remove takes the clean copy and the pairing with the page copy.
  const del = s.slice(s.indexOf('export async function deleteSupplierPageCopy('), s.indexOf('export async function deletePageCopyAfterTakedown('));
  assert.match(del, /cleanCopyKeyFor\(page\.key\)/);
  assert.match(del, /from\('supplier_photo_originals'\)\s*\.delete\(\)/);
  assert.match(code('lib/cleanup-delete-scope.ts'), /vendor-originals\/\$\{v\}\/server\/portfolio\/from-album\//);
});

test('SABOTAGE-PROVEN: an Instagram post is re-hosted MARKED, or dropped — never the raw bytes', () => {
  const s = code('app/vendor-dashboard/instagram-actions.ts');
  const fn = s.slice(s.indexOf('async function rehostImage('), s.indexOf('async function syncInstagramMedia('));
  assert.doesNotMatch(fn, /r2Upload|PutObjectCommand|encodeR2Ref/, 'a raw re-host path is back');
  assert.match(fn, /const published = await publishMarkedSupplierPhoto\(\{ vendorProfileId, publicKey: key, bytes: buf \}\);\s*return published\.publicRef;/);
  assert.match(fn, /\} catch \(err\) \{\s*console\.error\([^)]*\);\s*return null;\s*\}/);
});

/* ── 4 · the backfill plan ──────────────────────────────────────────────── */

test('the backfill plans each unpaired photo in the shop\'s own folder ONCE; clips and foreign refs are never touched', () => {
  const own = `r2://setnayan-media/vendors/${SHOP}/portfolio/a.jpg`;
  const plan = planSupplierPhotoBackfill(
    [
      { vendor_profile_id: SHOP, column: 'vendor_profiles.portfolio_r2_keys', ref: own },
      { vendor_profile_id: SHOP, column: 'vendor_profiles.microsite_hero_photo_key', ref: own },
      { vendor_profile_id: SHOP, column: 'vendor_services.primary_photo_r2_key', ref: `r2://setnayan-media/vendors/${SHOP}/services/b.jpg` },
      { vendor_profile_id: SHOP, column: 'vendor_services.showcase_video_r2_key', ref: `r2://setnayan-media/vendors/${SHOP}/services/showcase/c.mp4` },
      { vendor_profile_id: SHOP, column: 'vendor_services.showcase_photo_r2_keys', ref: 'r2://setnayan-media/vendors/someone-else/x.jpg' },
      { vendor_profile_id: SHOP, column: 'vendor_services.showcase_photo_r2_keys', ref: 'https://example.com/legacy.jpg' },
      { vendor_profile_id: SHOP, column: 'vendor_ig_media.r2_key', ref: `r2://setnayan-media/vendors/${SHOP}/ig/done.jpg` },
      { vendor_profile_id: SHOP, column: 'vendor_ig_media.thumbnail_r2_key', ref: null },
    ],
    new Set([`r2://setnayan-media/vendors/${SHOP}/ig/done.jpg`]),
  );
  assert.deepEqual(plan.photos.map((p) => p.key), [`vendors/${SHOP}/portfolio/a.jpg`, `vendors/${SHOP}/services/b.jpg`]);
  assert.deepEqual(plan.photos[0]!.columns, ['vendor_profiles.portfolio_r2_keys', 'vendor_profiles.microsite_hero_photo_key'], 'a cover is the same photo as its portfolio entry — planned once');
  assert.equal(plan.clips.length, 1);
  assert.equal(plan.foreign, 2);
  assert.equal(plan.paired, 1);
  assert.ok(describeBackfill(plan, 0).includes('unmarked photos to mark: 2'));
  // Nothing left → the second run plans nothing (idempotent).
  const again = planSupplierPhotoBackfill([{ vendor_profile_id: SHOP, column: 'vendor_profiles.portfolio_r2_keys', ref: own }], new Set([own]));
  assert.equal(again.photos.length, 0);
});
