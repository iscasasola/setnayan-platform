-- ============================================================================
-- 20271212927845_ra2_walls_decor_five_families.sql
-- RA2 · PART B · THE SIDE WALLS GET THEIR DRAWINGS — ALL FIVE FAMILIES.
--
-- `walls` becomes the ninth of `renderVenueSvg`'s thirteen zones to carry
-- generated artwork, after `backdrop` + `ceiling` (MB14b), `stage`, `tables`,
-- `feast`, `program`, `booths` and `photo_wall`.
--
-- 🔑 AND IT IS THE FIRST ZONE THAT OCCUPIES MORE THAN ONE BOX. Every decor zone
-- before it is one contiguous rect; `wallsDecorLayer` draws TWO 56-wide bands,
-- one down each edge of the room, with the backdrop, the stage and the couple
-- between them. A single rect spanning both would paint over all of it. So
-- `DECOR_SLOTS` values become "a rect OR an array of rects", and the same
-- drawing is composited into each band — which is exactly what the flat layer
-- already does with its two bands.
--
-- ⚠ THE SINGLE-RECT OUTPUT IS UNCHANGED, BYTE FOR BYTE, AND THAT IS ASSERTED.
-- `decorImage` keeps the clip id `decor-<zone>` for the FIRST box, so every zone
-- that has one box emits exactly the markup it emitted before this type existed.
-- A one-element array and a bare rect are deliberately NOT interchangeable in
-- the source; making them so would silently change eight zones' bytes.
--
-- ── THE FIVE FILES, WITH THEIR HASHES ───────────────────────────────────────
-- Recraft V4.1 vectors (`model_type: 'vector'`, `resolution: '2k'`,
-- `aspect_ratio: '9:16'` — the first PORTRAIT-TALL sources in the feature, for
-- a band that is 56 wide and 372 high), served from
-- `apps/web/public/moodboard-seed/`.
--
--   sha256                                                            bytes  file
--   d461cb4f7b403fcd593cfdb76de6ec1aa3b5f4ffc1d5fb6d6b0881ecc73dcb0f   89541  bridgerton-regal.svg
--   8b1fb459bd6a85ef7ab65b54597e118da22dcc224e4e4c7c0d06f61c358325e4   16165  editorial-cream.svg
--   4d4ea5d43fd436142aeffc86ea8846e9e4f558a0d6ae4496d169549e4bfdd312   19486  elegant-simple-classic.svg
--   65cb426a4ad8ade80c7fa1da5e2f662a632c8fdd76b6db04f276a0de34c168e9   18125  modern-minimalist.svg
--   047b351480956b3577a5dfcc932993485f62f18713a12474932248caf5041c58   79713  tropical-heritage.svg
--
-- ── YIELD: 5 KEEPERS / 5 GENERATIONS ────────────────────────────────────────
-- A 1:1 round, the second of the session after `tables`. Every lesson this
-- session paid for was in the first prompt: object-on-plain-background is
-- inverted to full-bleed (a panel, not a scene), warm-cream neutrals, "no
-- tonal variation of any kind from one fold to the next", and one colour in
-- `colors`. Prompts in `apps/web/scripts/reception-decor-pilot-prompts.ts`.
--
-- ── THE TOLERANCES, MEASURED WITH NO AREA FLOOR ─────────────────────────────
-- Rasterised at the component's own MAX_PREVIEW_PX (520) with `sharp`
-- (`fit: 'contain'`), pushed through the REAL `recolorRGBA` against four
-- unrelated targets (#7A1F2B, #D4AF37, #0F766E, #1E3A8A), counting every opaque
-- pixel that changes OUTSIDE a 2px dilation of the tagged drape.
--
--   family                       slot      tol   nearest neutral   outside@tol   bounded by
--   elegant · simple · classic   #C9A059    15        5.89              23 px      the budget
--   bridgerton · regal           #5643A0    30       42.60               0 px      the CHECK
--   editorial cream              #D98BA6    30       22.02               4 px      the CHECK
--   tropical heritage            #519374    30        4.06 (own edge)     9 px      the CHECK
--   modern minimalist            #4A3B45    30       70.07               0 px      the CHECK
--
-- ⚠ FOUR OF THE FIVE SIT AT THE CHECK CEILING OF 30, WHICH IS UNUSUAL AND IS
-- EXPLAINED RATHER THAN GLOSSED. These are near-monochrome full-bleed panels:
-- one fabric or one leaf colour over 55–70% of the frame, a cream ground, and
-- nothing in between. Their nearest neighbours are 42.60, 22.02, 4.06 (its own
-- antialiased edge) and 70.07 — so there is nothing a wider tolerance can reach,
-- the measurement runs clean all the way to 30, and it stops there only because
-- the table's CHECK stops it. NONE of the four is bounded by a cliff, and the
-- guard asserts that reason instead of inventing a boundary. `elegant` is the
-- one file with a real neighbour close enough to bound it (5.89) and it is
-- seeded at 15 accordingly.
--
-- 🪤 TWO SAMPLED HEXES ARE AGAIN NOT THE HEX THAT WAS ASKED FOR — `bridgerton`
-- came back `#5643A0` rather than `#8C6BA6`, and `tropical` `#519374` rather
-- than `#9CB29A`. Re-sampled off the pixels, like every slot in this feature.
-- Across the session the seed has been wrong on 6 of 25 files.
--
-- ── 🪤 THE GATE, IN ITS THIRD SHAPE ─────────────────────────────────────────
-- `feast` shipped with its image gated on "did the flat layer draw anything",
-- and a couple with plated service got a buffet they never chose. `walls` has
-- the same trap wearing different clothes: the treatment `uplighting_only` is
-- spelled in the taxonomy as one of the TWO options meaning "no wall dressing"
-- (`bare` is the other) — but it DRAWS, four ellipses per band. Gating on "did
-- the flat layer draw anything" would hand a generated fabric drape to a couple
-- who explicitly said their walls are undressed.
--
-- So the gate is the three treatments that actually dress a wall —
-- `fabric_drape`, `floral_garland`, `greenery_wall` — and the uplighting is
-- drawn OVER the image, because a couple who ticked both a drape and uplighting
-- chose both.
--
-- ── WIRING ──────────────────────────────────────────────────────────────────
--   1. `PILOT_DECOR_ZONES`  — the resolver will look for an asset
--   2. `DECOR_SLOTS`        — the geometry ("the geometry IS the permission")
--   3. a `decorImage(zone, decor) ??` call site in `renderVenueSvg`
-- `SCENE_DECOR_ZONES` gets NOTHING: a wall drawing FILLS its band and its ground
-- IS the wall, so knocking it out makes the couple's side walls see-through.
--
-- Cross-references:
--   * 20271213232572 — `photo_wall`, the other panel zone added this session
--   * build-sessions/RECEPTION-ART-PLAN.md — Part 2, the measurement procedure
--   * apps/web/lib/color-recolor.ts — `colorDistance`, the metric above
--
-- Idempotent: every INSERT is gated on `WHERE NOT EXISTS` keyed on the row's own
-- `storage_path` (assets) and `(asset_id, slot_id)` (ranges).
-- ============================================================================

BEGIN;

INSERT INTO public.moodboard_library_assets
  (asset_type, asset_subtype, label, storage_path, source, style_theme, approved_at)
SELECT 'venue_scene', 'walls', v.label, v.path, 'higgsfield_generated', v.style_theme, NOW()
  FROM (VALUES
    ('Side walls · Elegant · Simple · Classic (Recraft V4.1 vector)',
     '/moodboard-seed/venue_scene/walls/elegant-simple-classic.svg', 'elegant · simple · classic'),
    ('Side walls · Bridgerton · Regal (Recraft V4.1 vector)',
     '/moodboard-seed/venue_scene/walls/bridgerton-regal.svg', 'bridgerton · regal'),
    ('Side walls · Editorial Cream (Recraft V4.1 vector)',
     '/moodboard-seed/venue_scene/walls/editorial-cream.svg', 'editorial cream'),
    ('Side walls · Tropical Heritage (Recraft V4.1 vector)',
     '/moodboard-seed/venue_scene/walls/tropical-heritage.svg', 'tropical heritage'),
    ('Side walls · Modern Minimalist (Recraft V4.1 vector)',
     '/moodboard-seed/venue_scene/walls/modern-minimalist.svg', 'modern minimalist')
  ) AS v(label, path, style_theme)
 WHERE NOT EXISTS (
   SELECT 1 FROM public.moodboard_library_assets a WHERE a.storage_path = v.path
 );

-- One measured range each, slot 1 — the couple's FIRST reception colour,
-- matching every other decor zone. Each drawing has exactly one isolable
-- dominant region: the drape, or the greenery.
INSERT INTO public.moodboard_asset_color_ranges
  (asset_id, slot_id, sampled_hex, tolerance_de, region_label)
SELECT a.asset_id, 1::SMALLINT, v.sampled_hex, v.tolerance_de, 'draped fabric'
  FROM (VALUES
    ('/moodboard-seed/venue_scene/walls/elegant-simple-classic.svg', '#C9A059', 15::NUMERIC),
    ('/moodboard-seed/venue_scene/walls/bridgerton-regal.svg',       '#5643A0', 30::NUMERIC),
    ('/moodboard-seed/venue_scene/walls/editorial-cream.svg',        '#D98BA6', 30::NUMERIC),
    ('/moodboard-seed/venue_scene/walls/tropical-heritage.svg',      '#519374', 30::NUMERIC),
    ('/moodboard-seed/venue_scene/walls/modern-minimalist.svg',      '#4A3B45', 30::NUMERIC)
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
     AND asset_subtype = 'walls'
     AND storage_path ~ '^/moodboard-seed/venue_scene/walls/[a-z0-9-]+\.svg$'
     AND approved_at IS NOT NULL
     AND retired_at IS NULL;

  IF n_assets <> 5 THEN
    SELECT string_agg(storage_path, ', ' ORDER BY storage_path) INTO bad
      FROM public.moodboard_library_assets
     WHERE asset_type = 'venue_scene' AND asset_subtype = 'walls';
    RAISE EXCEPTION
      'RA2: expected exactly 5 live app-served venue_scene walls rows, found %. Paths are: %.',
      n_assets, COALESCE(bad, '(none)');
  END IF;

  SELECT count(*) INTO n_ranges
    FROM public.moodboard_asset_color_ranges c
    JOIN public.moodboard_library_assets a ON a.asset_id = c.asset_id
   WHERE a.asset_type = 'venue_scene' AND a.asset_subtype = 'walls';

  IF n_ranges <> 5 THEN
    RAISE EXCEPTION
      'RA2: expected exactly 5 colour ranges across the side-wall drawings (slot 1 each), '
      'found %. A second range on one of these files is a region nobody measured.',
      n_ranges;
  END IF;
END $$;

COMMIT;
