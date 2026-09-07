## 2026-09-07 · feat(moodboard): the feast line gets generated artwork, all five families

`feast` becomes the fifth of `renderVenueSvg`'s thirteen zones to carry generated decor, after
`backdrop` + `ceiling` (MB14b), `stage` (`20271211370331`) and `tables` (`20271211440288`).
Migration `20271212409881` seeds five `venue_scene` rows with one measured range each — five of
five families again, on the object-on-plain-background composition the guest tables established.

### Tolerances, measured with no area floor

| family | slot | tol | outside@tol | outside@tol+1 |
|---|---|---|---|---|
| elegant · simple · classic | `#C9A059` | 8 | 8 px | **52** ← cliff |
| bridgerton · regal | `#8C6BA6` | 8 | 11 px | **411** ← cliff |
| editorial cream | `#D98BA6` | 10 | 18 px | 39 px |
| tropical heritage | `#9CB29A` | 5 | 0 px | **132** ← cliff |
| modern minimalist | `#4A3B45` | 5 | 26 px | 55 px |

Largest integer at which the outside count stays under 0.02% of the opaque area (31 px), the
same measured antialiasing allowance the guest tables use. Nothing widened, CHECK untouched.
**Three of five sit on a cliff and two do not** — a different split from the tables' two-of-five,
which is why each zone carries its own map rather than a shared rule.

### 🔑 The finding: a wrongly-coloured object INSIDE the tagged region is invisible

`tropical heritage` is the **second generation** of its cell, and the first one **measured
clean**. Its v1 drew the food on the platters in the same sage as the tablecloth, so every mound
and bowl recoloured with it — a burgundy palette gave a table of burgundy food.

**No assertion in this recipe could see it.** The food is *inside* the tagged region, so
"nothing outside the cloth moved" was true, the region recoloured completely, and the tolerance
measured clean at 5. Every guard was green and the picture was wrong. Caught by rendering the
room and looking at it; fixed by regenerating with the food's colours named explicitly. The
replacement measures identically.

➡ **Generalise for the remaining six zones:** the pixel guards catch neutrals wearing the
palette. They cannot catch the tagged region *containing* something that shouldn't wear it.
Only the render does.

### 🪤 `feast` is a `FloorItem`, so the wiring differs

`stage` and `backdrop` are plain layers. `feast` returns `{ anchorY, svg }` and is depth-sorted
against the guest tables by `compositeFloorItems` (RV3, #5281). The substitution happens *inside*
`feastFloorItem`, on the `svg` field only:

- `anchorY` stays **computed** from the flat geometry — an image must not change where the thing
  stands in the room.
- the `return null` check stays on the **flat** svg, so a couple who chose no service and no
  stations still gets nothing drawn. **A decor image replaces what the couple chose; it must
  never invent a feast in a room that was not meant to have one.**

### Also fixed: a stale guard that failed for the wrong reason

`MB14b: only the two pilot zones can composite` probes each zone for a `decor-<zone>` clip. Its
candidate list was **hardcoded** and omitted `feast`, so when the zone gained a slot the test
failed not because the two lists had drifted but because the probe never asked. Derived from
`RECEPTION_PARTS` now, so the next zone is covered without editing a string — and the probe
design gains a feast service, since a `FloorItem` with nothing chosen returns null and a probe
without one cannot tell "no geometry" from "nothing to draw". `MB14B_DESIGN` itself is untouched;
the byte-identity hashes measure against it.

Six new guard cases; **four sabotages, four red** — tropical 5→6 (over its cliff), `feast`
dropped from `SCENE_DECOR_ZONES`, the `DECOR_SLOTS` geometry removed, and the null check moved
onto the image. 6 generations for 5 keepers.

SPEC IMPACT: None. Extends decor coverage by one zone using the recipe in
`build-sessions/RECEPTION-ART-PLAN.md`; prompts recorded in
`apps/web/scripts/reception-decor-pilot-prompts.ts`.
