import test from 'node:test';
import assert from 'node:assert/strict';

import {
  IDENTITY_DOC_SLOTS,
  SEVEN_YEAR_DOC_SLOTS,
  VENDOR_IDENTITY_RETENTION_DAYS,
  hasIdentityUploads,
  identityUploadsSubset,
  scrubIdentityUploads,
  vendorIdentityIsPastRetention,
  VERIFICATION_IDENTITY_BUCKET,
  verificationRefIsInScope,
} from './vendor-identity-retention-core';
import { collectStoredAssetRefs } from './erasure/coverage';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));

const MS_PER_DAY = 24 * 60 * 60 * 1000;
const DECIDED = '2026-01-01T00:00:00.000Z';
const decidedMs = Date.parse(DECIDED);

/** A realistic row: two identity uploads, two seven-year permits, a decision. */
const DOCS = {
  dti_certificate: { r2_key: 'r2://setnayan-vendor-verification/v1/dti.pdf', uploaded_at: DECIDED },
  bir_2303: { r2_key: 'r2://setnayan-vendor-verification/v1/bir.pdf', uploaded_at: DECIDED },
  mayors_permit: { r2_key: 'r2://setnayan-vendor-verification/v1/permit.pdf', uploaded_at: DECIDED },
  government_id: { r2_key: 'r2://setnayan-vendor-verification/v1/id.jpg', uploaded_at: DECIDED },
  bank_account_proof: { r2_key: 'r2://setnayan-vendor-verification/v1/bank.pdf', uploaded_at: DECIDED },
  portfolio_samples: [
    { r2_key: 'r2://setnayan-vendor-verification/v1/p1.jpg' },
    { r2_key: 'r2://setnayan-vendor-verification/v1/p2.jpg' },
  ],
  client_references: [{ name: 'A Client', phone: '0900' }],
  google_meet: { scheduled_at: DECIDED, meet_url: 'https://meet.example' },
};

test('the 90-day list and the 7-year list can never overlap', () => {
  // A slot in both would delete a document the pack tells the NPC we keep.
  const seven = new Set<string>(SEVEN_YEAR_DOC_SLOTS);
  const overlap = IDENTITY_DOC_SLOTS.filter((s) => seven.has(s));
  assert.deepEqual(overlap, [], 'a seven-year document is in the 90-day delete list');
  assert.equal(VENDOR_IDENTITY_RETENTION_DAYS, 90);
});

test('THE BOUNDARY: 89 days keeps, 90 days deletes, 91 days deletes', () => {
  assert.equal(vendorIdentityIsPastRetention(DECIDED, decidedMs + 89 * MS_PER_DAY), false);
  assert.equal(vendorIdentityIsPastRetention(DECIDED, decidedMs + 90 * MS_PER_DAY - 1), false);
  assert.equal(vendorIdentityIsPastRetention(DECIDED, decidedMs + 90 * MS_PER_DAY), true);
  assert.equal(vendorIdentityIsPastRetention(DECIDED, decidedMs + 91 * MS_PER_DAY), true);
});

test('a decision that never happened has no clock — nothing is deleted', () => {
  // Draft / withdrawn / in-review rows. Fails closed.
  for (const v of [null, undefined, '', '   ', 'not-a-date']) {
    assert.equal(vendorIdentityIsPastRetention(v, Date.now()), false, `${String(v)} started a clock`);
  }
  assert.equal(vendorIdentityIsPastRetention(DECIDED, Number.NaN), false);
});

test('only the identity slots are selected for deletion', () => {
  assert.deepEqual(
    Object.keys(identityUploadsSubset(DOCS)).sort(),
    ['bank_account_proof', 'government_id', 'portfolio_samples'],
  );
});

test('every portfolio sample is found — the arrays are the easy miss', () => {
  // Two of the slot shapes are ARRAYS. A hand-rolled `.r2_key` read would drop
  // both portfolio files and report a clean sweep.
  const refs = collectStoredAssetRefs(identityUploadsSubset(DOCS)).sort();
  assert.deepEqual(refs, [
    'r2://setnayan-vendor-verification/v1/bank.pdf',
    'r2://setnayan-vendor-verification/v1/id.jpg',
    'r2://setnayan-vendor-verification/v1/p1.jpg',
    'r2://setnayan-vendor-verification/v1/p2.jpg',
  ]);
});

test('THE SEVEN-YEAR DOCUMENTS ARE NEVER IN THE DELETE SET', () => {
  const refs = collectStoredAssetRefs(identityUploadsSubset(DOCS));
  for (const kept of ['dti.pdf', 'bir.pdf', 'permit.pdf']) {
    assert.ok(
      !refs.some((r) => r.endsWith(kept)),
      `${kept} is a seven-year document and was queued for deletion`,
    );
  }
});

test('scrubbing REMOVES the identity slots and copies the rest through', () => {
  const after = scrubIdentityUploads(DOCS);
  // Gone.
  for (const slot of IDENTITY_DOC_SLOTS) {
    assert.ok(!(slot in after), `${slot} survived the scrub`);
  }
  // Untouched, byte-for-byte.
  assert.deepEqual(after.dti_certificate, DOCS.dti_certificate);
  assert.deepEqual(after.bir_2303, DOCS.bir_2303);
  assert.deepEqual(after.mayors_permit, DOCS.mayors_permit);
  assert.deepEqual(after.client_references, DOCS.client_references);
  assert.deepEqual(after.google_meet, DOCS.google_meet);
});

