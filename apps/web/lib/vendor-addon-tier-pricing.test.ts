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

test('band: Free / Verified / Supplier Plus pay the entry row', () => {
  assert.equal(vendorAddonPriceBand('free'), 'entry');
  assert.equal(vendorAddonPriceBand('verified'), 'entry');
  assert.equal(vendorAddonPriceBand('solo'), 'entry');
});

test('band: Pro / Ultra (enterprise) pay the growth row', () => {
  assert.equal(vendorAddonPriceBand('pro'), 'growth');
  assert.equal(vendorAddonPriceBand('enterprise'), 'growth');
});

test('band: unknown / missing tier fails to the entry row (never the cheaper one)', () => {
  assert.equal(vendorAddonPriceBand(null), 'entry');
  assert.equal(vendorAddonPriceBand(undefined), 'entry');
  assert.equal(vendorAddonPriceBand('not-a-tier'), 'entry');
});

// ── owner 2026-11-04: "DEEP SEARCH AND CHATBOT KEEP TWO PRICES BY PLAN" ──────

test('the AI chatbot reads a different catalogue row per band (kept by the 2026-11-09 ruling)', () => {
  assert.equal(vendorAddonSkuCode('ai_chatbot_basic', 'verified'), 'vendor_ai_addon_entry');
  assert.equal(vendorAddonSkuCode('ai_chatbot_basic', 'enterprise'), 'vendor_ai_addon');
});

// ── owner 2026-11-09: "DEEP SEARCH = ₱499, ONE USE, EVERY PLAN" ──────────────

test('Deep Search is ONE price on every plan — the vendor_deep_search row, never the retired entry row', () => {
  for (const tier of ['free', 'verified', 'solo', 'pro', 'enterprise', null]) {
    assert.equal(vendorAddonSkuCode('deep_search_about_you', tier), 'vendor_deep_search', String(tier));
  }
  assert.doesNotMatch(
    readFileSync(fileURLToPath(new URL('./vendor-addon-tier-pricing.ts', import.meta.url)), 'utf8'),
    /'vendor_deep_search_entry'/,
    'the retired ₱799 entry row is named again',
  );
});

test('3D booth, Papic Challenges and Deep Search are one price — the same row on both sides', () => {
  for (const sku of ['ads_3d_plan', 'papic_challenge', 'deep_search_about_you'] as VendorAddonSku[]) {
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
