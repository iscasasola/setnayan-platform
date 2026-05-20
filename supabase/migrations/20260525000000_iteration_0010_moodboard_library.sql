-- ============================================================================
-- 20260525000000_iteration_0010_moodboard_library.sql
-- Iteration 0010 Moodboard — Visual preview pillars + Color Range Manipulator
-- locked 2026-05-21 (see 0010 § "Visual preview pillars" + CLAUDE.md decision log
-- "Moodboard expanded · 3 pillars" 2026-05-21 row).
--
-- This migration lands the persistence layer for the new pillars:
--   - moodboard_library_assets: photos uploaded by admin (V1 placeholders →
--     V1.x Higgsfield → V1.x+ approved stylist contributions)
--   - moodboard_asset_color_ranges: per-asset color-range tag maps from the
--     Color Range Manipulator tool (up to 6 palette slots per asset)
--   - storage bucket: public bucket holding the photo bytes
--   - RLS: admin read/write all; public read approved+not-retired assets only
--
-- Stylist-private uploads (their own Google Drive) are NOT modeled here —
-- those live on the stylist's own Drive per the 2026-05-21 lock. The library
-- table tracks photo bytes Setnayan hosts.
--
-- Idempotent.
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- moodboard_library_assets: photos in the shared template library
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.moodboard_library_assets (
  asset_id       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_type     TEXT NOT NULL CHECK (asset_type IN ('venue_scene', 'figure_attire')),
  asset_subtype  TEXT,                                          -- 'reception' | 'church' | 'cocktail' | 'bride' | 'groom' | 'bridesmaid' | 'groomsman' | 'guest_female' | 'guest_male' | etc.
  label          TEXT NOT NULL,                                 -- short admin-readable label, shown in admin grid
  storage_path   TEXT NOT NULL,                                 -- 'moodboard-library/{uuid}.{ext}' in Supabase Storage
  source         TEXT NOT NULL DEFAULT 'internet_placeholder'
                 CHECK (source IN ('internet_placeholder', 'higgsfield_generated', 'stylist_upload')),
  uploaded_by    UUID REFERENCES public.users(user_id),
  approved_at    TIMESTAMPTZ,                                   -- admin review gate; NULL = draft, not visible to couples
  retired_at     TIMESTAMPTZ,                                   -- soft-delete; for V1 placeholder cutover at hard-launch
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_moodboard_library_assets_published
  ON public.moodboard_library_assets(asset_type, asset_subtype)
  WHERE approved_at IS NOT NULL AND retired_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_moodboard_library_assets_admin_drafts
  ON public.moodboard_library_assets(created_at DESC)
  WHERE approved_at IS NULL;

-- ----------------------------------------------------------------------------
-- moodboard_asset_color_ranges: per-asset color-range tag map (up to 6 slots)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.moodboard_asset_color_ranges (
  asset_id        UUID NOT NULL REFERENCES public.moodboard_library_assets(asset_id) ON DELETE CASCADE,
  slot_id         SMALLINT NOT NULL CHECK (slot_id BETWEEN 1 AND 6),
  sampled_hex     CHAR(7) NOT NULL,                              -- '#rrggbb'
  tolerance_de    NUMERIC NOT NULL DEFAULT 15
                  CHECK (tolerance_de BETWEEN 5 AND 30),         -- approximate ΔE tolerance (5–30)
  region_label    TEXT,                                          -- 'drapery' | 'table runners' | 'cocktail dress' | etc.
  PRIMARY KEY (asset_id, slot_id)
);

-- ----------------------------------------------------------------------------
-- RLS
-- ----------------------------------------------------------------------------
ALTER TABLE public.moodboard_library_assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.moodboard_asset_color_ranges ENABLE ROW LEVEL SECURITY;

-- Admin (is_internal | is_team_member | account_type='admin') can read/write all
DROP POLICY IF EXISTS moodboard_library_assets_admin_all ON public.moodboard_library_assets;
CREATE POLICY moodboard_library_assets_admin_all ON public.moodboard_library_assets
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.user_id = auth.uid()
        AND (u.is_internal = true OR u.is_team_member = true OR u.account_type = 'admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.user_id = auth.uid()
        AND (u.is_internal = true OR u.is_team_member = true OR u.account_type = 'admin')
    )
  );

-- Everyone can SELECT approved + not-retired assets (couples + stylists alike)
DROP POLICY IF EXISTS moodboard_library_assets_public_read ON public.moodboard_library_assets;
CREATE POLICY moodboard_library_assets_public_read ON public.moodboard_library_assets
  FOR SELECT
  USING (approved_at IS NOT NULL AND retired_at IS NULL);

DROP POLICY IF EXISTS moodboard_asset_color_ranges_admin_all ON public.moodboard_asset_color_ranges;
CREATE POLICY moodboard_asset_color_ranges_admin_all ON public.moodboard_asset_color_ranges
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.user_id = auth.uid()
        AND (u.is_internal = true OR u.is_team_member = true OR u.account_type = 'admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.user_id = auth.uid()
        AND (u.is_internal = true OR u.is_team_member = true OR u.account_type = 'admin')
    )
  );

DROP POLICY IF EXISTS moodboard_asset_color_ranges_public_read ON public.moodboard_asset_color_ranges;
CREATE POLICY moodboard_asset_color_ranges_public_read ON public.moodboard_asset_color_ranges
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.moodboard_library_assets a
      WHERE a.asset_id = moodboard_asset_color_ranges.asset_id
        AND a.approved_at IS NOT NULL
        AND a.retired_at IS NULL
    )
  );

-- ----------------------------------------------------------------------------
-- Storage bucket — public bucket; admin-only writes via service role
-- ----------------------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public)
VALUES ('moodboard-library', 'moodboard-library', true)
ON CONFLICT (id) DO NOTHING;

-- Allow public read of bucket contents (the photos themselves)
DROP POLICY IF EXISTS moodboard_library_storage_public_read ON storage.objects;
CREATE POLICY moodboard_library_storage_public_read ON storage.objects
  FOR SELECT
  TO public
  USING (bucket_id = 'moodboard-library');

-- Allow admin to insert/update/delete bucket contents
DROP POLICY IF EXISTS moodboard_library_storage_admin_write ON storage.objects;
CREATE POLICY moodboard_library_storage_admin_write ON storage.objects
  FOR ALL
  USING (
    bucket_id = 'moodboard-library'
    AND EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.user_id = auth.uid()
        AND (u.is_internal = true OR u.is_team_member = true OR u.account_type = 'admin')
    )
  )
  WITH CHECK (
    bucket_id = 'moodboard-library'
    AND EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.user_id = auth.uid()
        AND (u.is_internal = true OR u.is_team_member = true OR u.account_type = 'admin')
    )
  );

COMMIT;
