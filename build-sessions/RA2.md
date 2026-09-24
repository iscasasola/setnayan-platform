# RA2 — the photo wall, then the band, the booths and the walls

**Model · effort: Opus · high.** One zone on the existing recipe, then a small geometry extension
to the compositor, then three zones that need it. Every pixel rule from RA1's closing report
applies unchanged; the new risk is the one no pixel rule can see (see § The finding).

**Owner ruling 2026-09-07 (confirmed to oversight):** ship `photo_wall` now from the staged
generations; then extend the compositor so a zone can supply its real rectangle(s), and bring
`program` (the band riser), `booths` (each bay) and `walls` (both strips) to artwork. `tunnel`
and `welcome_signage` stay flat, by ruling. End state: 9 zones of 13.

## Read first, in this order

1. `MB-OVERSIGHT.md` → the **RA1 closing report** (the zone-geometry survey, the settled recipe,
   the four wiring permissions, and the finding below). It is the most exact description of the
   method as it stands; `RECEPTION-ART-PLAN.md` is older and partly superseded by it.
2. `build-sessions/assets/ra1/photo_wall/MANIFEST.md` — five generations, **unmeasured, unwired**,
   with job ids and hashes. Expect to reject some.
3. `lib/reception-decor-layers.ts` (`PILOT_DECOR_ZONES`, `decorImage`), `lib/reception-scene.ts`
   (`DECOR_SLOTS`, `SCENE_DECOR_ZONES`, `programFloorItem` and its "empty shelf" comment,
   `booth(...)` at `28 + i*96`, the two wall bands), `lib/reception-decor-layers.test.ts`.

## Part 1 · `photo_wall` (fixed rect `786,92,130×108`)

Run the full measurement on the five staged files: 520 px through the real `recolorRGBA`, no area
floor, object mask from pixels within 3 of the slot, 2 px dilation, outside budget 0.02 % of
opaque (31 px), largest integer tolerance that holds — AND render the room for each family and
LOOK for a wrongly-coloured object inside the tagged region (§ The finding). Seed only what passes
both. Migration idempotent on `storage_path` with a refusing DO block; all four wiring
permissions; guards extended; sabotages (one step over each cliff, zone dropped from the list,
slot geometry removed, a file deleted) red. Own PR, based on `origin/main`, auto-merge.

## Part 2 · The geometry extension (its own PR, no artwork)

Today `decorImage(zone, decor)` reads one static rect from `DECOR_SLOTS`. Extend it so a zone's
own layer function can pass a **rect override — one rect or a list of rects** — that refines the
static geometry: the static map stays the permission (a zone not in it never draws an image), the
override supplies the real extent(s). Rules:

- `program`: the override is the riser's real rect, `width = performers.length * 92 + 16`,
  computed where `programFloorItem` already computes it. A one-performer band gets a one-performer
  image; the empty-shelf defect cannot return. Guard: render with 1, 2 and 3 performers and assert
  the image's drawn width equals the riser's.
- `booths`: one override rect **per bay** (`28 + i*96`, 84×108), the same family image repeated;
  count follows the couple's booth count. Guard: 0, 1 and 3 booths render 0, 1 and 3 images.
- `walls`: two override rects, the left and right 56×372 bands, same image, mirrored on the right
  if the artwork is asymmetric (decide by looking; state it). Guard: both bands carry the image.
- `FloorItem` zones substitute on the `svg` field only; `anchorY` stays computed; the `return
  null` stays on the FLAT svg so an image never invents a band for a couple who booked none.
- **Byte-identity:** every room that has no override-using zone renders byte-identical before and
  after this PR. Pin it against `origin/main` at the sha you branched from.

## Part 3 · `program`, `booths`, `walls` — one PR each, on the recipe

Object on a plain empty background, *"no floor, no wall, no room, no horizon line"*; tag a draped
or flat-clad surface (the riser's clad face, a booth's counter skirt, a wall's fabric panel), never
performers, equipment or trim; one colour in `colors`, neutrals named in words, **and name the
colour of every object sitting on the tagged surface** (the clause added after the tropical feast).
Expect the band to need more than one round; stop a zone at worse than one keeper per four
generations and report the number.

## The finding that no pixel rule can see

RA1, feast tropical v1: measured perfectly clean — nothing outside the cloth moved, the region
recoloured completely — and the generator had drawn the FOOD in the cloth's colour, so a burgundy
palette produced a table of burgundy food. **A wrongly-coloured object inside the tagged region
is invisible to every assertion in the recipe. Only the render catches it.** For every keeper:
render the room in two palettes that are far apart (burgundy + gold, and a cool one) and look at
what changed; if anything that is not the tagged surface changed colour, the file is rejected, not
re-tolerated. Say in the report which files you rejected this way.

Also from RA1, now paid for three times: **a green sabotage is a claim about the probe before it
is a claim about the guard.** Three probes landed on cases that could not fail. Assert over the
whole population, never a representative.

## Out of lane

`tunnel` and `welcome_signage` (ruled flat). The ceremony scenes. Attire. The 3D room. Any
tolerance widening or CHECK change.

## Report

Per PR: the four lines in `MB-OVERSIGHT.md`, hashes, tolerances with nearest neutral, generation
and keeper counts, the files rejected by render, and one rendered room per family in two palettes.
