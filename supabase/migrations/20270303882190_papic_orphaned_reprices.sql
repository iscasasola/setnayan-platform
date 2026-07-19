-- papic_orphaned_reprices
-- Created via `pnpm migration:new`. Prefix auto-allocated to sort AFTER every
-- existing migration. KEEP THIS MIGRATION IDEMPOTENT (it may be re-applied):
--   • CREATE TABLE IF NOT EXISTS …   (+ ALTER TABLE … ENABLE ROW LEVEL SECURITY in the SAME migration)
--   • ALTER TABLE … ADD COLUMN IF NOT EXISTS …
--   • CREATE INDEX IF NOT EXISTS …
--   • CREATE OR REPLACE FUNCTION …
--   • DROP POLICY IF EXISTS … ; CREATE POLICY …   (policies have no IF NOT EXISTS)

-- Re-apply the orphaned per-tier-caps catalog reprices (owner 2026-06-26). The
-- PR7 (#2265) migration merged at an EARLY commit (auto-merge race), so the
-- Pabati + Camera Bridge reprices never reached the migration file — the LIVE DB
-- is already correct (applied via admin SQL); this restores reproducibility for
-- a fresh DB rebuild. Idempotent.
update public.platform_retail_catalog_v2
  set retail_price_php = 500, updated_at = now()
  where service_code = 'PABATI';

update public.platform_retail_catalog_v2
  set retail_price_php = 100,
      title = 'Camera Bridge (per seat, per day · max ₱2,000)',
      updated_at = now()
  where service_code = 'CAMERA_BRIDGE';
