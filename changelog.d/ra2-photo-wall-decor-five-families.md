## 2026-09-07 · feat(moodboard): the photo wall gets its drawings, all five families

`photo_wall` becomes the eighth of `renderVenueSvg`'s thirteen zones to carry
generated artwork — and **the first PANEL zone since the pilot pair**.

Every zone added since `stage` (`tables`, `feast`) is a SCENE zone: an object
standing in a room, whose foreign background is knocked out before compositing.
`photo_wall` is not. Like `backdrop` and `ceiling` its drawing FILLS its rect and
the ground between its blooms IS the wall, so it is deliberately absent from
`SCENE_DECOR_ZONES` — knocking it out would punch holes through the couple's
photo wall to the room behind it, with the SVG bytes on disk completely
unchanged. The existing "no panel drawing is ever knocked out" guard is extended
to cover it, and adding it to `SCENE_DECOR_ZONES` turns three tests red.

The prompt shape differs for the same reason: `4:5` portrait, "FILLING THE ENTIRE
FRAME edge to edge with no border and no margin", rather than the scene zones'
16:9 object on a plain field with empty margins.

**Yield: 5 keepers / 6 generations (1 per 1.2).** Tolerances: elegant 6 ·
bridgerton 8 · editorial cream 30 · tropical 20 · modern minimalist 30. Budget is
42 px (0.02% of 210,080 — larger than the scene zones' 31 because a 4:5 raster
letterboxes less of the 520px square).

**Two sit at the CHECK ceiling of 30 and the guard says why.** `editorial cream`
and `modern minimalist` are near-monochrome walls whose nearest neighbour is 4.78
(its own edge) and **70.07** — the widest margin measured this session — so there
is nothing for a wider tolerance to reach and the measurement runs clean to 30
and stops because the CHECK stops it. They are bounded by the CHECK, not by a
cliff, and the guard asserts that reason rather than inventing a boundary.

**🔎 Finding: "one flat colour" is heard as *per shape*, not *across the wall*.**
`elegant`'s first generation looked right and measured unseedable — 545 px
outside at the tightest legal tolerance. Diagnosed positionally rather than
argued about: 238 of those sit more than 6px from any tagged pixel, scattered,
and every one is a near-duplicate gold the model used for a *subset of the
blooms*. A second tone of the same object, spatially disjoint from the first —
no tolerance reaches it without also reaching the ground, and no mask can call it
an edge. Re-generated with "EVERY SINGLE BLOOM IS THE EXACT SAME ONE GOLD … no
tonal variation of any kind between one flower and another".

**Finding 3 twice more:** `editorial cream` came back `#F75B74` rather than the
`#D98BA6` blush passed in `colors`, and `elegant` `#EE8827` rather than `#C9A059`.
Both seeded from the pixels. Across this session the seed has been wrong on 4 of
20 files.

Five sabotages run, five red — including adding `photo_wall` to
`SCENE_DECOR_ZONES`, which is the failure this zone's whole shape guards against.

SPEC IMPACT: None. `reception_design` is unchanged; this seeds artwork rows and
switches an existing zone on.
