-- Panood camera bridge is now FREE — included in the ₱4,999/day Panood multicam
-- tier (owner 2026-06-26: "make it free"). Connecting a DSLR / external camera
-- into the control room carries no per-camera fee; owning PANOOD_SYSTEM grants it.
--
-- Removes the short-lived standalone PANOOD_CAMERA_BRIDGE SKU (created earlier the
-- same day in migration 20270302400000, never sold) and notes the inclusion on the
-- PANOOD_SYSTEM row. Papic's separate CAMERA_BRIDGE (₱100/seat/day) is UNTOUCHED.
--
-- Applied live to platform_retail_catalog_v2 via SQL (db push creds stale); this
-- mirrors it so a rebuild / next push match. Idempotent — safe to re-run.

BEGIN;

DELETE FROM public.platform_retail_catalog_v2 WHERE service_code = 'PANOOD_CAMERA_BRIDGE';

UPDATE public.platform_retail_catalog_v2
   SET description = 'The paid multicam controller (₱4,999/day): multi-cam YouTube streaming + in-house/offline live, camera switching, overlays, a live highlight generator, and routing Photowall + LED Wall to every venue screen — connect multiple cameras (phones or DSLRs; the camera bridge is included, no per-camera fee), control multiple screens. The single-camera YouTube livestream stays free.'
 WHERE service_code = 'PANOOD_SYSTEM';

COMMIT;
