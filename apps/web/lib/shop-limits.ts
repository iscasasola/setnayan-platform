/**
 * How many shops one user may OWN — the multi-business dial.
 *
 * Owner-locked 2026-07-09 (M1): "the concept of multi vendor needs to be
 * available but set to 1 limit for now. in time, we will open this to more."
 * Ownership is person-anchored — one user owns their shop(s) directly (not an
 * org that members belong to), verified against their documents. See
 * DECISION_LOG 2026-07-09 (M1) + memory project_setnayan_multi_business_marketplace.
 *
 * Today this reads 1, which the DB also enforces via `vendor_profiles.user_id
 * UNIQUE`. This constant is the single NAMED source of that rule so the cap is
 * a deliberate product dial, not a hidden schema constraint.
 *
 * ⚠ Raising it above 1 is NOT just a number change — it must ship together with
 * the deferred multi-shop flip, or the app will hand out shops the data layer
 * can't safely isolate:
 *   1. shop-picker UI + `/vendor-dashboard/[shopId]` routing (behind a flag)
 *   2. drop `vendor_profiles.user_id UNIQUE` + switch `open-shop` provisioning
 *      from find-or-create-by-user to a count-checked insert
 *   3. migrate the ~28 single-owner RLS policies to `current_vendor_ids()`
 * The resolver seam (`lib/roles.ts` shop list, `fetchOwnVendorProfile` active-id)
 * is already in place; this dial gates the visible "+ Open a business" action.
 */
export const MAX_SHOPS_PER_USER = 1;

/**
 * True when a user who already owns `ownedCount` shops may open another. The
 * future "+ Open a business" affordance reads this; `open-shop` provisioning
 * guards on it before minting a new `vendor_profiles` row.
 */
export function canOpenAnotherShop(ownedCount: number): boolean {
  return ownedCount < MAX_SHOPS_PER_USER;
}
