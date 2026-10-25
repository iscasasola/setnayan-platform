## 2026-10-20 · fix(suppliers): "Also covers" lists the Suppliers page's own rows — and searches them

Owner, on a Dunkin' card filed under Everything else: *"how do i connect the dunkin donuts to a food truck
category?"* … *"we already have that food truck category"* … *"allow us to search that and add it on the
category for their service. it just means, we do not have the categories synced properly"*.

- **One list.** The card sheet's and the workspace editor's "Also covers" offered the ~30 plan groups
  (`wedding-plan-groups.ts`); the Suppliers page draws the taxonomy tiles (`buildShortlistFolders`,
  `service_categories` tier 2). Every row no plan group opens on — Food Truck, Food Cart, Dessert, Coffee,
  Perfume Bar, Accommodation (the row), … — was unreachable. The picker now takes `CoverCatalogFolder[]`
  from `coverCatalogFromFolders(buildShortlistFolders(...))`: the page's own rows, names, folders and order
  (`lib/cover-catalog.server.ts` → `loadCoverCatalog` for sheets opened off the bench).
- **Search.** A search box heads the dropdown (PickMenu gains a `head` slot; the box filters the options).
- **Storage stays compatible, no migration.** A ticked row is stored as the plan-group id that opens on it
  when one exists (byte-for-byte what the old picker wrote), else `tile:<id>`. Bare tile ids would collide:
  the `accommodation` plan group opens on Reception. Budget readers see plan groups only
  (`planGroupsOfCovers` in `attributeCommitted`); `bucketForVendor` already ignores an unknown key.
- **A newly ticked row is put on the event** through `restoreTileToPlan`, the Suppliers page's own
  "＋ Add to your event".
- The workspace editor's chip wall became the same picker; a stored key is kept as stored unless unticked.
- Guard: `lib/also-covers-is-the-suppliers-rows.test.ts` (every row offered · every key round-trips · every
  tile, ticked, draws the card under it · legacy keys kept · a row-only key never becomes a budget line).

SPEC IMPACT: `DECISION_LOG.md` row 2026-10-20 "Also covers = the Suppliers page's rows" (corpus).
