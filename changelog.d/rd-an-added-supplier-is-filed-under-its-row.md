## 2026-10-20 · fix(suppliers): a supplier added from a row is filed under that row

Owner, verbatim: *"Yes fix that. We want them to be designated to their category"*. Adding your own
supplier from the Food Truck row filed them under Everything else: the add wrote only the enum
`event_vendors.category` (Food Truck stores `misc`), and the walk's dropdown collapsed rows that share
one enum value ("the first one names it").

- **One storage rule for add and move.** `storageForRow(tile)` (lib/shortlist-taxonomy.ts) is the
  inverse of `homeTileForRow`: the enum `category`, plus `category_key` = the row when the enum alone
  would draw it elsewhere. `planSupplierMove` (#6712) now uses it too.
- **The add writes the row.** `addManualSupplier` → `attachManualVendorToCategory` and
  `attachMarketplaceVendorToCategory` read a posted `category_key` through one check
  (`categoryKeyFromAdd` → `categoryKeyForAdd`): kept only when it is a row the page draws and refines
  the posted category. No row, the top-level Everything else row, or a contradicting/unknown key →
  no key, exactly what the add always wrote.
- **Every add path posts it.** The walk (`AddYourOwnWalk`, both Add and Inquire), the one-screen
  sheet (`NewManualVendorModal`, manual and shop pick), and every bench opener (thumb row ＋, the
  "which category" ask, both "Add manually" buttons) carry the row. The walk's dropdown is built by
  `addOwnCategoriesFromRows` — one entry per row, keyed on the row — and Done lands on that row.
- **Money:** unchanged rule — `bucketForVendor` keys on `category`, the same bucket #6712's move uses;
  no linked copy, so nothing is counted twice. **Claim link:** `createManualVendorInvite` snapshots the
  record's `category`, the value the move keeps `vendor_invites.service_category` at.
- Lab: `/dev/suppliers-lab` draws what the walk's Add posted (`&own=<category>~<key>~<name>`).
- Guards: `lib/an-added-supplier-is-filed-under-its-row.test.ts` (every row, shared-enum pairs,
  sources) and `tests/db/an-added-supplier-keeps-the-row-it-was-added-from.db.test.ts`.
- No migration; no existing row rewritten.

SPEC IMPACT: None — implements the owner's 2026-10-20 instruction with the #6712 mechanism.
