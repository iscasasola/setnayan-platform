# Changelog fragment — collected into CHANGELOG.md by scripts/changelog-collect.mjs

## 2026-07-08 · fix(vendors): close the crew-meal gap in the vendor event-brief budget band

Gap audit of the shipped Crew-Meal Provider Marketplace (#2868/#2870/#2878) found the core vendor-lists → couple-discovers → books chain intact (discovery keys on the vendor's `crew_meal_supply` coverage, which `syncProfileFromCoverages` writes into `vendor_profiles.services`) — but one MEDIUM soft-fail remained, plus doc drift.

- **Migration `20270522618307`** — `get_vendor_event_brief` inlines a `cat_to_leaf(vendor_category → budget plan-group)` VALUES map that omitted `crew_meals`, so a booked crew-meal vendor's Customer Card budget band computed the couple's crew-meal allocation as ₱0 even when they had allocated to the `crew_meals` budget leaf. Re-emits the function with one added self-mapping row `('crew_meals','crew_meals')`. The re-emit is **extracted verbatim** from `20270508637171` (not hand-retyped — a diff confirms the added row is the ONLY change across the ~360-line `SECURITY DEFINER` body), so no other logic moved. `crew_meals` is intentionally NOT added to the guest-dietary rollup set (a crew-meal vendor feeds the crew, not the guests).
- **Doc drift** — two stale "26 plan groups" comments (`lib/vendors-plan-budget.ts`, `app/onboarding/wedding/actions.ts`) made count-agnostic (the code always iterated `PLAN_GROUPS` dynamically; it's now 27 with Crew Meals).

Verified NOT gaps (from the audit, no change): coverage-addability of `crew_meal_supply` (surfaced + synced), the vendor list path (`/services/new/crew_meals`), the couple accordion render (extras tier, no fixed-count assumption), the `crew_meals` enum on `event_vendors.category`, and all exhaustive `Record<VendorCategory>`/`Record<PlanGroupId>` maps (typecheck-guarded). Left as-is (cosmetic/pre-existing): the humanized "Crew Meal Supply" coverage label (no `canonical_service_schemas` row — a full schema row is heavy for a cosmetic label) and the pre-existing null-`applicable_event_types` universal-vs-wedding divergence (affects non-wedding events only; crew meals is wedding-scoped in V1).

Verification: `pnpm typecheck` clean; migration timestamp guard passes; SQL diff confirms verbatim re-emit + 1 line.

SPEC IMPACT: None — closes a gap in the already-recorded Crew-Meal Provider Marketplace (DECISION_LOG.md 2026-07-08).
