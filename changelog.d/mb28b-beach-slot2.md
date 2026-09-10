## 2026-09-06 · fix(moodboard): the beach ceremony drapes take the couple's colour

MB28 shipped the beach ceremony aisle with slot 1 (florals) only: its
driftwood arch was filled `rgb(221,214,200)`, 3.536 from the fabric slot in
the engine's own metric (`colorDistance` — weighted RGB, not CIELAB), and
`moodboard_asset_color_ranges` CHECKs `tolerance_de BETWEEN 5 AND 30`, so the
tightest legal tolerance (5) would have turned the whole arch the couple's
second colour. That was surfaced as an owner decision rather than worked
around. Owner ruling: re-cut the driftwood (the same call as MB23/MB24's
bride).

- Re-cut `apps/web/public/moodboard-seed/venue_scene/beach/ceremony-aisle.svg`:
  the 24 driftwood paths moved from `rgb(221,214,200)` to `rgb(172,168,160)`,
  19.8 from the fabric slot (was 3.536). Nothing else in the file changed.
  sha256 `d4e843bba1c457f798ced8936b3af55ff1d90c44850e495207ddfdad3ed2ee6e`.
- Migration `20271209690679` seeds the beach's slot 2 (`#E8D9B5`, tolerance 5,
  `fabric`), idempotent, with a `DO $$ … RAISE` if the beach row does not carry
  exactly two ranges afterwards. Tolerance 5 matches the church's own seeded
  value — the sky (`#E3EBEE`) is the new nearest neutral at 9.25, so 5 leaves
  over 4 points of margin rather than the "largest clean integer" the other
  seven venue scenes use.
- `the-background-never-wears-the-palette.test.ts`: the beach case now folds
  into the shared MB28 scene array with two slots, so every existing MB28
  assertion (own region moves, neutrals move by nothing, sampled_hex matches
  its region, no fringe growth) runs on it exactly like the other seven venue
  scenes. Added a beach-specific boundary test pinning the sky as the real
  tolerance ceiling (clean through 9, turns completely at 10).

SPEC IMPACT: None — this corrects an already-shipped migration's known gap
per the owner's 2026-09-06 ruling; no design doc described the driftwood
colour or the beach fabric slot as permanently absent.
