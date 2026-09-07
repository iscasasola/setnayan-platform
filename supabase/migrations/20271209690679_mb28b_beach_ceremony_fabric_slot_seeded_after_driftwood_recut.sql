-- ============================================================================
-- 20271209690679_mb28b_beach_ceremony_fabric_slot_seeded_after_driftwood_recut.sql
-- MB28b · THE BEACH DRAPES TAKE THE COUPLE'S COLOUR.
--
-- MB28 (`20271208519468`) seeded eight ceremony venue scenes with two colour
-- ranges each — EXCEPT the beach, which shipped florals only. Its driftwood
-- arch was filled rgb(221,214,200), 3.536 from the fabric slot in the
-- engine's own metric (`colorDistance` in lib/color-recolor.ts — weighted
-- RGB, NOT CIELAB), and `moodboard_asset_color_ranges` CHECKs
-- `tolerance_de BETWEEN 5 AND 30`, so the tightest LEGAL tolerance (5) turned
-- the whole arch the couple's second colour. MB28 correctly refused to seed a
-- bleed and surfaced the re-cut as an owner decision.
--
-- OWNER: re-cut the driftwood (the same call as MB23/MB24's bride).
--
-- Re-cut committed at apps/web/public/moodboard-seed/venue_scene/beach/
-- ceremony-aisle.svg: the 24 driftwood paths moved from rgb(221,214,200) to
-- rgb(172,168,160). Nothing else in the file changed.
--   sha256: d4e843bba1c457f798ced8936b3af55ff1d90c44850e495207ddfdad3ed2ee6e
--
-- ── EVERY DISTANCE BELOW WAS MEASURED THROUGH `recolorRGBA`, NOT CIELAB ─────
-- Re-measured 2026-09-06 at the component's own MAX_PREVIEW_PX (520), fabric
-- slot #E8D9B5, every fill vs that slot:
--
--   driftwood  rgb(172,168,160)  19.8   (was 3.536 pre-recut)
--   sand       #B8B2A6           15.8   (unchanged by the recut)
--   white      #FFFFFF           15.7   (unchanged by the recut)
--   sky        #E3EBEE            9.2   ← the new nearest neutral
--
-- So slot 2's tolerance must stay below 9. Seeded at 5 — the legal minimum,
-- 4.2 of margin below the sky, and the same value the church and six of the
-- other seven venue scenes already use for this exact fabric hex. Florals
-- (slot 1, #D98BA6, tolerance 10) is untouched: nothing about the recut moves
-- its nearest neutral (13.1 away).
--
-- Idempotent: WHERE NOT EXISTS on (asset_id, slot_id), matched by storage_path.
-- ============================================================================

BEGIN;

INSERT INTO public.moodboard_asset_color_ranges
  (asset_id, slot_id, sampled_hex, tolerance_de, region_label)
SELECT a.asset_id, 2::SMALLINT, '#E8D9B5', 5::NUMERIC, 'fabric'
  FROM public.moodboard_library_assets a
 WHERE a.storage_path = '/moodboard-seed/venue_scene/beach/ceremony-aisle.svg'
   AND NOT EXISTS (
     SELECT 1 FROM public.moodboard_asset_color_ranges c
      WHERE c.asset_id = a.asset_id AND c.slot_id = 2
   );

-- ── the beach row must carry exactly two ranges after this migration ───────
DO $$
DECLARE
  n_ranges INTEGER;
BEGIN
  SELECT COUNT(*) INTO n_ranges
    FROM public.moodboard_asset_color_ranges c
    JOIN public.moodboard_library_assets a ON a.asset_id = c.asset_id
   WHERE a.storage_path = '/moodboard-seed/venue_scene/beach/ceremony-aisle.svg';

  IF n_ranges <> 2 THEN
    RAISE EXCEPTION
      'MB28b: expected the beach ceremony drawing to carry exactly 2 colour ranges (florals from MB28 + fabric from this migration), found %. Either the beach row does not exist, MB28''s florals range is missing, or this migration inserted a duplicate fabric slot.',
      n_ranges;
  END IF;
END $$;

COMMIT;
