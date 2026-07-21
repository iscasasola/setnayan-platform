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
 *   • VERIFICATION  — `verificationSubmitMissing` refuses to submit while the
 *     profile is incomplete, so a logo-less vendor cannot reach pending_review
 *     even with every required document uploaded.
 *   • PUBLISH       — the save-time gate in app/vendor-dashboard/actions.ts
 *     checks the same field set via BUSINESS_PROFILE_LABELS; that set is
 *     asserted here to still contain the logo.
 *
 * If someone drops the logo from the checklist to "make onboarding easier",
 * these fail on purpose: that one edit would let a logo-less shop publish AND
 * get verified.
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

test('the logo is one of the fields the publish gate checks', () => {
  // app/vendor-dashboard/actions.ts pushes BUSINESS_PROFILE_LABELS.logo onto
  // `missing` and forces is_published=false. Both surfaces read this label
  // set, so keeping the key here keeps them locked together.
  assert.equal(BUSINESS_PROFILE_LABELS.logo, 'Logo');
  const keys = businessProfileChecklist(profileWithoutLogo()).items.map((i) => i.key);
  assert.ok(keys.includes('logo'), 'publish gate and checklist must share the logo item');
});

test('a logo-less vendor cannot submit for verification, even with all docs in', () => {
  const uploads = allRequiredDocs();
  assert.equal(requiredDocsComplete(uploads), true, 'documents must not be the blocker');

  const missing = verificationSubmitMissing({
    profileComplete: businessProfileChecklist(profileWithoutLogo()).complete,
    uploads,
  });
  assert.deepEqual(missing, ['Finish your business profile']);
});

test('adding the logo is the ONLY thing between that vendor and submitting', () => {
  const missing = verificationSubmitMissing({
    profileComplete: businessProfileChecklist(profileWithLogo()).complete,
    uploads: allRequiredDocs(),
  });
  assert.deepEqual(missing, [], 'logo in + docs in → the gate is clear');
});
