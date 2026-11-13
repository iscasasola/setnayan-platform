import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  VENDOR_AI_ADVANCED_SKU_CODE,
  VENDOR_AI_LEVELS,
  VENDOR_AI_LEVEL_PRICING_SKU,
  coerceVendorAiLevel,
  isVendorAiAdvanced,
  nextVendorAiLevel,
  vendorAiAdvancedActive,
  vendorAiBasicActive,
  vendorAiLevelForServiceKey,
} from './vendor-ai-level';
import { vendorAddonSkuCode } from './vendor-addon-tier-pricing';
import { isVendorAiAddonActive } from './vendor-addon-pricing';

/**
 * The Vendor AI ladder. These tests pin the four things that decide money or
 * capability: least-privilege defaulting, that a lapsed window revokes Advanced,
 * that only the Advanced SKU can promote, and that a promotion never demotes.
 */

// ── least privilege on every unknown input ──────────────────────────────────

test('anything that is not exactly "advanced" reads as basic', () => {
  for (const raw of [
    null,
    undefined,
    '',
    'basic',
    'Advanced', // case-sensitive on purpose — the CHECK stores lowercase
    'ADVANCED',
    'premium',
    'smart',
    ' advanced',
  ]) {
    assert.equal(coerceVendorAiLevel(raw), 'basic', JSON.stringify(raw));
    assert.equal(isVendorAiAdvanced(raw), false, JSON.stringify(raw));
  }
  assert.equal(coerceVendorAiLevel('advanced'), 'advanced');
  assert.equal(isVendorAiAdvanced('advanced'), true);
});

test('a row fetched WITHOUT the level column still reads as basic', () => {
  // The flag-off path omits ai_addon_level from the select, so callers get
  // undefined. That must mean Basic, never Advanced.
  const rowWithoutColumn: { ai_addon_level?: string } = {};
  assert.equal(coerceVendorAiLevel(rowWithoutColumn.ai_addon_level), 'basic');
});

// ── the window is half the gate, and it never relaxes ───────────────────────

test('Advanced requires BOTH a live window and the advanced level', () => {
  assert.equal(vendorAiAdvancedActive({ level: 'advanced', windowActive: true }), true);
  assert.equal(vendorAiAdvancedActive({ level: 'advanced', windowActive: false }), false);
  assert.equal(vendorAiAdvancedActive({ level: 'basic', windowActive: true }), false);
  assert.equal(vendorAiAdvancedActive({ level: 'basic', windowActive: false }), false);
});

test('a LAPSED window revokes Advanced even though the level marker persists', () => {
  // Lapse is automatic at read time (no cron clears the marker), so checking the
  // level alone would grant Advanced forever after a single paid cycle.
  assert.equal(vendorAiAdvancedActive({ level: 'advanced', windowActive: false }), false);
  assert.equal(vendorAiBasicActive({ level: 'advanced', windowActive: false }), false);
});

test('Advanced is a SUPERSET — an advanced vendor still gets every basic capability', () => {
  assert.equal(vendorAiBasicActive({ level: 'advanced', windowActive: true }), true);
  assert.equal(vendorAiBasicActive({ level: 'basic', windowActive: true }), true);
});

// ── only the Advanced SKU promotes ──────────────────────────────────────────

test('the level a paid order grants comes from its service_key, fail-safe to basic', () => {
  assert.equal(vendorAiLevelForServiceKey(VENDOR_AI_ADVANCED_SKU_CODE), 'advanced');
  for (const key of ['vendor_ai_addon', 'vendor_3d_booth', 'nonsense', '', null, undefined]) {
    assert.equal(vendorAiLevelForServiceKey(key), 'basic', String(key));
  }
});

test('the Advanced SKU code keeps the vendor_ prefix', () => {
  // lib/orders.ts isVatInclusiveServiceKey keys off this prefix; without it the
  // admin payment shortfall guard strands every order for the SKU.
  assert.ok(VENDOR_AI_ADVANCED_SKU_CODE.startsWith('vendor_'));
});

