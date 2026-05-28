-- =============================================================================
-- 20260701010000_v2_title_polish.sql
-- Match catalog titles to the screenshot's clean short forms · 2026-05-28
-- =============================================================================
-- Some titles still carry the longer V1-descriptive form ("Animated Monogram
-- Maker", "Indoor Blueprint Venue Layout Engine", etc). Owner's canonical
-- screenshot uses the shorter names ("Animated Monogram", "Indoor Blueprint").
-- Sync the DB to match.
-- =============================================================================

BEGIN;

UPDATE public.platform_retail_catalog_v2 SET title = 'Animated Monogram'    WHERE service_code = 'ANIMATED_MONOGRAM';
UPDATE public.platform_retail_catalog_v2 SET title = 'Call-Time Escalator'  WHERE service_code = 'CALL_TIME_ESCALATOR';
UPDATE public.platform_retail_catalog_v2 SET title = 'Camera Bridge'        WHERE service_code = 'CAMERA_BRIDGE';
UPDATE public.platform_retail_catalog_v2 SET title = 'Indoor Blueprint'     WHERE service_code = 'INDOOR_BLUEPRINT';
UPDATE public.platform_retail_catalog_v2 SET title = 'Pabati'               WHERE service_code = 'PABATI';
UPDATE public.platform_retail_catalog_v2 SET title = 'Pakanta'              WHERE service_code = 'PAKANTA';
-- PANOOD_SYSTEM intentionally NOT changed · title stays "Panood (Website
-- Add-on)" per the screenshot (the parenthetical IS part of the canonical
-- title · matches the same pattern as PAPIC_GUEST, PAPIC_SEATS, SDE, +
-- the 3 PAPIC_ADDON_* rows).

COMMIT;
