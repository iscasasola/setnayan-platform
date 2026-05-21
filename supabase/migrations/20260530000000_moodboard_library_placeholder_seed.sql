-- ============================================================================
-- 20260530000000_moodboard_library_placeholder_seed.sql
--
-- V1 placeholder seed for moodboard_library_assets + moodboard_asset_color_ranges.
--
-- The moodboard_library_assets table (migration 20260525000000) has been
-- empty in production since hard-launch. /dashboard/[eventId]/add-ons/mood-board
-- queries it with `WHERE approved_at IS NOT NULL` and renders the "Visual
-- Preview" pillars — with zero rows, couples see an empty visual-preview
-- section. Owner-asked 2026-05-21: "add the photos on the mood board".
--
-- This migration seeds 10 approved templates (4 venue_scene + 6 figure_attire)
-- with stable Picsum seed URLs in the `storage_path` column. The mood-board
-- page detects absolute URLs in storage_path and bypasses Supabase Storage
-- resolution for them (see apps/web/app/dashboard/[eventId]/add-ons/mood-board/
-- page.tsx isAbsoluteUrl branch).
--
-- Color ranges: one slot-1 entry per asset with a plausible PH-wedding
-- accent hex (blush / champagne / sage / navy / ivory / dusty rose). Slot 1
-- is the only slot the Visual Preview substitutes against the event's palette;
-- slots 2-6 stay as sampled. The placeholder hex is what gets recolored when
-- a couple's palette has a hex in the asset's role slot.
--
-- Source classification: 'internet_placeholder' per the existing CHECK
-- constraint. Setnayan's admin can replace these with real uploads via
-- /admin/moodboard-library + retire these placeholder rows once V1.x ships
-- stylist Drive uploads.
--
-- All rows marked approved_at = NOW() so they show on the couple page
-- immediately; retired_at = NULL.
--
-- Idempotent: INSERTs gated on storage_path uniqueness via WHERE NOT EXISTS.
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- venue_scene assets — Location feel pillar
-- ----------------------------------------------------------------------------

INSERT INTO public.moodboard_library_assets
  (asset_type, asset_subtype, label, storage_path, source, approved_at)
SELECT 'venue_scene', 'reception',
       'Banquet hall reception setup',
       'https://picsum.photos/seed/setnayan-reception-1/1200/800',
       'internet_placeholder', NOW()
WHERE NOT EXISTS (
  SELECT 1 FROM public.moodboard_library_assets
  WHERE storage_path = 'https://picsum.photos/seed/setnayan-reception-1/1200/800'
);

INSERT INTO public.moodboard_library_assets
  (asset_type, asset_subtype, label, storage_path, source, approved_at)
SELECT 'venue_scene', 'church',
       'Catholic church ceremony',
       'https://picsum.photos/seed/setnayan-church-1/1200/800',
       'internet_placeholder', NOW()
WHERE NOT EXISTS (
  SELECT 1 FROM public.moodboard_library_assets
  WHERE storage_path = 'https://picsum.photos/seed/setnayan-church-1/1200/800'
);

INSERT INTO public.moodboard_library_assets
  (asset_type, asset_subtype, label, storage_path, source, approved_at)
SELECT 'venue_scene', 'garden',
       'Garden estate (Tagaytay)',
       'https://picsum.photos/seed/setnayan-garden-1/1200/800',
       'internet_placeholder', NOW()
WHERE NOT EXISTS (
  SELECT 1 FROM public.moodboard_library_assets
  WHERE storage_path = 'https://picsum.photos/seed/setnayan-garden-1/1200/800'
);

INSERT INTO public.moodboard_library_assets
  (asset_type, asset_subtype, label, storage_path, source, approved_at)
SELECT 'venue_scene', 'beach',
       'Beach ceremony altar',
       'https://picsum.photos/seed/setnayan-beach-1/1200/800',
       'internet_placeholder', NOW()
WHERE NOT EXISTS (
  SELECT 1 FROM public.moodboard_library_assets
  WHERE storage_path = 'https://picsum.photos/seed/setnayan-beach-1/1200/800'
);

-- ----------------------------------------------------------------------------
-- figure_attire assets — Dress codes pillar
-- ----------------------------------------------------------------------------

INSERT INTO public.moodboard_library_assets
  (asset_type, asset_subtype, label, storage_path, source, approved_at)
SELECT 'figure_attire', 'bride',
       'Bride · classic gown silhouette',
       'https://picsum.photos/seed/setnayan-bride-1/1200/800',
       'internet_placeholder', NOW()
WHERE NOT EXISTS (
  SELECT 1 FROM public.moodboard_library_assets
  WHERE storage_path = 'https://picsum.photos/seed/setnayan-bride-1/1200/800'
);

INSERT INTO public.moodboard_library_assets
  (asset_type, asset_subtype, label, storage_path, source, approved_at)
