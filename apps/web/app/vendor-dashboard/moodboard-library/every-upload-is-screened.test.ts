/**
 * every-upload-is-screened.test.ts — the safeguards MB11 put on the vendor
 * upload path may not be routed around.
 *
 * ── WHY A SOURCE GUARD AND NOT A BEHAVIOUR TEST ─────────────────────────────
 * The rules themselves are unit-tested on real values and real pixels
 * (lib/moodboard-gallery-upload.test.ts · lib/moodboard-gallery-image-checks
 * .test.ts). What THIS file pins is the WIRING — that the one function which
 * turns bytes into a row is the only one that does, and that it still runs all
 * five steps in order. A server action cannot be imported under `tsx --test`
 * (it is 'use server', and half its imports are `server-only`), and the
 * defect this guards against is structural: somebody adds a second insert, or
 * quietly drops a step, and every existing test stays green because the rules
 * they test are still correct — they are just no longer called.
 *
 * 🔑 THE WINDOW FACES THE SABOTAGE. Each assertion is anchored inside the
 * function it is about, and the insert count is asserted as a NUMBER — a file
 * -level "does `hashAndScanVendorImages` appear anywhere" would stay green
 * while a new second upload path skipped it entirely, which is the exact shape
 * of miss this repo has shipped before.
 *
 * Comments are stripped with the ONE canonical stripper first, so this
 * docblock — which names every symbol it hunts — is not itself a finding.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripComments } from '@/lib/strip-comments';

const HERE = dirname(fileURLToPath(import.meta.url));
const WEB = join(HERE, '..', '..', '..');

const read = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));

/**
 * ⚠ THE ADMIN SURFACE IS DELIBERATELY OUT OF SCOPE, and this note is here so
 * the next reader does not mistake that for an oversight.
 * `app/admin/moodboard-library/actions.ts` writes to the same public bucket,
 * but it uploads SETNAYAN'S OWN curated imagery, pushed by Setnayan staff.
 * Two of MB11's three checks are meaningless there — there is no uploading
 * SHOP whose contact details or logo could be in the picture — and the
 * cross-vendor theft scan cannot run at all, because `hashAndScanVendorImages`
 * is keyed on a `vendorProfileId` that an admin upload does not have.
 * Extending the QR check and a server-side watermark to it is a real, separate
 * change; it is named here rather than silently assumed handled.
 */
const ACTIONS = 'app/vendor-dashboard/moodboard-library/actions.ts';
const PAGE = 'app/vendor-dashboard/moodboard-library/page.tsx';
const EDITOR =
  'app/vendor-dashboard/moodboard-library/_components/stylist-library-editor.tsx';

/**
 * The body of a TOP-LEVEL function, sliced by line.
 *
 * 🪤 BRACE-COUNTING FROM THE FIRST `{` DOES NOT WORK HERE, and getting that
 * wrong is how a guard ends up asserting against the wrong text. Every function
 * this file inspects takes a destructured argument (`args: { … }`) or returns
 * an inline object type (`Promise<{ assetId: string }>`), so the first `{`
 * after the name opens a TYPE, and the counter closes on the parameter list
 * instead of the body — the window then faces a few lines of type annotation
 * and every assertion about the body fails, or worse, vacuously passes.
 *
 * These are all top-level declarations in a file with zero-indent bodies, so
 * the honest boundary is a line that is exactly `}`.
 */
function functionBody(source: string, name: string): string {
  const lines = source.split('\n');
  const start = lines.findIndex((l) =>
    new RegExp(`^(export )?(async )?function ${name}\\b`).test(l),
  );
  assert.notEqual(start, -1, `${name} must exist as a top-level function`);
  const end = lines.findIndex((l, i) => i > start && l === '}');
  assert.notEqual(end, -1, `${name} must have a zero-indent closing brace`);
  return lines.slice(start, end + 1).join('\n');
}

function count(haystack: string, needle: string): number {
  return haystack.split(needle).length - 1;
}

/* ══════════════════════════════════════════════════════════════════════════
   ONE DOOR INTO THE TABLE
   ══════════════════════════════════════════════════════════════════════════ */

