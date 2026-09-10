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
  planApplicationScrub,
  planVerificationScrub,
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

/* ==========================================================================
 * BOTH SWEEPS DELETE ONLY THE VENDOR'S OWN OBJECTS (2026-09-10)
 *
 * Proved by CALLING the planners the sweep executes — never by checking that a
 * function name appears in the sweep's source (the guard this replaces did that,
 * and `const inScope = [...present]` stayed green while the sweep deleted
 * another bucket).
 *
 * ⚠ CORRECTED: this block used to assert that the APPLICATIONS sweep is left
 * unpinned on purpose, because its refs were "tenancy-pinned at WRITE time by
 * SEC-1". That pin lived only in the server action; a vendor could PATCH its own
 * draft's doc_uploads through PostgREST. Both paths are pinned by TENANT now.
 * ========================================================================== */

const V = '0a000000-0000-4000-8000-000000000001';
const VICTIM = '0a000000-0000-4000-8000-00000000dead';
const OWN_ID = `r2://setnayan-vendor-verification/vendors/${V}/verification/gov.png`;
const OWN_MEDIA = `r2://setnayan-media/vendors/${V}/portfolio/p1.jpg`;
const VICTIM_LOGO = `r2://setnayan-media/vendors/${VICTIM}/logo/logo.png`;
const VICTIM_DTI = `r2://setnayan-vendor-verification/vendors/${VICTIM}/verification/dti.pdf`;

test('APPLICATION: the reviewer’s exploit — another shop’s permit and a stranger’s logo — is refused', () => {
  const plan = planApplicationScrub({
    vendor_profile_id: V,
    doc_uploads: {
      government_id: { r2_key: VICTIM_DTI },
      portfolio_samples: [{ r2_key: VICTIM_LOGO }],
      dti_certificate: { r2_key: `r2://setnayan-vendor-verification/vendors/${V}/verification/dti.pdf` },
    },
  });
  assert.deepEqual(plan.deletes, [], 'a foreign object was planned for deletion');
  assert.equal(plan.refused, 2);
  assert.deepEqual(plan.refusedSlots.sort(), ['government_id', 'portfolio_samples']);
  assert.deepEqual(plan.scrubbedSlots, []);
  // The pointers are KEPT — the refused slots are still there to be re-reported.
  assert.deepEqual(Object.keys(plan.nextDocUploads).sort(), ['dti_certificate', 'government_id', 'portfolio_samples']);
});

test('APPLICATION: the vendor’s own uploads — in EITHER place the intake accepts — are deleted and scrubbed', () => {
  const plan = planApplicationScrub({
    vendor_profile_id: V,
    doc_uploads: {
      government_id: { r2_key: OWN_ID },
      portfolio_samples: [{ r2_key: OWN_MEDIA }, { r2_key: `r2://setnayan-media/vendors/${V}/portfolio/p2.jpg` }],
      dti_certificate: { r2_key: `r2://setnayan-vendor-verification/vendors/${V}/verification/dti.pdf` },
      client_references: [{ name: 'A Client' }],
    },
  });
  assert.equal(plan.refused, 0);
  assert.deepEqual(
    plan.deletes.map((d) => `${d.bucket}/${d.key}`).sort(),
    [
      `setnayan-media/vendors/${V}/portfolio/p1.jpg`,
      `setnayan-media/vendors/${V}/portfolio/p2.jpg`,
      `setnayan-vendor-verification/vendors/${V}/verification/gov.png`,
    ],
  );
  // The seven-year permit and the non-identity slots are copied through.
  assert.deepEqual(Object.keys(plan.nextDocUploads).sort(), ['client_references', 'dti_certificate']);
});

