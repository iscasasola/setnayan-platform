import { test } from 'node:test';
import assert from 'node:assert/strict';
import { boothIsBranded, boothCanBrand, type BoothVendor } from './seating-3d';

/**
 * boothIsBranded — THE single booth-branding decision boundary for a couple's
 * rendered 3D Plan (owner 2026-07-22). A booth brands ONLY when the vendor is a
 * brandable tier (boothCanBrand: pro/enterprise) AND holds an ACTIVE paid 3D
 * Booth add-on (vendor.boothAddonActive). These tests pin the two-factor gate so
 * a future edit can't silently drop the entitlement requirement.
 */

function vendor(partial: Partial<BoothVendor>): BoothVendor {
  return {
    name: 'Test Vendor',
    category: 'photographer',
    logoUrl: 'r2://logo.png',
    ...partial,
  };
}

// ── the tier factor (unchanged) ─────────────────────────────────────────────

test('tier factor: only pro/enterprise CAN brand', () => {
  // ⚠ REWRITTEN 2026-08-29 BY AN OWNER RULING: *"3D Plan and papic Challenge is
  // only for paid vendors Solo, Pro, Enterprise, and Custom. not for free"*.
  // The gate has moved three times — a Pro/Ent perk (2026-07-04), then anybody
  // who bought the add-on (2026-07-25, behind a PRICE flag), now every PAID plan.
  //
  // 🔴 AND `custom` USED TO BE FALSE — the most expensive plan there is could not
  // brand its booth, because the old predicate listed two tier NAMES instead of
  // reading the ladder. The owner names Custom explicitly.
  assert.equal(boothCanBrand('solo'), true);
  assert.equal(boothCanBrand('pro'), true);
  assert.equal(boothCanBrand('enterprise'), true);
  assert.equal(boothCanBrand('custom'), true, 'the tier above Enterprise must not be excluded');
  assert.equal(boothCanBrand('free'), false);
  assert.equal(boothCanBrand('verified'), false, 'the legacy FREE tier — "not for free"');
  assert.equal(boothCanBrand(null), false);
  assert.equal(boothCanBrand('not-a-tier'), false, 'an unknown tier fails closed');
});

// ── the combined gate: tier AND active add-on ───────────────────────────────

test('brandable tier + active add-on → branded', () => {
  assert.equal(boothIsBranded(vendor({ tier: 'pro', boothAddonActive: true })), true);
  assert.equal(boothIsBranded(vendor({ tier: 'enterprise', boothAddonActive: true })), true);
});

test('brandable tier WITHOUT the add-on → NOT branded (generic booth)', () => {
  assert.equal(boothIsBranded(vendor({ tier: 'pro', boothAddonActive: false })), false);
  // Absent flag (older cached payload) is treated as inactive.
  assert.equal(boothIsBranded(vendor({ tier: 'pro' })), false);
  assert.equal(boothIsBranded(vendor({ tier: 'enterprise', boothAddonActive: undefined })), false);
});

test('add-on active but tier NOT brandable → NOT branded', () => {
  // Solo moved from refused to admitted by the same 2026-08-29 ruling; the free
  // plans did not.
  assert.equal(boothIsBranded(vendor({ tier: 'solo', boothAddonActive: true })), true);
  assert.equal(boothIsBranded(vendor({ tier: 'verified', boothAddonActive: true })), false);
  assert.equal(boothIsBranded(vendor({ tier: 'free', boothAddonActive: true })), false);
  assert.equal(boothIsBranded(vendor({ tier: null, boothAddonActive: true })), false);
});

test('no vendor → never branded', () => {
  assert.equal(boothIsBranded(null), false);
  assert.equal(boothIsBranded(undefined), false);
});

// ── 2026-08-29: THE all-tiers LEVER IS GONE, BY AN OWNER RULING ──────────────
//
// ⚠ FOUR TESTS WERE DELETED HERE, NOT SILENTLY WEAKENED. They pinned the
// 2026-07-25 tiered add-on model's `allTiersAllowed` parameter — *"3D Plan Ads
// becomes a paid add-on ANY tier can buy, so the entitlement earns the branded
// booth, not the tier"* — including that a FREE shop holding the add-on brands.
//
// The owner turned that model's switch on (2026-08-29) and, in the same breath,
// ruled the floor: *"3D Plan and papic Challenge is only for paid vendors Solo,
// Pro, Enterprise, and Custom. not for free"*. The parameter those four tests
// exercised no longer exists, so they could not be inverted — a test cannot
// assert about an argument the function does not take. What they were protecting
// survives below and above: the ENTITLEMENT half still gates every tier, and the
// floor is now asserted for every tier by name.
//
// 🔑 The lever was fed from a PRICE switch. Deleting it is the fix, not the
//    casualty: one setting must not answer both "what does it cost" and "who may
//    have it".

test('the ACTIVE-add-on half still gates every PAID tier', () => {
  // What the deleted tests were really protecting, kept: opening a tier must
  // never give anyone a free branded booth. No entitlement, no branding.
  assert.equal(boothIsBranded(vendor({ tier: 'solo', boothAddonActive: false })), false);
  assert.equal(boothIsBranded(vendor({ tier: 'pro', boothAddonActive: undefined })), false);
  assert.equal(boothIsBranded(vendor({ tier: 'custom' })), false);
  assert.equal(boothIsBranded(null), false);
  assert.equal(boothIsBranded(undefined), false);
});

// ── the floor cannot be lifted by a price switch (owner 2026-08-29) ──────────

test('boothCanBrand takes NO all-tiers lever any more', () => {
  // The defect being fixed in one assertion: the second parameter was fed from
  // NEXT_PUBLIC_VENDOR_ADDON_TIERED_PRICING, so one setting decided both the
  // add-on PRICE BAND and WHO MAY HAVE IT — and turning it on opened branding to
  // free shops as a side effect of a price change.
  assert.equal(boothCanBrand.length, 1, 'a second argument would be a way back in');
  assert.equal(boothIsBranded.length, 1);
});

test('a paid plan WITHOUT the add-on still renders generic — both halves required', () => {
  assert.equal(boothIsBranded(vendor({ tier: 'solo', boothAddonActive: false })), false);
  assert.equal(boothIsBranded(vendor({ tier: 'custom', boothAddonActive: false })), false);
});
