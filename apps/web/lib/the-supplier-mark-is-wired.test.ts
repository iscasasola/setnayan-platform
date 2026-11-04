/**
 * THE SUPPLIER MARK IS WIRED, FAILS CLOSED, AND IS NEVER CROPPED OFF
 * (Seal and plate, owner-approved 2026-11-04 · controller audit items 1–6).
 *
 * Source guards (each sabotage-proven — see the changelog fragment for the
 * runs) plus pure checks of the server-side spec and the re-mark job.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { stripComments } from './strip-comments';
import { shopMarkFromRow } from './supplier-mark-spec.server';
import { pendingRemarks, remarkOne, type OriginalRow, type RemarkDeps } from './supplier-photo-remark.server';
import { displayAspectAllowed } from './photo-mark-geometry';

const ROOT = process.cwd();
const read = (rel: string) => fs.readFileSync(path.join(ROOT, rel), 'utf8');
const code = (rel: string) => stripComments(read(rel));

function walk(dir: string, out: string[] = []): string[] {
  for (const e of fs.readdirSync(path.join(ROOT, dir), { withFileTypes: true })) {
    const rel = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (e.name === 'node_modules' || e.name.startsWith('.')) continue;
      walk(rel, out);
    } else if (e.name.endsWith('.tsx')) out.push(rel);
  }
  return out;
}

/** Every `<FileUpload … />` block in a file, as its own text. */
function uploadBlocks(src: string): string[] {
  const blocks: string[] = [];
  let i = src.indexOf('<FileUpload');
  while (i !== -1) {
    const end = src.indexOf('/>', i);
    blocks.push(src.slice(i, end === -1 ? undefined : end + 2));
    i = src.indexOf('<FileUpload', i + 1);
  }
  return blocks;
}

/**
 * A supplier upload under `vendors/<id>/…` that is NOT a marketplace photo, and why.
 * Anything else under `vendors/` must pass `mark="supplier"`.
 */
const EXEMPT: ReadonlyArray<[RegExp, string]> = [
  [/\/logo`/, 'the shop logo carries no mark — it IS the coin inside the mark (approved matrix: NONE)'],
  [/\/verification\//, 'verification documents must stay whole (approved matrix: excluded)'],
  [/\/poster`/, 'a booth poster is printed for one event, not a marketplace photo'],
];

test('SABOTAGE-PROVEN: every supplier photo upload passes mark="supplier"', () => {
  const missing: string[] = [];
  let checked = 0;
  for (const file of walk('app')) {
    const src = code(file);
    for (const block of uploadBlocks(src)) {
      const prefix = /pathPrefix=\{`([^`]*)`\}/.exec(block)?.[1];
      if (!prefix || !prefix.startsWith('vendors/')) continue;
      if (EXEMPT.some(([re]) => re.test(`${prefix}\``) || re.test(prefix))) continue;
      checked += 1;
      if (!/\bmark="supplier"/.test(block)) missing.push(`${file}: ${prefix}`);
    }
  }
  assert.ok(checked >= 6, `expected the six supplier photo/clip uploads, found ${checked}`);
  assert.deepEqual(missing, [], 'a supplier photo upload without the supplier mark');
});

test('the admin category samples carry the Setnayan-only mark', () => {
  const src = code('app/admin/categories/_components/what-couples-choose.tsx');
  const blocks = uploadBlocks(src);
  assert.ok(blocks.length >= 3);
  for (const b of blocks) assert.match(b, /\bmark="setnayan"/);
});

