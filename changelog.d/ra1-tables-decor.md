## 2026-09-07 · feat(moodboard): the guest tables get generated artwork, all five families

`tables` becomes the fourth of `renderVenueSvg`'s thirteen zones to carry generated decor,
after `backdrop` + `ceiling` (MB14b) and `stage` (`20271211370331`). Migration
`20271211440288` seeds five `venue_scene` rows (`asset_subtype 'tables'`) with one measured
colour range each. Unlike the stage, this covers **every** one of the five original style
families — including `tropical heritage`, which the stage could not solve in four generations.

### Five keepers from five generations, and the reason is the composition

The stage's yield was 1 keeper per 2.25 generations. These are 1:1. The difference isn't prompt
wording — it's that **every stage failure needed a room to put the colour in.** Across four
attempts Recraft spent the sage seed on the wall, the floor or the riser and left the cloth
cream or mint. These five say *"no floor, no wall, no room, no horizon line"* and place the
tables in a horizontal band with empty margins, so there is no surface left to mis-paint.
`tropical heritage` landed first try.

That composition was chosen for a **rendering** reason (see the geometry note below) and the
yield improvement came free. ➡ **Prefer object-on-plain-background for every remaining zone** —
cheaper to generate *and* it composites correctly.

### The tolerances, measured with no area floor

| family | slot | tol | outside@tol | outside@tol+1 |
|---|---|---|---|---|
| elegant · simple · classic | `#C9A059` | 9 | 17 px | 77 px |
| bridgerton · regal | `#8C6BA6` | 8 | 6 px | **593 px** ← cliff |
| editorial cream | `#D98BA6` | 7 | 28 px | 34 px |
| tropical heritage | `#9CB29A` | 5 | 4 px | **351 px** ← cliff |
| modern minimalist | `#4A3B45` | 6 | 28 px | 43 px |

Each is the largest integer at which the outside count stays under 0.02% of the opaque area
(31 px) — a measured antialiasing allowance where a chair leg or plate rim crosses the cloth's
edge. Nothing widened, CHECK untouched. **Two of the five sit on a cliff and three do not**, and
the guard asserts a boundary only for the two that have one rather than inventing three.

### 🪤 The geometry is the unusual part

`tables` is not one object: `renderVenueSvg` draws **four** at `(150,520,r60) (810,520,r60)
(240,432,r44) (720,432,r44)`, scattered with the aisle between them, and `DECOR_SLOTS` takes one
rect per zone. A single 88..872 × 386..586 rect works **only because `tables` is also a scene
zone** — its background is knocked out first, so the floor, the aisle runner and the dance floor
show through between the tables. Composited opaque, that rect would blank the entire lower half
of the couple's room.

### A measurement correction carried forward

Building the object mask from **exact** slot matches only — which worked on the stage's flat
panels — reports "no clean tolerance at all" on these five, because a cloth's own antialiased
interior then lands outside the mask and every tolerance looks like a bleed. The mask is built
from pixels within 3 of the slot instead. Recorded in the test, since the next zone will hit it.

Six guard cases in `reception-decor-layers.test.ts`; **five sabotages, five red** — tropical
5→6 and bridgerton 8→9 (each over its cliff), `tables` dropped from `SCENE_DECOR_ZONES`, the
`DECOR_SLOTS` geometry removed, and a tolerance flattened to the floor. Judged on rendered rooms,
not fill-swap simulations.

SPEC IMPACT: None. Extends the decor-layer coverage by one zone using the recipe in
`build-sessions/RECEPTION-ART-PLAN.md`; prompts recorded in
`apps/web/scripts/reception-decor-pilot-prompts.ts`.
