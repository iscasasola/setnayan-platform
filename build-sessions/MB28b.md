# MB28b — the beach drapes take the couple's colour

**Model · effort: Sonnet · high.** One re-cut file (done), one migration adding one colour range,
one guard case extended from one slot to two. The guard framework is MB28's; nothing new in shape.

## Why

MB28 (PR #5233) shipped the beach ceremony with **slot 1 only**: its driftwood arch was filled
`rgb(221,214,200)`, **3.536 from the fabric slot in the engine's own metric**
(`colorDistance` in `lib/color-recolor.ts` — weighted RGB, not CIELAB), and the table CHECK
`tolerance_de BETWEEN 5 AND 30` makes 5 the tightest legal value. At 5, all driftwood pixels
turned the couple's second colour. The session correctly refused to seed a bleed and surfaced
the re-cut as an owner decision. **Owner: re-cut it** (the same call as the bride, MB24).

🔑 Oversight's simulated recolour was an **exact fill swap**, which structurally cannot show a
tolerance bleeding into a neighbouring colour; and oversight measured in CIELAB, which put the
driftwood at 11.9. **Measure in the engine's metric**, always.

## What oversight did (2026-09-06)

- Re-cut `build-sessions/assets/mb28/ceremony-beach.svg`: the 24 driftwood paths moved from
  `rgb(221,214,200)` to `rgb(172,168,160)`. Nothing else changed; an XML comment records why.
  The pre-re-cut file is beside it as `ceremony-beach.ORIGINAL-driftwood-3.5.svg`.
- sha256 of the re-cut: `d4e843bba1c457f798ced8936b3af55ff1d90c44850e495207ddfdad3ed2ee6e`.
- Engine-metric distances after the re-cut, every fill vs the fabric slot: driftwood **19.8**,
  sand 15.8, white 15.7, **sky `rgb(227,235,238)` 9.2 — the new nearest neutral.** So slot 2's
  tolerance must be **< 9**; seed **5** (legal minimum, 4.2 of margin, and what the church uses).
  Florals slot unchanged: nearest neutral 13.1, tolerance 10 stays.

## The build

1. Copy the re-cut byte-for-byte over `apps/web/public/moodboard-seed/venue_scene/beach/ceremony-aisle.svg`;
   record the sha256 in the migration header. The row's `storage_path` does not change.
2. Migration (`pnpm migration:new`, above `20271209362403`): `INSERT` the beach row's
   `slot_id 2, '#E8D9B5', tolerance 5, 'fabric'`, idempotent, with a `DO $$ … RAISE` if the beach
   row afterwards does not carry exactly two ranges. Verify the tolerance by pixel through the
   real `recolorRGBA` at `MAX_PREVIEW_PX`: drapes and sashes recolour; sky, sand, driftwood,
   chairs and sea move by nothing; no fringe grows.
3. Extend MB28's `the-background-never-wears-the-palette.test.ts`: the beach case goes from
   one slot to two, parsed from the migration like the other eight. Sabotage: tolerance 5 → 10
   (the sky should turn) → red; restore the old driftwood fill in the SVG → red (the arch turns);
   swap the two `sampled_hex` → red.
4. `attire-recolours-because-the-query-asks.test.ts` — if it pins "beach has one slot" anywhere,
   update that pin to two with the reason; do not delete it.

## Out of lane

The other eight scenes and their tolerances. The pick logic. The sky colour (leave it; 9.2 with a
tolerance of 5 is honest margin).

## Report

The four lines in `MB-OVERSIGHT.md`, the sha256, and a screenshot of a beach event in
burgundy + gold: gold drapes and sashes, burgundy flowers, grey driftwood, grey sand.
