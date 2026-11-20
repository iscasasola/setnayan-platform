/**
 * verify-cut-the-paper-is-the-only-input.test.ts — ✂ CUT (2) OF THE SUPPLIER CUTS (DECISION_LOG 93ed7cd0).
 *
 * Owner, 2026-11-14: the supplier gives Setnayan three papers and presses Submit. Nothing else.
 *   · the registration number is READ off the DTI/SEC paper — never typed into a box of its own;
 *   · no "VALIDATE <shop>" email or text the supplier has to send from outside the app — so the admin
 *     no longer has a "Mark email received / Mark text received" stamp to press;
 *   · no 15-minute call;
 *   · bank proof is dropped completely (held in `three-verification-papers.test.ts`).
 *
 * Each rule is its own test so a regression names itself. The stored VALIDATE stamps on old applications are
 * kept (nothing here deletes data); only the stamping UI and its action are gone.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { stripComments } from './strip-comments';
import { registrationNumberOnPaper, type IntakeSlot } from './paper-intake';

const WEB = join(__dirname, '..');
const code = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));

const ACTIONS = 'app/vendor-dashboard/shop/inline-docs-actions.ts';
const DTI_REF = 'r2://setnayan-vendor-verification/vendors/v1/verification/dti.pdf';

const readSlot = (registrationNumber: string | null): IntakeSlot =>
  ({
    r2_key: DTI_REF,
    attempts: 1,
    kind: 'dti',
    evidence: { model: { registrationNumber } as never, qrTexts: [], read_at: '2026-11-15T00:00:00Z' },
  }) as IntakeSlot;

test('1 · the number is the one READ off a clean DTI/SEC copy', () => {
  assert.equal(registrationNumberOnPaper(readSlot('BN-1234567')), 'BN-1234567');
  assert.equal(registrationNumberOnPaper(readSlot('  BN-1234567  ')), 'BN-1234567');
  // Nothing read, nothing filed, nothing claimed.
  assert.equal(registrationNumberOnPaper(readSlot(null)), null);
  assert.equal(registrationNumberOnPaper(null), null);
  assert.equal(registrationNumberOnPaper({ attempts: 0 } as IntakeSlot), null, 'a slot with no file gave a number');
});

test('2 · after the third unclear try (and only then) the number typed FROM that paper is used', () => {
  const manual = {
    r2_key: DTI_REF,
    attempts: 3,
    manual: true,
    typed: { registration_number_raw: 'BN-7654321', registered_business_name: 'Banawe Blooms' },
    // A model read that was not trusted (the slot is manual) must not win over what the supplier typed.
    evidence: { model: { registrationNumber: 'BN-0000000' } as never, qrTexts: [], read_at: '2026-11-15T00:00:00Z' },
  } as IntakeSlot;
  assert.equal(registrationNumberOnPaper(manual), 'BN-7654321');
  // A manual slot with nothing typed yet has no number.
  assert.equal(registrationNumberOnPaper({ ...manual, typed: {} }), null);
});

test('3 · the claim is made by Submit, from the SEALED paper — never from a request', () => {
  const src = code(ACTIONS);
  // No action, no form field: the old typed box's action is gone, and nothing reads a typed number off a form.
  assert.ok(!/export async function saveRegistrationNumberInline/.test(src), 'the typed registration-number action is a public route again');
  assert.ok(!/formData\.get\(\s*'registration_number'\s*\)/.test(src), 'a registration number is read off a form again');
  assert.match(src, /^async function claimRegistrationNumber\(/m, 'the claim is missing (or exported)');
  // Submit opens the DTI/SEC slot through its seal and claims what is on it.
  assert.match(
    src,
    /registrationNumberOnPaper\(openSealedSlot\('dti_certificate', [^)]*\)?[^;]*\)/,
    'Submit does not take the number from the sealed DTI/SEC paper',
  );
  assert.match(src, /claimRegistrationNumber\(auth, numberOnPaper\)/, 'Submit does not claim the number on the paper');
  // The claim comes BEFORE the automatic decision, so the admin's "Same registration number as <shop>" has a number to compare.
  assert.ok(
    src.indexOf('claimRegistrationNumber(auth, numberOnPaper)') < src.indexOf('runAutoVerifyOnSubmit({'),
    'the number is claimed after the decision that reads it',
  );
  // Submit still asks for the three papers and nothing else.
  assert.match(src, /verificationSubmitMissing\(\{ uploads \}\)/);
});

test('4 · no VALIDATE email or text: the admin has nothing to stamp', () => {
  const actions = code('app/admin/verify/actions.ts');
  const page = code('app/admin/verify/page.tsx');
  assert.ok(!/markVendorContactConfirmed/.test(actions), 'the admin VALIDATE stamping action is back');
  assert.ok(!/mark_vendor_contact_confirmed/.test(actions), 'the admin VALIDATE stamping RPC is called again');
  for (const banned of [/markVendorContactConfirmed/, /ContactConfirmationBlock/, /Mark email received/, /Mark text received/, /VALIDATE message/, /expectedValidateToken/]) {
    assert.ok(!banned.test(page), `/admin/verify still draws the VALIDATE stamp (${banned})`);
  }
  // The checks no longer carry the stamps as facts — nothing could read them.
  for (const rel of ['lib/verification-checks.ts', 'lib/verification-checks-server.ts']) {
    assert.ok(!/contact(Email|Phone)ConfirmedAt/.test(code(rel)), `${rel} still carries a VALIDATE stamp as a check fact`);
  }
  // The supplier side was cut in #7627 and stays cut.
  const section = code('app/vendor-dashboard/shop/_components/verify-section.tsx');
  assert.ok(!/ContactsStep|ReceiptLine|VALIDATE/.test(section), 'the supplier is asked to send a VALIDATE message again');
});

test('5 · no call: no Meet step, no call check, no call copy on the supplier’s path', () => {
  assert.ok(!/identity_meeting|checkIdentityMeeting/.test(code('lib/verification-checks.ts')), 'the identity-call check is back');
  for (const rel of [
    'lib/vendor-verification.ts',
    'app/vendor-dashboard/shop/_components/verify-section.tsx',
    'app/vendor-dashboard/shop/_components/paper-upload-place.tsx',
    'app/vendor-dashboard/shop/_components/docs-body.tsx',
  ]) {
    const src = code(rel);
    // What a person reads. (`lib/vendor-verification.ts` still knows the retired `google_meet` KEY so an old
    // application's stored slot is read correctly — a key is not a request.)
    assert.ok(!/Google Meet|video call|15-minute call|short call|book a call/i.test(src), `${rel} asks for a call again`);
  }
});
