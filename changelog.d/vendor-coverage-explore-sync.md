## 2026-07-02 · feat(vendor-services): coverage drives Explore — event-types + services sync (rework PR 4c)

Coverage is now the source of truth that drives Explore discovery (owner-locked 2026-07-02). Closes the vendor Services rework.

- **`services/coverage-actions.ts`** — `syncProfileFromCoverages()` runs on every coverage create/update/delete:
  - `vendor_profiles.event_types` = **union across the vendor's coverages** (never empty → `['wedding']`) → drives the Explore `?event_type=` filter (read via the `vendor_market_stats` view).
  - `vendor_profiles.services[]` = the vendor's **coarse profile categories PRESERVED** + the **covered `canonical_service` keys**. Explore already matches canonical keys directly (`.contains('services',[canonical])`) and a tile filter `.overlaps('services', <tile canonicals>)` — so writing coverage canonicals makes coverage drive category/tile discovery **with no Explore-filter or view change**. Only the canonical portion is recomputed, so removing a coverage correctly drops its leaf from discovery.
- **Retired the profile-side event-type writer** (the two-writer conflict): `vendor-dashboard/actions.ts` no longer writes `event_types` (removed the now-unused `parseEventTypesArray` + its import); the profile page shows event types **read-only, derived from coverage** ("set per coverage on your Services page").

Grounding note: `vendor_profiles.services[]` is an opaque `text[]` that already accepts both coarse VendorCategory keys and canonical keys — so no marketplace-wide filter repoint was needed. tsc + vendor-layout + ESLint clean.

SPEC IMPACT: None (covered by the rework's DECISION_LOG row).
