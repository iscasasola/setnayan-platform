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
  assert.equal(boothCanBrand('pro'), true);
  assert.equal(boothCanBrand('enterprise'), true);
  assert.equal(boothCanBrand('solo'), false);
  assert.equal(boothCanBrand('verified'), false);
  assert.equal(boothCanBrand('free'), false);
  assert.equal(boothCanBrand('custom'), false); // branding gated to pro/enterprise per boothCanBrand
  assert.equal(boothCanBrand(null), false);
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
  assert.equal(boothIsBranded(vendor({ tier: 'solo', boothAddonActive: true })), false);
  assert.equal(boothIsBranded(vendor({ tier: 'verified', boothAddonActive: true })), false);
  assert.equal(boothIsBranded(vendor({ tier: null, boothAddonActive: true })), false);
});

test('no vendor → never branded', () => {
  assert.equal(boothIsBranded(null), false);
  assert.equal(boothIsBranded(undefined), false);
});

// ── 2026-07-25 tiered add-on model: allTiersAllowed lifts the TIER factor ────
// Owner-locked — 3D Plan Ads becomes a paid add-on ANY tier can buy (₱2,000
// Free/Solo · ₱1,500 Pro/Ent), so the entitlement earns the branded booth, not
// the tier. Pinned here because the entitlement half must NEVER relax with it.

test('allTiersAllowed defaults OFF → today’s Pro/Enterprise gate, byte-identical', () => {
  // Explicit `false` and omitted must agree on every tier.
  for (const t of ['pro', 'enterprise', 'solo', 'verified', 'free', 'custom', null] as const) {
    assert.equal(boothCanBrand(t, false), boothCanBrand(t), `tier ${t}`);
  }
  assert.equal(
    boothIsBranded(vendor({ tier: 'solo', boothAddonActive: true }), false),
    false,
  );
});

test('allTiersAllowed ON → every tier CAN brand', () => {
  assert.equal(boothCanBrand('free', true), true);
  assert.equal(boothCanBrand('solo', true), true);
  assert.equal(boothCanBrand('verified', true), true);
  assert.equal(boothCanBrand('custom', true), true);
  assert.equal(boothCanBrand('pro', true), true);
  assert.equal(boothCanBrand(null, true), true);
});

test('allTiersAllowed ON: Free/Solo WITH the add-on → branded', () => {
  assert.equal(boothIsBranded(vendor({ tier: 'free', boothAddonActive: true }), true), true);
  assert.equal(boothIsBranded(vendor({ tier: 'solo', boothAddonActive: true }), true), true);
});

test('allTiersAllowed ON: the ACTIVE-add-on half still gates every tier', () => {
  // The whole point of the gate — opening tiers must not give anyone a free
  // branded booth. No entitlement, no branding, on any tier.
  assert.equal(boothIsBranded(vendor({ tier: 'free', boothAddonActive: false }), true), false);
  assert.equal(boothIsBranded(vendor({ tier: 'solo' }), true), false);
  assert.equal(boothIsBranded(vendor({ tier: 'pro', boothAddonActive: undefined }), true), false);
  assert.equal(boothIsBranded(null, true), false);
  assert.equal(boothIsBranded(undefined, true), false);
});
