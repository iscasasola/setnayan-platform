import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import {
  parseClientRef,
  vendorPaymentQrPolicy,
  vendorPaymentQrLegacyPolicy,
  PRIVATE_R2_BUCKETS,
} from '@/lib/r2-client-ref';
import { bucketForPrefix } from '@/lib/bucket-routing';
import { tenancyForPathPrefix } from '@/lib/upload-prefix-tenancy';
import { stripComments } from '@/lib/strip-comments';

/**
 * A SUPPLIER'S PAYMENT QR IS NOT PUBLIC EITHER.
 *
 * ⚖ Owner ruling 2026-09-17, extending the couples' 2026-09-15 rule. Asked
 * rather than inferred — the corpus records that the wallet ruling was issued
 * separately from the bank one precisely because "widening a disclosure rule
 * past what was asked is how the next person inherits a decision nobody made".
 *
 * 🔢 Done NOW because `vendor_payment_methods` held ZERO rows: a policy change
 * today, a migration plus an orphan sweep once suppliers start uploading.
 */

const VENDOR = '7f3c1a9e-2b4d-4c8a-9e10-5d6f7a8b9c01';
const OTHER = '11111111-2222-3333-4444-555555555555';

let cases = 0;
const ck = () => { cases++; };

test('the private home is a PRIVATE bucket under its own root', () => {
  const p = vendorPaymentQrPolicy(VENDOR);
  assert.equal(p.bucket, 'setnayan-thread-files');
  assert.ok(PRIVATE_R2_BUCKETS.has('setnayan-thread-files'), 'the target bucket is not private');
  assert.deepEqual(p.prefixes, [`vendor-payment-qr/${VENDOR}/`]);
});

test('🔑 the ROOT prefix is what lets a routing rule exist at all', () => {
  /*
    `bucketForPrefix` matches `startsWith`. The old shape was
    `vendors/<id>/payment-qr/` — meaningful segment in the MIDDLE, behind an
    unpredictable id, unreachable by any rule. And the `vendors/` root could not
    carry one either: vendor VERIFICATION documents share it and belong in a
    different bucket, so a rule there would misroute them.
  */
  assert.equal(bucketForPrefix(`vendor-payment-qr/${VENDOR}/x.png`), 'threadFiles');
  // The old root must NOT have been claimed — that would misroute verification docs.
  assert.notEqual(
    bucketForPrefix(`vendors/${VENDOR}/verification/id.jpg`),
    'threadFiles',
    'a vendors/ rule was added and is now stealing verification documents',
  );
});

test('the new root carries a VENDOR id, not an event id', () => {
  /*
    The resolver defaults an unknown root to `{ kind: 'event' }`, and
    /api/upload then checks that id against `events` — which refuses every
    upload with a 403. This is the failure the ROOT_CARRIES guard warns about.
  */
  const t = tenancyForPathPrefix(`vendor-payment-qr/${VENDOR}/x.png`);
  assert.equal(t?.kind, 'vendor', `resolved as ${t?.kind} — uploads would 403`);
  assert.equal(t?.id, VENDOR);
});

test('🔒 a ref for ANOTHER supplier is refused', () => {
  ck();
  assert.equal(
    parseClientRef(
      `r2://setnayan-thread-files/vendor-payment-qr/${OTHER}/x.png`,
      vendorPaymentQrPolicy(VENDOR),
    ),
    null,
    'a supplier could point their row at another supplier’s QR',
  );
});

test('🔒 the PUBLIC bucket is no longer an accepted write target', () => {
  for (const ref of [
    `r2://setnayan-media/vendor-payment-qr/${VENDOR}/x.png`,
    `r2://setnayan-media/vendors/${VENDOR}/payment-qr/x.png`,
  ]) {
    ck();
    assert.equal(
      parseClientRef(ref, vendorPaymentQrPolicy(VENDOR)),
      null,
      `${ref} was accepted as a write — the bucket move is not enforced`,
    );
  }
});

test('the legacy policy still READS the old home, and only that', () => {
  ck();
  assert.ok(
    parseClientRef(
      `r2://setnayan-media/vendors/${VENDOR}/payment-qr/x.png`,
      vendorPaymentQrLegacyPolicy(VENDOR),
    ),
    'a row written before the move would blank instead of rendering',
  );
  ck();
  assert.equal(
    parseClientRef(
      `r2://setnayan-media/vendors/${OTHER}/payment-qr/x.png`,
      vendorPaymentQrLegacyPolicy(VENDOR),
    ),
    null,
    'the legacy arm reads across suppliers',
  );
});

// ── Every surface goes through the ONE helper. ─────────────────────────────

const SURFACES = [
  'lib/vendor-payment-methods.server.ts',
  'app/admin/payment-options/page.tsx',
  'app/vendor-dashboard/payment-options/surface.tsx',
];

test('🔑 no surface still resolves a supplier QR against the PUBLIC bucket', () => {
  /*
    Four call sites render this image: the couple's vendor workspace, the public
    proposal page, the supplier's own dashboard and the admin desk. They each
    called `displayUrlForStoredAsset`, which serves the public bucket ONLY and
    returns null otherwise — and a null renders as a MISSING IMAGE, not an
    error. Missing one would look exactly like a supplier who never uploaded.
  */
  for (const rel of SURFACES) {
    const src = stripComments(readFileSync(join(process.cwd(), rel), 'utf8'));
    assert.ok(
      !src.includes('displayUrlForStoredAsset'),
      `${rel} still resolves a QR against the public bucket — it will render blank`,
    );
    assert.match(
      src,
      /vendorPaymentQrDisplayUrl\(/,
      `${rel} does not use the shared helper`,
    );
  }
});

test('the uploader writes to the private home', () => {
  const src = stripComments(
    readFileSync(
      join(process.cwd(), 'app/vendor-dashboard/payment-options/_components/add-payment-method.tsx'),
      'utf8',
    ),
  );
  assert.match(src, /bucket="thread-files"/, 'the uploader still targets the public bucket');
  assert.match(src, /vendor-payment-qr\/\$\{vendorProfileId\}/, 'the uploader writes the old prefix');
});

test('🔑 the anti-swap decoder reads BYTES, and checks the ref first', () => {
  const src = stripComments(
    readFileSync(join(process.cwd(), 'lib/vendor-payment-methods.server.ts'), 'utf8'),
  );
  const fn = src.slice(src.indexOf('export async function decodeQrFromR2'));
  /*
    It used to presign a public URL for our OWN object and fetch it back over
    HTTP — which lib/r2.ts explicitly warns against, and which only ever worked
    against the public bucket. After the move it would have returned null
    SILENTLY, taking the anti-swap verification with it and quietly routing
    every supplier to manual review.
  */
  assert.match(fn, /r2GetBytes\(/, 'the decoder no longer reads bytes directly');
  assert.ok(!fn.includes('fetch('), 'the decoder fetches its own object over HTTP again');
  assert.match(
    fn,
    /vendorProfileId: string,/,
    'vendorProfileId became optional — an optional id is how the ref check gets skipped',
  );
  assert.match(fn, /parseClientRef\(/, 'the ref is fetched without being checked');
});

test('case count', () => {
  console.log(`      (${cases} ref decisions executed)`);
  assert.ok(cases >= 5, `expected >= 5 executed ref decisions, ran ${cases}`);
});
