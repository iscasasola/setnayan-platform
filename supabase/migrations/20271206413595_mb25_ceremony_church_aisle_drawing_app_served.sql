-- ============================================================================
-- 20271206413595_mb25_ceremony_church_aisle_drawing_app_served.sql
-- MB25 · THE CEREMONY CARD GETS A DRAWING.
--
-- MB23 (`20271205919528`) retired the two live `venue_scene` rows: both were
-- `https://picsum.photos/...` STOCK PHOTOGRAPHS seeded during bring-up, shown
-- to couples as their ceremony space "in their colors". Since that migration
-- the Ceremony card has been ABSENT — the honest end state, and a temporary
-- one. This migration is what ends it: the first venue scene the section has
-- ever shown that is our own artwork and recolours honestly.
--
-- THE ASSET
--   apps/web/public/moodboard-seed/venue_scene/church/ceremony-aisle.svg
--   sha256 9c311f0f353a88d8df8b7e5186c1f242fa296414755ee0fdd339fc6ed1cc7977
--   Generated 2026-09-05 with Recraft V4.1 `vector` — the same model family as
--   the 75 attire figures, hence `source = 'higgsfield_generated'` (the value
--   this table's CHECK has carried for every Setnayan-generated asset since
--   20260525000000; it names the pipeline, not today's vendor).
--   viewBox 0 0 2048 1331 · 326 paths · NO gradients, NO rasters.
--   App-served, exactly like the florals seed (20260927000000) — a relative
--   path, so `lib/moodboard-library-placeholder.ts` reads no host and the
--   MB23 write-side guard passes it.
--   The file carries a <metadata> C2PA provenance block from the generator.
--   LEAVE IT: it is the honest record of where the picture came from.
--
-- ── THE TWO COLOUR RANGES, AND WHY THESE NUMBERS ────────────────────────────
--
-- 🔑 THE TOLERANCES ARE MEASURED THROUGH `recolorRGBA`, NOT CONVERTED FROM ΔE.
--
-- The engine that recolours these pixels (`apps/web/lib/color-recolor.ts`)
-- does NOT compute CIELAB ΔE. `colorDistance` is a weighted-RGB Euclidean
-- proxy — sqrt(0.3dr² + 0.59dg² + 0.11db²)/2.55 — and for THIS artwork it
-- disagrees with CIELAB sharply, in the direction that matters:
--
--                                   CIELAB ΔE      what recolorRGBA sees
--     fabric  → floor  (#D6D1C7)       14.4                 5.1
--     fabric  → walls  (#F4F1EA)       17.9                10.3
--     florals → nearest non-slot       38.2                12.6  (#B89559)
--
-- MB25's brief was written from the CIELAB column and specified "fabric ≤ 10".
-- MEASURED BY PIXEL, A FABRIC TOLERANCE OF 10 PAINTS THE ENTIRE FLOOR — and
-- so does 6. All 3,158 exact floor pixels in a 520px raster turn the couple's
-- second colour at tolerance 6. Only 5 is clean, and 5 is also the floor of
-- this table's own CHECK (`tolerance_de BETWEEN 5 AND 30`). There is no margin
-- below it and none is needed: both regions are FLAT vector fills (florals 64
-- paths of one colour, fabric 35 of another), so no shading sits outside the
-- range waiting to be stranded at stock colour the way an attire figure's
-- folds would be.
--
-- Measured 2026-09-05, rsvg-convert at the component's own MAX_PREVIEW_PX
-- (520 → 520x338), pushed through the real `recolorRGBA`:
--
--   slot 1 · florals · #D98BA6 ± 10 → 5,094/5,094 exact florals px recolour;
--            walls, floor, pews, white move by 0. Nearest non-slot fill is
--            #B89559 at 12.6 — a 2.6 margin.
--   slot 2 · fabric  · #E8D9B5 ±  5 → 13,409/13,409 exact fabric px recolour;
--            walls, floor, pews, white move by 0. Floor at 5.1 — 0.1 margin,
--            and the reason this number is not 6.
--
-- Both slots were then applied TOGETHER (burgundy + gold) and each recoloured
-- only its own region. Pinned by
-- `_components/the-background-never-wears-the-palette.test.ts`, which parses
-- these very rows out of this file rather than restating them.
--
-- ── SLOT ORDER IS THE COUPLE'S COLOUR ORDER ─────────────────────────────────
-- `moodboard-board.tsx` maps `out[r.slotId] = palette[i % palette.length]`, so
-- slot 1 = the couple's FIRST ceremony colour (the flowers) and slot 2 their
-- second (the fabric). A couple with one ceremony colour gets both regions in
-- it, which is what `i % palette.length` already does.
--
-- Idempotent: WHERE NOT EXISTS on the storage_path; ranges keyed off the row.
-- ============================================================================

BEGIN;

INSERT INTO public.moodboard_library_assets
  (asset_type, asset_subtype, label, storage_path, source, style_theme, approved_at)
SELECT
  'venue_scene',
  'church',
  'Church ceremony aisle · Elegant · Simple · Classic (Recraft V4.1 vector)',
  '/moodboard-seed/venue_scene/church/ceremony-aisle.svg',
  'higgsfield_generated',
  'elegant · simple · classic',
  NOW()
WHERE NOT EXISTS (
  SELECT 1 FROM public.moodboard_library_assets
   WHERE storage_path = '/moodboard-seed/venue_scene/church/ceremony-aisle.svg'
);

-- The two recolourable regions. Values MEASURED, not converted — see header.
INSERT INTO public.moodboard_asset_color_ranges
  (asset_id, slot_id, sampled_hex, tolerance_de, region_label)
SELECT a.asset_id, v.slot_id, v.sampled_hex, v.tolerance_de, v.region_label
  FROM public.moodboard_library_assets a
  CROSS JOIN (VALUES
    -- (slot, sampled_hex, tolerance_de, region)
    (1::SMALLINT, '#D98BA6', 10::NUMERIC, 'florals'),
    (2::SMALLINT, '#E8D9B5',  5::NUMERIC, 'fabric')
  ) AS v(slot_id, sampled_hex, tolerance_de, region_label)
 WHERE a.storage_path = '/moodboard-seed/venue_scene/church/ceremony-aisle.svg'
   AND NOT EXISTS (
     SELECT 1 FROM public.moodboard_asset_color_ranges c
      WHERE c.asset_id = a.asset_id AND c.slot_id = v.slot_id
   );

COMMIT;
