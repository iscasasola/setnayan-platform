# RA1 — the stage gets its drawings, then every reception zone does

**Model · effort: Opus · high.** Pixel measurement in the engine's metric across up to 49 files,
one migration per zone, and the same guard framework as MB14b/MB28. The generation itself is
mechanical; the measurement is where every session before this one paid.

**Owner ruling 2026-09-06 (Q10, confirmed to oversight): ship the four stage keepers now, then
bring all nine reception zones to that fidelity on the measured recipe** — about 101 generations,
roughly 63 credits — judged on real recolours, never on fill swaps.

## Read first, in this order

1. `build-sessions/RECEPTION-ART-PLAN.md` — the recipe (generation, measurement, wiring, sequence,
   pilot result, and the four findings that changed the recipe). **Do not re-derive it.**
2. `build-sessions/assets/ra1/stage/MANIFEST.md` — the four stage keepers, recovered by oversight
   from the Higgsfield generation history **because the pilot session left no files on disk**
   ("staged" was a claim). Job ids, sha256, the pilot's slot hex + tolerance, and oversight's
   engine-metric recheck of the nearest neutral.
3. `apps/web/scripts/reception-decor-pilot-prompts.ts` — the prompt record. Extend it with every
   prompt you run so the next session has yours.

## Part A · Ship the stage (4 of 5 families)

1. Copy the four keepers byte-for-byte to
   `apps/web/public/moodboard-seed/venue_scene/stage/<family-slug>.svg`; hashes in the migration
   header must match the manifest.
2. **Re-measure every tolerance through the real `recolorRGBA` at `MAX_PREVIEW_PX`** (plan Part 2,
   steps 1–5): largest tolerance at which no neutral moves, and the region moves COMPLETELY
   (the `farthestTone` check — the pilot's finding 1). The pilot's numbers are a starting point,
   not a seed. Any slot whose nearest neutral is < 5 in the engine metric is unseedable: re-cut or
   ship without it; never widen, never touch the table CHECK.
3. Migration: four `venue_scene` rows, `asset_subtype 'stage'`, `style_theme` = the family,
   approved, idempotent on `storage_path`; one range each; `DO $$ … RAISE` if the live stage count
   is not 4. Add `'stage'` to `PILOT_DECOR_ZONES` in `lib/reception-decor-layers.ts` — without it
   the rows are dead (plan Part 3 · 2). Bridgerton stays flat SVG, byte-identical (MB14b's
   invariant; its guard already covers uncovered cells — cite it, extend if the zone list is pinned).
4. Extend `the-background-never-wears-the-palette.test.ts` with the four as one-slot real-raster
   cases: region moves in every tone, every neutral moves by nothing, no fringe. Sabotage: one
   tolerance +1 → red; restore a neutral to the slot colour → red; drop `'stage'` from the zone list
   → red (the rows go dead silently otherwise — assert bytes, per plan Part 3 · 5).
5. Render the room for a couple in each of the four families and LOOK (RV1's lesson). Screenshot.

**Open the stage PR and enable auto-merge before starting Part B.** Part B is a separate PR per
zone; a single 45-cell PR is unreviewable and blocks nothing usefully.

## Part B · The remaining eight zones, one PR each, in the plan's order

`tables` → `feast` · `program` · `booths` → `walls` · `photo_wall` → `tunnel` · `welcome_signage`.

Per zone: 5 cells, one `generate_image_batch` call (cap 12), **tag a draped or flat-clad surface,
never ornate furniture** (pilot finding 4), pass ONE colour in `colors` plus the background and
name the neutral palette in words (finding 3), re-sample pixels never the seed, judge on a real
recolour through `recolorRGBA`, look at every keeper, re-run the failing cells at most twice.
**Stop rule (plan Part 4):** worse than 1 keeper per 4 generations on a zone → stop that zone,
ship what passed, report the number. Every zone ships with whatever families passed; uncovered
cells render flat, byte-identical.

Budget guidance, not a cap: ~101 generations ≈ 63 credits total. Report the actual count per
zone; the plan's whole purpose is to replace borrowed numbers with measured ones.

## Also fix

`bridgerton · regal` on the stage: one more attempt with finding 3's cheap test (one colour, or
none, and the neutral palette named). If it lands, include it in Part A; if not, say so and stop.

## Out of lane

`people` and `entrance` (not artwork zones). The ceremony scenes (MB28). The 3D room. RV2's
suggestion chips. Any tolerance or CHECK widening, ever.

## Report

Per PR: the four lines in `MB-OVERSIGHT.md`, the hashes, the seeded tolerances with the nearest
neutral each was measured against, the generation count and keeper count for the zone, and one
rendered room per shipped family.
