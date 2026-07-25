/**
 * vendor-reach-rings-flag.ts — the NEXT_PUBLIC flag that arms the two-ring reach
 * model (`Vendor_Monetization_Model_LOCKED_2026-07-25.md` § 6).
 *
 * OFF (the default) → byte-identical to today: the vendor reach-rings settings
 * card never renders, no ring columns are ever read, and the Proposal Maker's
 * transportation line behaves exactly as it does now (Included / Flat / By
 * distance, all editable).
 *
 * ON → the vendor's Ring 1 / Ring 2 settings become live: a venue inside Ring 1
 * forces the proposal's transportation line to ₱0 with the field disabled and
 * the couple sees "Free Transportation."
 *
 * NEXT_PUBLIC so the client-side Proposal Maker and the server that resolves the
 * ring agree on one value. Kept in its own module (not in
 * `vendor-reach-rings.ts`) so the resolver stays I/O- and env-free and runs
 * under `tsx --test`. Mirrors `vendor-addon-tiered-pricing-flag.ts`.
 */
export function isVendorReachRingsEnabled(): boolean {
  const v = process.env.NEXT_PUBLIC_VENDOR_REACH_RINGS_V1;
  return v === '1' || v === 'true';
}