test('SABOTAGE-PROVEN: FileUpload FAILS CLOSED — a mark failure refuses, never uploads the original', () => {
  const src = code('app/_components/file-upload.tsx');
  assert.doesNotMatch(src, /uploading original', err\);\s*void trackFailure\(\{\s*eventType: 'BLANK_FALLBACK'/);
  // Both image painters and the clip encode route a throw to the refusal.
  for (const call of ['markPhotoFile(rawFile', 'watermarkFile(rawFile', 'markAndCompressVideo(rawFile']) {
    const at = src.indexOf(call);
    assert.notEqual(at, -1, `FileUpload must call ${call}`);
    // The FIRST catch after the call — not merely some later one (a sabotage that
    // set `file = rawFile` here stayed green against a window that reached the
    // next painter's catch; caught and narrowed 2026-11-04).
    const tail = src.slice(at);
    const firstCatch = /catch \(err\) \{\s*([^\n]*)/.exec(tail)?.[1] ?? '';
    assert.equal(firstCatch.trim(), 'return refuseUnmarked(err);', `${call} must refuse on failure`);
  }
  // The refusal is a failed tile WITH Try again, not a silent drop.
  assert.match(src, /const refuseUnmarked = [\s\S]{0,600}setFailed\(\(prev\) => \[\.\.\.prev, \{ id, file: rawFile \}\]\)/);
  // A supplier photo is not kept until its clean copy is paired.
  assert.match(src, /if \(paired\.ok\) keep\(\);\s*else refuseUnmarked\(/);
});

test('the marked clip throws instead of returning the unmarked original', () => {
  const src = code('lib/video-compress.ts');
  const at = src.indexOf('export async function markAndCompressVideo');
  assert.notEqual(at, -1);
  const body = src.slice(at);
  assert.doesNotMatch(body, /return file;/, 'markAndCompressVideo must never hand back the input');
  assert.match(body, /overlay=0:0/);
});

test('the mark is decided on the SERVER — FileUpload takes no verified/name/slug/logo prop', () => {
  const src = code('app/_components/file-upload.tsx');
  const props = src.slice(src.indexOf('type FileUploadBaseProps'), src.indexOf('export type FileUploadProps'));
  assert.doesNotMatch(props, /\b(verified|shopName|slug|logoUrl|logoDataUrl)\??:/);
  assert.match(src, /photoMark\('mark', \{ kind, pathPrefix \}\)/);
  const action = code('app/_components/photo-mark-actions.ts');
  assert.match(action, /shopMarkFacts\(createAdminClient\(\), shop\.vendorProfileId\)/);
  assert.match(action, /resolveActiveShopId\(/);
});

test('the spec: verified only while the badge is on; the coin only with a logo', () => {
  const base = { business_name: 'Bloom & Vine', business_slug: 'Bloom-Vine', logo_url: 'r2://setnayan-media/vendors/x/logo/a.png' };
  const on = shopMarkFromRow({ ...base, verification_state: 'verified', next_renewal_due_at: null });
  assert.equal(on.spec.verified, true);
  assert.equal(on.spec.slug, 'bloom-vine');
  assert.equal(on.spec.hasLogo, true);
  const lapsed = shopMarkFromRow({ ...base, verification_state: 'verified', next_renewal_due_at: '2020-01-01T00:00:00Z' });
  assert.equal(lapsed.spec.verified, false, 'a lapsed badge is Setnayan only');
  const pending = shopMarkFromRow({ ...base, verification_state: 'pending', next_renewal_due_at: null });
  assert.equal(pending.spec.verified, false);
  assert.equal(pending.spec.hasLogo, false);
});

test('the re-mark job is idempotent and writes the bytes before the record', async () => {
  const row: OriginalRow = { id: 1, vendor_profile_id: 'v1', public_ref: 'r2://setnayan-media/vendors/v1/a.jpg', original_ref: 'r2://setnayan-vendor-verification/vendor-originals/v1/a.jpg', frame: null, mark_kind: 'setnayan' };
  const spec = { kind: 'supplier' as const, verified: true, shopName: 'S', slug: 's', hasLogo: false };
  const log: string[] = [];
  const deps: RemarkDeps = {
    getBytes: async (ref) => (log.push(`get ${ref}`), new Uint8Array([1])),
    mark: async () => (log.push('mark'), Buffer.from([2])),
    putBytes: async (ref) => void log.push(`put ${ref}`),
    setMarkKind: async (id, k) => void log.push(`set ${id} ${k}`),
  };
  assert.equal(await remarkOne(row, spec, deps), 'remarked');
  assert.deepEqual(log, [`get ${row.original_ref}`, 'mark', `put ${row.public_ref}`, 'set 1 verified']);
  log.length = 0;
  assert.equal(await remarkOne({ ...row, mark_kind: 'verified' }, spec, deps), 'unchanged');
  assert.deepEqual(log, []);
  const pending = pendingRemarks([row, { ...row, id: 2, mark_kind: 'verified' }], new Map([['v1', 'verified']]));
  assert.deepEqual(pending.map((r) => r.id), [1]);
});

test('the dry-run script refuses every mode but --dry-run and writes nothing', () => {
  const src = code('scripts/remark-supplier-photos.ts');
  assert.match(src, /args\[0\] !== '--dry-run'/);
  assert.doesNotMatch(src, /\.(update|insert|upsert|delete)\(|putBytes|r2Upload|remarkOne/);
});

/* ── item 1: the mark is never cropped off by a display ─────────────────── */

test('SABOTAGE-PROVEN: the wide displays draw a square-framed photo whole (MarkedPhoto), never cropped to 2.5:1+', () => {
  const card = code('app/(shell)/explore/_components/vendor-card.tsx');
  assert.match(card, /<MarkedPhoto[\s\S]{0,200}frame="square"[\s\S]{0,80}displayAspect=\{358 \/ 128\}/);
  const shop = code('app/v/[slug]/page.tsx');
  const heroes = shop.match(/<MarkedPhoto\s+src=\{heroPhotoUrl\}/g) ?? [];
  assert.equal(heroes.length, 2, 'both shop heroes (cinematic and banner) must go through MarkedPhoto');
  assert.doesNotMatch(shop, /<Image\s+src=\{heroPhotoUrl\}/);
  const mp = code('app/_components/marked-photo.tsx');
  assert.match(mp, /if \(displayAspectAllowed\(frame, displayAspect\)\)/);
  assert.match(mp, /object-contain/);
});

test('the shortlist and budget heroes are inside the square band, and their price badge is top-left', () => {
  for (const [file, scope] of [
    ['app/tour/vendors/_components/tour-shortlist.tsx', 'tsl'],
    ['app/dashboard/[eventId]/vendors/_components/plan-budget-accordion.tsx', 'pbacc'],
  ] as const) {
    const src = read(file);
    const cardW = Number(new RegExp(`\\.${scope} \\.card\\{[^}]*flex:0 0 min\\((\\d+)px`).exec(src)?.[1]);
    const imgH = Number(new RegExp(`\\.${scope} \\.v \\.img\\{height:(\\d+)px`).exec(src)?.[1]);
    assert.ok(cardW > 0 && imgH > 0, `${file}: card width / hero height not found`);
    assert.ok(displayAspectAllowed('square', cardW / imgH), `${file}: ${cardW}×${imgH} crops a square cover's mark off`);
    const badge = new RegExp(`\\.${scope} \\.v \\.img \\.hprice\\{([^}]*)\\}`).exec(src)?.[1] ?? '';
    assert.match(badge, /left:10px;top:10px/, `${file}: the price badge must sit top-left`);
    assert.doesNotMatch(badge, /right:|bottom:/, `${file}: a badge at the bottom-right covers the mark`);
  }
});
