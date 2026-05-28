-- =============================================================================
-- 20260701000000_v2_pricing_screenshot_v3_alignment.sql
-- Owner-supplied canonical pricing screenshot v3 · 2026-05-28
-- =============================================================================
--
-- Third pricing alignment pass this session. Supersedes the v2 alignment
-- (migration 20260631000000) which matched an earlier screenshot. This
-- migration applies the latest owner-supplied table.
--
-- THREE STRUCTURAL CHANGES + ~15 ROW UPDATES:
--
-- 1. PINOY_MAP_ROUTE · DELETED (owner directive · "Delete the row entirely")
-- 2. PAPIC_GUEST_STORIES + PAPIC_MEDIA_PACK · DELETED + REPLACED with
--    fresh add-on-semantics SKU codes (owner directive · "Rename codes ·
--    retire old + create new")
-- 3. LIVE_WALL · split into 2 SKUs: Live Venue Photo Wall (existing
--    LIVE_WALL code repurposed) + new LIVE_BACKGROUND
--
-- Pre-flight check confirmed zero dependent rows in
-- event_software_activations_v2 + token_rewards_log for all DELETE
-- targets · safe to hard-delete.
--
-- ALSO · schema extension: platform_retail_catalog_v2 gains a
-- `description` TEXT column to capture the screenshot's per-SKU
-- description copy.
--
-- Pilot 2026-06-01 unaffected · V1 service_catalog untouched ·
-- setnayan_pay_methods retirement still deferred to next session.
-- =============================================================================

BEGIN;

-- =============================================================================
-- STEP 1 · schema extension · add description column
-- =============================================================================

ALTER TABLE public.platform_retail_catalog_v2
  ADD COLUMN IF NOT EXISTS description TEXT;

COMMENT ON COLUMN public.platform_retail_catalog_v2.description IS
  'Short customer-facing description shown on /pricing + checkout surfaces. Set from the canonical owner-supplied pricing screenshot 2026-05-28.';

-- =============================================================================
-- STEP 2 · DELETEs (owner-confirmed · no FK dependents)
-- =============================================================================

DELETE FROM public.platform_retail_catalog_v2 WHERE service_code = 'PINOY_MAP_ROUTE';
DELETE FROM public.platform_retail_catalog_v2 WHERE service_code = 'PAPIC_GUEST_STORIES';
DELETE FROM public.platform_retail_catalog_v2 WHERE service_code = 'PAPIC_MEDIA_PACK';

-- =============================================================================
-- STEP 3 · INSERT new SKUs introduced by this screenshot
-- =============================================================================
-- LIVE_BACKGROUND · split from the prior combined LIVE_WALL row.
-- PAPIC_ADDON_STORIES · replaces the retired PAPIC_GUEST_STORIES bundle.
-- PAPIC_ADDON_THANK_YOU · replaces the retired PAPIC_MEDIA_PACK bundle.

INSERT INTO public.platform_retail_catalog_v2
  (service_code, title, retail_price_php, saas_overhead_cost_php, is_token_able, description)
VALUES
  ('LIVE_BACKGROUND',
   'Live Background',
   2499.00, 200.00, TRUE,
   'LED Wall Design Background with Monogram'),
  ('PAPIC_ADDON_STORIES',
   'Guest Stories (Papic Add-on)',
   1999.00, 50.00, FALSE,
   '30 second story maker for guests'),
  ('PAPIC_ADDON_THANK_YOU',
   'Thank You Video (Papic Add-on)',
   5499.00, 250.00, TRUE,
   '5 minute thank you video of couple for all those who attended.')
ON CONFLICT (service_code) DO UPDATE SET
  title                  = EXCLUDED.title,
  retail_price_php       = EXCLUDED.retail_price_php,
  saas_overhead_cost_php = EXCLUDED.saas_overhead_cost_php,
  is_token_able          = EXCLUDED.is_token_able,
  description            = EXCLUDED.description;

-- =============================================================================
-- STEP 4 · UPDATE existing rows · price + title + token-able + description
-- =============================================================================

-- Animated Monogram · description added
UPDATE public.platform_retail_catalog_v2
   SET description = 'Bespoke Monogram with Animation'
 WHERE service_code = 'ANIMATED_MONOGRAM';

-- Pro Website · price jump 2999 → 5499 · title + description update
UPDATE public.platform_retail_catalog_v2
   SET retail_price_php = 5499.00,
       title            = 'Pro Website',
       description      = 'Premium Invitation + Event Page + Editorial'
 WHERE service_code = 'PRO_WEBSITE';

-- Panood · rename to "Panood (Website Add-on)" + description
UPDATE public.platform_retail_catalog_v2
   SET title       = 'Panood (Website Add-on)',
       description = 'live streaming per day embedded on Event Page'
 WHERE service_code = 'PANOOD_SYSTEM';

-- Custom QR per Guest
UPDATE public.platform_retail_catalog_v2
   SET title       = 'Custom QR per Guest',
       description = '1 QR Code for each guest (up to 250 pax)'
 WHERE service_code = 'CUSTOM_QR_GUEST';

-- Today's Focus · description added
UPDATE public.platform_retail_catalog_v2
   SET title       = 'Today''s Focus',
       description = 'Assisted Planning'
 WHERE service_code = 'TODAYS_FOCUS';

-- Indoor Blueprint · description added
UPDATE public.platform_retail_catalog_v2
   SET description = 'Guided from Entrance to Table'
 WHERE service_code = 'INDOOR_BLUEPRINT';

-- Call-Time Escalator · description added
UPDATE public.platform_retail_catalog_v2
   SET description = 'SMS update all vendors'
 WHERE service_code = 'CALL_TIME_ESCALATOR';

-- Patiktok · title clarified + description added
UPDATE public.platform_retail_catalog_v2
   SET title       = 'Patiktok',
       description = 'up to 250 tiktok recordings'
 WHERE service_code = 'PATIKTOK_COMPILER';

-- Pabati · description added
UPDATE public.platform_retail_catalog_v2
   SET description = 'up to 300 5-second videos'
 WHERE service_code = 'PABATI';

-- Pakanta · price 1499 → 2499 · is_token_able FALSE → TRUE · description
UPDATE public.platform_retail_catalog_v2
   SET retail_price_php = 2499.00,
       is_token_able    = TRUE,
       description      = 'Create a special song for the couple'
 WHERE service_code = 'PAKANTA';

-- Papic Guest · title clarified + description
UPDATE public.platform_retail_catalog_v2
   SET title       = 'Papic Guest (Disposable Camera)',
       description = '24 photos + 10 5-second videos'
 WHERE service_code = 'PAPIC_GUEST';

-- Papic (5 Seats) · title clarified + description
UPDATE public.platform_retail_catalog_v2
   SET title       = 'Papic (5 Seats)',
       description = 'Unlimited photos + Unlimited Videos for 5 hours'
 WHERE service_code = 'PAPIC_SEATS';

-- SDE · reframed as Papic add-on · price 5499 → 3499 · title + description
UPDATE public.platform_retail_catalog_v2
   SET retail_price_php = 3499.00,
       title            = 'SDE (Papic Add-on)',
       description      = '3 minute video compilation from Papic'
 WHERE service_code = 'SDE';

-- Camera Bridge · description added
UPDATE public.platform_retail_catalog_v2
   SET description = 'Connect DSLR to Papic and Panood Service'
 WHERE service_code = 'CAMERA_BRIDGE';

-- LIVE_WALL · price 3499 → 2499 · title trimmed (lost "+Background" half) + description
-- The Background half is now its own LIVE_BACKGROUND row inserted above.
UPDATE public.platform_retail_catalog_v2
   SET retail_price_php = 2499.00,
       title            = 'Live Venue Photo Wall',
       description      = 'Live Photo Collage of Event Photos with Live Count'
 WHERE service_code = 'LIVE_WALL';

-- High Res Archive · description hint (per year billing)
UPDATE public.platform_retail_catalog_v2
   SET title       = 'High Res Archive',
       description = 'Yearly archive (billed per year)'
 WHERE service_code = 'HIGH_RES_ARCHIVE';

COMMIT;

-- =============================================================================
-- VERIFICATION:
--
-- -- (1) Final catalog · should be 20 rows · matches screenshot
-- SELECT service_code, title, retail_price_php::text, is_token_able, description
--   FROM platform_retail_catalog_v2
--   ORDER BY service_code;
-- -- Expected 20 rows: 19 from screenshot + LIVE_WALL/LIVE_BACKGROUND split (counts as 2)
-- -- · PINOY_MAP_ROUTE absent · PAPIC_GUEST_STORIES + PAPIC_MEDIA_PACK absent
-- -- · PAPIC_ADDON_STORIES + PAPIC_ADDON_THANK_YOU present
--
-- -- (2) Pakanta back to ₱2,499 + Token Worthy:
-- SELECT service_code, retail_price_php, is_token_able FROM platform_retail_catalog_v2
--  WHERE service_code='PAKANTA';
-- -- Expected: 2499.00 · TRUE
--
-- -- (3) Pro Website at ₱5,499:
-- SELECT service_code, retail_price_php FROM platform_retail_catalog_v2
--  WHERE service_code='PRO_WEBSITE';
-- -- Expected: 5499.00
--
-- -- (4) LIVE_WALL + LIVE_BACKGROUND both at ₱2,499:
-- SELECT service_code, title, retail_price_php FROM platform_retail_catalog_v2
--  WHERE service_code IN ('LIVE_WALL','LIVE_BACKGROUND');
-- -- Expected: 2 rows · both 2499.00
-- =============================================================================
