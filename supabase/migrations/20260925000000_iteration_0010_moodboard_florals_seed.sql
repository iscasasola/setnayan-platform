-- ============================================================================
-- 20260925000000_iteration_0010_moodboard_florals_seed.sql
-- Iteration 0010 Mood Board — seed the new Flowers chapter with 5 Recraft-
-- generated, Setnayan-owned floral photos so couples can recolor them.
--
-- Follow-up to PR #1120 (the couple-facing Recolor Studio + Flowers chapter).
-- The chapter showed a graceful empty state until now.
--
-- Hosting: the image bytes live in the app repo at
--   apps/web/public/moodboard-seed/florals/*.webp
-- and are served same-origin by Next.js (no Supabase Storage upload — that
-- needs a service-role key not available in the build environment). The
-- moodboard page resolver treats a leading-"/" storage_path as an app-relative
-- URL, so the Recolor Studio loads them same-origin (getImageData never taints
-- the canvas). IP-clean: Recraft output is Setnayan-owned, not hot-linked stock.
--
-- Each asset is tagged with ONE color range (slot 1) over its dominant bloom
-- color, sampled from the actual image and tuned for clean recolor with low
-- background spill (saturated blooms take a wider tolerance; pale blooms a
-- tighter one). The couple taps the region chip and snaps/adjusts from there.
--
-- Idempotent: assets keyed by storage_path, ranges by (asset, slot).
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- 0. Allow source='recraft_generated' (Setnayan-owned AI imagery, like the
--    higgsfield_generated bucket but honestly labeled).
-- ----------------------------------------------------------------------------
ALTER TABLE public.moodboard_library_assets
  DROP CONSTRAINT IF EXISTS moodboard_library_assets_source_check;
ALTER TABLE public.moodboard_library_assets
  DROP CONSTRAINT IF EXISTS moodboard_library_assets_source_check_v2;
ALTER TABLE public.moodboard_library_assets
  ADD CONSTRAINT moodboard_library_assets_source_check_v2
  CHECK (source IN ('internet_placeholder', 'higgsfield_generated', 'stylist_upload', 'recraft_generated'));

-- ----------------------------------------------------------------------------
-- 1. Assets (idempotent by storage_path). approved_at=NOW() → visible to hosts.
-- ----------------------------------------------------------------------------
INSERT INTO public.moodboard_library_assets
  (asset_type, asset_subtype, label, storage_path, source, approved_at)
SELECT v.asset_type, v.asset_subtype, v.label, v.storage_path, 'recraft_generated', NOW()
FROM (VALUES
  ('florals','bridal_bouquet',    'Bridal bouquet',        '/moodboard-seed/florals/bridal_bouquet.webp'),
  ('florals','entourage_bouquet', 'Bridesmaid bouquet',    '/moodboard-seed/florals/entourage_bouquet.webp'),
  ('florals','ceremony_florals',  'Ceremony arrangement',  '/moodboard-seed/florals/ceremony_florals.webp'),
  ('florals','centerpiece',       'Reception centerpiece', '/moodboard-seed/florals/centerpiece.webp'),
  ('florals','boutonniere',       'Boutonniere',           '/moodboard-seed/florals/boutonniere.webp')
) AS v(asset_type, asset_subtype, label, storage_path)
WHERE NOT EXISTS (
  SELECT 1 FROM public.moodboard_library_assets a WHERE a.storage_path = v.storage_path
);

-- ----------------------------------------------------------------------------
-- 2. Color ranges — slot 1 over each photo's dominant bloom color.
-- ----------------------------------------------------------------------------
INSERT INTO public.moodboard_asset_color_ranges
  (asset_id, slot_id, sampled_hex, tolerance_de, region_label)
SELECT a.asset_id, 1, v.sampled_hex, v.tolerance_de, v.region_label
FROM (VALUES
  ('/moodboard-seed/florals/bridal_bouquet.webp',    '#DCA0A2',  9, 'pink roses'),
  ('/moodboard-seed/florals/entourage_bouquet.webp', '#EDEAE2', 24, 'white roses'),
  ('/moodboard-seed/florals/ceremony_florals.webp',  '#B41F29', 24, 'red blooms'),
  ('/moodboard-seed/florals/centerpiece.webp',       '#7C57A2', 16, 'purple blooms'),
  ('/moodboard-seed/florals/boutonniere.webp',       '#E8946F', 11, 'coral rose')
) AS v(storage_path, sampled_hex, tolerance_de, region_label)
JOIN public.moodboard_library_assets a ON a.storage_path = v.storage_path
WHERE NOT EXISTS (
  SELECT 1 FROM public.moodboard_asset_color_ranges r
  WHERE r.asset_id = a.asset_id AND r.slot_id = 1
);

COMMIT;