test('exactly ONE place in the vendor actions inserts a library asset', () => {
  const src = read(ACTIONS);
  const inserts = count(src, "from('moodboard_library_assets')");
  const writes = count(src, '.insert({');
  assert.equal(
    writes,
    1,
    `expected 1 insert into moodboard_library_assets, found ${writes} — a second upload path skips every safeguard`,
  );
  assert.ok(inserts >= 1);
  // And that one insert lives inside the screened store, not loose in an action.
  const store = functionBody(src, 'storeScreenedAsset');
  assert.equal(count(store, '.insert({'), 1);
});

test('both upload entry points go through storeScreenedAsset', () => {
  const src = read(ACTIONS);
  for (const fn of ['uploadStylistAsset', 'importEditorialMediaToGallery']) {
    const body = functionBody(src, fn);
    assert.ok(
      body.includes('storeScreenedAsset({'),
      `${fn} must store through storeScreenedAsset`,
    );
  }
});

/* ══════════════════════════════════════════════════════════════════════════
   THE FIVE STEPS, IN ORDER, INSIDE THE ONE DOOR
   ══════════════════════════════════════════════════════════════════════════ */

test('SABOTAGE-PROVEN: the screen · watermark · store · scan run in order', () => {
  // Sabotage runs, one at a time, each restored after:
  //   · deleted the `hashAndScanVendorImages` call  → this test RED
  //   · deleted the `watermarkImageBytes` call      → this test RED
  //   · deleted `if (screen.blocked) throw`         → this test RED
  const store = functionBody(read(ACTIONS), 'storeScreenedAsset');
  const steps = [
    'screenGalleryImage({',
    'if (screen.blocked) throw',
    'watermarkImageBytes(',
    '.upload(objectKey',
    '.insert({',
    'hashAndScanVendorImages({',
  ];
  let cursor = -1;
  for (const step of steps) {
    const at = store.indexOf(step, cursor + 1);
    assert.notEqual(at, -1, `storeScreenedAsset must contain: ${step}`);
    assert.ok(at > cursor, `out of order: ${step}`);
    cursor = at;
  }
});

test('the theft scan is fed the WATERMARKED bytes it stored', () => {
  // Hashing the pre-watermark original would compare something the public can
  // never see against other vendors' public images.
  const store = functionBody(read(ACTIONS), 'storeScreenedAsset');
  assert.match(store, /surface: 'moodboard_library'/);
  assert.match(store, /bytesByRef: \{ \[storagePath\]: marked\.bytes \}/);
});

test('the warranty is written on the same insert as the row', () => {
  const store = functionBody(read(ACTIONS), 'storeScreenedAsset');
  assert.match(store, /rights_warranted_at:/);
  assert.match(store, /rights_warranty_version: RIGHTS_WARRANTY_VERSION/);
  // MB10 landed these columns; MB11 must not add its own.
  const src = read(ACTIONS);
  assert.doesNotMatch(src, /rights_warranty_v2|warranty_accepted_at/);
});

/* ══════════════════════════════════════════════════════════════════════════
   THE QUOTA, AND WHICH ROWS IT COUNTS
   ══════════════════════════════════════════════════════════════════════════ */

test('SABOTAGE-PROVEN: the count is scoped to back-catalogue rows', () => {
  // Sabotage run: removed `.is('source_event_id', null)` from
  // countBackCatalogue, so event-linked photos were counted too. This test went
  // RED. That change is invisible in every other suite — the arithmetic is
  // still right, it is just counting the wrong rows.
  const body = functionBody(read(ACTIONS), 'countBackCatalogue');
  assert.match(body, /\.is\('source_event_id', null\)/);
  assert.match(body, /\.is\('retired_at', null\)/);
  assert.match(body, /SUPPLIER_GALLERY_ASSET_TYPE/);
});

test('MB19: the count is ALSO scoped to one category — drop this line and the quota reverts to account-wide', () => {
  // The behavioural half (that this predicate produces the right numbers
  // against real rows) is pinned against Postgres in
  // tests/db/the-back-catalogue-quota-counts-the-right-rows.db.test.ts; this
  // is the wiring half — that the query itself still carries the filter.
  const body = functionBody(read(ACTIONS), 'countBackCatalogue');
  assert.match(body, /\.eq\('asset_subtype', slot\)/);
});

