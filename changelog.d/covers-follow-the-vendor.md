## 2026-09-21 · feat(vendors): a supplier's "also covers" shows on those categories, and holds in the build

Owner: *"when we manual add a vendor on a category and add other categories as
well, it should auto populate to the other categories … automatically linked
everytime. even when they are making builds."*

`event_vendors.covers_plan_groups` was saved by the Add-manually sheet and the
workspace editor, then read by nothing on the bench — a supplier sat in exactly
one tile.

- **Bench** (`lib/shortlist-taxonomy.ts`): `linkedTilesForRow` resolves each
  covered plan group to its tile; the supplier appears there as a card reading
  "Included with {home category}", with no price (one booking, one price),
  after that tile's own candidates, once per tile, and counted once.
- **Build** (`lib/vendors-plan-budget.ts`): "Covered by" no longer requires the
  covered category to be EMPTY; only that category's own build pick or lock
  outranks the package. `coveredBy` now carries `locked`.
- **Saved builds** (`vendors/page.tsx`): the current-plan snapshot carries a
  covered category as that supplier at ₱0 with NO `vendorId`, so loading a
  build can never write a duplicate pick.
- **Address map** (`branch-pin-map.tsx`): the map now follows its value when it
  changes from outside — "Find" moved the pin's coordinates but not the map,
  and the next nudge overwrote the result. Recentres at street level (z16).

Guarded by `apps/web/lib/also-covers-follows-the-supplier.test.ts` (7 cases;
each fix sabotaged in turn goes red).

Not fixed here, flagged: `bucketForVendor` files a manual supplier's money under
its FIRST also-covered group.

SPEC IMPACT: `DECISION_LOG.md` — two 2026-09-21 rows (the 2026-06-12
category-satisfaction "EMPTY only" rule is amended; the address-map fix).
