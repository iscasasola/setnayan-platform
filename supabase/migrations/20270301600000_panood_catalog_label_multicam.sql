-- Panood admin pricelist — multicam controller reprice + label/description.
--
-- Owner packaging lock 2026-06-26: Panood = FREE single-camera YouTube livestream
-- + PAID multicam control room. The PANOOD_SYSTEM row in
-- public.platform_retail_catalog_v2 IS the paid multicam tier. The owner set the
-- new price at ₱4,999/day (up from ₱2,499) and the tier's coverage to the full
-- 9-feature controller (multi-cam YouTube + in-house live · camera switching ·
-- overlays · highlight generator (live replays) · Photowall→screen · LED-wall→
-- screen · extended screen control · multiple cameras · multiple screens).
--
-- No standalone SKU is retired (owner 2026-06-26): the post-event edit SKUs
-- (AI Highlight / SDE / Thank You) stay separate from Panood's LIVE-replay
-- highlight generator, and the PhotoWall / Live-Background (LED) content SKUs
-- stay separate — Panood ROUTES their content to venue screens.
--
-- retail_price_php IS changed here (owner-directed). saas_overhead_cost_php and
-- every other column are left untouched. Additive + idempotent — safe to re-run.
-- Applies on the next `supabase db push` (DB creds currently stale); the live
-- catalog is also updated out-of-band so the price shows immediately.

BEGIN;

UPDATE public.platform_retail_catalog_v2
   SET title            = 'Panood — Multicam control room',
       retail_price_php = 4999,
       description      = 'The paid multicam controller (₱4,999/day): multi-cam YouTube streaming + in-house/offline live, camera switching, overlays, a live highlight generator, and routing Photowall + LED Wall to every venue screen — connect multiple cameras, control multiple screens. The single-camera YouTube livestream stays free.'
 WHERE service_code = 'PANOOD_SYSTEM';

COMMIT;
