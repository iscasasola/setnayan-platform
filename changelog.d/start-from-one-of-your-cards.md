## 2026-08-24 · feat(vendor-services): a supplier can start a new card from one they already made

Owner asked for this on 2026-07-28: *"can they copy what they created and place it to the
wizard to recreate it?"*, with the rule that **events created for that card stay on that
card** (`WHATS_NEXT_Card_Family_Handoff_2026-07-29.md` § 3a).

Every card row in My Services grows a copy doorway. It opens the zero-step maker already
filled in with everything the vendor AUTHORED — name, price and basis, pax brackets,
inclusions, discounts, the Setnayan Exclusive, crew size, lead-time rules, the coverage it
sits in, the other categories it comes bundled with, and the media references.

Nothing the card EARNED comes across: bookings, the Card Record, event assignments, its
public id and address stay with the original. That is true by construction rather than by
policy — the maker posts no service id, so `commitVendorService` can only insert.

Media is REFERENCED, never duplicated: the copy names the same R2 objects. A future delete
path must therefore check for other referents before sweeping.

The ★ Customization options are the one thing that cannot be copied, and the maker says so on
screen. They live in a one-service `vendor_packages` row with no link back to the service —
`commitVendorService`'s own comment names the missing column — so there is no honest way to
find them, and guessing by vendor + category would attach a different card's options to this
one. Silence there would mean a card published missing what it sells.

The doorway and the `?from=` parameter are both gated on `NEXT_PUBLIC_CANVAS_MAKER_ENABLED`,
because only the canvas takes defaults; the 6-step wizard does not, so with the flag off the
link would render and do nothing.

Also: `discountsToDrafts` / `inclusionsToDrafts` / `bracketsToDrafts` moved out of
`services-manager.tsx` into `lib/vendor-service-drafts.ts`, so the edit form and the maker
seed from one converter instead of two copies.

SPEC IMPACT: None. No schema, no pricing, no locked decision touched.
