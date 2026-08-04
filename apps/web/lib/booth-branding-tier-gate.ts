import { boothCanBrand, boothIsBranded, type BoothVendor } from './seating-3d';
import { isVendorAddonTieredPricingEnabled } from './vendor-addon-tiered-pricing-flag';

/**
 * booth-branding-tier-gate.ts — the FLAG-AWARE booth-branding gate.
 *
 * `lib/seating-3d.ts` keeps the branding decision PURE: `boothCanBrand(tier,
 * allTiersAllowed)` / `boothIsBranded(vendor, allTiersAllowed)` take the
 * tier-gate switch as a plain parameter so that hot, heavily unit-tested module
 * never reads env. This file is the one place that supplies that parameter from
 * the build-time flag, so the seven live call sites (five 3D render sites + the
 * two `/v/[slug]` showcase gates) can't drift apart — forgetting the flag at one
 * booth mesh would brand the logo but not the poster, or vice versa.
 *
 * WHAT THE FLAG CHANGES (owner-locked 2026-07-25 vendor monetization model):
 * booth branding stops being a PRO/ENTERPRISE tier perk and becomes a paid
 * ADD-ON any tier can buy — 3D Plan Ads at ₱2,000 / 28 days for Free/Solo,
 * ₱1,500 for Pro/Enterprise (`resolveVendorAddonPricePhp('ads_3d_plan', tier)`).
 * The entitlement, not the tier, earns the branded booth. The ACTIVE-add-on half
 * of the gate is UNCHANGED and never relaxes: a vendor without a live
 * `booth_addon_expires_at` window renders the generic booth on every tier.
 *
 * FLAG OFF (default) → `allTiersAllowed = false` → byte-identical to the
 * pre-2026-07-25 Pro-and-up perk. Reuses `NEXT_PUBLIC_VENDOR_ADDON_TIERED_PRICING`
 * (the same switch the tiered add-on price matrix reads) so price and access flip
 * together — a Free vendor can never see a buy CTA at a price the server won't
 * honour, nor pay the entry price and still render generic.
 *
 * NEXT_PUBLIC, so this is safe in the client 3D render tree (Next inlines it at
 * build time) as well as in server components — same shape as `boothStudioEnabled`.
 */

/**
 * May a vendor on `tier` brand a 3D booth AT ALL right now? Tier-only — the paid
 * add-on entitlement is layered on by {@link boothRendersBranded}. Used by the
 * surfaces that gate on tier alone: the vendor's own booth showcase
 * (`/v/[slug]/booth`) and the profile page's link to it.
 */
export function boothTierCanBrand(tier: string | null | undefined): boolean {
  return boothCanBrand(tier, isVendorAddonTieredPricingEnabled());
}

/**
 * THE render decision for a booth inside a couple's published 3D Plan: brands
 * only with a live 3D Plan Ads entitlement, plus (flag OFF) a Pro/Enterprise
 * tier. Every BoothMesh / poster / nameboard call site reads this one boolean.
 */
export function boothRendersBranded(vendor: BoothVendor | null | undefined): boolean {
  return boothIsBranded(vendor, isVendorAddonTieredPricingEnabled());
}
