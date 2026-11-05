import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { stripComments } from './strip-comments';
import {
  VENDOR_ADDON_BAND_SKU_CODES,
  vendorAddonPriceBand,
  vendorAddonSkuCode,
  type VendorAddonSku,
} from './vendor-addon-tier-pricing';

// ── vendorAddonPriceBand: Pro-and-up = the cheaper 'growth' band ─────────────

test('band: Free / Verified / Solo pay the entry row', () => {
  assert.equal(vendorAddonPriceBand('free'), 'entry');
  assert.equal(vendorAddonPriceBand('verified'), 'entry');
  assert.equal(vendorAddonPriceBand('solo'), 'entry');
});

test('band: Pro / Ultra (enterprise) / Custom pay the growth row', () => {
  assert.equal(vendorAddonPriceBand('pro'), 'growth');
  assert.equal(vendorAddonPriceBand('enterprise'), 'growth');
  assert.equal(vendorAddonPriceBand('custom'), 'growth');
});

test('band: unknown / missing tier fails to the entry row (never the cheaper one)', () => {
  assert.equal(vendorAddonPriceBand(null), 'entry');
  assert.equal(vendorAddonPriceBand(undefined), 'entry');
  assert.equal(vendorAddonPriceBand('not-a-tier'), 'entry');
});

// ── owner 2026-11-04: "DEEP SEARCH AND CHATBOT KEEP TWO PRICES BY PLAN" ──────

test('Deep Search and the AI chatbot read a different catalogue row per band', () => {
  assert.equal(vendorAddonSkuCode('deep_search_about_you', 'solo'), 'vendor_deep_search_entry');
  assert.equal(vendorAddonSkuCode('deep_search_about_you', 'pro'), 'vendor_deep_search');
  assert.equal(vendorAddonSkuCode('ai_chatbot_basic', 'verified'), 'vendor_ai_addon_entry');
  assert.equal(vendorAddonSkuCode('ai_chatbot_basic', 'enterprise'), 'vendor_ai_addon');
});

test('3D booth and Papic Challenges are one price — the same row on both sides', () => {
  for (const sku of ['ads_3d_plan', 'papic_challenge'] as VendorAddonSku[]) {
    const b = VENDOR_ADDON_BAND_SKU_CODES[sku];
    assert.equal(b.entry, b.growth, sku);
  }
});

test('🔒 no price is typed in the band module — it maps rows, the catalogue holds money', () => {
  const src = stripComments(
    readFileSync(fileURLToPath(new URL('./vendor-addon-tier-pricing.ts', import.meta.url)), 'utf8'),
  );
  assert.doesNotMatch(src, /\b\d{3,}\b/, 'a number of 3+ digits is back in the band module');
});
