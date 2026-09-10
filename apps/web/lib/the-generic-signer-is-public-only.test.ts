/**
 * THE GENERIC SIGNER SIGNS ONLY THE PUBLIC BUCKET — and every private read goes
 * through a signer whose caller names the bucket AND the tenant folder.
 * (N4 part 3, 2026-09-11; found by N3's review of #5415.)
 *
 * WHAT WAS OPEN
 * -------------
 * `displayUrlForStoredAsset` presigned an `r2://` ref in ANY bucket, with the
 * admin R2 credentials, for whoever's page asked. Browser-writable columns
 * reach it — `event_editorial.draft_json`, `guests.photo_url`,
 * `vendor_profiles.logo_url` (authenticated INSERT/UPDATE, production
 * 2026-09-11) and a dispute's `evidence_urls` (its action kept ANY ref). One
 * value naming `setnayan-thread-files` (payment proofs, chat files) or
 * `setnayan-vendor-verification` (government IDs) made the server hand the
 * viewer a signed link to a stranger's private file.
 *
 * HOW THIS FILE HOLDS IT SHUT — by the claim, not a proxy:
 *   1. the pure rule the signer applies refuses every private bucket and every
 *      spelling that could smuggle one (behaviour, not text);
 *   2. the signer's body applies that rule BEFORE it can reach presign;
 *   3. every surface that legitimately shows a private file uses the scoped
 *      signer with the policy for ITS folder — the inventory below was built by
 *      enumerating every private-bucket WRITER, and a new private uploader
 *      fails here until its reader is named;
 *   4. nobody else presigns a stored ref's own bucket directly — a pinned list
 *      of the only files allowed to call `presignDisplayUrl` / `r2SignedGet`.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { stripComments } from './strip-comments';
import { publicBucketServeRef } from './site-media-ref';
import {
  catalogueArtPolicy,
  disputeEvidencePolicy,
  parseClientRef,
  paymentProofPolicy,
  PRIVATE_R2_BUCKETS,
} from './r2-client-ref';

const WEB = join(import.meta.dirname, '..');
const src = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));

function walk(dir: string, out: string[] = []): string[] {
  for (const e of readdirSync(dir)) {
    if (e === 'node_modules' || e === '.next' || e.startsWith('.')) continue;
    const p = join(dir, e);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.(ts|tsx)$/.test(e) && !/\.test\.tsx?$/.test(e)) out.push(p);
  }
  return out;
}
const FILES = ['app', 'lib', 'components'].flatMap((d) => walk(join(WEB, d)));
const REL = (p: string) => relative(WEB, p);

/* ── 1 · THE RULE, BY BEHAVIOUR ─────────────────────────────────────────── */

test('the rule refuses every private bucket — and every spelling that could smuggle one', () => {
  assert.equal(PRIVATE_R2_BUCKETS.size, 4, 'the private bucket set changed — re-read this suite');
  let refused = 0;
  for (const bucket of PRIVATE_R2_BUCKETS) {
    for (const v of [
      `r2://${bucket}/payments/o1/receipt.png`,
      ` r2://${bucket}/x.png`,
      `\tr2://${bucket}/x.png`,
      `r2://${bucket}/x.png `,
    ]) {
      assert.equal(publicBucketServeRef(v), null, `the signer's rule accepts ${JSON.stringify(v)}`);
      refused += 1;
    }
  }
  for (const v of ['r2://setnayan-unknown/x.png', 'r2://setnayan-media', 'r2://setnayan-media/', 'r2:///x']) {
    assert.equal(publicBucketServeRef(v), null, `the rule accepts ${JSON.stringify(v)}`);
    refused += 1;
  }
  console.log(`# private / malformed refs refused by the signer's rule: ${refused}`);
  assert.ok(refused >= 20);
  // Positive controls: the public bucket and a legacy URL still resolve, trim-stable.
  assert.equal(publicBucketServeRef(' r2://setnayan-media/vendors/v1/logo.png '), 'r2://setnayan-media/vendors/v1/logo.png');
  assert.equal(publicBucketServeRef('https://lh3.googleusercontent.com/a/x'), 'https://lh3.googleusercontent.com/a/x');
  // A different-case scheme is not a ref to the resolver either: passed through as a dead URL, never signed.
  assert.equal(publicBucketServeRef('R2://setnayan-thread-files/x')?.startsWith('r2://'), false);
});

