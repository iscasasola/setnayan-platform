-- ============================================================================
-- 20271213232572_ra2_photo_wall_decor_five_families.sql
-- RA2 · PART B · THE PHOTO WALL GETS ITS DRAWINGS — ALL FIVE FAMILIES.
--
-- `photo_wall` becomes the eighth of `renderVenueSvg`'s thirteen zones to carry
-- generated artwork, after `backdrop` + `ceiling` (MB14b), `stage`
-- (`20271211370331`), `tables` (`20271211440288`), `feast` (`20271212409881`),
-- `program` (`20271212747087`) and `booths` (`20271212913454`).
--
-- 🔑 AND IT IS THE FIRST PANEL ZONE SINCE THE PILOT PAIR. Every zone added
-- since `stage` has been a SCENE zone — an object standing in a room, whose
-- background is knocked out before compositing. `photo_wall` is not: like
-- `backdrop` and `ceiling` its drawing FILLS its rect, and its ground between
-- the blooms IS the wall. It is therefore deliberately ABSENT from
-- `SCENE_DECOR_ZONES`, and the existing "no panel drawing is ever knocked out"
-- guard is extended to cover it — knocking this one out would punch holes
-- through the couple's photo wall to the room behind it.
--
-- ── THE FIVE FILES, WITH THEIR HASHES ───────────────────────────────────────
-- Recraft V4.1 vectors (`model_type: 'vector'`, `resolution: '2k'`,
-- `aspect_ratio: '4:5'` — a PANEL, so portrait and full-bleed, not the 16:9
-- object-on-a-field the scene zones use), served from
-- `apps/web/public/moodboard-seed/`. Shipped as generated, not run through an
-- optimiser: an optimiser that merges fills is exactly the hazard the colour
-- guard exists to catch.
--
--   sha256                                                            bytes  file
--   fbd0cc3ed2b6266f359455274cf372c9828af196ae7935b4c916a1729d201964  724166  bridgerton-regal.svg
--   81b522225365058c8530143d66d63cd2f4a884e2284a3170a533d1c0f5fc7389  182996  editorial-cream.svg
--   7b34e8778ce746927da5bc0ce10d077fcec4b14a6734c6037da0b9e522dde20b  457076  elegant-simple-classic.svg
--   438dde0e8af11ab4a4f43f5c8a06f61dabc21724d2c6df110ee886c4bc229531   13134  modern-minimalist.svg
--   412b683f518ac6be2d341c757129d16b7262d681fb708822bcdfc055d1d612c6  117674  tropical-heritage.svg
--
-- ── YIELD: 5 KEEPERS / 6 GENERATIONS (1 per 1.2) ────────────────────────────
-- The warm-cream-neutrals lever from `booths` was in the FIRST prompt for every
-- family here, and four of the five landed first time. Prompts in
-- `apps/web/scripts/reception-decor-pilot-prompts.ts`.
--
-- ── THE TOLERANCES, MEASURED WITH NO AREA FLOOR ─────────────────────────────
-- Rasterised at the component's own MAX_PREVIEW_PX (520) with `sharp`
-- (`fit: 'contain'`), pushed through the REAL `recolorRGBA` against four
-- unrelated targets (#7A1F2B, #D4AF37, #0F766E, #1E3A8A), counting every opaque
-- pixel that changes OUTSIDE a 2px dilation of the tagged wall.
--
--   family                       slot      tol   nearest neutral   outside@tol   bounded by
--   elegant · simple · classic   #EE8827     6        3.02 (own edge)   42 px      the budget
--   bridgerton · regal           #8C6BA6     8        5.25             22 px      the budget
--   editorial cream              #F75B74    30        4.78 (own edge)    4 px      the CHECK
--   tropical heritage            #9CB29A    20       12.02              4 px      a cliff (5416 @21)
--   modern minimalist            #4A3B45    30       70.07              0 px      the CHECK
--
-- The budget is 0.02% of the opaque area — 42 px of 210,080 here, larger than
-- the scene zones' 31 because a 4:5 raster letterboxes less of the 520px square.
--
-- ⚠ TWO OF THESE SIT AT THE CHECK CEILING OF 30 AND THAT IS STATED PLAINLY.
-- `editorial cream` and `modern minimalist` are near-monochrome walls: their
-- nearest neutral is 4.78 (its own antialiased edge) and 70.07 respectively, so
-- there is simply nothing in the picture for a wider tolerance to reach, and the
-- measurement runs clean all the way to 30 and stops there because the CHECK
-- stops it. They are bounded by the CHECK, not by a cliff, and the guard says so
-- instead of asserting a boundary that does not exist. `modern minimalist`'s
-- 70.07 is the widest margin measured anywhere in this session.
--
-- 🪤 TWO SAMPLED HEXES ARE NOT THE HEX THAT WAS ASKED FOR — finding 3, twice
-- more. `editorial cream` came back a hot `#F75B74` rather than the `#D98BA6`
-- blush passed in `colors`, and `elegant` a bright `#EE8827` rather than
-- `#C9A059` gold. Both are re-sampled off the pixels, as every slot in this
-- feature is. The seed is a hint; the file is the fact.
--
-- ── 🔎 THE REJECT THAT MADE `elegant` TAKE TWO ROUNDS ────────────────────────
-- Its first generation looked right and measured UNSEEDABLE: 545 px outside the
-- tagged region at the tightest legal tolerance. Diagnosed positionally rather
-- than argued about — 238 of those pixels sit MORE THAN 6px from any tagged
-- pixel, scattered across the frame, and every one of them is a near-duplicate
-- gold (`#CFAB6D`, 4.4 away) the model used for a subset of the blooms. A second
-- tone of the same object, spatially disjoint from the first: no tolerance can
-- include it without also reaching the ground, and no mask can call it an edge.
-- Re-generated with "EVERY SINGLE BLOOM IS THE EXACT SAME ONE GOLD … no tonal
-- variation of any kind between one flower and another", and it landed.
-- ➡ For a repeating-motif wall, say the motifs must not vary from each other.
--   "One flat colour" is heard as "per shape", not "across the wall".
--
-- ── WIRING ──────────────────────────────────────────────────────────────────
-- Rows alone are dead, and a zone needs THREE permissions, not one:
--   1. `PILOT_DECOR_ZONES`  — the resolver will look for an asset
--   2. `DECOR_SLOTS`        — the geometry ("the geometry IS the permission")
--   3. a `decorImage(zone, decor) ??` call site in `renderVenueSvg`
-- Missing 2 or 3 is invisible: no error, no null, no log. All three land here.
-- `SCENE_DECOR_ZONES` gets NOTHING, deliberately — see the note at the top.
--
-- The geometry is the flat panel's own rect, `rx` included: 786,92 130x108 rx 8.
-- Unlike every scene zone so far there is no judgement in it, because a panel
-- drawing fills exactly the box the flat drawing already occupies.
--
-- 🔑 AND THE IMAGE ONLY DRAWS WHEN THE COUPLE CHOSE A PHOTO WALL. Every style
-- but `none` draws a panel; `none` draws nothing, and a couple who chose nothing
-- must not be handed a generated flower wall. `photo_wall` has ONE attribute, so
-- unlike `feast` and `program` there is no second object to lose — the gate is
-- simply "did the flat layer draw anything".
--
-- Cross-references:
--   * 20271212913454 — `booths`, and the warm-cream-neutrals lever used here
--   * build-sessions/RECEPTION-ART-PLAN.md — Part 2, the measurement procedure
--   * apps/web/lib/color-recolor.ts — `colorDistance`, the metric above
--
-- Idempotent: every INSERT is gated on `WHERE NOT EXISTS` keyed on the row's own
-- `storage_path` (assets) and `(asset_id, slot_id)` (ranges), so a re-Apply is a
-- no-op and the count guard passes on the second run exactly as on the first.
-- ============================================================================

BEGIN;

INSERT INTO public.moodboard_library_assets
  (asset_type, asset_subtype, label, storage_path, source, style_theme, approved_at)
SELECT 'venue_scene', 'photo_wall', v.label, v.path, 'higgsfield_generated', v.style_theme, NOW()
  FROM (VALUES
    ('Photo wall · Elegant · Simple · Classic (Recraft V4.1 vector)',
     '/moodboard-seed/venue_scene/photo_wall/elegant-simple-classic.svg', 'elegant · simple · classic'),
    ('Photo wall · Bridgerton · Regal (Recraft V4.1 vector)',
     '/moodboard-seed/venue_scene/photo_wall/bridgerton-regal.svg', 'bridgerton · regal'),
    ('Photo wall · Editorial Cream (Recraft V4.1 vector)',
     '/moodboard-seed/venue_scene/photo_wall/editorial-cream.svg', 'editorial cream'),
    ('Photo wall · Tropical Heritage (Recraft V4.1 vector)',
     '/moodboard-seed/venue_scene/photo_wall/tropical-heritage.svg', 'tropical heritage'),
    ('Photo wall · Modern Minimalist (Recraft V4.1 vector)',
     '/moodboard-seed/venue_scene/photo_wall/modern-minimalist.svg', 'modern minimalist')
  ) AS v(label, path, style_theme)
 WHERE NOT EXISTS (
   SELECT 1 FROM public.moodboard_library_assets a WHERE a.storage_path = v.path
 );

-- One measured range each, slot 1 — the couple's FIRST reception colour
-- (`moodboard-board.tsx` maps slot N to `palette[(N-1) % length]`), matching
-- every other decor zone. Each drawing has exactly one isolable dominant
-- region: the wall's blooms, leaves or tiles.
INSERT INTO public.moodboard_asset_color_ranges
  (asset_id, slot_id, sampled_hex, tolerance_de, region_label)
SELECT a.asset_id, 1::SMALLINT, v.sampled_hex, v.tolerance_de, 'wall face'
  FROM (VALUES
    ('/moodboard-seed/venue_scene/photo_wall/elegant-simple-classic.svg', '#EE8827',  6::NUMERIC),
    ('/moodboard-seed/venue_scene/photo_wall/bridgerton-regal.svg',       '#8C6BA6',  8::NUMERIC),
    ('/moodboard-seed/venue_scene/photo_wall/editorial-cream.svg',        '#F75B74', 30::NUMERIC),
    ('/moodboard-seed/venue_scene/photo_wall/tropical-heritage.svg',      '#9CB29A', 20::NUMERIC),
    ('/moodboard-seed/venue_scene/photo_wall/modern-minimalist.svg',      '#4A3B45', 30::NUMERIC)
  ) AS v(path, sampled_hex, tolerance_de)
  JOIN public.moodboard_library_assets a ON a.storage_path = v.path
 WHERE NOT EXISTS (
   SELECT 1 FROM public.moodboard_asset_color_ranges c
    WHERE c.asset_id = a.asset_id AND c.slot_id = 1
 );

-- ── the count guard ─────────────────────────────────────────────────────────
DO $$
DECLARE
  n_assets int;
  n_ranges int;
  bad      text;
BEGIN
  SELECT count(*) INTO n_assets
    FROM public.moodboard_library_assets
   WHERE asset_type = 'venue_scene'
     AND asset_subtype = 'photo_wall'
     AND storage_path ~ '^/moodboard-seed/venue_scene/photo_wall/[a-z0-9-]+\.svg$'
     AND approved_at IS NOT NULL
     AND retired_at IS NULL;

  IF n_assets <> 5 THEN
    SELECT string_agg(storage_path, ', ' ORDER BY storage_path) INTO bad
      FROM public.moodboard_library_assets
     WHERE asset_type = 'venue_scene' AND asset_subtype = 'photo_wall';
    RAISE EXCEPTION
      'RA2: expected exactly 5 live app-served venue_scene photo_wall rows, found %. Paths are: %.',
      n_assets, COALESCE(bad, '(none)');
  END IF;

  -- One range each. An asset with no range is skipped entirely by
  -- fetchDecorLayerCatalog (`if (!slot1) continue`), so the cell silently falls
  -- back to the flat SVG and nobody is told the drawing is unreachable.
  SELECT count(*) INTO n_ranges
    FROM public.moodboard_asset_color_ranges c
    JOIN public.moodboard_library_assets a ON a.asset_id = c.asset_id
   WHERE a.asset_type = 'venue_scene' AND a.asset_subtype = 'photo_wall';

  IF n_ranges <> 5 THEN
    RAISE EXCEPTION
      'RA2: expected exactly 5 colour ranges across the photo-wall drawings (slot 1 each), '
      'found %. A second range on one of these files is a region nobody measured.',
      n_ranges;
  END IF;
END $$;

COMMIT;