SELECT 'figure_attire', 'groom',
       'Groom · wedding suit',
       'https://picsum.photos/seed/setnayan-groom-1/1200/800',
       'internet_placeholder', NOW()
WHERE NOT EXISTS (
  SELECT 1 FROM public.moodboard_library_assets
  WHERE storage_path = 'https://picsum.photos/seed/setnayan-groom-1/1200/800'
);

INSERT INTO public.moodboard_library_assets
  (asset_type, asset_subtype, label, storage_path, source, approved_at)
SELECT 'figure_attire', 'bridesmaid',
       'Bridesmaid · entourage dress',
       'https://picsum.photos/seed/setnayan-bridesmaid-1/1200/800',
       'internet_placeholder', NOW()
WHERE NOT EXISTS (
  SELECT 1 FROM public.moodboard_library_assets
  WHERE storage_path = 'https://picsum.photos/seed/setnayan-bridesmaid-1/1200/800'
);

INSERT INTO public.moodboard_library_assets
  (asset_type, asset_subtype, label, storage_path, source, approved_at)
SELECT 'figure_attire', 'groomsman',
       'Groomsman · entourage suit',
       'https://picsum.photos/seed/setnayan-groomsman-1/1200/800',
       'internet_placeholder', NOW()
WHERE NOT EXISTS (
  SELECT 1 FROM public.moodboard_library_assets
  WHERE storage_path = 'https://picsum.photos/seed/setnayan-groomsman-1/1200/800'
);

INSERT INTO public.moodboard_library_assets
  (asset_type, asset_subtype, label, storage_path, source, approved_at)
SELECT 'figure_attire', 'guest_female',
       'Ninang · principal sponsor gown',
       'https://picsum.photos/seed/setnayan-ninang-1/1200/800',
       'internet_placeholder', NOW()
WHERE NOT EXISTS (
  SELECT 1 FROM public.moodboard_library_assets
  WHERE storage_path = 'https://picsum.photos/seed/setnayan-ninang-1/1200/800'
);

INSERT INTO public.moodboard_library_assets
  (asset_type, asset_subtype, label, storage_path, source, approved_at)
SELECT 'figure_attire', 'guest_male',
       'Ninong · principal sponsor barong',
       'https://picsum.photos/seed/setnayan-ninong-1/1200/800',
       'internet_placeholder', NOW()
WHERE NOT EXISTS (
  SELECT 1 FROM public.moodboard_library_assets
  WHERE storage_path = 'https://picsum.photos/seed/setnayan-ninong-1/1200/800'
);

-- ----------------------------------------------------------------------------
-- moodboard_asset_color_ranges — slot 1 placeholder hex per asset
--
-- Slot 1 is the palette-substitution slot in VisualPreview's
-- buildPreviewPalette(). When a couple's role_palette has the corresponding
-- role color, the asset's slot-1 sampledHex gets replaced visually (HSL
-- substitution via ColorRangeManipulator). Hexes chosen below are plausible
-- PH-wedding accent colors so the unsubstituted preview still reads well.
-- ----------------------------------------------------------------------------

INSERT INTO public.moodboard_asset_color_ranges
  (asset_id, slot_id, sampled_hex, tolerance_de, region_label)
SELECT a.asset_id, 1, h.hex, 15, h.region
FROM public.moodboard_library_assets a
JOIN (VALUES
  ('https://picsum.photos/seed/setnayan-reception-1/1200/800', '#F4C4D1', 'drapery / centerpieces'),
  ('https://picsum.photos/seed/setnayan-church-1/1200/800',    '#E8D9B5', 'florals / pew accents'),
  ('https://picsum.photos/seed/setnayan-garden-1/1200/800',    '#B5D3A8', 'foliage / table runners'),
  ('https://picsum.photos/seed/setnayan-beach-1/1200/800',     '#C7E0E8', 'aisle florals / arch'),
  ('https://picsum.photos/seed/setnayan-bride-1/1200/800',     '#F5EFE6', 'gown bodice'),
  ('https://picsum.photos/seed/setnayan-groom-1/1200/800',     '#3A4255', 'suit jacket'),
  ('https://picsum.photos/seed/setnayan-bridesmaid-1/1200/800','#D9B8C4', 'entourage gown'),
  ('https://picsum.photos/seed/setnayan-groomsman-1/1200/800', '#4F5A6F', 'entourage suit'),
  ('https://picsum.photos/seed/setnayan-ninang-1/1200/800',    '#C8A4B8', 'sponsor gown'),
  ('https://picsum.photos/seed/setnayan-ninong-1/1200/800',    '#E8DCC6', 'sponsor barong')
) AS h(path, hex, region) ON a.storage_path = h.path
WHERE NOT EXISTS (
  SELECT 1 FROM public.moodboard_asset_color_ranges
  WHERE asset_id = a.asset_id AND slot_id = 1
);

COMMIT;
