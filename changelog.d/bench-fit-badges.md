## 2026-07-09 · feat(vendors): live fit-badges (reach + budget) on the Shortlist bench

Surfaced two live fit-badges on every considered-vendor card in the couple **Services / Shortlist** bench (`ShortlistCategories`) — the first of the deferred "live fit-badges on shortlist rows" items from `unify-vendor-tabs.md`. Warn-only by design (owner 2026-07-09): a red badge informs, it never blocks the card.

- **Reach** — "Reaches you" (ok) / "Beyond N km" (warn) from the vendor's tier service radius vs. the event venue (Verified 20km · Pro 50km · Free/Enterprise unscoped), reusing the same `vendor-tier-caps` + Haversine + fail-open rule the category-search overlay already uses. Unknown coords / manual vendors render NO badge (never a false "out of range").
- **Budget** — "Fits budget" (ok) / "Over budget" (warn) from the vendor's price basis vs. the event's remaining budget (total `estimated_budget_centavos` − Σ locked commitments). Basis is a real quote (`total_cost_php`) first, else the service's "starts at" anchor (`vendor_services.starting_price_php`), which renders an "est." qualifier so an estimate never reads as firm. Locked picks carry no budget badge (already committed + already netted out). No budget set → no budget badge anywhere.

Plumbing: extended `ShortlistVendor` (`reachesVenue`, `serviceRadiusKm`, `budgetFit`, `budgetEstimated`) + `VendorEnrichment` (`within_radius`, `service_radius_km`, `starting_price_php`); `buildShortlistFolders` gained a `totalBudgetPhp` arg and computes remaining + per-vendor fit; the vendors page computes reach in the existing enrichment pass (no new query) and piggybacks `starting_price_php` onto the existing `fetchVendorPhotoMaps` `vendor_services` fetch (no new query). 9 unit tests in `shortlist-taxonomy.test.ts` cover fits/over/null, locked-netting, starts-at fallback, and reach.

Date-availability badge is a deliberate fast-follow (needs a per-vendor calendar batch, unlike reach/budget which reuse data already fetched for the bench). Behind `BUDGET_BUILD_ENABLED` with the rest of the takeover.

Files: `apps/web/lib/shortlist-taxonomy.ts`, `apps/web/lib/vendors-plan-budget.ts`, `apps/web/app/dashboard/[eventId]/vendors/page.tsx`, `apps/web/app/dashboard/[eventId]/vendors/_components/shortlist-categories.tsx`, `apps/web/lib/shortlist-taxonomy.test.ts`.

SPEC IMPACT: None — surfaces existing fit primitives on a new row; no schema, pricing, SKU, or engine change. (Advances the "fit-badges on shortlist rows" item the corpus already tracked as deferred.)
