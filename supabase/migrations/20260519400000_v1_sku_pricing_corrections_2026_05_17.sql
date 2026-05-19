-- ============================================================================
-- 20260519400000_v1_sku_pricing_corrections_2026_05_17.sql
--
-- Pricing corrections per CLAUDE.md decision log row 406 (2026-05-17,
-- "V1 SKU lock batch — Pricing & Frequency overhaul"). These reprices were
-- locked 2026-05-17 but the corresponding service_catalog UPDATEs were
-- never seeded — the 2026-05-16 lock migration was the most recent source
-- of truth in the DB until now.
--
-- Changes:
--   1. save_the_date_video         9,900¢ (₱99)    → 19,900¢ (₱199)
--                                                    Cost Watch math: highest
--                                                    observed render ~₱45;
--                                                    at ₱99 the cost-to-price
--                                                    ratio is 45% (yellow);
--                                                    at ₱199 it drops to 23%
--                                                    (green). 2× margin
--                                                    capture at an under-
--                                                    ₱200 impulse-buy price.
--   2. panood_daily_broadcast      49,900¢ (₱499)  → 249,900¢ (₱2,499)
--                                                    Always-multicam pivot
--                                                    (max 6 cams via SFU);
--                                                    Camera Sync collapsed
--                                                    into this SKU.
--   3. panood_annual_streaming     299,900¢ (₱2,999) → 1,999,900¢ (₱19,999)
--                                                    Vendor / competition-
--                                                    organizer subscription
--                                                    positioning at year +
--                                                    all_events scope.
--   4. panood_camera_sync          is_active = FALSE
--                                                    Retired — collapsed
--                                                    into always-multicam
--                                                    daily broadcast.
--   5. panood_annual_streaming_plus is_active = FALSE
--                                                    Retired — collapsed
--                                                    into always-multicam
--                                                    annual streaming.
--
-- Idempotent. Each UPDATE is conditional on the OLD price so re-applying
-- the migration is a no-op. The two retirements check is_active = TRUE
-- so re-applying after manual revert is safe.
-- ============================================================================

BEGIN;

-- 1. Save-the-Date Video — ₱99 → ₱199
UPDATE public.service_catalog
   SET price_centavos = 19900,
       updated_at = NOW()
 WHERE sku_code = 'save_the_date_video'
   AND price_centavos = 9900;

-- 2. Panood Daily Broadcast — ₱499 → ₱2,499 (always-multicam baked in)
UPDATE public.service_catalog
   SET price_centavos = 249900,
       updated_at = NOW()
 WHERE sku_code = 'panood_daily_broadcast'
   AND price_centavos = 49900;

-- 3. Panood Annual Streaming — ₱2,999 → ₱19,999 (annual + all_events scope)
UPDATE public.service_catalog
   SET price_centavos = 1999900,
       updated_at = NOW()
 WHERE sku_code = 'panood_annual_streaming'
   AND price_centavos = 299900;

-- 4. Panood Camera Sync — retired (collapsed into always-multicam)
UPDATE public.service_catalog
   SET is_active = FALSE,
       updated_at = NOW()
 WHERE sku_code = 'panood_camera_sync'
   AND is_active = TRUE;

-- 5. Panood Annual Streaming Plus — retired (collapsed into always-multicam)
UPDATE public.service_catalog
   SET is_active = FALSE,
       updated_at = NOW()
 WHERE sku_code = 'panood_annual_streaming_plus'
   AND is_active = TRUE;

-- Remove the two retired Panood SKUs from the launch promo set as well —
-- they're inactive now, but clearing launch_promo_until keeps the promo
-- query surface honest.
UPDATE public.service_catalog
   SET launch_promo_until = NULL,
       updated_at = NOW()
 WHERE sku_code IN ('panood_camera_sync', 'panood_annual_streaming_plus')
   AND launch_promo_until IS NOT NULL;

COMMIT;
