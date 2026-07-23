/**
 * Pins owner decision 4 (2026-07-21): "shop logo is only required before
 * verification. starting your shop can start as name, next is completing the
 * profile, then verification."
 *
 * The logo requirement MOVED one stage later — it did not disappear. Locking
 * "the vendor's own submit button refuses" is NOT enough to make that true,
 * because another door leads to the same room. This suite locks all of them:
 *
 *   • REGISTRATION — `OPEN_SHOP_LOGO_REQUIRED` is off, and it is the SINGLE
 *     flag both the /open-shop client wizard and the `becomeVendor` server
 *     action read.
 *   • PROFILE — the logo is still a `businessProfileChecklist` item, so a
 *     logo-less shop is visibly sub-100% with a row labelled "Logo".
 *   • VERIFICATION (vendor side) — `verificationSubmitMissing` refuses submit
 *     while the profile is incomplete, the reason string is an IMPORTED
 *     constant rather than a literal re-typed at the call site, and the submit
 *     BUTTON consults the same gate instead of only counting document slots.
 *   • VERIFICATION (admin side) — `verificationApprovalRefusal` refuses to
 *     mint a verified vendor whose profile is incomplete, and BOTH admin
 *     approve paths in app/admin/verify/actions.ts call it. Without this the
 *     stated goal is simply not met: an admin can flip `public_visibility →
 *     'verified'` on a vendor who never submitted anything, and that flip also
 *     advances `verification_state`.
 *   • PUBLISH — the save-time gate in app/vendor-dashboard/actions.ts. This
 *     suite SOURCE-SCANS that gate and asserts the field set it enumerates is
 *     exactly the checklist's field set. (An earlier revision of this docblock
 *     claimed that assertion and only checked that the logo label existed.)
 *   • THE ESCAPE HATCH — a shop that reaches verified without a logo must
 *     still be able to ADD one. `isLockedLogoCompletion` is what allows that,
 *     and both vendor write paths honour it.
 *   • DEGRADED READS — a gate must never be decided from the LEGACY fallback
 *     projection, which reports three real fields as NULL.
 *
 * If someone drops the logo from the checklist to "make onboarding easier",
 * these fail on purpose: that one edit would unlock publish AND verification
 * at once.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import { OPEN_SHOP_LOGO_REQUIRED } from './open-shop-validation';
import {
  BUSINESS_PROFILE_LABELS,
  businessProfileChecklist,
  verificationApprovalRefusal,
  type VendorProfileRow,
} from './vendor-profile';
import { isLockedLogoCompletion } from './vendor-corrections';
import {
  REQUIRED_DOC_SLOT_KEYS,
  VERIFICATION_MISSING_PROFILE,
  requiredDocsComplete,
  verificationSubmitMissing,
  type DocUploadMap,
} from './vendor-verification';

const HERE = dirname(fileURLToPath(import.meta.url));
const src = (rel: string) => readFileSync(join(HERE, '..', rel), 'utf8');

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

// ---------------------------------------------------------------------------
// Registration + profile
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// PUBLISH — the claim the old docblock made, now actually asserted
// ---------------------------------------------------------------------------

test('the publish gate enumerates EXACTLY the checklist field set', () => {
  const actions = src('app/vendor-dashboard/actions.ts');
  const start = actions.indexOf('if (payload.is_published) {');
  assert.ok(start > 0, 'publish gate block not found — did it move or get renamed?');
  const end = actions.indexOf('publishBlockedMissing = missing;', start);
  assert.ok(end > start, 'publish gate block end marker not found');
  const gate = actions.slice(start, end);

  const gateKeys = new Set(
    [...gate.matchAll(/BUSINESS_PROFILE_LABELS\.(\w+)/g)].map((m) => m[1]),
  );
  const checklistKeys = new Set(
    businessProfileChecklist(profileWithoutLogo()).items.map((i) => i.key),
  );

  assert.ok(gateKeys.has('logo'), 'the publish gate must still check the logo');
  assert.deepEqual(
    [...gateKeys].sort(),
    [...checklistKeys].sort(),
    'publish gate and business-profile checklist must gate the SAME field set',
  );
});

// ---------------------------------------------------------------------------
// VERIFICATION — vendor side
// ---------------------------------------------------------------------------

test('a logo-less vendor cannot submit for verification, even with all docs in', () => {
  const uploads = allRequiredDocs();
  assert.equal(requiredDocsComplete(uploads), true, 'documents must not be the blocker');

  const missing = verificationSubmitMissing({
    profileComplete: businessProfileChecklist(profileWithoutLogo()).complete,
    uploads,
  });
  assert.deepEqual(missing, [VERIFICATION_MISSING_PROFILE]);
});

test('adding the logo is the ONLY thing between that vendor and submitting', () => {
  const missing = verificationSubmitMissing({
    profileComplete: businessProfileChecklist(profileWithLogo()).complete,
    uploads: allRequiredDocs(),
  });
  assert.deepEqual(missing, [], 'logo in + docs in → the gate is clear');
});

test('the profile reason is imported, never re-typed at a call site', () => {
  const verifyActions = src('app/vendor-dashboard/verify/actions.ts');
  assert.ok(
    verifyActions.includes('VERIFICATION_MISSING_PROFILE'),
    'the /verify submit path must branch on the shared constant',
  );
  assert.ok(
    !verifyActions.includes(`'${VERIFICATION_MISSING_PROFILE}'`) &&
      !verifyActions.includes(`"${VERIFICATION_MISSING_PROFILE}"`),
    'a re-typed literal is the client/server drift this module exists to prevent',
  );
});

test('the submit button reads the profile gate, not just the doc count', () => {
  const page = src('app/vendor-dashboard/verify/page.tsx');
  assert.ok(
    page.includes('probeBusinessProfileCompleteness'),
    'the page must consult the same completeness source the action does',
  );
  const card = page.slice(page.indexOf('function SubmitCard('));
  assert.ok(card.length > 0, 'SubmitCard not found');
  assert.ok(
    card.includes('profileMissing'),
    'SubmitCard must know what the profile is missing so it can say so',
  );
  assert.ok(
    /const eligible\s*=\s*docsIn\s*&&\s*profileIn/.test(card),
    'submit eligibility must require BOTH the documents and the profile',
  );
});

// ---------------------------------------------------------------------------
// VERIFICATION — admin side. This is the half the first pass missed.
// ---------------------------------------------------------------------------

test('the admin guard refuses a logo-less vendor, and names the gap', () => {
  const c = businessProfileChecklist(profileWithoutLogo());
  const refusal = verificationApprovalRefusal({
    ok: true,
    complete: c.complete,
    missing: c.missing,
    logoMissing: true,
  });
  assert.ok(refusal, 'approving a logo-less vendor must be refused');
  assert.ok(
    refusal.includes(BUSINESS_PROFILE_LABELS.logo),
    'the refusal must tell the admin which field is missing',
  );
});

test('the admin guard lets a complete vendor through', () => {
  const c = businessProfileChecklist(profileWithLogo());
  assert.equal(
    verificationApprovalRefusal({
      ok: true,
      complete: c.complete,
      missing: c.missing,
      logoMissing: false,
    }),
    null,
  );
});

test('a failed completeness read refuses too — fail closed, never accuse', () => {
  const refusal = verificationApprovalRefusal({ ok: false, error: 'boom' });
  assert.ok(refusal, 'an unreadable profile must not be approved on a guess');
  // It must NOT claim specific fields are missing — that is a false accusation.
  assert.ok(
    !refusal.includes('still missing'),
    'a read failure must not be reported as a list of missing fields',
  );
});

test('BOTH admin approve paths run the guard — no verified-with-NULL-logo door', () => {
  const adminSrc = src('app/admin/verify/actions.ts');

  // Path A — the visibility flip. `transitionVendorVisibility(nextVisibility:
  // 'verified')` also advances verification_state, for a vendor who may never
  // have submitted an application at all.
  const a0 = adminSrc.indexOf('async function transitionVendorVisibility(');
  assert.ok(a0 > 0, 'transitionVendorVisibility not found');
  const a1 = adminSrc.indexOf('export async function approveVendor(', a0);
  assert.ok(a1 > a0, 'approveVendor not found');
  const pathA = adminSrc.slice(a0, a1);
  assert.ok(
    pathA.includes('verificationApprovalRefusal'),
    'the visibility→verified flip must run the profile-completeness guard',
  );

  // Path B — the application decision. `case 'approved'` writes
  // verification_state = 'verified' + public_visibility = 'verified'.
  const b0 = adminSrc.indexOf("case 'approved': {");
  assert.ok(b0 > 0, "applyApplicationDecision case 'approved' not found");
  const b1 = adminSrc.indexOf("case 'rejected': {", b0);
  assert.ok(b1 > b0, "case 'rejected' not found");
  const pathB = adminSrc.slice(b0, b1);
  assert.ok(
    pathB.includes('verificationApprovalRefusal'),
    'approving an application must run the profile-completeness guard',
  );
  assert.ok(
    pathB.indexOf('verificationApprovalRefusal') < pathB.indexOf("toState = 'verified'"),
    'the guard must run BEFORE the state is set to verified',
  );
});

// ---------------------------------------------------------------------------
// THE ESCAPE HATCH — a verified vendor with no logo can still add one
// ---------------------------------------------------------------------------

test('adding a first logo while verified is a completion, not a locked edit', () => {
  assert.equal(isLockedLogoCompletion(null, 'r2://v/abc/logo.png'), true);
  assert.equal(isLockedLogoCompletion('   ', 'r2://v/abc/logo.png'), true);
  // Changing an EXISTING logo stays locked — that is the identity an admin
  // signed off on.
  assert.equal(
    isLockedLogoCompletion('r2://v/abc/old.png', 'r2://v/abc/new.png'),
    false,
  );
  // Clearing a logo is never a "completion".
  assert.equal(isLockedLogoCompletion(null, null), false);
  assert.equal(isLockedLogoCompletion('r2://v/abc/old.png', null), false);
});

test('both vendor write paths honour the completion exception', () => {
  const actions = src('app/vendor-dashboard/actions.ts');
  const inline = actions.slice(
    actions.indexOf('export async function updateVendorProfileField('),
  );
  assert.ok(inline.length > 0, 'updateVendorProfileField not found');
  assert.ok(
    inline.includes('isLockedLogoCompletion'),
    'the inline field editor is the path a real vendor uses — it must allow a first logo',
  );
  const stripAt = actions.indexOf('for (const key of LOCKED_IDENTITY_FIELD_KEYS)');
  assert.ok(stripAt > 0, 'locked-identity strip not found');
  assert.ok(
    actions.slice(stripAt, stripAt + 900).includes('isLockedLogoCompletion'),
    'the full-form strip must let a first logo through too',
  );
});

// ---------------------------------------------------------------------------
// DEGRADED READS — a resilient fetch must never become an accusation
// ---------------------------------------------------------------------------

test('verification gates read the narrow probe, not the legacy-degradable row', () => {
  // `fetchOwnVendorProfile` falls back to a LEGACY projection that reports
  // hq_address / business_owner_name / in_business_since_year as NULL. That is
  // fine for a progress ring and catastrophic for a gate: it would refuse a
  // complete vendor and name three fields they already filled in.
  for (const rel of [
    'app/vendor-dashboard/verify/actions.ts',
    'app/vendor-dashboard/shop/inline-docs-actions.ts',
  ]) {
    const s = src(rel);
    assert.ok(
      s.includes('probeBusinessProfileCompleteness'),
      `${rel} must gate on the narrow probe`,
    );
    assert.ok(
      !/profileComplete:\s*businessProfileChecklist\(/.test(s),
      `${rel} must not gate on a possibly-degraded fetchOwnVendorProfile row`,
    );
  }
});
