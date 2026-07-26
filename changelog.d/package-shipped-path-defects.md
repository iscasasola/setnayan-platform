## 2026-07-26 · fix(packages): three defects in the shipped lock path

Found by a "prove it ships" audit of the couple-side package configurator. All three
were unreachable in production only because **zero packages have ever been authored**
(`vendor_packages=0`, `event_vendor_packages=0`, verified live). Each fires on the first one.

**1. 💰 Removing an add-on refunded money the vendor never charged.**
`package-card.tsx` listed only `is_default_included` items; `lock-modal.tsx` mapped
`pkg.items` **unfiltered** with `removedIds=[]`, so an optional add-on rendered
PRE-TICKED. `computeCustomization` then treated it as inside `total_price_centavos`,
so unticking it knocked its `replacement_value_centavos` off the price (or grew the
credit pool by it, on a flexible package). The modal now lists the same set the card does.

**2. 🔒 `is_required` was declared but never enforced.**
Owner-locked 2026-07-26: *"the vendor can place required so this is something they have
to pick and cannot be unpicked."* `lockPackage` did not SELECT the column and
`computeCustomization` did not honour it. Now: the column is selected on both package
reads, `isRemovableItem()` is the single predicate, the checkbox renders disabled with
an "Always included" note, and `removeItemFromPackage` refuses server-side.

**3. 🧹 Post-lock removal deleted every sibling row in the category.**
`removeItemFromPackage` deleted `event_vendors` by `(booking, category)`, but
`PACKAGE_CANONICAL_TO_VENDOR_CATEGORY` is many-to-one — `reception_venue`,
`function_hall`, `events_place`, `hotel_ballroom`, `garden_reception_venue` and
`resort_reception_venue` all resolve to `venue`. Dropping one line deleted them all
while recording a single `item_id`, silently desynchronising the booking from its rows.
New `event_vendors.package_item_id` makes the cascade item-precise, with a unique index
per `(booking, item)` and a NULL-only fallback for rows predating the column.

Two characterization tests in `package-credit.test.ts` that pinned defects 1 and 2 as
known divergences are converged — one of them explicitly said it was waiting for "the
lock wave" to choose. This is that wave.

- `supabase/migrations/20271007240000_event_vendors_package_item_id.sql` (new)
- `apps/web/lib/vendor-packages.ts` — `isRemovableItem()`, `computeCustomization`, `keptItems`
- `apps/web/lib/vendor-packages-customization.test.ts` (new — 9 tests; 7 go red on revert)
- `apps/web/app/_components/vendor-packages/lock-modal.tsx`
- `apps/web/app/dashboard/[eventId]/vendors/packages/actions.ts`

SPEC IMPACT: `Vendor_Card_Actions_Findings_2026-07-26.md` §3b — the three defects listed
there as live are fixed; the `is_required` row moves from BROKEN to SHIPS.
