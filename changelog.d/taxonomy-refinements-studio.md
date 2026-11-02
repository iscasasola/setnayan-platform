## 2026-07-03 · feat(taxonomy): fold refinements management into the Taxonomy Studio (PR 3 of 3)

Adds a third **Refinements** tab to the Taxonomy Studio inspector (`/admin/taxonomy`),
retiring the forked `/admin/refinements` editor. For a selected tile the tab shows the
onboarding "what kind of X?" leaves anchored to it (`onboarding_refinements.tile_id`) —
each with label / description / status / main-photo editing and an option grid (emoji /
label / photo / status), inline-edited through the same core mutations as the legacy
editor (extracted to `lib/refinements-mutations.ts`, so no logic is duplicated).

- **Drag + up/down reorder** for leaves within a tile and options within a leaf, via two
  new JSON-returning server actions following the PR-2 pattern (requireAdminJson, ONE
  `admin_audit_log` row each with before/after order arrays, shared `validateReorder` /
  `computeReorder`): `reorderRefinementLeaves(tileId, orderedLeafKeys)` and
  `reorderRefinementOptions(leafKey, orderedOptionKeys)`. Audit actions
  `taxonomy.reorder_refinement_leaves` / `taxonomy.reorder_refinement_options`.
- **CRUD** via redirect-back form actions (`updateRefinementLeaf`, `updateRefinementOption`,
  `addRefinementOption`, `removeRefinementOption`) that re-open the tile on the Refinements
  tab (`?open=<tile>&opentab=refinements`).
- **Photo required on every NEW option** (owner-ratified 2026-06-10): the add-option submit
  is disabled until a photo is uploaded, and `addOptionCore` re-checks server-side. Existing
  options untouched.
- **PROJECTABLE lock preserved** (ceremony / catering / photo_video): option add/remove is
  blocked with a quiet explanatory note; dynamic-ceremony leaves keep the faith-driven note.
- `leaf_key` / `option_key` stay **immutable** (label/description/photo/status/sort_order
  edits only); photo refs validated against the `/public`-path-or-`r2://` pattern and
  presigned server-side with graceful emoji fallback.
- Tile-card refinement badge is now a click-through that opens the inspector on the
  Refinements tab.
- `/admin/refinements` becomes a server-side `redirect('/admin/taxonomy')` (route kept for
  bookmarks); the dead legacy page/editor components + `app/admin/refinements/actions.ts`
  are removed (nothing else imported them).
- Unit tests extended to pin the reorder helpers' permutation semantics for the
  refinement (leaf_key / option_key) case.

SPEC IMPACT: None. Consolidates two existing admin surfaces; no product-behavior or schema
change (couple-facing onboarding read path `getOnboardingRefinements()` unchanged, DB-first
+ const-fallback intact).
