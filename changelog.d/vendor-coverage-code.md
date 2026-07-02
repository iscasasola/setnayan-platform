## 2026-07-02 · feat(vendor-services): coverage-first management — read layer + CRUD actions + UI (rework PR 2+3)

Backend + UI for the coverage-first Services rework (on top of the schema in `20270426250948`).

- **`lib/vendor-coverages.ts`** — `fetchVendorCoverages()` (a vendor's `vendor_coverages` rows) + `getCoverageTaxonomy()`, the live **parent → branch → leaf** pick list built straight from the admin taxonomy tables (`service_categories` tier 1/2 + `canonical_service_taxonomy` + `canonical_service_schemas`), so admin edits flow through with no deploy. A leaf's allowed event types resolve canonical-override → tile → universal; retired/hidden nodes dropped; cached per request. Plus `resolveCoverageLabels()` for card/list display.
- **`services/coverage-actions.ts`** — `createCoverage` / `updateCoverageEventTypes` / `deleteCoverage`. Validates `canonical_service` against the live taxonomy and `event_types` against `event_type_vocab` (+ the leaf's allowed set); vendor-scoped writes (RLS + explicit `.eq` double-scope). The Explore sync (`vendor_profiles.services` + event_types union) is wired in PR 4.
- **`lib/vendor-services.ts`** — `base_pax` + `coverage_id` added to `VendorServiceRow` + `FULL_SELECT` + the graceful-fallback defaults.
- **`services/_components/coverage-panel.tsx`** + `page.tsx` — replaced the old derived "Service coverage" pills with a first-class **"Your coverage"** panel: an **Add coverage** drill-down (parent → branch → leaf from the live taxonomy, already-covered leaves locked out) + **event-types** step (constrained by the leaf), and per-coverage **edit event types** / **remove**. Each coverage shows its `Parent › Branch › Leaf` path, event chips, and card count. The old category-based service list is untouched for now (cards get coverage-scoped + flat/pax + add-ons in PR 4).

Typecheck clean (`tsc --noEmit`, 0 errors); nav-icon + vendor-layout lints pass.

SPEC IMPACT: None (covered by the rework's DECISION_LOG row from PR 1; no new decisions).