test('APPLICATION: a slot is all-or-nothing — one foreign ref keeps the WHOLE slot, own refs included', () => {
  const plan = planApplicationScrub({
    vendor_profile_id: V,
    doc_uploads: { portfolio_samples: [{ r2_key: OWN_MEDIA }, { r2_key: VICTIM_LOGO }] },
  });
  assert.deepEqual(plan.deletes, []);
  assert.equal(plan.refused, 1);
  assert.deepEqual(plan.nextDocUploads, { portfolio_samples: [{ r2_key: OWN_MEDIA }, { r2_key: VICTIM_LOGO }] });
});

test('APPLICATION: the tenant is the ROW’S vendor — a missing one admits nothing', () => {
  const plan = planApplicationScrub({ vendor_profile_id: null, doc_uploads: { government_id: { r2_key: OWN_ID } } });
  assert.deepEqual(plan.deletes, []);
  assert.equal(plan.refused, 1);
  // …and another vendor's row cannot claim this vendor's folder.
  const other = planApplicationScrub({ vendor_profile_id: VICTIM, doc_uploads: { government_id: { r2_key: OWN_ID } } });
  assert.deepEqual(other.deletes, []);
});

test('VERIFICATION COLUMNS: the exploit ref from #5401 and a cross-vendor ref are refused, pointer kept', () => {
  const plan = planVerificationScrub({
    vendor_profile_id: V,
    government_id_r2_key: 'r2://setnayan-media/vendors/8f14e45f-ceea-467a-9f2a-1c2d3e4f5a6b/logo/aaaaaaaa-logo.png',
    bank_account_proof_r2_key: `r2://setnayan-vendor-verification/vendors/${VICTIM}/bank.pdf`,
  });
  assert.deepEqual(plan.deletes, []);
  assert.deepEqual(plan.clear, [], 'a refused column would be nulled — the object kept with nothing pointing at it');
  assert.deepEqual([...plan.refused].sort(), ['bank_account_proof_r2_key', 'government_id_r2_key']);
});

test('VERIFICATION COLUMNS: every bucket but the private one is refused; the vendor’s own file is deleted', () => {
  for (const bucket of ['setnayan-media', 'setnayan-thread-files', 'setnayan-vendor-contracts', 'setnayan-samples']) {
    const plan = planVerificationScrub({
      vendor_profile_id: V,
      government_id_r2_key: `r2://${bucket}/vendors/${V}/government-id.jpg`,
    });
    assert.deepEqual(plan.clear, [], `${bucket} must be refused`);
  }
  const ok = planVerificationScrub({
    vendor_profile_id: V,
    government_id_r2_key: `r2://setnayan-vendor-verification/vendors/${V}/government-id.jpg`,
    bank_account_proof_r2_key: null,
  });
  assert.deepEqual(ok.clear, ['government_id_r2_key']);
  assert.equal(ok.deletes.length, 1);
  assert.equal(ok.deletes[0]!.key, `vendors/${V}/government-id.jpg`);
});

test('VERIFICATION COLUMNS: mixed row — only the in-scope column is deleted AND cleared', () => {
  const plan = planVerificationScrub({
    vendor_profile_id: V,
    government_id_r2_key: `r2://setnayan-vendor-verification/vendors/${V}/id.jpg`,
    bank_account_proof_r2_key: VICTIM_LOGO,
  });
  assert.deepEqual(plan.clear, ['government_id_r2_key']);
  assert.deepEqual(plan.refused, ['bank_account_proof_r2_key']);
  assert.equal(plan.deletes.length, 1);
});

test('near-miss buckets, bare refs, legacy URLs and junk are refused rather than crashing', () => {
  for (const ref of [
    'r2://setnayan-vendor-verification-evil/vendors/x/k.jpg',
    'r2://setnayan-vendor-verification/',
    'r2://setnayan-vendor-verification',
    'https://cdn.setnayan.com/vendors/v1/logo.png',
    `vendors/${V}/logo.png`,
    '   ',
  ]) {
    const plan = planVerificationScrub({ vendor_profile_id: V, government_id_r2_key: ref });
    assert.deepEqual(plan.deletes, [], JSON.stringify(ref));
    assert.deepEqual(plan.clear, [], JSON.stringify(ref));
  }
});
