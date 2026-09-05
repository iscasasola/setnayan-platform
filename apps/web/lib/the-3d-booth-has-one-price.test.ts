/**
 * THE 3D BOOTH HAS ONE PRICE — and the couple's 3D Plan has none.
 *
 * Owner 2026-09-05: "yes flat prices for all of them." Before this, the vendor
 * 3D Booth carried THREE prices at once and a flag chose which one a vendor was
 * billed: the docblock owner-lock (₱1,500), the catalogue row (₱2,500), and the
 * tiered matrix (₱2,000 entry / ₱1,500 growth) — with
 * NEXT_PUBLIC_VENDOR_ADDON_TIERED_PRICING="true" in production, so the owner's
 * catalogue figure was never what anybody paid.
 *
 * This pins the collapse: fallback = entry band = growth band = ₱3,000, so the
 * flag can no longer select a price for this SKU in either state. The catalogue
 * row is moved by migration 20271205977137 in the same PR, and
 * `fallback-prices-match-the-catalog.db.test.ts` holds the fallback to it.
 *
 * And the other half of the same decision: SEATING_3D — the couple's 3D Plan —
 * is FREE (FREE_FOR_ALL_SKUS, PR #5185), so the fixture that stands in for the
 * catalogue in CI must show its row deactivated, exactly as KWENTO's is.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { VENDOR_3D_BOOTH_FALLBACK_PHP } from './vendor-3d-booth-pricing';
import { VENDOR_ADDON_TIER_PRICES_PHP, resolveVendorAddonPricePhp } from './vendor-addon-tier-pricing';
import { RETAIL } from './llms-txt-guard-input';

const FLAT = 3000;

test('the fallback and BOTH matrix bands are the one flat price', () => {
  assert.equal(VENDOR_3D_BOOTH_FALLBACK_PHP, FLAT, 'fallback');
  assert.equal(VENDOR_ADDON_TIER_PRICES_PHP.ads_3d_plan.entry, FLAT, 'entry band');
  assert.equal(VENDOR_ADDON_TIER_PRICES_PHP.ads_3d_plan.growth, FLAT, 'growth band');
});

test('no tier can be quoted a different number', () => {
  for (const tier of ['free', 'verified', 'solo', 'pro', 'enterprise', 'custom', null, undefined]) {
    assert.equal(resolveVendorAddonPricePhp('ads_3d_plan', tier), FLAT, String(tier));
  }
});

test("the couple's 3D Plan row is off sale in the fixture, like KWENTO", () => {
  const row = RETAIL.find((r) => r.service_code === 'SEATING_3D');
  assert.ok(row, 'the row stays listed — a deletion would read as an accident');
  assert.equal(row.is_active, false, 'SEATING_3D is free; it must not be advertised for sale');
  const kwento = RETAIL.find((r) => r.service_code === 'KWENTO');
  assert.equal(kwento?.is_active, false, 'the precedent this follows is still there');
});
