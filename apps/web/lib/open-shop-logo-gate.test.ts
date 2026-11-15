/**
 * Pins owner decision 4 (2026-07-21): "shop logo is only required before
 * verification. starting your shop can start as name, next is completing the
 * profile, then verification."
 *
 * The logo requirement MOVED one stage later — it did not disappear. This
 * suite locks both halves of that sentence, because each half is one line away
 * from silently undoing the other:
 *
 *   • REGISTRATION  — `OPEN_SHOP_LOGO_REQUIRED` is off, and it is the SINGLE
 *     flag both the /open-shop client wizard and the `becomeVendor` server
 *     action read (the two-layer drift this module exists to prevent).
 *   • PROFILE       — the logo is still a `businessProfileChecklist` item, so
 *     a logo-less shop is visibly sub-100% with a row literally labelled
 *     "Logo". Removing it from the checklist would hide the obligation AND
 *     (see below) unlock both downstream gates at once.
 *   • VERIFICATION  — ⚠ SUPERSEDED 2026-11-14 (owner, DECISION_LOG "VERIFICATION
 *     IS THREE PAPERS AND ONE SUBMIT"; profile gate: "Yes, remove it"). The
 *     submit gate no longer reads the profile: a logo-less vendor with the three
 *     papers CAN submit, and the tests below now hold that. The logo stays a
 *     checklist item (PROFILE, above) — an obligation on the profile, not a gate
 *     on verification.
 *   • PUBLISH       — ⚠ CORRECTED 2026-08-09. This used to read "the save-time
 *     gate in app/vendor-dashboard/actions.ts checks the same field set via
 *     BUSINESS_PROFILE_LABELS". That gate lived inside `saveVendorProfile`,
 *     which had had NO CALLER since 2026-07-05 and was deleted 2026-08-09 — so
 *     the sentence described a check that could not run, and had not run for
 *     five weeks before it was written out of the codebase. Publication is an
 *     ADMIN action (app/admin/vendors/actions.ts, from a form that renders a
 *     real `is_published` checkbox) and that path has never consulted profile
 *     completeness. The logo obligation is therefore carried by the two gates
 *     above, both of which genuinely run; BUSINESS_PROFILE_LABELS is still
 *     asserted below because the CHECKLIST and the completion card share it.
 *
 * If someone drops the logo from the checklist to "make onboarding easier",
 * these fail on purpose: that one edit would hide the obligation.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { OPEN_SHOP_LOGO_REQUIRED } from './open-shop-validation';
import {
  BUSINESS_PROFILE_LABELS,
  businessProfileChecklist,
  type VendorProfileRow,
} from './vendor-profile';
import {
  REQUIRED_DOC_SLOT_KEYS,
  requiredDocsComplete,
  verificationSubmitMissing,
  type DocUploadMap,
} from './vendor-verification';

/** Everything on the 8-item business-profile checklist EXCEPT the logo. */
function profileWithoutLogo(): VendorProfileRow {
  return {
    logo_url: null,
    business_name: 'SetnaProd',
    business_owner_name: 'Owner Name',
    hq_address: '123 Real St, Makati',
    contact_phone: '+63 900 000 0000',
    contact_email: 'hi@setnaprod.example',
    in_business_since_year: 2020,
    services: ['photography'],
  } as unknown as VendorProfileRow;
}

function profileWithLogo(): VendorProfileRow {
  const p = profileWithoutLogo() as { logo_url: string | null };
  p.logo_url = 'r2://vendors/abc/logo/mark.png';
  return p as unknown as VendorProfileRow;
}

/** Every REQUIRED verification document in — so ONLY the profile can block. */
function allRequiredDocs(): DocUploadMap {
  const uploads: DocUploadMap = {};
  for (const key of REQUIRED_DOC_SLOT_KEYS) {
    uploads[key] = [{ r2_key: `vendors/abc/docs/${key}.pdf` }];
  }
  return uploads;
}

test('the logo is NOT required to start a shop', () => {
  assert.equal(
    OPEN_SHOP_LOGO_REQUIRED,
    false,
    'owner decision 4: starting a shop must not demand a logo',
  );
});

test('a logo-less profile is still visibly incomplete, by name', () => {
  const c = businessProfileChecklist(profileWithoutLogo());
  assert.equal(c.complete, false);
  assert.equal(c.done, 7);
  assert.equal(c.total, 8);
  // The vendor is TOLD what they owe — the row is labelled, not silent.
  assert.deepEqual(c.missing, [BUSINESS_PROFILE_LABELS.logo]);
  assert.ok(c.items.some((i) => i.key === 'logo' && i.ok === false));
});

test('the logo keeps the same name on the checklist and on the completion card', () => {
  // Renamed 2026-08-09 — see the PUBLISH note above: this asserted a coupling to
  // a publish gate that had not been reachable since 2026-07-05. The coupling
  // that IS live is checklist ↔ label: `businessProfileChecklist` decides the
  // item exists, BUSINESS_PROFILE_LABELS decides what the vendor is told it is
  // called, and `verificationSubmitMissing` refuses on the result. Drop the key
  // from either side and the obligation goes quiet rather than wrong.
  assert.equal(BUSINESS_PROFILE_LABELS.logo, 'Logo');
  const keys = businessProfileChecklist(profileWithoutLogo()).items.map((i) => i.key);
  assert.ok(keys.includes('logo'), 'checklist and label set must share the logo item');
});

// SUPERSEDED 2026-11-14 — owner, DECISION_LOG "VERIFICATION IS THREE PAPERS AND ONE SUBMIT" (profile gate: "Yes,
// remove it"): neither Submit nor the admin's approval may be blocked by the shop profile, the logo included. These two
// tests used to hold the opposite (a logo-less vendor could not submit); they now hold the ruling.
test('a logo-less vendor CAN submit for verification once the papers are in (2026-11-14)', () => {
  const uploads = allRequiredDocs();
  assert.equal(requiredDocsComplete(uploads), true, 'documents must not be the blocker');
  assert.equal(businessProfileChecklist(profileWithoutLogo()).complete, false, 'the fixture lost its missing logo');
  assert.deepEqual(verificationSubmitMissing({ uploads }), [], 'the missing logo blocks Submit again');
});

test('the papers are the ONLY thing between a vendor and submitting', () => {
  assert.equal(businessProfileChecklist(profileWithLogo()).complete, true, 'a complete profile changes nothing either way');
  assert.deepEqual(verificationSubmitMissing({ uploads: allRequiredDocs() }), [], 'docs in → the gate is clear');
  assert.deepEqual(verificationSubmitMissing({ uploads: {} }), ['Upload your DTI/SEC, BIR 2303, and Business Permit']);
});
