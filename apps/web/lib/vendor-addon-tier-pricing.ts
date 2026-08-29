/**
 * vendor-addon-tier-pricing.ts — the single source of truth for VENDOR ADD-ON
 * prices under the 2026-07-25 vendor monetization model (owner-locked; see
 * corpus `Vendor_Monetization_Model_LOCKED_2026-07-25.md`).
 *
 * The model reprices every add-on into TWO tier bands — Free/Solo pay the
 * standard price, Pro/Enterprise pay a cheaper "subscriber" price — and splits
 * two products into variants (AI Chatbot Basic/Advanced; Deep Search About-You /
 * Market Scan). This module encodes that price matrix + the tier→band→price
 * resolver.
 *
 * PURE: no I/O, no clock, no env — just the matrix and pure functions, so it
 * stays unit-testable under `tsx --test`. The env flag that decides whether live
 * checkout READS this instead of the current flat catalog price lives separately
 * in `vendor-addon-tiered-pricing-flag.ts` (keeps this module I/O-free). Until a
 * consumer is wired behind that flag (follow-up PRs), this module is inert and
 * changes no live price.
 *
 * Admin-dialable later by moving these figures into `vendor_billing_catalog`
 * rows keyed (sku, band); today they live here as the code SSOT, mirroring how
 * `booking-fee.ts` keeps the fee schedule in code.
 */
import { isTierAtLeast } from './vendor-tier-caps';

/** The add-ons whose price varies by tier band under the 2026-07-25 model. */
export type VendorAddonSku =
  | 'papic_challenge' // per 28-day cycle (was per event until 2026-08-28)
  | 'ads_3d_plan' // per 28-day cycle
  | 'ai_chatbot_basic' // per 28-day cycle
  | 'ai_chatbot_advanced' // per 28-day cycle
  | 'deep_search_about_you' // per search
  | 'deep_search_market'; // per search

/**
 * Two price bands. `entry` = Free / Verified / Solo. `growth` = Pro / Enterprise
 * / Custom (Custom runs as Enterprise-or-better, so it inherits the cheaper
 * band automatically). The boundary is "Pro and up", reusing the existing tier
 * ladder so there is no second source of truth for what counts as a subscriber.
 */
export type VendorAddonPriceBand = 'entry' | 'growth';

/**
 * Which price band a vendor on `tier` pays. Owner 2026-07-25: subscribers
 * (Pro-and-up) pay the cheaper `growth` price for every add-on. PURE.
 */
export function vendorAddonPriceBand(
  tier: string | null | undefined,
): VendorAddonPriceBand {
  return isTierAtLeast(tier, 'pro') ? 'growth' : 'entry';
}

/**
 * The locked add-on price matrix (PHP), owner 2026-07-25. `entry` = Free/Solo,
 * `growth` = Pro/Enterprise. Cadence is per the SKU comment; this module returns
 * the PHP figure only (the caller knows the cadence).
 */
export const VENDOR_ADDON_TIER_PRICES_PHP: Record<
  VendorAddonSku,
  Record<VendorAddonPriceBand, number>
> = {
  // OWNER 2026-08-28 — "unlimited us 2500 for 4 weeks". Papic Challenges stopped
  // being a per-EVENT fee and became a ₱2,500 / 28-day SHOP subscription, so the
  // two bands are now ONE number: he set a price, not a band pair.
  // ⚠ Kept in the matrix rather than deleted from the union, and kept EQUAL
  // rather than left at 500/400: this matrix OVERRIDES the catalogue whenever
  // NEXT_PUBLIC_VENDOR_ADDON_TIERED_PRICING is on, so a stale band here would
  // charge ₱400 for a 28-day subscription the moment that flag flips — the
  // catalogue price would be right and the charge would not.
  papic_challenge: { entry: 2500, growth: 2500 }, // per 28 days, unlimited
  ads_3d_plan: { entry: 2000, growth: 1500 }, // per 28-day cycle
  ai_chatbot_basic: { entry: 2000, growth: 1500 }, // per 28-day cycle
  ai_chatbot_advanced: { entry: 3000, growth: 2500 }, // per 28-day cycle
  deep_search_about_you: { entry: 1000, growth: 500 }, // per search
  deep_search_market: { entry: 2000, growth: 1500 }, // per search
};

/**
 * The PHP price of `sku` for a vendor on `tier`. PURE. Free/Verified/Solo pay
 * the `entry` price; Pro/Enterprise/Custom pay the cheaper `growth` price
 * (owner 2026-07-25 — "subscribers pay less for add-ons"). Server-authoritative
 * callers re-read the vendor's own `vendor_profiles.tier_state` so a tampered
 * client can never force the cheaper band.
 */
export function resolveVendorAddonPricePhp(
  sku: VendorAddonSku,
  tier: string | null | undefined,
): number {
  return VENDOR_ADDON_TIER_PRICES_PHP[sku][vendorAddonPriceBand(tier)];
}
