-- Camera Bridge reprice → ₱200 per camera, per day (owner-set 2026-06-26, in the
-- Panood multicam context; was ₱100/seat/day).
--
-- CAMERA_BRIDGE is the shared DSLR/external-camera bridge SKU (used by both Papic
-- and Panood to connect a non-phone camera). The live catalog was already updated
-- out-of-band via SQL (db push creds currently stale); this migration mirrors it
-- so a fresh rebuild and the next `db push` match the live value (no drift).
--
-- Price + "per camera" title only. The ₱2,000 daily cap is unchanged (at ₱200/cam
-- that caps a day at 10 cameras). Additive + idempotent — safe to re-run.

BEGIN;

UPDATE public.platform_retail_catalog_v2
   SET retail_price_php = 200,
       title            = 'Camera Bridge (per camera, per day · max ₱2,000)'
 WHERE service_code = 'CAMERA_BRIDGE';

COMMIT;