test('the file upload is back-catalogue; the editorial import is event-linked', () => {
  const src = read(ACTIONS);
  assert.match(functionBody(src, 'uploadStylistAsset'), /source_event_id: null/);
  assert.match(
    functionBody(src, 'importEditorialMediaToGallery'),
    /source_event_id: row\.event_id/,
  );
});

test('the quota is decided BEFORE the bytes are stored', () => {
  const body = functionBody(read(ACTIONS), 'uploadStylistAsset');
  const quota = body.indexOf('backCatalogueQuotaVerdict({');
  const store = body.indexOf('storeScreenedAsset({');
  assert.ok(quota !== -1 && store !== -1);
  assert.ok(quota < store, 'a refused upload must not reach storage first');
});

/* ══════════════════════════════════════════════════════════════════════════
   THE EDITORIAL IMPORT'S OWN GATES
   ══════════════════════════════════════════════════════════════════════════ */

test('the recommended-pick gate is RE-CHECKED at import, not inherited', () => {
  const body = functionBody(read(ACTIONS), 'importEditorialMediaToGallery');
  assert.match(body, /getEditorialEligibility\(/);
  assert.match(body, /if \(!eligibility\.eligible\)/);
  // And the couple's own curation survives the promotion.
  assert.match(body, /hidden_by_couple/);
  assert.match(body, /moderation_state !== 'clean'/);
});

/* ══════════════════════════════════════════════════════════════════════════
   ONE AUTH PREDICATE, NOT TWO
   ══════════════════════════════════════════════════════════════════════════ */

test('SABOTAGE-PROVEN: page and action ask the SAME question', () => {
  // Sabotage run: restored the old `users.account_type === 'vendor'` check in
  // requireLibraryAccess. This test went RED on the account_type assertion —
  // which is the state this surface shipped in for four months, where the page
  // rendered and the save threw 'vendor only'.
  const actions = read(ACTIONS);
  const page = read(PAGE);
  for (const [name, src] of [['actions', actions], ['page', page]] as const) {
    assert.match(
      src,
      /resolveMoodboardLibraryAccess/,
      `${name} must use the shared predicate`,
    );
    assert.doesNotMatch(
      src,
      /account_type/,
      `${name} must not re-derive access from users.account_type`,
    );
    assert.doesNotMatch(
      src,
      /reception_decor/,
      `${name} must not pin the trade gate to one service key`,
    );
  }
});

/* ══════════════════════════════════════════════════════════════════════════
   THE CLIENT MAY NOT BE THE ONE HOLDING THE RULE
   ══════════════════════════════════════════════════════════════════════════ */

test('the editor no longer watermarks in the browser', () => {
  const editor = read(EDITOR);
  assert.doesNotMatch(
    editor,
    /watermarkFile/,
    'the server marks these bytes — a client pass would print SETNAYAN twice',
  );
});

test('the rights warranty is a real tick, never a hidden or pre-checked field', () => {
  const editor = read(EDITOR);
  assert.match(editor, /name="rightsWarranted"/);
  assert.match(editor, /type="checkbox"/);
  assert.doesNotMatch(
    editor,
    /type="hidden"[^>]*rightsWarranted|rightsWarranted[^>]*type="hidden"/,
    'a hidden warranty field records a promise nobody made',
  );
  assert.match(
    editor,
    /useState\(false\)/,
    'the tick must start unchecked',
  );
});

test('the vendor is told when the text screen could not run', () => {
  const editor = read(EDITOR);
  assert.match(editor, /textScreen === 'unavailable'/);
});

test('a failed editorial read is not rendered as "you have none"', () => {
  // The `reads-are-honest` lesson, applied to the one new read on this page:
  // Supabase resolves with `{ error }` rather than throwing, and a bare
  // `.catch(() => [])` would tell a supplier who worked six weddings that they
  // have no day-of photos — byte-identical to the honest empty state.
  const page = read(PAGE);
  assert.doesNotMatch(page, /listImportableEditorialMedia\(\)\.catch/);
  assert.match(page, /importableFailed = true/);
  assert.match(read(EDITOR), /importableEditorialFailed \?/);
});
