-- Owner rulings, specs DECISION_LOG "Seven open calls settled", items 6 and 7.
--
--   6. PAPIC_GUEST_150: the gift price equals the retail price. Prod read
--      (SELECT, 23 Nov 2026): retail_price_php 99.00, gift_price_php 90.00.
--   7. The Video booth is retired. Prod read: onboarding_refinement_options
--      leaf_key 'photo_booth', option_key 'Patiktok' (label_en 'Video booth')
--      is still 'active'. 'retired' is an existing status value (CHECK on the
--      table since 20260927000001_onboarding_refinements).
--
-- DATA ONLY. No schema change. Each UPDATE is guarded on the old value, so an
-- admin edit made after the read above is never overwritten, and a replay (or a
-- database without the row) is a no-op.

BEGIN;

UPDATE public.platform_retail_catalog_v2
   SET gift_price_php = 99
 WHERE service_code = 'PAPIC_GUEST_150'
   AND gift_price_php = 90;

UPDATE public.onboarding_refinement_options
   SET status = 'retired'
 WHERE leaf_key = 'photo_booth'
   AND option_key = 'Patiktok'
   AND status = 'active';

COMMIT;
