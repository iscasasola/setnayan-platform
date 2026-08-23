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
} from './vendor-identity-retention-core';
import { collectStoredAssetRefs } from './erasure/coverage';

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
