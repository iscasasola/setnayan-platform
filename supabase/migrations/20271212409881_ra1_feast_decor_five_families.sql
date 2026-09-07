-- ============================================================================
-- 20271212409881_ra1_feast_decor_five_families.sql
-- RA1 · PART B · THE FEAST LINE GETS ITS DRAWINGS — ALL FIVE FAMILIES.
--
-- `feast` becomes the fifth of `renderVenueSvg`'s thirteen zones to carry
-- generated artwork, after `backdrop` + `ceiling` (MB14b), `stage`
-- (`20271211370331`) and `tables` (`20271211440288`). Five of five families
-- again, on the composition the guest tables established.
--
-- ── THE FIVE FILES, WITH THEIR HASHES ───────────────────────────────────────
-- Recraft V4.1 vectors (`model_type: 'vector'`, `resolution: '2k'`,
-- `aspect_ratio: '16:9'`), served from `apps/web/public/moodboard-seed/`.
-- Shipped as generated, not run through an optimiser.
--
--   sha256                                                            bytes  file
--   c686a759c4045f08998fd6e3e52eba9cf727acc6f36afabffd23b2a22f0a6d6e   57656  bridgerton-regal.svg
--   f47982db59631ce33ad206d287b6355396cef7ef53ba78ccdf110e7c918a6b18   67601  editorial-cream.svg
--   381cd840a29a4ae2b2f2faa820c2c27fa160fe2a3be7811c9ec003997b1f742e   42805  elegant-simple-classic.svg
--   446acc424008669011fbf7697b6db4e35d8385862207ead0c1e9f25e16bf6731   21881  modern-minimalist.svg
--   7751b1282d05626c31e2b95a2bf8b79131035d3561344f2f967de7d23ef7e0cd  191689  tropical-heritage.svg
--
-- ── THE TOLERANCES, MEASURED WITH NO AREA FLOOR ─────────────────────────────
-- 520px `sharp` raster (`fit: 'contain'`, the component's own MAX_PREVIEW_PX),
-- real `recolorRGBA`, four unrelated targets (#7A1F2B, #D4AF37, #0F766E,
-- #1E3A8A), counting every opaque pixel that changes OUTSIDE a 2px dilation of
-- the tagged cloth.
--
--   family                       slot      tol   outside@tol   outside@tol+1
--   elegant · simple · classic   #C9A059     8         8 px          52 px  ← cliff
--   bridgerton · regal           #8C6BA6     8        11 px         411 px  ← cliff
--   editorial cream              #D98BA6    10        18 px          39 px
--   tropical heritage            #9CB29A     5         0 px         132 px  ← cliff
--   modern minimalist            #4A3B45     5        26 px          55 px
--
-- Each is the largest integer at which the outside count stays under 0.02% of
-- the opaque area (31 px), the same measured antialiasing allowance the guest
-- tables use. All five recolour their cloth COMPLETELY at the seeded value
-- under all four targets. All five sit inside `tolerance_de BETWEEN 5 AND 30`;
-- nothing widened, the CHECK untouched.
--
-- ⚠ `tropical heritage` IS THE SECOND GENERATION OF ITS CELL, AND THE FIRST ONE
-- MEASURED CLEAN. Its v1 drew the FOOD on the platters in the same sage as the
-- cloth, so every mound and bowl recoloured with it — a burgundy palette gave a
-- table of burgundy food. No assertion could see it: the food is INSIDE the
-- tagged region, so "nothing outside the cloth moved" was true, the region
-- recoloured completely, and every tolerance measured clean at 5. It was caught
-- by rendering the room and looking at it, and fixed by regenerating with the
-- food's colours named explicitly ("warm brown, terracotta, cream and oatmeal
-- — NOTHING on the table is green, only the cloth"). 🔑 GENERALISE: a wrongly
-- coloured object INSIDE the tagged region is invisible to every measurement in
-- this recipe. Only the render catches it.
--
-- THREE of the five sit on a cliff (a measured field turns one step up) and two
-- climb gradually. The guard asserts a boundary only for the three that have
-- one — inventing two more to make the table look uniform is exactly the kind
-- of tidy fiction these headers exist to prevent.
--
-- ── 🪤 `feast` IS A `FloorItem`, NOT A LAYER — THE WIRING IS DIFFERENT ──────
-- `stage` and `backdrop` are drawn as plain layers in `renderVenueSvg`'s
-- output list. `feast` is not: it returns `{ anchorY, svg }` and is depth-sorted
-- against the guest tables and the other celebration zones by
-- `compositeFloorItems` (RV3, PR #5281). So the decor substitution happens
-- INSIDE `feastFloorItem`, on the `svg` field only:
--
--   * `anchorY` stays COMPUTED from the flat geometry, so the depth sort keeps
--     placing this item at its own real ground contact. An image cannot be
--     allowed to change where the thing stands in the room.
--   * the `if (svg === '') return null` check stays on the FLAT svg, so a
--     couple who chose no service and no stations still gets nothing drawn.
--     🔑 A DECOR IMAGE MUST NEVER INVENT A FEAST IN A ROOM THAT WAS NOT MEANT
--     TO HAVE ONE — the image replaces what the couple chose, it does not
--     supply a choice they never made.
--
-- ── GEOMETRY ────────────────────────────────────────────────────────────────
-- `feastFloorItem` draws at x 24, y 300, w 288: the service line occupies
-- y 334..364 and the stations stand BEHIND it from y 252. The slot is
-- 24..312 × 250..366 — clear of the guest-table band at y 386..586.
--
-- `feast` is also added to `SCENE_DECOR_ZONES`: its drawing is a buffet table
-- standing on a plain background, so the background is knocked out and the
-- room's own floor shows underneath. Without that it would paint an opaque
-- rectangle over the floor and the dance floor beside it.
--
-- Cross-references:
--   * 20271211440288 — the guest tables, the same shape one zone earlier
--   * build-sessions/RECEPTION-ART-PLAN.md — Part 2, the measurement procedure
--
-- Idempotent: every INSERT is gated on `WHERE NOT EXISTS` keyed on the row's own
-- `storage_path` (assets) and `(asset_id, slot_id)` (ranges).
-- ============================================================================

BEGIN;

INSERT INTO public.moodboard_library_assets
  (asset_type, asset_subtype, label, storage_path, source, style_theme, approved_at)
SELECT 'venue_scene', 'feast', v.label, v.path, 'higgsfield_generated', v.style_theme, NOW()
  FROM (VALUES
    ('Feast line · Elegant · Simple · Classic (Recraft V4.1 vector)',
     '/moodboard-seed/venue_scene/feast/elegant-simple-classic.svg', 'elegant · simple · classic'),
    ('Feast line · Bridgerton · Regal (Recraft V4.1 vector)',
     '/moodboard-seed/venue_scene/feast/bridgerton-regal.svg', 'bridgerton · regal'),
    ('Feast line · Editorial Cream (Recraft V4.1 vector)',
     '/moodboard-seed/venue_scene/feast/editorial-cream.svg', 'editorial cream'),
    ('Feast line · Tropical Heritage (Recraft V4.1 vector)',
     '/moodboard-seed/venue_scene/feast/tropical-heritage.svg', 'tropical heritage'),
    ('Feast line · Modern Minimalist (Recraft V4.1 vector)',
     '/moodboard-seed/venue_scene/feast/modern-minimalist.svg', 'modern minimalist')
  ) AS v(label, path, style_theme)
 WHERE NOT EXISTS (
   SELECT 1 FROM public.moodboard_library_assets a WHERE a.storage_path = v.path
 );

INSERT INTO public.moodboard_asset_color_ranges
  (asset_id, slot_id, sampled_hex, tolerance_de, region_label)
SELECT a.asset_id, 1::SMALLINT, v.sampled_hex, v.tolerance_de, 'draped fabric'
  FROM (VALUES
    ('/moodboard-seed/venue_scene/feast/elegant-simple-classic.svg', '#C9A059',  8::NUMERIC),
    ('/moodboard-seed/venue_scene/feast/bridgerton-regal.svg',       '#8C6BA6',  8::NUMERIC),
    ('/moodboard-seed/venue_scene/feast/editorial-cream.svg',        '#D98BA6', 10::NUMERIC),
    ('/moodboard-seed/venue_scene/feast/tropical-heritage.svg',      '#9CB29A',  5::NUMERIC),
    ('/moodboard-seed/venue_scene/feast/modern-minimalist.svg',      '#4A3B45',  5::NUMERIC)
  ) AS v(path, sampled_hex, tolerance_de)
  JOIN public.moodboard_library_assets a ON a.storage_path = v.path
 WHERE NOT EXISTS (
   SELECT 1 FROM public.moodboard_asset_color_ranges c
    WHERE c.asset_id = a.asset_id AND c.slot_id = 1
 );

DO $$
DECLARE
  n_assets int;
  n_ranges int;
  bad      text;
BEGIN
  SELECT count(*) INTO n_assets
    FROM public.moodboard_library_assets
   WHERE asset_type = 'venue_scene'
     AND asset_subtype = 'feast'
     AND storage_path ~ '^/moodboard-seed/venue_scene/feast/[a-z0-9-]+\.svg$'
     AND approved_at IS NOT NULL
     AND retired_at IS NULL;

  IF n_assets <> 5 THEN
    SELECT string_agg(storage_path, ', ' ORDER BY storage_path) INTO bad
      FROM public.moodboard_library_assets
     WHERE asset_type = 'venue_scene' AND asset_subtype = 'feast';
    RAISE EXCEPTION
      'RA1: expected exactly 5 live app-served venue_scene feast rows, found %. Paths are: %.',
      n_assets, COALESCE(bad, '(none)');
  END IF;

  -- One range each. An asset with no range is skipped entirely by
  -- fetchDecorLayerCatalog (`if (!slot1) continue`), so the cell silently falls
  -- back to the flat drawing and nobody is told the artwork is unreachable.
  SELECT count(*) INTO n_ranges
    FROM public.moodboard_asset_color_ranges c
    JOIN public.moodboard_library_assets a ON a.asset_id = c.asset_id
   WHERE a.asset_type = 'venue_scene' AND a.asset_subtype = 'feast';

  IF n_ranges <> 5 THEN
    RAISE EXCEPTION
      'RA1: expected exactly 5 colour ranges across the feast drawings (slot 1 each), found %.',
      n_ranges;
  END IF;
END $$;

COMMIT;
