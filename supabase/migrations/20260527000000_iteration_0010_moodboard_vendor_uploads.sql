-- ============================================================================
-- 20260527000000_iteration_0010_moodboard_vendor_uploads.sql
-- Iteration 0010 Moodboard — RLS expansion to allow vendor (stylist) uploads.
-- Per owner directive 2026-05-21: "stylists can edit it ... stylists can
-- upload their own design." V1 implementation stores vendor uploads in
-- Setnayan storage with source='stylist_upload'; the Google Drive variant
-- the owner described lands in V1.x.
--
-- New RLS posture on moodboard_library_assets:
--   1. Admin all-actions (unchanged)
--   2. Public read approved+not-retired (unchanged)
--   3. NEW: vendor users may INSERT their own uploads
--      (uploaded_by = auth.uid() AND source = 'stylist_upload')
--   4. NEW: vendor users may SELECT/UPDATE their own rows
--      (uploaded_by = auth.uid())
--   5. Vendor users cannot self-approve (only admin sets approved_at)
--
-- Same expansion on moodboard_asset_color_ranges so vendors can tag their
-- own uploaded photos.
--
-- Storage bucket: vendor users get write access to moodboard-library bucket
-- (their objects only, scoped via an object-key prefix convention:
-- `${user_id}/${uuid}.${ext}` — actions.ts enforces this).
--
-- Idempotent.
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- moodboard_library_assets — vendor inserts + their-own-row reads
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS moodboard_library_assets_vendor_insert ON public.moodboard_library_assets;
CREATE POLICY moodboard_library_assets_vendor_insert ON public.moodboard_library_assets
  FOR INSERT
  WITH CHECK (
    uploaded_by = auth.uid()
    AND source = 'stylist_upload'
    AND EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.user_id = auth.uid()
        AND u.account_type = 'vendor'
    )
  );

-- Vendor can SELECT their own uploads even before approval (drafts), plus
-- the public approved+not-retired set they already see via the existing
-- public_read policy. Two separate policies stack as OR per Postgres RLS.
DROP POLICY IF EXISTS moodboard_library_assets_vendor_select_own ON public.moodboard_library_assets;
CREATE POLICY moodboard_library_assets_vendor_select_own ON public.moodboard_library_assets
  FOR SELECT
  USING (
    uploaded_by = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.user_id = auth.uid()
        AND u.account_type = 'vendor'
    )
  );

-- Vendor can UPDATE their own rows but cannot self-approve. We enforce the
-- no-self-approve rule at the app-action level (admin_only approveAsset).
-- The policy itself just gates by ownership.
DROP POLICY IF EXISTS moodboard_library_assets_vendor_update_own ON public.moodboard_library_assets;
CREATE POLICY moodboard_library_assets_vendor_update_own ON public.moodboard_library_assets
  FOR UPDATE
  USING (
    uploaded_by = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.user_id = auth.uid()
        AND u.account_type = 'vendor'
    )
  )
  WITH CHECK (
    uploaded_by = auth.uid()
  );

-- Vendor can DELETE their own rows (e.g. removing a draft they no longer
-- want).
DROP POLICY IF EXISTS moodboard_library_assets_vendor_delete_own ON public.moodboard_library_assets;
CREATE POLICY moodboard_library_assets_vendor_delete_own ON public.moodboard_library_assets
  FOR DELETE
  USING (
    uploaded_by = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.user_id = auth.uid()
        AND u.account_type = 'vendor'
    )
  );

-- ----------------------------------------------------------------------------
-- moodboard_asset_color_ranges — vendor tags their own assets
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS moodboard_asset_color_ranges_vendor_all ON public.moodboard_asset_color_ranges;
CREATE POLICY moodboard_asset_color_ranges_vendor_all ON public.moodboard_asset_color_ranges
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.moodboard_library_assets a
      WHERE a.asset_id = moodboard_asset_color_ranges.asset_id
        AND a.uploaded_by = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.moodboard_library_assets a
      WHERE a.asset_id = moodboard_asset_color_ranges.asset_id
        AND a.uploaded_by = auth.uid()
    )
  );

-- ----------------------------------------------------------------------------
-- Storage bucket — allow vendor users to write objects under their own prefix
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS moodboard_library_storage_vendor_write ON storage.objects;
CREATE POLICY moodboard_library_storage_vendor_write ON storage.objects
  FOR ALL
  USING (
    bucket_id = 'moodboard-library'
    AND auth.uid() IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.user_id = auth.uid()
        AND u.account_type = 'vendor'
    )
    -- The object key must be prefixed with the user's id (enforced in
    -- actions.ts when uploading; the app-side check is the source of truth,
    -- this is defense-in-depth).
    AND name LIKE auth.uid()::text || '/%'
  )
  WITH CHECK (
    bucket_id = 'moodboard-library'
    AND auth.uid() IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.user_id = auth.uid()
        AND u.account_type = 'vendor'
    )
    AND name LIKE auth.uid()::text || '/%'
  );

COMMIT;
