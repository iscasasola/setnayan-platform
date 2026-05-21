-- ============================================================================
-- 20260531000000_moodboard_library_placeholder_seed.sql
--
-- V1 placeholder seed for moodboard_library_assets + moodboard_asset_color_ranges.
--
-- The moodboard_library_assets table (migration 20260525000000) has been
-- empty in production since hard-launch. /dashboard/[eventId]/add-ons/mood-board
-- queries it with `WHERE approved_at IS NOT NULL` and renders the "Visual
-- Preview" pillars — with zero rows, couples see an empty visual-preview
-- section. Owner-asked 2026-05-21: "add the photos on the mood board".
--
-- Owner refined 2026-05-21: "just 2 of each". Seeds 2 venue_scene assets
-- (reception + church) + 2 figure_attire assets (bride + groom). Sponsor
-- attire (ninang/ninong), garden/beach venues, bridesmaid/groomsman etc.
-- get added later by admin via /admin/moodboard-library — keeps the V1
-- seed minimal so admin curation is the source of growth.
--
-- Originally landed as 20260530000000 in PR #258. Renamed to 20260531000000
-- in PR #259 to free the 20260530 prefix that already belonged to
-- 20260530000000_event_vendors_venue_directory_link.sql (the missing
-- column behind the "Add to plan · Try again" production error).
-- INSERTs are idempotent (WHERE NOT EXISTS gates), so re-applying after
-- the rename is a no-op on databases that already ran the previous version.
--
-- Stable Picsum seed URLs hot-linked from the storage_path column so
-- the migration ships fully via SQL — no Supabase Storage uploads required.
-- The mood-board page detects absolute URLs in storage_path and bypasses
-- Supabase Storage resolution for them.
--
-- Color ranges: one slot-1 entry per asset with a plausible PH-wedding
-- accent hex. Slot 1 is the only slot VisualPreview substitutes against
-- the event's role_palette — slots 2-6 stay as sampled.
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- venue_scene assets — Location feel pillar (2 of each per owner)
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

-- ----------------------------------------------------------------------------
-- figure_attire assets — Dress codes pillar (2 of each per owner)
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

-- ----------------------------------------------------------------------------
-- moodboard_asset_color_ranges — slot 1 placeholder hex per asset
-- ----------------------------------------------------------------------------

INSERT INTO public.moodboard_asset_color_ranges
  (asset_id, slot_id, sampled_hex, tolerance_de, region_label)
SELECT a.asset_id, 1, h.hex, 15, h.region
FROM public.moodboard_library_assets a
JOIN (VALUES
  ('https://picsum.photos/seed/setnayan-reception-1/1200/800', '#F4C4D1', 'drapery / centerpieces'),
  ('https://picsum.photos/seed/setnayan-church-1/1200/800',    '#E8D9B5', 'florals / pew accents'),
  ('https://picsum.photos/seed/setnayan-bride-1/1200/800',     '#F5EFE6', 'gown bodice'),
  ('https://picsum.photos/seed/setnayan-groom-1/1200/800',     '#3A4255', 'suit jacket')
) AS h(path, hex, region) ON a.storage_path = h.path
WHERE NOT EXISTS (
  SELECT 1 FROM public.moodboard_asset_color_ranges
  WHERE asset_id = a.asset_id AND slot_id = 1
);

-- ----------------------------------------------------------------------------
-- Retire the 6 over-seeded rows from PR #258, if any made it into production
-- before the owner asked to trim. Idempotent: rows that don't exist no-op.
-- ----------------------------------------------------------------------------

UPDATE public.moodboard_library_assets
SET retired_at = NOW()
WHERE retired_at IS NULL
  AND storage_path IN (
    'https://picsum.photos/seed/setnayan-garden-1/1200/800',
    'https://picsum.photos/seed/setnayan-beach-1/1200/800',
    'https://picsum.photos/seed/setnayan-bridesmaid-1/1200/800',
    'https://picsum.photos/seed/setnayan-groomsman-1/1200/800',
    'https://picsum.photos/seed/setnayan-ninang-1/1200/800',
    'https://picsum.photos/seed/setnayan-ninong-1/1200/800'
  );

COMMIT;