test('the scoped policies accept their own folder and nothing next to it', () => {
  const pay = paymentProofPolicy({ orderId: 'o1', eventId: 'e1', userId: 'u1' });
  assert.ok(parseClientRef('r2://setnayan-thread-files/payments/o1/a.png', pay));
  assert.ok(parseClientRef('r2://setnayan-thread-files/payment-screenshots/inline-checkout/e1/a.png', pay));
  assert.ok(parseClientRef('r2://setnayan-thread-files/payment-screenshots/inline-checkout/u1/a.png', pay));
  assert.equal(parseClientRef('r2://setnayan-thread-files/payments/o2/a.png', pay), null, 'another order’s proof');
  assert.equal(parseClientRef('r2://setnayan-thread-files/payments/o12/a.png', pay), null, 'prefix confusion o1 → o12');
  assert.equal(parseClientRef('r2://setnayan-thread-files/chat/t1/a.png', pay), null, 'a chat file');
  assert.equal(parseClientRef('r2://setnayan-vendor-verification/payments/o1/a.png', pay), null, 'a different bucket');
  const guest = paymentProofPolicy({ orderId: 'o1', eventId: null, userId: null });
  assert.deepEqual([...guest.prefixes], ['payments/o1/'], 'a guest order must admit only its own order folder');

  const dispute = disputeEvidencePolicy('e1');
  assert.ok(parseClientRef('r2://setnayan-thread-files/events/e1/disputes/incoming/a.png', dispute));
  assert.equal(parseClientRef('r2://setnayan-thread-files/events/e1/chat/a.png', dispute), null);
  assert.equal(parseClientRef('r2://setnayan-thread-files/events/e2/disputes/a.png', dispute), null);
  assert.equal(parseClientRef('r2://setnayan-thread-files/payment-proof/events/e1/a.png', dispute), null);

  const art = catalogueArtPolicy();
  assert.ok(parseClientRef('r2://setnayan-samples/taxonomy/photography/a.jpg', art));
  assert.ok(parseClientRef('r2://setnayan-samples/refinements/leaf/a.jpg', art));
  assert.equal(parseClientRef('r2://setnayan-samples/other/a.jpg', art), null);
  assert.equal(parseClientRef('r2://setnayan-thread-files/taxonomy/a.jpg', art), null);
});

/* ── 2 · THE SIGNER APPLIES IT ──────────────────────────────────────────── */

function fnBody(file: string, name: string): string {
  const s = src(file);
  const start = s.indexOf(`export async function ${name}(`);
  assert.ok(start >= 0, `${name} is missing from ${file}`);
  const next = s.indexOf('\nexport ', start + 10);
  return s.slice(start, next === -1 ? undefined : next);
}

test('displayUrlForStoredAsset gates on the rule BEFORE it can presign, and signs only what passed', () => {
  const body = fnBody('lib/uploads.ts', 'displayUrlForStoredAsset');
  const gate = body.indexOf('publicBucketServeRef(value)');
  const presign = body.indexOf('presignDisplayUrl(');
  assert.ok(gate > 0, 'the generic signer no longer applies publicBucketServeRef');
  assert.ok(presign > gate, 'presign is reachable before the rule');
  assert.match(body, /if \(!servable\) return null;/);
  assert.match(body, /parseStoredAsset\(servable\)/, 'the signer parses the RAW value, not the one the rule approved');
  assert.doesNotMatch(body, /parseStoredAsset\(value\)/);
});

