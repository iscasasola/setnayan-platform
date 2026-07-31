## 2026-07-30 · fix(vendor): translate booked categories to service tiles — all three specialization desks were unreachable

The day-of surfaces narrow a vendor's service tiles to "the tiles booked on THIS
event". The event-side signal is `get_vendor_event_brief().booked_categories`,
which speaks the couple-side category vocabulary (`band_dj`,
`planner_coordinator`, `host_emcee`); `vendor_profiles.services` speaks the tile
vocabulary (`live_band`, `coordinator`, `host_mc`). They were intersected
directly with `Set.has()`.

`live_band` ∉ {`band_dj`}, so narrowing excluded every tile,
`specializationSetForServices` returned `null`, and NO booked vendor could reach
the song desk, floor command, or stage script. Verified against production on
the seeded song-desk fixture: the RPC returns `["band_dj"]` while the vendor's
services are `["live_band"]`, so the gate denied and the requests inbox rendered
"no requests yet" while three pending requests sat in the table.

The bridge already existed and was simply never crossed —
`tilesForVendorCategory('band_dj')` → `['live_band','dj']` in
`lib/vendor-category-taxonomy.ts`. Adds a plural `tilesForVendorCategories()`
and calls it at all four `booked_categories` read sites.

Also fixes the second half: both narrowers used `eventTiles ? new Set(…) : null`,
where an EMPTY array is truthy and silently excludes every tile. Empty and
absent both now mean "the event can't say — do not narrow". Narrowing is a
refinement, never the gate; access is still decided by booking + services +
entitlement, so declining to narrow cannot widen who gets in.

No entitlement or pricing rule changed — `holdsSpecialization` and the tier
floor are untouched. This restores the intended resolution, which had been
failing closed for everyone.

SPEC IMPACT: None — defect fix, no product decision changed.
