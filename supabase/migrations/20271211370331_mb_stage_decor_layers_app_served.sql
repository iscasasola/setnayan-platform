-- ============================================================================
-- 20271211370331_mb_stage_decor_layers_app_served.sql
-- THE STAGE ZONE GETS ARTWORK — the first zone added since MB14b's pilot pair.
--
-- Owner ruling 2026-09-06 (Q10): *go on the staged plan, not on ~55 images*.
-- `build-sessions/RECEPTION-ART-PLAN.md` is that plan; `stage` is its pilot
-- zone, chosen because it is the couple's own spot — the most-looked-at part
-- of the room. Until now only `backdrop` and `ceiling` had generated images
-- (MB14b, `20271207934361`); the other nine zones render as flat SVG.
--
-- THE FIVE ASSETS · sha256 of the bytes committed under apps/web/public/:
--
--   elegant-simple-classic  36b8e4716ce3ac787d7d6e35d8ca67a608d2e19c18a39084d99aeacf420fae9e
--   bridgerton-regal        e1caa25f209fc89a2641f20202434dfcbb71396cf39384ca6ca4c103d468014e
--   editorial-cream         0c74031350e5a323cff2850ef2af420264f108679fca3072df7c92573598f3b2
--   tropical-heritage       6d4127551193ba82b70a398d7c431dd7e87451ee3a14759154713087b9ddead3
--   modern-minimalist       82031af11dadb7fca2d7d222deb656f8f0b8c75c2be3c340cca55af53d86dedb
--
--   Recraft V4.1 `vector`, `source = 'higgsfield_generated'`, app-served from
--   `public/moodboard-seed/venue_scene/stage/<style-slug>.svg` — the MB24/MB25
--   route that needs no bucket, no custom domain and no CORS negotiation.
--   Approved at seed time (unlike the 2026-09-03 pilot, whose rows sat
--   `approved_at NULL` behind a host that never resolved).
--
-- ── THE TOLERANCES ARE PER FILE AND MEASURED THROUGH `recolorRGBA` ──────────
--
-- Not CIELAB ΔE. `colorDistance` is a weighted-RGB proxy and the two disagree
-- sharply — the lesson MB25 paid for once and MB28 paid for again on eight
-- files. Each value below is the LARGEST INTEGER at which no measured neutral
-- moves, capped at 15, on a 520px raster (the component's own MAX_PREVIEW_PX):
--
--   style                     slot       nearest neutral    seeded
--   elegant · simple · classic #C9A059   #AC9B8F @  9.5      9
--   bridgerton · regal         #8C6BA6   #69507C @ 12.3     12
--   editorial cream            #D98BA6   #F7F3EA @ 33.2     15  (clean to 30)
--   tropical heritage          #9CB29A   #E4D9CC @ 20.5     15  (clean to 20)
--   modern minimalist          #4A3B45   #F5F3EF @ 70.1     15  (clean to 30)
--
-- ── 🔑 WHAT THIS ZONE COST, AND THE TWO RULES IT BOUGHT ─────────────────────
--
-- Ten generations for five keepers (1 per 2.0). MB28's ceremony scenes were
-- 8 of 68 (1 per 8.5) — reception zones are ~4x cheaper because the frames are
-- smaller, simpler and single-slot.
--
-- 🪤 RULE 1 — TAG A DRAPED OR FLAT-CLAD SURFACE, NEVER ORNATE FURNITURE. The
-- four cells that tag a tablecloth, runner or clad riser face passed on their
-- first or a redirected attempt; every attempt that tagged carved chairs or a
-- piped sofa failed, because the model insists on a second tone for frames,
-- trim and piping — and a second tone of the SAME object is a region that sits
-- at stock colour while the rest recolours around it.
--
-- 🪤 RULE 2 — `colors: [seed, background]` DOES NOT PIN THE DOMINANT REGION.
-- On `bridgerton · regal` Recraft invented its own dominant (#8358FB, the
-- cloth) and spent the passed seed #8C6BA6 on a DIFFERENT object (the floor),
-- producing two same-hue regions 12.6 apart — one recolouring, one not. Three
-- rounds failed that way. Passing ONE colour fixed it on the next attempt, and
-- the slot then sampled to exactly the seed. Re-sample the pixels regardless.
--
-- Idempotent: WHERE NOT EXISTS on (asset_subtype, style_theme); ranges keyed
-- off the row. A DO block pins the live count afterwards.
-- ============================================================================

BEGIN;

INSERT INTO public.moodboard_library_assets
  (asset_type, asset_subtype, label, storage_path, source, style_theme, approved_at)
SELECT 'venue_scene', 'stage',
       'Stage · ' || v.title || ' (Recraft V4.1 vector)',
       '/moodboard-seed/venue_scene/stage/' || v.slug || '.svg',
       'higgsfield_generated', v.style_theme, NOW()
FROM (VALUES
  ('elegant-simple-classic', 'Elegant · Simple · Classic', 'elegant · simple · classic'),
  ('bridgerton-regal',       'Bridgerton · Regal',         'bridgerton · regal'),
  ('editorial-cream',        'Editorial Cream',            'editorial cream'),
  ('tropical-heritage',      'Tropical Heritage',          'tropical heritage'),
  ('modern-minimalist',      'Modern Minimalist',          'modern minimalist')
) AS v(slug, title, style_theme)
WHERE NOT EXISTS (
  SELECT 1 FROM public.moodboard_library_assets a
   WHERE a.asset_type = 'venue_scene' AND a.asset_subtype = 'stage'
     AND a.style_theme = v.style_theme
);

-- One tagged region per file. MEASURED, not converted — see header.
INSERT INTO public.moodboard_asset_color_ranges
  (asset_id, slot_id, sampled_hex, tolerance_de, region_label)
SELECT a.asset_id, 1, v.sampled_hex, v.tolerance_de, 'decor'
  FROM public.moodboard_library_assets a
  JOIN (VALUES
    -- (style_theme, sampled_hex, tolerance_de)
    ('elegant · simple · classic', '#C9A059',  9::NUMERIC),
    ('bridgerton · regal',         '#8C6BA6', 12::NUMERIC),
    ('editorial cream',            '#D98BA6', 15::NUMERIC),
    ('tropical heritage',          '#9CB29A', 15::NUMERIC),
    ('modern minimalist',          '#4A3B45', 15::NUMERIC)
  ) AS v(style_theme, sampled_hex, tolerance_de)
    ON a.style_theme = v.style_theme
 WHERE a.asset_type = 'venue_scene' AND a.asset_subtype = 'stage'
   AND NOT EXISTS (
     SELECT 1 FROM public.moodboard_asset_color_ranges c
      WHERE c.asset_id = a.asset_id AND c.slot_id = 1
   );

DO $$
DECLARE
  n_stage   INTEGER;
  n_ranges  INTEGER;
  n_decor   INTEGER;
BEGIN
  SELECT COUNT(*) INTO n_stage
    FROM public.moodboard_library_assets
   WHERE asset_type='venue_scene' AND asset_subtype='stage'
     AND approved_at IS NOT NULL AND retired_at IS NULL;

  SELECT COUNT(*) INTO n_ranges
    FROM public.moodboard_asset_color_ranges c
    JOIN public.moodboard_library_assets a ON a.asset_id=c.asset_id
   WHERE a.asset_subtype='stage' AND a.asset_type='venue_scene';

  SELECT COUNT(*) INTO n_decor
    FROM public.moodboard_library_assets
   WHERE asset_type='venue_scene' AND approved_at IS NOT NULL AND retired_at IS NULL
     AND asset_subtype IN ('backdrop','ceiling','stage');

  IF n_stage <> 5 THEN
    RAISE EXCEPTION 'stage decor: expected 5 live stage venue_scene rows (one per style family), found %. A family with no row falls back to the flat SVG silently.', n_stage;
  END IF;
  IF n_ranges <> 5 THEN
    RAISE EXCEPTION 'stage decor: expected 5 colour ranges across the stage drawings, found %. An untagged asset renders at the artist''s colours and nothing reports it.', n_ranges;
  END IF;
  IF n_decor <> 15 THEN
    RAISE EXCEPTION 'stage decor: expected 15 live decor-layer venue_scene rows (backdrop 5 + ceiling 5 + stage 5), found %.', n_decor;
  END IF;
END $$;

COMMIT;
