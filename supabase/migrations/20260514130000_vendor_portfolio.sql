-- ============================================================================
-- 20260514130000_vendor_portfolio.sql
-- Vendor portfolio gallery — phase 1 of the R2 file-upload migration.
--
-- Adds `portfolio_r2_keys` to vendor_profiles. Each entry is an
-- `r2://bucket/key` string emitted by the new `<FileUpload>` widget +
-- `/api/upload` route (see apps/web/lib/uploads.ts for the encoding).
--
-- The existing `logo_url` column is intentionally left as TEXT — the same
-- column now holds either a legacy http(s) URL (paste-in, pre-R2) or an
-- `r2://…` ref. The `displayLogoUrl` helper in apps/web/lib/uploads.ts
-- branches on the prefix so existing vendor logos keep rendering unchanged.
--
-- Idempotent.
-- ============================================================================

BEGIN;

ALTER TABLE public.vendor_profiles
  ADD COLUMN IF NOT EXISTS portfolio_r2_keys TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

COMMENT ON COLUMN public.vendor_profiles.portfolio_r2_keys IS
  'Portfolio gallery. Each entry is an r2://bucket/key reference emitted by /api/upload. NULL/empty means no portfolio uploaded yet.';

COMMIT;
