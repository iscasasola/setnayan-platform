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
