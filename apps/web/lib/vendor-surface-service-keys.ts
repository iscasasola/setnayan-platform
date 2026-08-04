/**
 * SEC-4b · VENDOR-SURFACE SERVICE KEYS ARE NOT SELLABLE FROM COUPLE CHECKOUT.
 *
 * # The shape
 *
 * Four SKU families encode their TARGET OBJECT in the service_key itself:
 *
 *     vendor_booking_fee__<charge_id>         → settles a booking-fee charge
 *     vendor_additional_branch__<branch_id>   → flips a branch subscription live
 *     vendor_extra_seat__<vendor_profile_id>  → recomputes paid team seats
 *     vendor_custom_plan__<vendor_profile_id> → promotes a negotiated Custom plan
 *
 * `activateOrderSku`'s PREFIX_HOOKS provision straight off that string — e.g.
 * `settleBookingFeeCharge(chargeIdFromBookingFeeLockServiceKey(serviceKey))` —
 * with no check that the ORDER has anything to do with the vendor owning the
 * target. The key IS the authority. So any path that mints an order with an
 * attacker-chosen key of these shapes, and gets it to `paid`, provisions
 * somebody else's object.
 *
 * # ⚠ WHY THIS IS DEFENCE IN DEPTH TODAY, NOT A LIVE FIX
 *
 * This guard was written 2026-07-26 against a hole that was real then: couple
 * checkout accepted any key, `resolveServiceSellability` returned 'unknown' for
 * these (no catalog row) which ALLOWS, and the charge then fell back to the
 * browser's `original_centavos` — so ₱1 bought a stranger's branch renewal.
 * The original comment said as much: *"That is SEC-7 (task #50), still open."*
 *
 * SEC-7 has since landed. `lib/order-charge-authority.ts` is now total: it
 * returns a server-resolved total or a REFUSAL, with no client fallback left, so
 * a key with no price source is refused (`refusal: 'no_price_source'`) before an
 * order exists. Verified on `origin/main` 2026-07-30, along with the mint paths:
 * `startBranchPayment` and friends resolve `vendorProfileId` FROM THE SESSION
 * and re-read the target filtered by `parent_vendor_profile_id`, so a vendor
 * cannot mint a key naming another vendor's object either.
 *
 * **So do not read this module as closing a live hole — it does not.** It exists
 * because the thing that currently blocks the attack is a PRICING rule, and this
 * is not a pricing question. The day someone adds one of these prefixes to
 * `platform_retail_catalog_v2` (entirely reasonable — "let vendors buy a branch
 * from a catalog row"), sellability becomes 'sellable', SEC-7 happily resolves a
 * price, and the couple-checkout door is open again. This guard keeps it shut
 * independently of what the catalog says.
 *
 * # What is still NOT here
 *
 * The original commit paired this with `assertOrderOwnsVendorTarget` in
 * `lib/sku-activation.ts` — an activation-time check that the order's
 * `vendor_profile_id` owns the object being provisioned. That is the
 * origin-independent gate (it holds for a comp grant, an admin-minted bespoke
 * order, or any future minter) and it is **still unlanded**. See
 * `99_Recovered_Orphaned_Work_2026-07-30/` in the spec corpus. This module is
 * the front door only.
 *
 * Pure and dependency-light on purpose: unit-testable, and safe to import from
 * both a server action and the activation library.
 */

import { BOOKING_FEE_LOCK_SERVICE_PREFIX } from './booking-fee-lock';
import { BRANCH_SERVICE_KEY_PREFIX } from './vendor-branches';
import { SEAT_SERVICE_KEY_PREFIX } from './vendor-seats';
import { CUSTOM_PLAN_SERVICE_KEY_PREFIX } from './vendor-custom-catalog';

/**
 * Every service-key prefix whose suffix names an object owned by a vendor.
 *
 * Imported from each feature module rather than re-typed, so renaming a prefix
 * cannot silently drop it out of this guard.
 */
export const VENDOR_SURFACE_SERVICE_KEY_PREFIXES: readonly string[] = Object.freeze([
  BOOKING_FEE_LOCK_SERVICE_PREFIX,
  BRANCH_SERVICE_KEY_PREFIX,
  SEAT_SERVICE_KEY_PREFIX,
  CUSTOM_PLAN_SERVICE_KEY_PREFIX,
]);

/** Does this key target a vendor-owned object (and therefore need an owner)? */
export function isVendorSurfaceServiceKey(serviceKey: string): boolean {
  return VENDOR_SURFACE_SERVICE_KEY_PREFIXES.some((p) => serviceKey.startsWith(p));
}
