-- papic_unlock_bundle
-- Created via `pnpm migration:new`. Prefix auto-allocated to sort AFTER every
-- existing migration. KEEP THIS MIGRATION IDEMPOTENT (it may be re-applied):
--   • CREATE TABLE IF NOT EXISTS …   (+ ALTER TABLE … ENABLE ROW LEVEL SECURITY in the SAME migration)
--   • ALTER TABLE … ADD COLUMN IF NOT EXISTS …
--   • CREATE INDEX IF NOT EXISTS …
--   • CREATE OR REPLACE FUNCTION …
--   • DROP POLICY IF EXISTS … ; CREATE POLICY …   (policies have no IF NOT EXISTS)

-- Papic "Unlock all" umbrella bundle ₱15,000 (owner 2026-06-26). Grants every
-- Papic add-on; the unlimited-Unli camera allowance is a separate capture-gate
-- bypass (deferred). The app-side entitlement grant lives in
-- lib/entitlements.ts (BUNDLE_CHILD_SKUS.PAPIC_UNLOCK) — this migration creates
-- the sellable package row. Idempotent upsert.
insert into public.platform_package_catalog
  (package_code, title, retail_price_php, is_active, description)
values
  ('PAPIC_UNLOCK', 'Unlock all of Papic', 15000, true,
   'Everything Papic in one: unlimited Unli cameras for the whole wedding plus every Papic add-on — Kwento, Photo Wall, Thank You, Stories, Pabati, and the DSLR Camera Bridge.')
on conflict (package_code) do update
  set retail_price_php = excluded.retail_price_php,
      title           = excluded.title,
      description      = excluded.description,
      is_active        = true,
      updated_at       = now();
