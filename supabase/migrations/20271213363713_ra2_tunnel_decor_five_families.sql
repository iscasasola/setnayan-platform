-- ============================================================================
-- 20271213363713_ra2_tunnel_decor_five_families.sql
-- RA2 · PART B · THE ENTRANCE TUNNEL GETS ITS DRAWINGS — ALL FIVE FAMILIES.
--
-- `tunnel` becomes the tenth of `renderVenueSvg`'s thirteen zones to carry
-- generated artwork.
--
-- ── THE FIVE FILES, WITH THEIR HASHES ───────────────────────────────────────
-- Recraft V4.1 vectors (`model_type: 'vector'`, `resolution: '2k'`,
-- `aspect_ratio: '4:3'` — the first in the feature, matching a group that is
-- 356 wide and 268 high), served from `apps/web/public/moodboard-seed/`.
--
--   sha256                                                            bytes  file
--   b22e4b15badfb68c6c9e95716320ae7c676b224d59dd021c20925028bdf3081c  458046  bridgerton-regal.svg
--   dee16be9243a3e0b785d50bad1089653210751e68de1d55426f5641898cce37f  132448  editorial-cream.svg
--   43f6634ed739a48a9e4432adeffc27effd100fead17c905d8da260c7aa26e985   67083  elegant-simple-classic.svg
--   f01cf0d23866d8e05160a7914ccdb469626f65d0a877b61040fddc6e4f62d1f6    7470  modern-minimalist.svg
--   481bd30f0e2e351084afbc7fc2ff39a5426f775343f42efac8247ca96458d643  169408  tropical-heritage.svg
--
-- ── YIELD: 5 KEEPERS / 6 GENERATIONS (1 per 1.2) ────────────────────────────
--
-- 🔑 THE COMPOSITION HAD TO MATCH A PERSPECTIVE, NOT JUST A SHAPE. Every other
-- zone in this feature is an object seen flat-on. `tunnelLayer` draws THREE
-- arches receding down the aisle in one-point perspective at depths
-- (470,178,636) (432,124,588) (404,86,548). So the prompt asks for exactly that
-- — "a large arch nearest, a medium one behind it, a small one furthest" — and
-- all five came back with the recession reading correctly against the aisle.
--
-- ── THE TOLERANCES, MEASURED WITH NO AREA FLOOR ─────────────────────────────
-- Rasterised at 520px with `sharp` (`fit: 'contain'`), pushed through the REAL
-- `recolorRGBA` against four unrelated targets (#7A1F2B, #D4AF37, #0F766E,
-- #1E3A8A), counting every opaque pixel that changes OUTSIDE a 2px dilation of
-- the tagged arches. Budget: 40 px (0.02% of 199,160).
--
--   family                       slot      tol   nearest neutral   outside@tol   @tol+1
--   elegant · simple · classic   #C9A059    14       14.45               0 px      655 px  ← cliff
--   bridgerton · regal           #481C77    11        9.19 (own edge)     0 px      133 px  ← cliff
--   editorial cream              #D98BA6     6        3.21 (own edge)    37 px       65 px
--   tropical heritage            #9CB29A     5        4.17 (own edge)    18 px      131 px  ← cliff
--   modern minimalist            #4A3B45    30       70.07               0 px          —    the CHECK
--
-- 🪤 `tropical heritage` AND `editorial cream` HAVE A NEAREST NEUTRAL UNDER 5
-- AND ARE STILL SEEDABLE, WHICH IS NOT A CONTRADICTION — it is the 2026-09-07
-- correction to the recipe doing its job. "Nearest neutral" is a COLOUR
-- distance; the rule that decides is POSITIONAL, and those sub-5 colours are the
-- arches' OWN antialiased edges, inside the 2px dilation. What counts is the
-- pixels that move outside it: 18 and 37, both under the 40 px budget. A pure
-- colour-distance reading would have rejected two good files here.
--
-- ── 🪤 THE REJECT, AND WHY THE RE-RUN WORDING IS WORTH COPYING ──────────────
-- `tropical heritage`'s first generation was UNSEEDABLE: 100 px outside at the
-- tightest legal tolerance, against a `#94A992` sitting 3.37 away — a slightly
-- DARKER sage used for the leaves on the arches further back. The prompt had
-- already said "no second green, no darker green"; the model read that per-leaf
-- and still shaded BY DEPTH. What worked was naming the mechanism:
--
--     "THE ENTIRE PICTURE CONTAINS EXACTLY ONE SHADE OF GREEN AND NO OTHER
--      GREEN AT ALL … Depth is shown ONLY by the size of the arches, never by
--      colour."
--
-- ➡ On any zone drawn in perspective, forbid depth-shading explicitly. "One
--   flat colour" is heard as a rule about each shape, not about the picture.
--
-- ── 🪤 THE GATE, IN ITS FOURTH SHAPE — AND `cold_spark` IS WHY ──────────────
-- `feast` shipped gated on "did the flat layer draw anything" and gave a
-- plated-service couple a buffet. `walls` had the same trap in `uplighting_only`.
-- `tunnel`'s version is the sharpest: `cold_spark` is a walkway of spark
-- FOUNTAINS with NO ARCHES AT ALL, and the tunnel catalog's realism rule
-- (2026-07-08) says its sparks are NEVER palette-tinted. Handing that couple a
-- generated arch tunnel would invent a structure they did not book AND tint what
-- the catalog says must not be tinted.
--
-- So the gate is the ARCH styles, and a `cold_spark` the couple also chose is
-- drawn OVER the image — its machine boxes and untinted sparks intact.
--
-- 🔑 AND IT IS A SCENE ZONE, WHERE THE KNOCKOUT MATTERS MOST OF ALL. The aisle
-- runner, the petals and the mirror floor are drawn BENEATH this group and must
-- show through the arch openings and between the legs. Composited opaque, this
-- rect blanks the whole lower centre of the room — the couple's walk included.
--
-- ── WIRING ──────────────────────────────────────────────────────────────────
--   1. `PILOT_DECOR_ZONES`   2. `DECOR_SLOTS`   3. the `decorImage` call site
--   4. `SCENE_DECOR_ZONES`
-- Missing 2 or 3 is invisible: no error, no null, no log.
--
-- Cross-references:
--   * 20271212927845 — `walls`, whose gate this one generalises
--   * build-sessions/RECEPTION-ART-PLAN.md — Part 2, and its 2026-09-07
--     correction that the edge test is POSITIONAL, which two of these five need
--   * apps/web/lib/color-recolor.ts — `colorDistance`, the metric above
--
-- Idempotent: every INSERT is gated on `WHERE NOT EXISTS`.
-- ============================================================================

BEGIN;

INSERT INTO public.moodboard_library_assets
  (asset_type, asset_subtype, label, storage_path, source, style_theme, approved_at)
SELECT 'venue_scene', 'tunnel', v.label, v.path, 'higgsfield_generated', v.style_theme, NOW()
  FROM (VALUES
    ('Entrance tunnel · Elegant · Simple · Classic (Recraft V4.1 vector)',
     '/moodboard-seed/venue_scene/tunnel/elegant-simple-classic.svg', 'elegant · simple · classic'),
    ('Entrance tunnel · Bridgerton · Regal (Recraft V4.1 vector)',
     '/moodboard-seed/venue_scene/tunnel/bridgerton-regal.svg', 'bridgerton · regal'),
    ('Entrance tunnel · Editorial Cream (Recraft V4.1 vector)',
     '/moodboard-seed/venue_scene/tunnel/editorial-cream.svg', 'editorial cream'),
    ('Entrance tunnel · Tropical Heritage (Recraft V4.1 vector)',
     '/moodboard-seed/venue_scene/tunnel/tropical-heritage.svg', 'tropical heritage'),
    ('Entrance tunnel · Modern Minimalist (Recraft V4.1 vector)',
     '/moodboard-seed/venue_scene/tunnel/modern-minimalist.svg', 'modern minimalist')
  ) AS v(label, path, style_theme)
 WHERE NOT EXISTS (
   SELECT 1 FROM public.moodboard_library_assets a WHERE a.storage_path = v.path
 );

-- One measured range each, slot 1 — the couple's FIRST reception colour,
-- matching every other decor zone. Each drawing has exactly one isolable
-- dominant region: the blooms, leaves or hoops on the arches.
INSERT INTO public.moodboard_asset_color_ranges
  (asset_id, slot_id, sampled_hex, tolerance_de, region_label)
SELECT a.asset_id, 1::SMALLINT, v.sampled_hex, v.tolerance_de, 'arch florals'
  FROM (VALUES
    ('/moodboard-seed/venue_scene/tunnel/elegant-simple-classic.svg', '#C9A059', 14::NUMERIC),
    ('/moodboard-seed/venue_scene/tunnel/bridgerton-regal.svg',       '#481C77', 11::NUMERIC),
    ('/moodboard-seed/venue_scene/tunnel/editorial-cream.svg',        '#D98BA6',  6::NUMERIC),
    ('/moodboard-seed/venue_scene/tunnel/tropical-heritage.svg',      '#9CB29A',  5::NUMERIC),
    ('/moodboard-seed/venue_scene/tunnel/modern-minimalist.svg',      '#4A3B45', 30::NUMERIC)
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
     AND asset_subtype = 'tunnel'
     AND storage_path ~ '^/moodboard-seed/venue_scene/tunnel/[a-z0-9-]+\.svg$'
     AND approved_at IS NOT NULL
     AND retired_at IS NULL;

  IF n_assets <> 5 THEN
    SELECT string_agg(storage_path, ', ' ORDER BY storage_path) INTO bad
      FROM public.moodboard_library_assets
     WHERE asset_type = 'venue_scene' AND asset_subtype = 'tunnel';
    RAISE EXCEPTION
      'RA2: expected exactly 5 live app-served venue_scene tunnel rows, found %. Paths are: %.',
      n_assets, COALESCE(bad, '(none)');
  END IF;

  SELECT count(*) INTO n_ranges
    FROM public.moodboard_asset_color_ranges c
    JOIN public.moodboard_library_assets a ON a.asset_id = c.asset_id
   WHERE a.asset_type = 'venue_scene' AND a.asset_subtype = 'tunnel';

  IF n_ranges <> 5 THEN
    RAISE EXCEPTION
      'RA2: expected exactly 5 colour ranges across the entrance-tunnel drawings (slot 1 each), '
      'found %. A second range on one of these files is a region nobody measured.',
      n_ranges;
  END IF;
END $$;

COMMIT;
