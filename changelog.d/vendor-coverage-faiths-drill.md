## 2026-07-02 · feat(vendor): service-card redesign Phase 2 — coverage faiths + search/drill

Phase 2 of the service-card redesign (Phase 1 = schema, PR #2640). Activates the
`vendor_coverages.faiths` column and reworks "Add coverage" into the owner's
search-first drill. Code-only (no migration — Phase 1's schema is already applied).

**Coverage = leaf + WHO you serve (event types AND faiths).**
- `lib/vendor-coverages.ts` — `VendorCoverageRow` + `fetchVendorCoverages` now read
  `faiths TEXT[]`.
- `coverage-actions.ts` — `parseFaiths()` validates against the `FAITH_REGISTRY`
  `faithCol` set (faiths MAY be empty = "all faiths welcomed"). `createCoverage`
  writes faiths; `updateCoverageEventTypes` → **`updateCoverageServes`** now writes
  both `event_types` + `faiths`.
- `coverage-panel.tsx` — rebuilt "Add coverage": a **search box** (flat leaf match
  across the whole live taxonomy, ≤30 hits) + a **3-per-row card drill**
  (parent → branch → leaf) + a **breadcrumb** (Categories › Parent › Branch) that
  jumps to any level. Picking a leaf opens a "Serves" confirm step with event-type
  (leaf-constrained) + faith checklists. Each coverage row shows its faiths
  ("All faiths" when empty) and edits event types + faiths together via one Serves
  form. Fixed a would-be double-toggle (label onClick + hidden-checkbox onChange).
- `services-manager.tsx` — passes `faithOptions` (from `FAITH_REGISTRY`) + a
  **"Parents N of M" counter** (distinct tier-1 parent folders the coverages touch
  vs the tier's `parentCategories` cap; Infinity → "∞").

Verified: tsc (0) · next lint (0) · prod build.

SPEC IMPACT: None (uses the Phase-1 schema; see `DECISION_LOG` 2026-07-02 +
`project_setnayan_service_card_prototype_final`). Phase 3 (fast service-card
build/edit UI) + Phase 4 (Explore surfacing) still to build.
