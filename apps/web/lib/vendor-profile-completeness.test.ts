/**
 * Pins the scope of the My Shop completeness ring (bug fix 2026-07-15). The
 * three header signals (ring "100%", Profile KPI tile, "no public address yet")
 * contradicted each other because the ring read as an all-encompassing
 * "Complete" while the formula only ever counted the 8 business-profile fields.
 *
 * These tests lock that the completeness formula does NOT include the public
 * address (`business_slug`) — so a fully-filled profile can legitimately be 100%
 * while the shop still has no public page. That invariant is why the ring is
 * scoped to "Profile" (not "Complete") and why the header points the address at
 * the Pro/Website step instead of at "Profile". If someone later folds the slug
 * into the formula, this suite fails on purpose so the label story is revisited.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { businessProfileChecklist, type VendorProfileRow } from './vendor-profile';

/** A profile with every one of the 8 checklist fields filled — but no slug. */
function fullProfileNoSlug(): VendorProfileRow {
  return {
    logo_url: 'r2://logo.png',
    business_name: 'SetnaProd',
    business_owner_name: 'Owner Name',
    hq_address: '123 Real St, Makati',
    contact_phone: '+63 900 000 0000',
    contact_email: 'hi@setnaprod.example',
    in_business_since_year: 2020,
    services: ['photography'],
    business_slug: null,
    public_visibility: 'unlisted',
  } as unknown as VendorProfileRow;
}

test('all 8 business-profile fields in → 100% complete', () => {
  const c = businessProfileChecklist(fullProfileNoSlug());
  assert.equal(c.total, 8);
  assert.equal(c.done, 8);
  assert.equal(c.complete, true);
});

test('the public address (slug) is NOT one of the counted fields', () => {
  const c = businessProfileChecklist(fullProfileNoSlug());
  assert.ok(
    !c.items.some((i) => i.key === 'business_slug' || i.key === 'slug'),
    'business_slug must not appear in the profile-completeness checklist',
  );
  // ...and a null slug does not knock the profile below 100% — proving a 100%
  // ring can coexist with "no public address yet" (the contradiction being fixed).
  assert.equal(c.complete, true);
});

test('a missing required field drops below 100%', () => {
  const p = fullProfileNoSlug();
  (p as { contact_email: string | null }).contact_email = null;
  const c = businessProfileChecklist(p);
  assert.equal(c.complete, false);
  assert.equal(c.done, 7);
  assert.ok(c.missing.length === 1);
});