test('the scoped signer signs only what its policy admits', () => {
  const body = fnBody('lib/uploads.ts', 'displayUrlForPrivateStoredAsset');
  const check = body.indexOf('parseClientRef(');
  const presign = body.indexOf('presignDisplayUrl(');
  assert.ok(check > 0 && presign > check, 'the private signer presigns before (or without) the policy check');
  assert.match(body, /if \(!allowed\) return null;/);
  assert.match(body, /presignDisplayUrl\(allowed\.bucket, allowed\.key/, 'the private signer signs something other than what the policy approved');
});

test('the list, logo and guest-photo helpers all go through the gated signer', () => {
  for (const name of ['displayUrlsForStoredAssets', 'displayLogoUrl']) {
    const body = fnBody('lib/uploads.ts', name);
    assert.match(body, /displayUrlForStoredAsset\(/, `${name} bypasses the gated signer`);
    assert.doesNotMatch(body, /presignDisplayUrl\(/, `${name} presigns directly`);
  }
  const guest = fnBody('lib/uploads.ts', 'guestPhotoDisplayUrls');
  assert.match(guest, /displayUrlForStoredAsset\(g\.photo_url\)/);
});

/* ── 3 · EVERY PRIVATE READ HAS ITS OWN SCOPED SIGNER ───────────────────── */

/**
 * Every surface that shows a file from a PRIVATE bucket through a stored ref,
 * and the policy it must scope the signature to. Built by enumerating every
 * private-bucket WRITER (test below) and following each column to its readers:
 *   payments.screenshot_url · force_majeure_flags.evidence_urls ·
 *   event_paperwork.document_r2_key · event_vendor_payments.proof_r2_key ·
 *   vendor_verification_applications.doc_uploads · the catalogue's sample art.
 * (Chat attachments and mood-board renders have their own dedicated routes —
 * lib/chat-attachment-signs-only-its-own-thread.test.ts, every-render-read-is-pinned.)
 */
const PRIVATE_READERS: Array<[file: string, needle: RegExp]> = [
  ['app/admin/payments/page.tsx', /displayUrlForPrivateStoredAsset\(\s*p\.screenshot_url,\s*paymentProofPolicy\(/],
  ['app/dashboard/[eventId]/orders/[orderId]/page.tsx', /displayUrlForPrivateStoredAsset\(\s*p\.screenshot_url,\s*paymentProofPolicy\(\{ orderId: order\.order_id/],
  ['app/vendor-dashboard/booking-fees/[orderId]/page.tsx', /displayUrlForPrivateStoredAsset\(\s*p\.screenshot_url,\s*paymentProofPolicy\(\{ orderId: order\.order_id/],
  ['app/dashboard/[eventId]/disputes/page.tsx', /displayUrlsForPrivateStoredAssets\(\s*f\.evidence_urls,\s*disputeEvidencePolicy\(eventId\)/],
  ['app/dashboard/[eventId]/paperwork/page.tsx', /displayUrlForPrivateStoredAsset\(ref, paperworkScanPolicy\(eventId\)\)/],
  ['lib/vendor-service-payment-schedules.server.ts', /displayUrlForPrivateStoredAsset\(p\.proof_r2_key, budgetPaymentProofPolicy\(eventId\)\)/],
  ['app/vendor-dashboard/shop/inline-docs-actions.ts', /displayUrlForPrivateStoredAsset\(ref, vendorVerificationDocPolicy\(vendorProfileId\)\)/],
  ['app/(shell)/explore/page.tsx', /displayUrlForCatalogueArt\(ref\)/],
  ['app/admin/taxonomy/page.tsx', /displayUrlForCatalogueArt\(raw\)/],
  ['lib/onboarding-refinements.ts', /displayUrlForCatalogueArt\(ref\)/],
];

test('every private-file surface signs through the scoped signer with ITS OWN folder', () => {
  let pinned = 0;
  for (const [file, needle] of PRIVATE_READERS) {
    assert.match(src(file), needle, `${file} no longer scopes its private read`);
    pinned += 1;
  }
  const art = fnBody('lib/uploads.ts', 'displayUrlForCatalogueArt');
  assert.match(art, /displayUrlForPrivateStoredAsset\(value, catalogueArtPolicy\(\), opts\)/);
  console.log(`# private readers pinned to a scoped policy: ${pinned}`);
});

test('the dispute action keeps only the uploader’s own evidence folder (the write half)', () => {
  const s = src('app/dashboard/[eventId]/disputes/actions.ts');
  assert.match(s, /if \(!parseClientRef\(trimmed, disputeEvidencePolicy\(eventId\)\)\) continue;/);
});

/**
 * Every `<FileUpload>` that writes to a PRIVATE bucket, by file → count. A new
 * one fails here on purpose: its column's readers must then be added to
 * PRIVATE_READERS with a scoped policy, or the public-only signer will show
 * them nothing (null), silently.
 */
const PRIVATE_UPLOADERS: Record<string, number> = {
  'app/admin/taxonomy/_components/taxonomy-studio.tsx': 4, // samples → catalogue art
  'app/pay/[reference]/_components/pay-panel.tsx': 1, // thread-files → payments.screenshot_url
  'app/dashboard/[eventId]/disputes/page.tsx': 1, // thread-files → force_majeure_flags.evidence_urls
  'app/dashboard/[eventId]/_components/inline-checkout-drawer.tsx': 1, // thread-files → payments.screenshot_url
  'app/dashboard/[eventId]/_components/vendor-itemization-card.tsx': 1, // thread-files → event_vendor_payments.proof_r2_key
  'app/dashboard/[eventId]/paperwork/page.tsx': 1, // vendor-contracts → event_paperwork.document_r2_key
  'app/vendor-dashboard/shop/_components/verify-pairs.tsx': 1, // vendor-verification → doc_uploads
  'app/vendor-dashboard/shop/_components/docs-body.tsx': 2, // vendor-verification → doc_uploads
};

test('the private-bucket UPLOADERS are exactly the known ones (a new one names its reader first)', () => {
  const found: Record<string, number> = {};
  for (const abs of FILES) {
    const s = stripComments(readFileSync(abs, 'utf8'));
    const n = (s.match(/bucket=["'{`\s]*["'`](thread-files|vendor-contracts|vendor-verification|samples)["'`]/g) ?? []).length;
    if (n) found[REL(abs)] = n;
  }
  assert.ok(Object.keys(found).length >= 5, 'the uploader scan found almost nothing — it is blind');
  assert.deepEqual(found, PRIVATE_UPLOADERS);
});

/* ── 4 · NOBODY ELSE SIGNS A STORED REF'S OWN BUCKET ────────────────────── */

/**
 * The ONLY files that may call the raw signers. Each names its bucket itself (a
 * constant, a validated policy, or a server-written column) — none signs the
 * bucket a browser-writable value names. A new direct caller fails: route it
 * through `displayUrlForStoredAsset` (public) or `displayUrlForPrivateStoredAsset`.
 */
const RAW_SIGNER_CALLERS: Record<string, string> = {
  'lib/uploads.ts': 'the two signers themselves',
  'lib/r2-client-ref.server.ts': 'presignClientRef — policy-validated',
  'lib/r2.ts': 'r2SignedGet itself',
  'app/api/upload/route.ts': 'preview of the object this request just minted',
  'app/dashboard/[eventId]/studio/patiktok/actions.ts': 'R2_BUCKETS.media constant',
  'app/dashboard/[eventId]/studio/patiktok/page.tsx': 'R2_BUCKETS.media constant',
  'lib/auto-recap.ts': 'server-written output_bucket, allow-listed',
  'lib/std-bg-image.ts': 'gated by publicBucketServeRef first',
  'lib/std-video-gate.ts': 'parseClientRef(stdVideo*/stdSealed policy) first',
  'lib/vendor-image-repost-watch.ts': 'server-side byte fetch for analysis; never served',
  'lib/vendor-qr-media-guard.ts': 'server-side byte fetch for analysis; never served',
  'lib/moodboard-render-serve.ts': 'the render’s own key (#5415)',
  'lib/background-videos.ts': 'admin-curated media',
  'app/admin/app-performance/actions.ts': 'admin-only, named bucket',
  'app/admin/verification-docs/actions.ts': 'admin-only, named bucket',
  'app/admin/verify/actions.ts': 'admin-only, named bucket',
  'app/admin/website-media/actions.ts': 'admin-only, named bucket',
  'app/vendor-dashboard/on-the-day/live/[eventId]/_components/own-captures-strip.tsx': 'the vendor’s own captures',
  'app/vendor-dashboard/on-the-day/live/[eventId]/_components/portfolio-album-section.tsx': 'the vendor’s own album',
};

test('only the known files call a raw signer', () => {
  const found = new Set<string>();
  for (const abs of FILES) {
    const s = stripComments(readFileSync(abs, 'utf8'));
    if (/(?<![\w$.])(presignDisplayUrl|r2SignedGet)\(/.test(s)) found.add(REL(abs));
  }
  assert.ok(found.size >= 10, `only ${found.size} raw-signer files found — the scan is blind`);
  const unknown = [...found].filter((f) => !(f in RAW_SIGNER_CALLERS)).sort();
  const stale = Object.keys(RAW_SIGNER_CALLERS).filter((f) => !found.has(f)).sort();
  assert.deepEqual(unknown, [], `new direct callers of a raw signer: ${unknown.join(', ')}`);
  assert.deepEqual(stale, [], `listed but no longer calling a raw signer — shrink the list: ${stale.join(', ')}`);
});
