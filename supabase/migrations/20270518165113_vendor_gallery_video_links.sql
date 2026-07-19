-- vendor_gallery_video_links
-- Created via `pnpm migration:new`. Prefix auto-allocated to sort AFTER every
-- existing migration. KEEP THIS MIGRATION IDEMPOTENT (it may be re-applied):
--   • CREATE TABLE IF NOT EXISTS …   (+ ALTER TABLE … ENABLE ROW LEVEL SECURITY in the SAME migration)
--   • ALTER TABLE … ADD COLUMN IF NOT EXISTS …
--   • CREATE INDEX IF NOT EXISTS …
--   • CREATE OR REPLACE FUNCTION …
--   • DROP POLICY IF EXISTS … ; CREATE POLICY …   (policies have no IF NOT EXISTS)

ALTER TABLE vendor_profiles
  ADD COLUMN IF NOT EXISTS gallery_video_links TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[]
  CHECK (cardinality(gallery_video_links) <= 10);
COMMENT ON COLUMN vendor_profiles.gallery_video_links IS
  'Public profile "Featured videos" — up to 10 external video URLs (YouTube/Vimeo inline players; IG/FB/TikTok link-out cards). Additive, 2026-07-05.';
