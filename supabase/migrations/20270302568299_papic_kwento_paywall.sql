-- papic_kwento_paywall
-- Created via `pnpm migration:new`. Prefix auto-allocated to sort AFTER every
-- existing migration. KEEP THIS MIGRATION IDEMPOTENT (it may be re-applied):
--   • CREATE TABLE IF NOT EXISTS …   (+ ALTER TABLE … ENABLE ROW LEVEL SECURITY in the SAME migration)
--   • ALTER TABLE … ADD COLUMN IF NOT EXISTS …
--   • CREATE INDEX IF NOT EXISTS …
--   • CREATE OR REPLACE FUNCTION …
--   • DROP POLICY IF EXISTS … ; CREATE POLICY …   (policies have no IF NOT EXISTS)

-- Kwento = paid-to-unlock add-on ₱500 (owner 2026-06-26 · reverses the free
-- words-layer lock). The route + moderation gates check eventSkuActive('KWENTO').
-- Standalone SKU (not in any bundle) so no bundle-membership-mirror change.
-- Idempotent upsert.
insert into public.platform_retail_catalog_v2
  (service_code, title, retail_price_php, saas_overhead_cost_php,
   is_token_able, description, is_pax_priced, is_active)
values
  ('KWENTO', 'Kwento (words on a photo)', 500, 0,
   false,
   'Guests anchor a short message, story, or chismis to any photo or clip — couple-approved, surfaces inline in the gallery and on the editorial page.',
   false, true)
on conflict (service_code) do update
  set retail_price_php = excluded.retail_price_php,
      title           = excluded.title,
      is_active       = true,
      updated_at      = now();

-- Photo Wall (Live Photo Wall / Salamisim) repriced to ₱1,000 (owner 2026-06-26).
-- Already entitlement-gated (eventSkuActive('LIVE_WALL')) + a MEDIA_PACK child;
-- this is a pure reprice.
update public.platform_retail_catalog_v2
  set retail_price_php = 1000, updated_at = now()
  where service_code = 'LIVE_WALL';
