/**
 * vendor-addon-tier-pricing.ts — WHICH CATALOGUE ROW a supplier's add-on is priced from, by plan.
 *
 * The 2026-07-25 model (corpus `Vendor_Monetization_Model_LOCKED_2026-07-25.md`) priced add-ons in TWO plan bands —
 * Free / Verified / Solo pay the `entry` price, Pro / Ultra (and Custom) the cheaper `growth` price. Until 2026-11-04
 * the two figures were TYPED here, in a matrix that overrode the catalogue whenever
 * `NEXT_PUBLIC_VENDOR_ADDON_TIERED_PRICING` was on — so the price a supplier was charged could differ from the price an
 * admin saw and edited.
 *
 * ⚖ 2026-11-04 (DECISION_LOG "FINAL PRICE SHEET" + "DEEP SEARCH AND CHATBOT KEEP TWO PRICES BY PLAN"): Deep Search
 * ₱499 Pro/Ultra · ₱799 Free/Verified/Solo; AI chatbot ₱1,490 · ₱1,990; 3D booth and Photo challenge one price.
 * Prices live ONLY in `vendor_billing_catalog` (migration `*_the_final_price_sheet.sql`), each band its OWN row, so an
 * admin edits both in Admin › Pricing and this file holds no money at all — only the map from (add-on, band) to the
 * row's `sku_code`. A one-price add-on names the same row on both sides. The band always applies now (the owner ruled
 * two prices, not a flag); the flag no longer decides any price.
 *
 * The map is PURE; the read takes its Supabase client as an argument (import-type only) so this module stays
 * unit-testable under `tsx --test` with no server import.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { isTierAtLeast } from './vendor-tier-caps';

/** The add-ons whose price is chosen by plan band. */
export type VendorAddonSku =
  | 'papic_challenge' // per 28-day cycle
  | 'ads_3d_plan' // per 28-day cycle
  | 'ai_chatbot_basic' // per 28-day cycle
  | 'ai_chatbot_advanced' // per 28-day cycle — not on sale (is_active=false)
  | 'deep_search_about_you'; // per search

/**
 * Two price bands. `entry` = Free / Verified / Solo. `growth` = Pro / Enterprise (Ultra) / Custom. The boundary is
 * "Pro and up", reusing the tier ladder so there is no second source of truth for what counts as a subscriber.
 */
export type VendorAddonPriceBand = 'entry' | 'growth';

/** Which price band a vendor on `tier` pays. PURE. */
export function vendorAddonPriceBand(tier: string | null | undefined): VendorAddonPriceBand {
  return isTierAtLeast(tier, 'pro') ? 'growth' : 'entry';
}

/**
 * (add-on, band) → the `vendor_billing_catalog.sku_code` its price is read from. The `growth` row keeps the add-on's
 * historical sku_code (it is also the `orders.service_key` the activation hook dispatches on); the `entry` row is
 * a separate price row for the same product.
 */
export const VENDOR_ADDON_BAND_SKU_CODES: Readonly<Record<VendorAddonSku, Readonly<Record<VendorAddonPriceBand, string>>>> = {
  papic_challenge: { entry: 'vendor_photo_challenge', growth: 'vendor_photo_challenge' },
  ads_3d_plan: { entry: 'vendor_3d_booth', growth: 'vendor_3d_booth' },
  ai_chatbot_basic: { entry: 'vendor_ai_addon_entry', growth: 'vendor_ai_addon' },
  ai_chatbot_advanced: { entry: 'vendor_ai_addon_advanced', growth: 'vendor_ai_addon_advanced' },
  deep_search_about_you: { entry: 'vendor_deep_search_entry', growth: 'vendor_deep_search' },
};

/** The catalogue row a vendor on `tier` is charged from for `sku`. PURE. */
export function vendorAddonSkuCode(sku: VendorAddonSku, tier: string | null | undefined): string {
  return VENDOR_ADDON_BAND_SKU_CODES[sku][vendorAddonPriceBand(tier)];
}

/**
 * Both sides of the band, READ from the catalogue (active rows only). A side that is missing, inactive, unreadable or
 * non-positive is `null` — the caller refuses to sell rather than guess (CLAUDE.md rule 9).
 */
export async function fetchVendorAddonBandPrices(
  supabase: SupabaseClient,
  sku: VendorAddonSku,
): Promise<{ entryPhp: number | null; growthPhp: number | null }> {
  const codes = VENDOR_ADDON_BAND_SKU_CODES[sku];
  try {
    const { data, error } = await supabase
      .from('vendor_billing_catalog')
      .select('sku_code, price_php, is_active')
      .in('sku_code', [codes.entry, codes.growth]);
    if (error || !data) {
      if (error) console.error('[supabase-error] vendor-addon-tier-pricing: band prices', error);
      return { entryPhp: null, growthPhp: null };
    }
    const priceOf = (code: string): number | null => {
      const row = (data as Array<{ sku_code: string; price_php: number | string | null; is_active?: boolean | null }>).find(
        (r) => r.sku_code === code,
      );
      if (!row || row.is_active === false) return null;
      const n = Number(row.price_php);
      return Number.isFinite(n) && n > 0 ? n : null;
    };
    return { entryPhp: priceOf(codes.entry), growthPhp: priceOf(codes.growth) };
  } catch (e) {
    console.error('[vendor-addon-tier-pricing] band read threw', e);
    return { entryPhp: null, growthPhp: null };
  }
}

/** The price a vendor on `tier` pays for `sku`, READ from its band's catalogue row; null = not sellable now. */
export async function fetchVendorAddonPricePhp(
  supabase: SupabaseClient,
  sku: VendorAddonSku,
  tier: string | null | undefined,
): Promise<number | null> {
  const band = await fetchVendorAddonBandPrices(supabase, sku);
  return vendorAddonPriceBand(tier) === 'growth' ? band.growthPhp : band.entryPhp;
}
