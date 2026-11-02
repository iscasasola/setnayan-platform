# Changelog fragment — collected into CHANGELOG.md by scripts/changelog-collect.mjs

## 2026-07-09 · test(vendors): regression guard for the Crew Meals wiring

The Crew-Meal Provider Marketplace (#2868 / #2870 / #2878 / #2881) spans three vocabularies — the legacy `VendorCategory` (`crew_meals`), the plan-group id (`crew_meals`), and the taxonomy tile/canonical (`crew_meals` / `crew_meal_supply`) — bridged by six separate maps, with nothing asserting they stay in lockstep. A future edit to any one map could silently make crew-meal vendors undiscoverable or mis-priced (typecheck guards the exhaustive `Record<>` maps, but not the cross-vocabulary *values*).

Adds `lib/crew-meals-wiring.test.ts` (5 tests) pinning the load-bearing links:
- the taxonomy tile lives under Feast + `crew_meal_supply` canonical bridges to it;
- **the discovery chain** — the `crew_meals` plan group's `catalogTile` resolves (via `canonicalServicesForTile`) to the `crew_meal_supply` canonical that the couple's nearby-search overlaps against (the exact link that surfaces crew-meal vendors by venue proximity);
- the legacy `VendorCategory` is fully wired (in `VENDOR_CATEGORIES`, labelled, resolves via `serviceGroupOf` → `reception`, and `VENDOR_CATEGORY_CANONICAL` bridges to the `crew_meals` tile).

Closes the test-coverage gap found in the 2026-07-09 flow/safety audit (the audit confirmed no functional gaps; this is the one actionable item). Verified: `pnpm test:unit` 1246/1246 pass.

SPEC IMPACT: None — test coverage for the already-shipped feature.
