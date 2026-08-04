/**
 * vendor-addon-tiered-pricing-flag.ts — the NEXT_PUBLIC flag that decides whether
 * live add-on checkout reads the 2026-07-25 TIERED prices
 * (`vendor-addon-tier-pricing.ts`) instead of the current flat catalog price.
 *
 * NEXT_PUBLIC so the client price preview and the server charge agree on one
 * value. Default OFF → every add-on charges exactly today's flat price and the
 * tiered matrix is inert; nothing changes until the owner flips it. Kept in its
 * own file (not the pricing module) so that module stays I/O-free and
 * `tsx --test`-friendly. Mirrors the shape of `verified-median-flag.ts` /
 * `plausibility-scanner-flag.ts`.
 */
export function isVendorAddonTieredPricingEnabled(): boolean {
  const v = process.env.NEXT_PUBLIC_VENDOR_ADDON_TIERED_PRICING;
  return v === '1' || v === 'true';
}
