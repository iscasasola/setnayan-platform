/**
 * three-verification-papers.test.ts — 🧾 A SHOP IS VERIFIED ON THREE PAPERS, NOT FOUR.
 *
 * Owner, 2026-11-14 (specs DECISION_LOG f69ec167), verbatim:
 *   "delete bank account proof. we do not need that. just the 3. DTI/SEC, BIR, Mayor's/Business Permit"
 *
 * What this holds, each as its own test so a regression names itself:
 *   1 · the required list is exactly DTI/SEC · BIR 2303 · Mayor's/Business Permit, and the bank slot is gone;
 *   2 · a supplier with those three sees nothing missing about papers and can submit;
 *   3 · a shop that uploaded a bank proof earlier still reads the same — the stored key is simply not counted;
 *   4 · no supplier-facing sentence still asks for, counts or names a bank proof;
 *   5 · the retired guide's address is kept and forwards to the Getting verified help (never a 404);
 *   6 · payout settings are untouched — a supplier's GCash / bank payout method is a different thing.
 *
 * The admin half ("the admin can approve with three") is held in `lib/verification-checks.test.ts`, beside the
 * check it exercises; the paired-papers shape in `lib/verification-pairs.test.ts`.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { stripComments } from './strip-comments';
import { ALL_HELP_ARTICLES, findHelpArticle } from './help';
import { setupPapers } from './setup-papers';
import {
  DOC_SLOTS,
  REQUIRED_DOC_COUNT,
  REQUIRED_DOC_SLOT_KEYS,
  VENDOR_DOC_SLOTS,
  countCompleteRequiredSlots,
  countCompleteSlots,
  requiredDocsComplete,
  verificationSubmitMissing,
  type DocUploadMap,
} from './vendor-verification';

const WEB = join(__dirname, '..');
const read = (rel: string) => readFileSync(join(WEB, rel), 'utf8');

const THREE: DocUploadMap = {
  dti_certificate: { r2_key: 'r2://setnayan-vendor-verification/vendors/v/dti.pdf', uploaded_at: '2026-11-01T00:00:00Z' },
  bir_2303: { r2_key: 'r2://setnayan-vendor-verification/vendors/v/bir.pdf', uploaded_at: '2026-11-01T00:00:00Z' },
  mayors_permit: { r2_key: 'r2://setnayan-vendor-verification/vendors/v/permit.pdf', uploaded_at: '2026-11-01T00:00:00Z' },
} as DocUploadMap;

const THREE_PLUS_OLD_BANK_PROOF: DocUploadMap = {
  ...THREE,
  bank_account_proof: { r2_key: 'r2://setnayan-vendor-verification/vendors/v/bank.pdf', uploaded_at: '2026-10-01T00:00:00Z' },
} as DocUploadMap;

test('1 · the required papers are exactly DTI/SEC · BIR 2303 · Mayor’s/Business Permit', () => {
  assert.deepEqual([...REQUIRED_DOC_SLOT_KEYS], ['dti_certificate', 'bir_2303', 'mayors_permit']);
  assert.equal(REQUIRED_DOC_COUNT, 3);
  assert.ok(!DOC_SLOTS.some((s) => s.key === 'bank_account_proof'), 'bank proof is a checklist slot again');
  assert.ok(!VENDOR_DOC_SLOTS.some((s) => /bank/i.test(`${s.key} ${s.label} ${s.hint}`)), 'a supplier slot still mentions a bank');
  // Owner 2026-11-14 (DECISION_LOG "VERIFICATION IS THREE PAPERS AND ONE SUBMIT"): the Google Meet is not a step.
  assert.ok(!DOC_SLOTS.some((s) => s.key === 'google_meet' || s.kind !== 'upload'), 'a non-paper step is back on the checklist');
  // The slot numbers stay a clean 1…n after the removal.
  assert.deepEqual(DOC_SLOTS.map((s) => s.number), DOC_SLOTS.map((_, i) => i + 1));
});

test('2 · with the three papers, nothing about papers is missing and the supplier can submit', () => {
  assert.equal(requiredDocsComplete(THREE), true);
  assert.equal(countCompleteRequiredSlots(THREE), 3);
  assert.deepEqual(verificationSubmitMissing({ uploads: THREE }), []);
  // Two papers still stop the submit — and the sentence names only the three.
  const two = { dti_certificate: THREE.dti_certificate, bir_2303: THREE.bir_2303 } as DocUploadMap;
  const missing = verificationSubmitMissing({ uploads: two });
  assert.equal(missing.length, 1);
  assert.equal(missing[0], 'Upload your DTI/SEC, BIR 2303, and Business Permit');
  assert.doesNotMatch(missing.join(' '), /bank/i);
  // The Today rows: three, all in.
  const rows = setupPapers({ measured: true, status: 'draft', uploads: THREE })!;
  assert.deepEqual(rows.map((r) => r.key), ['dti_certificate', 'bir_2303', 'mayors_permit']);
  assert.ok(rows.every((r) => r.state === 'uploaded'));
});

test('3 · a shop that sent a bank proof earlier reads exactly the same — the old file is kept, never counted', () => {
  assert.equal(requiredDocsComplete(THREE_PLUS_OLD_BANK_PROOF), true);
  assert.equal(countCompleteRequiredSlots(THREE_PLUS_OLD_BANK_PROOF), countCompleteRequiredSlots(THREE));
  assert.equal(countCompleteSlots(THREE_PLUS_OLD_BANK_PROOF), countCompleteSlots(THREE));
  assert.deepEqual(
    verificationSubmitMissing({ uploads: THREE_PLUS_OLD_BANK_PROOF }),
    [],
  );
  const rows = setupPapers({ measured: true, status: 'approved', uploads: THREE_PLUS_OLD_BANK_PROOF })!;
  assert.equal(rows.length, 3, 'the old bank proof drew a fourth row');
  // Nothing here deletes it: the retention sweep still knows the key (the 90-day clock it was always on).
  assert.match(read('lib/vendor-identity-retention-core.ts'), /'bank_account_proof',/);
});

/** Supplier- and couple-facing files that used to ask for, count or name the bank proof. */
const SAID_TO_PEOPLE = [
  'lib/vendor-verification.ts',
  'lib/verification-pairs.ts',
  'lib/help.ts',
  'lib/shop-badge-row.ts',
  'lib/vendor-first-steps.ts',
  'lib/verified-badge.ts',
  'lib/feature-pages/plan-b.ts',
  'app/vendor-dashboard/_components/setup-papers.tsx',
  'app/vendor-dashboard/shop/_components/verify-section.tsx',
  'app/vendor-dashboard/shop/_components/verify-pairs.tsx',
  'app/vendor-dashboard/shop/_components/docs-body.tsx',
  'app/vendor-dashboard/shop/_components/shop-settings-rows.tsx',
  'app/for-suppliers/_components/supplier-front-data.ts',
  'app/for-suppliers/_components/supplier-front-page.tsx',
  'app/(shell)/for-coordinators/page.tsx',
] as const;

