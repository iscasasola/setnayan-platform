/**
 * THE BOOKING RECEIPT'S THREE LISTS.
 *
 * 🧾 A receipt may not claim the couple bought something they did not pay for.
 *
 * This page used to split a package into two lists on `removed_item_ids`
 * ALONE — `!removed` was printed under "Included in this booking", `removed`
 * under "Removed" — and never consulted `is_default_included`. An optional
 * ADD-ON is never inside `total_price_centavos` and is never charged, so every
 * add-on on a package was printed, with a green tick and no qualifier, as part
 * of what the couple had booked. The page disagreed with the LOCK PATH about
 * what was actually bought: `keptItems` in @/lib/vendor-packages has always
 * refused to cascade an add-on into an `event_vendors` row precisely because
 * "there is no purchase path for add-ons yet".
 *
 * The two definitions drifted apart because the page declared a LOCAL
 * `const keptItems` that SHADOWED the imported helper of the same name — the
 * shadow made the divergence invisible at the call site. The rule now lives
 * here, is imported by the page under names that cannot shadow it, and is
 * asserted by ./receipt-sections.test.ts.
 *
 * The owner's design (Design_Package_Credit_2026-07-26 ·
 * couple_customize_and_requests.html) models the couple side as three
 * sections — Included · add-ons · free-text requests — so add-ons are SHOWN in
 * their own labelled section, never hidden and never folded into Included.
 *
 * ⚠ THE DESIGN'S COPY IS NOT THIS PAGE'S COPY. "Add on if you'd like" is the
 * pre-lock CONFIGURATOR voice. This is a post-lock RECEIPT and there is no
 * purchase path for add-ons yet, so an invitation to add would promise
 * something the product cannot deliver. The section names the STATUS instead.
 *
 * Pure module — no React, no Supabase, no clock. That is the point: the rule is
 * testable without rendering a server component.
 */

import {
  isRemovableItem,
  keptItems,
  type VendorPackageItemRow,
  type VendorPackageWithItems,
} from '@/lib/vendor-packages';

export type ReceiptSections = {
  /** Bought. Inside `total_price_centavos`, cascaded into `event_vendors`. */
  included: ReadonlyArray<VendorPackageItemRow>;
  /** Offered on this package, never charged, never booked. */
  notIncluded: ReadonlyArray<VendorPackageItemRow>;
  /** Was bought, then dropped — the only removals that moved money. */
  removed: ReadonlyArray<VendorPackageItemRow>;
};

/**
 * Split a booking's package lines into the three lists the receipt prints.
 *
 * EXHAUSTIVE AND MUTUALLY EXCLUSIVE by construction — every non-follow-up line
 * lands in exactly one list:
 *
 *   • `!is_default_included`                    → notIncluded
 *   • included + required                       → included  (survives any removal id)
 *   • included + optional + removal id present  → removed
 *   • included + optional + no removal id       → included
 *
 * 🥊 THE DOUBLE-LISTING RULING — notIncluded WINS over removed.
 *
 * A stale or hand-rolled client can put a not-included line's id in
 * `removed_item_ids`; the pre-fix page would then have printed it under BOTH
 * "Not included" and "Removed". "Removed" is not a neutral label — it asserts
 * the line WAS part of the booking and then came out, which is the same
 * overstatement this fix exists to close, only in reverse. It also implies a
 * refund, and no money moved: `computeCustomization` prices a removal only
 * `if (removedSet.has(id) && isRemovableItem(item))`, so a removal id on a
 * not-included (or required) line is IGNORED by the lock path — nothing was
 * ever charged, so nothing was ever given back.
 *
 * So the receipt reports the status the money agrees with, and it does it by
 * reusing the lock path's own predicate rather than a second opinion:
 * `removed` is gated on `isRemovableItem`, which is exactly "did this removal
 * count?". A line the lock path ignored is never printed as removed.
 */
export function receiptSections(
  pkg: VendorPackageWithItems,
  removedItemIds: ReadonlyArray<string>,
): ReceiptSections {
  const removedSet = new Set(removedItemIds);

  // A FOLLOW-UP is not on this receipt in any of the three lists. It is
  // CONDITIONAL — the couple sees it only once its parent option is picked —
  // so it is neither bought, nor an add-on they could take on its own, nor
  // something they dropped. The page already filters these out of `pkg.items`
  // (PR #3823) and the database forces every follow-up to
  // `is_default_included = FALSE`; this repeats it because a caller may hand
  // this function objects built IN MEMORY, where no constraint applies, and
  // because it is what makes the partition below provably exhaustive.
  const lines = pkg.items.filter((i) => i.parent_option_id == null);

  return {
    // THE EXPORTED HELPER, not a local re-derivation. It is the same function
    // the cascade uses to decide which lines become booked services, so the
    // receipt cannot drift from the booking again.
    included: keptItems({ ...pkg, items: lines }, removedItemIds),
    notIncluded: lines.filter((i) => !i.is_default_included),
    removed: lines.filter(
      (i) => removedSet.has(i.item_id) && isRemovableItem(i),
    ),
  };
}
