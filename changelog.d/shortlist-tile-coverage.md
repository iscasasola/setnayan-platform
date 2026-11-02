## 2026-07-21 · fix(shortlist): bridge the 14 non-wedding gap leaves to their tiles (docstring was lying)

`CATEGORY_TO_TILE` in `apps/web/lib/shortlist-taxonomy.ts` documented itself as
"exhaustive over the enum so a considered pick always lands on a tile". It was
not: of the 45 `VendorCategory` values, 14 had no tile — `referee_official`,
`event_medic`, `tour_activity`, `tour_guide`, `travel_insurance`,
`av_production`, `speaker_talent`, `performers`, `kids_entertainer`,
`choreographer`, `reveal_element`, `event_insurance`,
`personal_accident_insurance`, `restaurant_reservation` (the non-wedding
event-type gap leaves added 2026-07-20). `buildShortlistFolders` does
`if (!tile) continue;`, so a considered vendor in any of those categories was
dropped from the Shortlist tab outright. A second, undiagnosed manifestation:
`TILE_TO_CATEGORY` is derived by inverting the same map, so the "Add manually"
affordance on those tiles stored the record as `misc` — which reads back as the
`escort` tile, a silently mis-filed round-trip.

- Added a third, final fill pass sourced from `VENDOR_CATEGORY_CANONICAL`
  (`lib/vendor-category-taxonomy.ts`) — the compile-time-exhaustive
  `Record<VendorCategory, …>` that already anchors all 14 keys 1:1 to their
  same-named tier-2 tile under EXPERIENCE / DINING / LOGISTICS & SAFETY /
  INSURANCE / SPECIALTY / PROGRAM. Nothing is forced onto a wedding tile; the
  tile's `applicable_event_types` filter (`passesEventTypeFilter`, already
  wired) is what keeps a Tour Guide tile off a wedding Shortlist.
- Runs LAST, first-writer-wins, so the six deliberate Shortlist-specific
  placements are untouched (officiant/church_fees → `ceremony_venue`,
  security/misc → `escort`, string_quartet → `orchestra`, reception_decor →
  `florist`). Four of those are canonically EXEMPT (null) — delegating wholesale
  would have turned them null and dropped MORE picks.
- Corrected the false docstrings (the exhaustiveness claim and two "28-value
  enum" references — it is 45).
- New `apps/web/lib/shortlist-taxonomy-coverage.test.ts` asserts the contract:
  all 45 map, every produced tile is live, the 14 leaves anchor to their own
  tile under the expected non-wedding family, the tile→category round-trip
  holds, and the four exempt-but-parked categories stay parked.

Not covered: Build / Budget / Compare are driven by `PLAN_GROUPS`, not this map,
and were never affected. No change to the event-type filter itself, so a
`tour_guide` row on a wedding event is still not displayed — now by the honest,
documented mechanism rather than a silent null bridge.

SPEC IMPACT: None — restores the documented exhaustiveness invariant; no new surface, pricing, or schema.
