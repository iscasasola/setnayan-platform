-- ============================================================================
-- 20261021000000_platform_settings_brand_icon.sql
--
-- Admin-controlled default brand icon (owner 2026-06-10). Lets an internal
-- admin upload a single square brand image at /admin/settings; the server
-- derives a favicon .ico, an opaque apple-touch tile, a 512 PWA PNG, and (when
-- the source is an SVG) an SVG passthrough. Those URLs feed:
--   - the browser-tab favicon (app/favicon.ico/route.ts) — the cure for the
--     stale orange Safari tab (no real favicon.ico existed before this),
--   - the root <metadata> icon links (apple-touch + svg favicon),
--   - the in-app <Logo>/<LogoMark> mark, via the root BrandProvider.
--
-- All five URL columns are plain public asset URLs (same convention as
-- bdo_qr_url / gcash_qr_url — R2 public URLs that deletePublicAsset() can
-- round-trip for cleanup). brand_icon_version is a monotonically-increasing
-- cache-buster appended as ?v=<n> on every icon link so browsers re-fetch
-- past their sticky favicon caches whenever the admin changes the icon.
--
-- Stored on the platform_settings singleton (id=1). RLS already enabled on the
-- table (public read / service-role write) — these columns inherit it, no new
-- policy needed. Idempotent.
-- ============================================================================

BEGIN;

ALTER TABLE public.platform_settings
  ADD COLUMN IF NOT EXISTS brand_icon_master_url  TEXT,
  ADD COLUMN IF NOT EXISTS brand_favicon_ico_url  TEXT,
  ADD COLUMN IF NOT EXISTS brand_apple_touch_url  TEXT,
  ADD COLUMN IF NOT EXISTS brand_icon_png_512_url TEXT,
  ADD COLUMN IF NOT EXISTS brand_icon_svg_url     TEXT,
  ADD COLUMN IF NOT EXISTS brand_icon_version     INTEGER NOT NULL DEFAULT 0;

COMMENT ON COLUMN public.platform_settings.brand_icon_master_url IS
  'Public URL of the admin-uploaded master brand image (normalized to PNG). NULL = use the built-in gold mark default.';
COMMENT ON COLUMN public.platform_settings.brand_favicon_ico_url IS
  'Public URL of the derived multi-size favicon .ico (16/32/48 PNG-in-ICO). Served at /favicon.ico when set, else the built-in gold default.';
COMMENT ON COLUMN public.platform_settings.brand_apple_touch_url IS
  'Public URL of the derived 180x180 apple-touch icon on an opaque tile (iOS composites transparency onto black, so it must be opaque).';
COMMENT ON COLUMN public.platform_settings.brand_icon_png_512_url IS
  'Public URL of the derived 512x512 transparent PNG (PWA / raster consumers).';
COMMENT ON COLUMN public.platform_settings.brand_icon_svg_url IS
  'Public URL of the SVG passthrough — only set when the admin uploaded an SVG. Preferred source for the crisp in-app <Logo> mark.';
COMMENT ON COLUMN public.platform_settings.brand_icon_version IS
  'Monotonic cache-buster. Appended as ?v=<n> on every icon link so browsers re-fetch past sticky favicon caches when the icon changes. Bumped on each upload/remove.';

COMMIT;
