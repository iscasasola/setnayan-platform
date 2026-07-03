-- vendor_microsite_video_ids
-- Created via `pnpm migration:new`. Prefix auto-allocated to sort AFTER every
-- existing migration. KEEP THIS MIGRATION IDEMPOTENT (it may be re-applied):
--   • CREATE TABLE IF NOT EXISTS …   (+ ALTER TABLE … ENABLE ROW LEVEL SECURITY in the SAME migration)
--   • ALTER TABLE … ADD COLUMN IF NOT EXISTS …
--   • CREATE INDEX IF NOT EXISTS …
--   • CREATE OR REPLACE FUNCTION …
--   • DROP POLICY IF EXISTS … ; CREATE POLICY …   (policies have no IF NOT EXISTS)


-- ── Enterprise "Flagship" video portfolio (YouTube) ──────────────────────────
-- Owner 2026-07-03: give Enterprise a distinct 4th-tier output. Vendors paste
-- YouTube links; the public /v/[slug] embeds them (youtube-nocookie) as a
-- playable "Films" rack. Stored as an ordered array of normalized 11-char
-- YouTube video IDs (parsed/validated app-side in lib/vendor-microsite.ts).
-- Additive column on the existing, RLS-protected vendor_profiles — no new
-- policy needed; the column inherits the table's row-level security. Wired to
-- the Enterprise editor control + Enterprise-gated render.
ALTER TABLE public.vendor_profiles
  ADD COLUMN IF NOT EXISTS microsite_video_ids text[];
