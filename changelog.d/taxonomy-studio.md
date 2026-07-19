## 2026-07-03 · feat(taxonomy): rebuild /admin/taxonomy as the visual "Taxonomy Studio"

Replaced the zero-JS nested-`<details>` form tree at `/admin/taxonomy` with a
three-pane visual card-tree editor (PR 2 of 3 of the Taxonomy Studio program;
stacks on the icons/photos representation layer in #2725).

- **Three panes:** left rail = 10 folders (icon + tile count) + Unfiled/Requests
  pseudo-buckets; center = tile cards (icon · label · photo thumbnail · badges for
  services/refinements/event-scope/faith); right = a reusable bottom-sheet /
  side-drawer inspector (`app/_components/sheet.tsx`) with **Details** and
  **Services** tabs. The Details tab leads with the single signature moment — a
  live /explore-style preview card that updates as the admin swaps icon/photo.
- **Drag & drop (HTML5 only, no dnd libs):** reorder tile cards within a folder,
  drop a tile onto a folder to re-home it, drag a service row onto a tile to
  remap it. Keyboard/mobile equivalents (overflow selects) preserved.
- **New JSON-returning server actions** (same requireAdmin + `admin_audit_log`
  contract; `router.refresh()` on the client, no redirect): `reorderCategories`,
  `moveTileToFolder` (re-points the denormalized `canonical_service_taxonomy.folder_id`
  with a compensating rollback), `deleteTileWithDestination` (never strands a
  canonical — a non-empty tile requires a destination; re-points canonicals +
  anchored refinements, then deletes, with rollback on partial failure).
- Pure reorder helpers extracted to `lib/taxonomy-studio-order.ts`
  (`validateReorder` permutation check + `computeReorder` minimal-write diff),
  unit-tested (`lib/taxonomy-studio-order.test.ts`, node:test via tsx).
- All existing redirect-form actions (rename, remap, faith, event-types, add
  service/tile, icon, photo) reused unchanged. Preserved sections retained:
  drift validator, demand signal, recommended-deadlines editor, last-minute
  window editor, and the vendor category-request queue (now the Requests bucket).
- Search + view chips (All · Faith-tagged · Event-scoped · Unfiled · Requests)
  filter client-side and sync to `?q=` / `?view=` so old deep links keep working.
- IDs/slugs immutable throughout (rename = label only, re-parent = parent_id +
  denormalized folder_id only); `getTaxonomy()` DB-first + const-fallback intact.

SPEC IMPACT: None. UI/interaction rebuild of an existing admin surface; no schema
changes, no pricing/SKU changes, no couple- or vendor-facing behavior change. The
marketplace/onboarding read path (`getTaxonomy()` snapshot) is unchanged.
