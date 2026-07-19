-- =============================================================================
-- 20270526326110_live_studio_device_tiers.sql
-- Live Studio (Panood) — device-tier repackaging (owner-locked 2026-07-08)
-- =============================================================================
--
-- WHY. The single "Panood multicam" catalog SKU (PANOOD_SYSTEM · ₱3,499) is
-- repackaged into two DEVICE tiers per the owner decision captured in the spec
-- corpus (Live_Studio_Repackaging_2026-07-08.md · DECISION_LOG 2026-07-08):
--   • Mobile Controller  ₱1,299/day — phone · ≤3 cameras · online-only
--   • Desktop Controller ₱2,499/day — laptop · ≤8 cameras · offline-capable
-- YouTube (save + reach) rides on the couple's own OBS, so the whole tier is
-- ₱0 marginal cost to us — no per-camera fee.
--
-- HOW.
--   1. PANOOD_SYSTEM (the existing row) BECOMES the Desktop tier: retitle +
--      reprice 3499 → 2499, per_day. Keeps the internal SKU key so existing
--      references (BUILD_STATUS, V2_SKU_CODES, entitlements) keep resolving.
--   2. INSERT PANOOD_SYSTEM_MOBILE as the new Mobile tier at 1299/day.
--   3. Both use billing_period='per_day' (constraint allows it since
--      20270331500000_patiktok_per_day_billing.sql) → renders " / day".
--
-- These are DISPLAY-ONLY rows on /pricing (no buy button there); they stay
-- non-purchasable ("In build") via the hardcoded BUILD_STATUS map in
-- apps/web/lib/v2-catalog.ts (PANOOD_SYSTEM + PANOOD_SYSTEM_MOBILE = 'partial').
-- The controller video build + a real-event test gate come before "buyable".
--
-- Prices are PESOS (NUMERIC(10,2)). service_code is the PK. Idempotent
-- (UPDATE by key + INSERT ... ON CONFLICT DO UPDATE).
--
-- NOTE. CAMERA_BRIDGE reprice (₱499, independent of Papic + Live Studio) is
-- handled by the Papic session's own catalog PR — deliberately NOT touched here
-- to avoid a collision.
-- =============================================================================

BEGIN;

-- 1. PANOOD_SYSTEM → Live Studio Desktop tier -------------------------------
UPDATE public.platform_retail_catalog_v2
   SET title            = 'Live Studio — Desktop Controller',
       description      = 'Full multicam control room — up to 8 cameras, offline-capable. Switch angles, add overlays and split cam; save + reach remote guests via your own YouTube. Per event-day.',
       retail_price_php = 2499.00,
       billing_period   = 'per_day'
 WHERE service_code = 'PANOOD_SYSTEM';

-- 2. New Live Studio Mobile tier --------------------------------------------
INSERT INTO public.platform_retail_catalog_v2
  (service_code, title, retail_price_php, saas_overhead_cost_php, is_token_able, description, billing_period)
VALUES
  ('PANOOD_SYSTEM_MOBILE',
   'Live Studio — Mobile Controller',
   1299.00, 0.00, TRUE,
   'Phone control room — up to 3 cameras. Switch angles, add overlays and split cam; save + reach remote guests via your own YouTube. Online, per event-day.',
   'per_day')
ON CONFLICT (service_code) DO UPDATE SET
  title            = EXCLUDED.title,
  retail_price_php = EXCLUDED.retail_price_php,
  description      = EXCLUDED.description,
  is_token_able    = EXCLUDED.is_token_able,
  billing_period   = EXCLUDED.billing_period;

COMMIT;
