import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  resolveVendorAddonPricePhp,
  vendorAddonPriceBand,
  VENDOR_ADDON_TIER_PRICES_PHP,
  type VendorAddonSku,
} from './vendor-addon-tier-pricing';

// ── vendorAddonPriceBand: Pro-and-up = the cheaper 'growth' band ─────────────

test('band: Free / Verified / Solo pay the entry band', () => {
  assert.equal(vendorAddonPriceBand('free'), 'entry');
  assert.equal(vendorAddonPriceBand('verified'), 'entry');
  assert.equal(vendorAddonPriceBand('solo'), 'entry');
});

test('band: Pro / Enterprise / Custom pay the growth band', () => {
  assert.equal(vendorAddonPriceBand('pro'), 'growth');
  assert.equal(vendorAddonPriceBand('enterprise'), 'growth');
  assert.equal(vendorAddonPriceBand('custom'), 'growth');
});

test('band: null / undefined / unknown fall to the entry band (fail-safe: never the cheaper price)', () => {
  assert.equal(vendorAddonPriceBand(null), 'entry');
  assert.equal(vendorAddonPriceBand(undefined), 'entry');
  assert.equal(vendorAddonPriceBand('not-a-tier'), 'entry');
});

// ── resolveVendorAddonPricePhp: the owner-locked 2026-07-25 matrix ───────────

test('price: Papic Challenge — ₱2,500 for EVERY tier (owner 2026-08-28)', () => {
  // ⚠ THIS ASSERTION WAS CHANGED, NOT WEAKENED. It read ₱500 entry / ₱400 growth,
  // which were per-EVENT prices under the model the owner replaced on 2026-08-28:
  // *"unlimited us 2500 for 4 weeks"* — one price, per 28 days, unlimited. He set
  // a NUMBER, not a band pair, so the two bands are deliberately equal here
  // rather than the SKU being deleted from the matrix: this matrix OVERRIDES the
  // catalogue whenever NEXT_PUBLIC_VENDOR_ADDON_TIERED_PRICING is on, so leaving
  // the old bands would have charged ₱400 for a 28-day subscription the moment
  // that flag flipped, with the catalogue price right and the charge wrong.
  assert.equal(resolveVendorAddonPricePhp('papic_challenge', 'solo'), 2500);
  assert.equal(resolveVendorAddonPricePhp('papic_challenge', 'pro'), 2500);
  assert.equal(resolveVendorAddonPricePhp('papic_challenge', 'free'), 2500);
  assert.equal(resolveVendorAddonPricePhp('papic_challenge', 'enterprise'), 2500);
});

test('price: 3D Booth — ₱3,000 FLAT on every tier (owner 2026-09-05)', () => {
  // Bands deliberately EQUAL, like papic_challenge: the tiered-pricing flag must
  // not be able to pick a number the catalogue does not hold.
  for (const tier of ['free', 'solo', 'pro', 'enterprise', 'custom']) {
    assert.equal(resolveVendorAddonPricePhp('ads_3d_plan', tier), 3000, tier);
  }
});

test('price: AI Chatbot Basic — ₱2,000 entry, ₱1,500 growth', () => {
  assert.equal(resolveVendorAddonPricePhp('ai_chatbot_basic', 'solo'), 2000);
  assert.equal(resolveVendorAddonPricePhp('ai_chatbot_basic', 'pro'), 1500);
});

test('price: AI Chatbot Advanced — ₱3,000 entry, ₱2,500 growth', () => {
  assert.equal(resolveVendorAddonPricePhp('ai_chatbot_advanced', 'solo'), 3000);
  assert.equal(resolveVendorAddonPricePhp('ai_chatbot_advanced', 'custom'), 2500);
});

test('price: Deep Search About-You — ₱1,000 entry, ₱500 growth', () => {
  assert.equal(resolveVendorAddonPricePhp('deep_search_about_you', 'verified'), 1000);
  assert.equal(resolveVendorAddonPricePhp('deep_search_about_you', 'pro'), 500);
});

test('price: Deep Search Market Scan — ₱2,000 entry, ₱1,500 growth', () => {
  assert.equal(resolveVendorAddonPricePhp('deep_search_market', 'free'), 2000);
  assert.equal(resolveVendorAddonPricePhp('deep_search_market', 'enterprise'), 1500);
});

// ── matrix integrity ────────────────────────────────────────────────────────

test('matrix: every SKU has a positive entry price >= its growth price (subscribers never pay more)', () => {
  const skus = Object.keys(VENDOR_ADDON_TIER_PRICES_PHP) as VendorAddonSku[];
  assert.equal(skus.length, 6);
  for (const sku of skus) {
    const { entry, growth } = VENDOR_ADDON_TIER_PRICES_PHP[sku];
    assert.ok(entry > 0, `${sku} entry price must be positive`);
    assert.ok(growth > 0, `${sku} growth price must be positive`);
    assert.ok(entry >= growth, `${sku}: entry (${entry}) must be >= growth (${growth})`);
  }
});
