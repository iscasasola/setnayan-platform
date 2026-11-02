## 2026-09-06 · fix(moodboard): three of the five live stage tolerances repaint the room

`20271211370331` (PR #5270, merged today) shipped the `stage` decor zone with five seeded
colour ranges. Three of them are too wide, and couples on those style families are getting
their palette on the wall panelling, the chair outlines and the plate rims — not only on the
tablecloth. `20271212320441` corrects them.

Measured on the SERVED files at the component's own `MAX_PREVIEW_PX` (520, `sharp`,
`fit: 'contain'`), through the real `recolorRGBA`, against four unrelated targets
(`#7A1F2B`, `#D4AF37`, `#0F766E`, `#1E3A8A`), counting every opaque pixel that changes outside
a 2px dilation of the tagged region:

| family | shipped | bleed at shipped | clean max | now |
|---|---|---|---|---|
| bridgerton · regal | 12 | **2572 px (1.67%)** | 8 | **8** |
| editorial cream | 15 | **628 px (0.41%)** | 12 | **12** |
| tropical heritage | 15 | **1480 px (0.96%)** | 1 | **range deleted** |
| elegant · simple · classic | 9 | 0 px | 9 | 9, unchanged |
| modern minimalist | 15 | 15 px (0.01%) | — | 15, unchanged |

No tolerance was widened and `tolerance_de BETWEEN 5 AND 30` was not touched.

**`tropical heritage` has no legal value at all.** Its nearest neutral — the chair and foliage
grey `#A7A99D` — is **3.60** away in the engine metric, below the CHECK floor of 5. And its
tablecloth is drawn in two tones, the skirt `#9CB29A` (tagged) and the tabletop plane
`#B0FED8`, 24.65 apart with the cream background at 20.48 *between* them, so no tolerance moves
the tabletop without repainting three quarters of the frame. Deleting the range makes
`fetchDecorLayerCatalog` skip the asset (`if (!slot1) continue`), so the cell falls back to the
flat stage layer — which does follow the couple's palette. The asset row stays approved and
un-retired so a later re-cut only has to re-seed a range.

### Why the guard that shipped with them could not see it

A census with a "fills ≥0.2% of the opaque area" floor. Every region these tolerances repaint
is hairline and none of them reaches 0.2%. The new section in
`the-background-never-wears-the-palette.test.ts` asks the spatial question instead — did any
opaque pixel change outside the tagged object? — and has **no area floor anywhere**. It also
pins the known-bad values (12 and 15) and asserts they still bleed, so the harness has to prove
it can see what it was written to catch.

**A hue filter is not a substitute**, and was measured failing in both directions on these same
five files: `modern minimalist`'s slot `#4A3B45` has HSL saturation `0.113`, so any near-grey
cutoff at 0.12 classifies the slot itself as off-hue and reports its own 77,650 correctly
recoloured pixels as a 50% bleed; and `elegant`'s cream background `#F3ECE0` sits at hue 37.9°
against a slot at 38.0°, so a >40° off-hue rule exempts it and reports a clean max of 30 for a
file whose real maximum is 9 — blessing a widening of the one tolerance that was already right.
Position is the honest test.

### Flagged, not fixed here

The stage drawings composite **opaque**, so each one paints a rectangle of its own cream room
over the floor and the wall behind the stage — visible in a rendered room, worst on
`modern minimalist` whose background is 48% of its frame. Unlike `backdrop` and `ceiling`,
which fill their zone, a stage drawing is a picture of a table standing in a room that
`renderVenueSvg` already draws. That is a separate change and is not bundled into a tolerance
correction.

SPEC IMPACT: None. Corrects seeded data from `20271211370331`; no locked decision changes.
