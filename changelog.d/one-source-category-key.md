## 2026-10-26 · refactor(taxonomy): the coarse category a category files its shops under is a database column (③0-c, part 1)

- **New column `service_categories.coarse_category`** (`public.vendor_category`, nullable),
  migration `20271290647325_one_source_coarse_category_column` — seeded row for row from the code
  map `BRANCH_TO_VENDOR_CATEGORY` (79 categories; only fills NULLs, so a re-apply never overwrites
  an admin's later value). RLS unchanged (the table's own public-read / admin-write policies);
  exposure baseline regenerated (+1 public column).
- **The resolvers read it.** `getTaxonomy()` selects it into `snapshot.tileCoarseCategory`;
  `categoryForBranch`, `vendorCategoryForLeaf`, `eventVendorCategoryForCardKind` and
  `eventVendorCategoryKeyForCardKind` now take the snapshot. Callers pass `await getTaxonomy()`:
  /explore save, "unlock a category" inquiry, the shop page's inquiry + its card groups,
  open-a-shop, and the signup coverage suggestions. The code map is the seed and the fallback
  snapshot's copy only — a category re-filed in the column is followed with no deploy.
- **`validateVendorCategoryMapping` is now a refusal.** `deleteTileWithDestination` refuses to
  delete a category a couple-side category is anchored on (`deletionWouldBreakCoupleLinks`) —
  until now the only signal was a "couple-side links broken" number on the admin page, after the
  damage.
- Guards: `apps/web/tests/db/one-source-category-key.db.test.ts` (column = code map on the seed;
  every resolver answers the same from the DB as from the code for every visible service and
  category; after an admin edit — a new category given a coarse category, an existing one re-filed
  — the resolvers follow; the delete refusal), `apps/web/lib/one-source-category-key.test.ts`;
  `no-service-lands-in-misc`, `inquiry-adds-the-shop` and `open-shop-service-tree` now judge the
  resolvers against the replayed DATABASE (`tests/db/taxonomy-from-db.ts`), not the code map.

NOT in this PR (reported, needs an owner call or its own PR): how a NEW category gets its coarse
category (chosen on create / set on its panel / inherited) — until decided it resolves to `misc`,
pinned by the db test; the leaf-level map `PACKAGE_CANONICAL_TO_VENDOR_CATEGORY` (also the packages
page's service list and a reverse map); `VENDOR_CATEGORY_CANONICAL` / `CATEGORY_TO_TILE` readers
moving to `event_vendors.category_key`.

SPEC IMPACT: Implements part of corpus `prototypes/admin_taxonomy_four_levels_2026-10-26/PLAN.md`
§ 8.3 step ③0-c (the column + the refusal). No spec text changes; the open owner question is
raised in the PR, not decided.
