## 2026-09-05 · feat(mood-board): the Ceremony card gets a drawing (MB25)

MB23 retired the two live `venue_scene` rows — both `picsum.photos` stock
photographs shown to couples as their ceremony space "in their colors" — which
left the Ceremony card correctly, and temporarily, ABSENT. This restores it with
our own artwork: a Recraft V4.1 vector church aisle, app-served at
`public/moodboard-seed/venue_scene/church/ceremony-aisle.svg` (sha256
`9c311f0f…`, 326 flat paths, no gradients, no rasters, C2PA provenance block
left intact). Migration `20271206413595` seeds the row plus **two** colour
ranges — the first two-slot asset in the library.

🔑 **The tolerances were measured through `recolorRGBA`, and that changed one of
them.** MB25's brief specified the fabric tolerance from a CIELAB measurement
(nearest neutral, the floor `#D6D1C7`, at ΔE 14.4 → "≤ 10 is safe").
`colorDistance` is not CIELAB — it is a weighted-RGB Euclidean proxy, and in it
that pair is **5.1** apart. Measured by pixel on a real 520px raster at the
component's own `MAX_PREVIEW_PX`, a fabric tolerance of 10 — and of 6 — repaints
all 3,158 exact floor pixels in the couple's second colour. The seeded value is
**5**, which is also this table's `CHECK` floor; both regions are flat vector
fills, so there is no shading outside the range to strand. Florals seeded at
`#D98BA6 ± 10` (nearest non-slot fill 12.6 away). At the seeded values, both
slots applied together: florals 5,094/5,094 and fabric 13,409/13,409 exact
pixels recolour; pews, walls, floor and window glass move by **zero**.

Also fixed, found while wiring the first two-slot asset: `toRegions` in
`page.tsx` now sorts colour ranges by `slot_id`. `moodboard-board.tsx` maps
`palette[i % palette.length]` by ARRAY INDEX and neither embedded select carries
an `ORDER BY`, so with two slots the couple's first ceremony colour could land
on the aisle runner on one response and on the flowers on the next, for the same
data. Harmless while every asset had exactly one range; not harmless now.

Guards: `_components/the-background-never-wears-the-palette.test.ts` gains the
scene as its first two-slot case (each slot recolours its own region, the two
recolour independently, neutrals move by nothing) — parsing the values out of
the migration rather than restating them, and verified red under all three
sabotages (fabric tolerance → 15, swapped `sampled_hex`, dropped slot 2).
`tests/db/no-placeholder-photo-is-ever-live.db.test.ts` gains the positive
direction: the scene is live, app-served and carries both ranges, so a migration
that silently inserts nothing is caught. That file was checked for the
"zero live venue scenes" trap and did NOT have it — its assertions pin
placeholder-ness, never the count — so nothing needed loosening.

SPEC IMPACT: None. The Ceremony card, its `palette.ceremony` binding and the
slot→colour contract are all as specified in iteration 0010; this seeds data
into them. No decision changed.