// ── promotion/demotion arithmetic ───────────────────────────────────────────

test('buying Advanced promotes; buying Basic while Advanced does NOT demote', () => {
  assert.equal(nextVendorAiLevel('basic', 'advanced'), 'advanced');
  assert.equal(nextVendorAiLevel(null, 'advanced'), 'advanced');
  // The two levels share ONE window, so a Basic re-up must not strip time the
  // vendor paid more for.
  assert.equal(nextVendorAiLevel('advanced', 'basic'), 'advanced');
  assert.equal(nextVendorAiLevel('advanced', 'advanced'), 'advanced');
  assert.equal(nextVendorAiLevel('basic', 'basic'), 'basic');
  assert.equal(nextVendorAiLevel(undefined, 'basic'), 'basic');
});

// ── the price bands the rungs map to ────────────────────────────────────────

test('each rung maps to its catalogue rows by plan band (prices live only in vendor_billing_catalog)', () => {
  assert.equal(VENDOR_AI_LEVEL_PRICING_SKU.basic, 'ai_chatbot_basic');
  assert.equal(VENDOR_AI_LEVEL_PRICING_SKU.advanced, 'ai_chatbot_advanced');
  // Owner 2026-11-04: two prices by plan — Free/Verified/Supplier Plus one row, Pro/Ultra another.
  assert.equal(vendorAddonSkuCode(VENDOR_AI_LEVEL_PRICING_SKU.basic, 'free'), 'vendor_ai_addon_entry');
  assert.equal(vendorAddonSkuCode(VENDOR_AI_LEVEL_PRICING_SKU.basic, 'verified'), 'vendor_ai_addon_entry');
  assert.equal(vendorAddonSkuCode(VENDOR_AI_LEVEL_PRICING_SKU.basic, 'solo'), 'vendor_ai_addon_entry');
  assert.equal(vendorAddonSkuCode(VENDOR_AI_LEVEL_PRICING_SKU.basic, 'pro'), 'vendor_ai_addon');
  assert.equal(vendorAddonSkuCode(VENDOR_AI_LEVEL_PRICING_SKU.basic, 'enterprise'), 'vendor_ai_addon');
  assert.equal(vendorAddonSkuCode(VENDOR_AI_LEVEL_PRICING_SKU.advanced, 'free'), 'vendor_ai_addon_advanced');
});

test('the rung list is exactly the two CHECKed values', () => {
  assert.deepEqual([...VENDOR_AI_LEVELS], ['basic', 'advanced']);
});

// ── the LAPSE rule — the caller contract on nextVendorAiLevel ───────────────
// REGRESSION (shipped in #3710, fixed here): activateVendorAiAddonOrder read the
// stored level with NO window check. Because nextVendorAiLevel takes the higher
// rung and nothing clears the marker on lapse, a vendor could buy Advanced once,
// let it lapse, then renew on BASIC and keep Advanced forever (~₱1,000/cycle).
// The fix is at the CALLER: pass null once the window is dead.

test('a LAPSED advanced rung must NOT survive into a new Basic purchase', () => {
  const lapsed = '2020-01-01T00:00:00Z';
  const live = '2099-01-01T00:00:00Z';

  // What the caller must compute, both ways round.
  const carry = (expiry: string, stored: string) =>
    nextVendorAiLevel(isVendorAiAddonActive(expiry) ? stored : null, 'basic');

  assert.equal(carry(lapsed, 'advanced'), 'basic', 'lapsed Advanced is SPENT');
  assert.equal(carry(live, 'advanced'), 'advanced', 'a LIVE Advanced window is not demoted');
});

test('buying Advanced still promotes regardless of window state', () => {
  const lapsed = '2020-01-01T00:00:00Z';
  const carry = (expiry: string, stored: string) =>
    nextVendorAiLevel(isVendorAiAddonActive(expiry) ? stored : null, 'advanced');
  assert.equal(carry(lapsed, 'basic'), 'advanced');
  assert.equal(carry(lapsed, 'advanced'), 'advanced');
});
