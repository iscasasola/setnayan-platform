# Changelog fragment — collected into CHANGELOG.md by scripts/changelog-collect.mjs

## 2026-07-08 · feat(vendors): Crew Meals as a first-class category + couple plan group

Makes the Crew-Meal Provider Marketplace reachable by couples (PR #2868 shipped the taxonomy tile; this wires the couple-facing entry point). Adds `crew_meals` as a legacy `VendorCategory` and a `crew_meals` plan group, so couples discover crew-meal providers near their venue by proximity and a booked provider buckets cleanly into its own card instead of misfiling under Catering.

- **Migration `20270521971232`**: `ALTER TYPE public.vendor_category ADD VALUE IF NOT EXISTS 'crew_meals'` — additive + idempotent, following the established precedent (`'accommodation'` 20260604150000, `'bridal_gown'` 20260621000000). Adds the value only; never uses it in the same migration (transaction-safe). `vendor_services.category` is TEXT, so it needs no change.
- **`lib/vendors.ts`**: `crew_meals` added to the `VendorCategory` union + `VENDOR_CATEGORIES` + `VENDOR_CATEGORY_LABEL` ("Crew Meals") + the `reception` service group (so `serviceGroupOf` resolves it).
- **`lib/vendor-service-tools.ts`**: `VENDOR_CATEGORY_ICON` gets `crew_meals` (Utensils).
- **`lib/vendor-category-taxonomy.ts`**: `VENDOR_CATEGORY_CANONICAL` bridges `crew_meals` → tile `crew_meals` (drives the "shop this category" deep-link).
- **`lib/wedding-plan-groups.ts`**: new `crew_meals` `PlanGroupId` + `PLAN_GROUPS` entry — extras tier, `catalogFolder: 'feast'`, `catalogTile: 'crew_meals'`, `subcategoryHint: 'crew_meal_supply'`. The couple's in-plan nearby-search (`searchCategoryVendors` → `canonicalsForGroup`) resolves the `crew_meal_supply` canonical → surfaces vendors with that coverage, ranked by distance from the reception venue.
- **`lib/todays-one-thing.ts`**: `crew_meals` entries in the three exhaustive nudge maps (WHY_IT_MATTERS · CTA_LABEL · ACTION_TITLE).

Verification: `pnpm typecheck` clean; `pnpm test:unit` 1083/1083 pass (the taxonomy / plan-group / vendor-category consistency suites included). Connect gate unchanged (owner Option 1 — regular-vendor treatment).

SPEC IMPACT: Extends the Crew-Meal Provider Marketplace already recorded in the corpus (DECISION_LOG.md 2026-07-08 + the two dated sibling specs, landed with PR #2868). No new spec delta.