test('the slot is REMOVED, not left present-but-empty', () => {
  // A key left behind still reads as "this document was collected".
  const after = scrubIdentityUploads({ government_id: { r2_key: 'r2://b/k' } });
  assert.deepEqual(after, {});
  assert.equal('government_id' in after, false);
});

test('scrubbing is idempotent — a second pass is a no-op', () => {
  const once = scrubIdentityUploads(DOCS);
  assert.deepEqual(scrubIdentityUploads(once), once);
  assert.equal(hasIdentityUploads(once), false);
});

test('a row with nothing to delete is not touched', () => {
  assert.equal(hasIdentityUploads({ dti_certificate: { r2_key: 'r2://b/k' } }), false);
  assert.equal(hasIdentityUploads({}), false);
  assert.equal(hasIdentityUploads(null), false);
  assert.equal(hasIdentityUploads('nonsense'), false);
});

test('a retired slot still holding a legacy file IS swept', () => {
  // government_id / live_selfie were pruned 2026-07-03, and existing values are
  // "simply ignored" — ignored is not deleted, which is the whole point.
  assert.equal(hasIdentityUploads({ live_selfie: { r2_key: 'r2://b/selfie.jpg' } }), true);
  assert.deepEqual(
    collectStoredAssetRefs(identityUploadsSubset({ live_selfie: { r2_key: 'r2://b/selfie.jpg' } })),
    ['r2://b/selfie.jpg'],
  );
});

/* ==========================================================================
 * THE SWEEP MAY ONLY DELETE OUT OF THE VERIFICATION BUCKET
 * (defence in depth behind migration 20271218766967)
 *
 * These columns had NO writer in the repo while `authenticated` held a
 * table-level INSERT grant and a self-insert policy that constrained only
 * `vendor_profile_id`. A forged row could name any object in any bucket, and
 * the sweep runs on the admin client, so RLS protects nothing on the target.
 * ========================================================================== */

test('THE EXPLOIT REF IS REFUSED: a public-media object cannot be deleted by this sweep', () => {
  // The exact string the forged row would carry — a shop logo key of the shape
  // published in our own page source inside a presigned URL.
  assert.equal(
    verificationRefIsInScope(
      'r2://setnayan-media/vendors/8f14e45f-ceea-467a-9f2a-1c2d3e4f5a6b/logo/aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee-logo.png',
    ),
    false,
    'A vendor-verification retention job would delete an object out of the ' +
      'PUBLIC media bucket. That is the reported vulnerability.',
  );
});

test('every bucket that is not the verification bucket is refused', () => {
  // All five names in R2_BUCKETS. Four must be refused; only the private
  // verification bucket is this job's business.
  for (const bucket of [
    'setnayan-media',
    'setnayan-thread-files',
    'setnayan-vendor-contracts',
    'setnayan-samples',
  ]) {
    assert.equal(
      verificationRefIsInScope(`r2://${bucket}/vendors/v1/government-id.jpg`),
      false,
      `${bucket} must be refused`,
    );
  }
  assert.equal(
    verificationRefIsInScope('r2://setnayan-vendor-verification/vendors/v1/government-id.jpg'),
    true,
    'The legitimate ref must still be deleted — a rule that refuses everything ' +
      'strands identity documents past their declared retention.',
  );
});

test('a near-miss bucket name does not slip through on a prefix', () => {
  // `startsWith` on the bucket alone would admit these. The trailing slash in
  // the compared prefix is what stops them.
  assert.equal(verificationRefIsInScope('r2://setnayan-vendor-verification-evil/k.jpg'), false);
  assert.equal(verificationRefIsInScope('r2://setnayan-vendor-verificationX/k.jpg'), false);
});

test('a bare bucket ref names no object and is refused', () => {
  assert.equal(verificationRefIsInScope('r2://setnayan-vendor-verification/'), false);
  assert.equal(verificationRefIsInScope('r2://setnayan-vendor-verification'), false);
});

test('a legacy URL is refused — it is the other half of the same primitive', () => {
  // `parseStoredAsset` classifies anything without an `r2://` scheme as
  // `legacy_url` and hands it to `deletePublicAsset`, which resolves R2 public
  // URLs too. A bare http ref must not reach it from these columns.
  assert.equal(verificationRefIsInScope('https://cdn.setnayan.com/vendors/v1/logo.png'), false);
  assert.equal(verificationRefIsInScope('vendors/v1/logo.png'), false);
});

test('nothing, blank and non-strings are refused rather than crashing the sweep', () => {
  assert.equal(verificationRefIsInScope(null), false);
  assert.equal(verificationRefIsInScope(undefined), false);
  assert.equal(verificationRefIsInScope('   '), false);
  assert.equal(verificationRefIsInScope(42 as unknown as string), false);
});

test('the bucket literal still matches R2_BUCKETS.vendorVerification', () => {
  // `lib/r2.ts` is `server-only`, which is NOT installed in this repo, so it
  // cannot be imported by a node:test. Read the constant out of the source
  // instead — the point is that the literal in the pure module can never drift
  // from the constant it mirrors.
  const r2 = readFileSync(resolve(HERE, 'r2.ts'), 'utf8');
  assert.match(
    r2,
    new RegExp(`vendorVerification:\\s*'${VERIFICATION_IDENTITY_BUCKET}'`),
    `R2_BUCKETS.vendorVerification no longer equals '${VERIFICATION_IDENTITY_BUCKET}'. ` +
      'The sweep would now refuse EVERY ref and silently stop deleting identity ' +
      'documents — a retention gap that looks exactly like a quiet week.',
  );
});
