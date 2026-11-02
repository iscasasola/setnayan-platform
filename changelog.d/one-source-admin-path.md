## 2026-10-26 · fix(admin/categories): the page can use the categories it creates (③0-d)

- **"Also listed under" validates against the live categories.** `setServiceSecondaryTiles`
  (`app/admin/categories/actions.ts`) checked the admin's pick against the code tile list
  (`WEDDING_TILE_ORDER`), so cross-listing a service onto a category created on the same page
  answered "Unknown category(s)". It now reads the tier-2 `service_categories` rows and decides with
  one pure rule, `secondaryTilesVerdict` (`_components/model.ts`).
- **"None" saves.** Clearing the cross-listing wrote NULL into `secondary_tiles`, which is
  `NOT NULL DEFAULT '{}'` — the database refused it every time. It writes `[]` now.
- **A supplier's "add a service" door opens for an admin-made category.**
  `/vendor-dashboard/services/new/[category]` accepted a tile id only if it was in the code list;
  it now asks `getTaxonomy().tileOrder` (fallback-safe).
- Guards: `tests/db/one-source-admin-path.db.test.ts` (live rule = code rule on the seed; an
  admin-made category is accepted and written; a deleted one is refused; `[]` lands, NULL is
  refused) and `app/admin/categories/_components/secondary-tiles-verdict.test.ts`;
  `lib/service-card-kind.test.ts` now pins that the route reads the live taxonomy.

SPEC IMPACT: Implements corpus `prototypes/admin_taxonomy_four_levels_2026-10-26/PLAN.md` § 8.3
step ③0-d (the admin "no deadline" count waits for ③0-g, as the plan says). No spec text changes.
