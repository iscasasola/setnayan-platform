import { boothCanBrand, boothIsBranded, type BoothVendor } from './seating-3d';

/**
 * booth-branding-tier-gate.ts — the booth-branding gate the render tree calls.
 *
 * ⚠ IT NO LONGER READS A FLAG, AND THAT IS THE WHOLE CHANGE OF 2026-08-29.
 *
 * It used to supply `allTiersAllowed` to `boothCanBrand` / `boothIsBranded` from
 * `NEXT_PUBLIC_VENDOR_ADDON_TIERED_PRICING` — the same switch that chooses the
 * add-on PRICE BAND. So one setting decided both what the 3D Booth costs and who
 * is allowed to have it, and the owner turning it on (2026-08-29) opened
 * branding to FREE shops as a side effect of a price change.
 *
 * He then ruled the floor directly: *"3D Plan and papic Challenge is only for
 * paid vendors Solo, Pro, Enterprise, and Custom. not for free"*. That floor
 * lives in `boothCanBrand` and cannot be lifted by any caller.
 *
 * 🔑 A FLOOR THAT A PRICING FLAG CAN LIFT IS NOT A FLOOR.
 *
 * ── WHY THIS FILE STILL EXISTS ─────────────────────────────────────────────
 * Seven live call sites (five 3D render sites + the two `/v/[slug]` showcase
 * gates) import these two names. Deleting the module would edit all seven for no
 * behaviour change, and the indirection is still worth something: it remains the
 * ONE place a future access rule would be supplied from, so the render sites
 * cannot drift apart — forgetting it at one booth mesh would brand the logo but
 * not the poster.
 */

/**
 * May a vendor on `tier` brand a 3D booth AT ALL? Tier-only — the paid add-on
 * entitlement is layered on by {@link boothRendersBranded}. Used by the surfaces
 * that gate on tier alone: the vendor's own booth showcase (`/v/[slug]/booth`)
 * and the profile page's link to it.
 */
export function boothTierCanBrand(tier: string | null | undefined): boolean {
  return boothCanBrand(tier);
}

/**
 * THE render decision for a booth inside a couple's published 3D Plan: brands
 * only with a live 3D Booth entitlement AND a paid plan. Every BoothMesh /
 * poster / nameboard call site reads this one boolean, so the entitlement can
 * never drift between the logo, the poster and the crowd-avoidance disc.
 */
export function boothRendersBranded(vendor: BoothVendor | null | undefined): boolean {
  return boothIsBranded(vendor);
}