test('4 · no supplier-facing sentence asks for, counts or names a bank proof — or "four papers"', () => {
  for (const rel of SAID_TO_PEOPLE) {
    const src = stripComments(read(rel));
    assert.doesNotMatch(src, /bank.?(account)?.?proof/i, `${rel} still mentions the bank proof`);
    assert.doesNotMatch(src, /\bfour (required )?papers\b|\b4 (required )?papers\b/i, `${rel} still says four papers`);
  }
  // The anti-vacuity: the files are real and carry the three papers in words.
  assert.match(read('app/vendor-dashboard/_components/setup-papers.tsx'), /The three required papers/);
});

test('5 · the retired guide is gone from Help, and its address forwards to Getting verified', () => {
  const slug = 'how-to-prepare-bank-account-proof';
  assert.equal(findHelpArticle(slug), undefined, 'the bank-proof guide is back in Help');
  assert.ok(!ALL_HELP_ARTICLES.some(({ article }) => /bank (account )?proof/i.test(`${article.title} ${article.body}`)));
  // The three remaining guides are still linked from their slots.
  for (const s of DOC_SLOTS.filter((x) => REQUIRED_DOC_SLOT_KEYS.has(x.key))) {
    assert.ok(s.guideSlug && findHelpArticle(s.guideSlug), `${s.key} lost its guide`);
  }
  const config = stripComments(read('next.config.ts'));
  assert.match(
    config,
    /source:\s*'\/help\/how-to-prepare-bank-account-proof',\s*destination:\s*'\/help\?role=vendor#getting-verified',\s*permanent:\s*true/,
    'the old guide address no longer forwards to the verification help',
  );
  assert.match(read('lib/help.ts'), /key: 'getting-verified'/, 'the forward points at a Help section that no longer exists');
});

test('6 · payout settings are not part of this ruling — the payout method keeps its bank option', () => {
  // A supplier's payout method (GCash / bank, to RECEIVE couple payments) is a separate setting and stays.
  const payout = read('lib/verification-checks.ts');
  assert.match(payout, /function checkPayoutAccountName/, 'the payout-name check was removed with the bank proof');
});

/* ── 2026-11-14 · NO TYPED REGISTRATION NUMBER BEFORE SUBMIT ─────────────────────────────────────────────────────
   Controller relaying the corpus (DECISION_LOG "VERIFICATION IS THREE PAPERS AND ONE SUBMIT": "no other steps needed";
   "ONE UPLOAD PLACE": the app READS name · number · dates off the paper, the supplier never types or confirms them).
   The duplicate-business check stays — on the admin's side ("CLEAN PAPERS VERIFY THE SHOP ON SUBMIT": any doubt goes
   to the admin), named: "Same registration number as <shop>" — held in `lib/verification-checks.test.ts`. */
test('7 · Submit asks for the three papers and nothing else — no typed registration number', () => {
  // The gate takes the uploads alone: there is no input left to ask for a number.
  assert.deepEqual(verificationSubmitMissing({ uploads: THREE }), []);
  const src = stripComments(read('lib/vendor-verification.ts'));
  assert.doesNotMatch(src, /registrationNumberOnFile|Add your government registration number/, 'Submit asks for a typed registration number again');
  for (const rel of [
    'app/vendor-dashboard/shop/inline-docs-actions.ts',
    'app/vendor-dashboard/profile/details-data.ts',
    'lib/vendor-first-steps.server.ts',
  ]) {
    assert.match(stripComments(read(rel)), /verificationSubmitMissing\(\{ uploads \}\)/, `${rel} feeds the submit gate more than the papers`);
  }
});
