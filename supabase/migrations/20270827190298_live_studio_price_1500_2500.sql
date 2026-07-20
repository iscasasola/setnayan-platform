-- live_studio_price_1500_2500
--
-- Live Studio device tiers repriced to the owner's 2026-07-17 per-service sheet.
--
--   Mobile Controller   PANOOD_SYSTEM_MOBILE   ₱1,299 → ₱1,500
--   Desktop Controller  PANOOD_SYSTEM          ₱2,499 → ₱2,500
--
-- Provenance: DECISION_LOG 2026-07-17 (artifact `reconciled-owner-prices`), confirmed
-- by the owner 2026-07-20. The round numbers are DELIBERATE — the 07-17 sheet re-bases
-- the catalog off the 2026-05-12 charm-pricing (-1 endings) convention across the board
-- (Pakanta ₱2,500 · 3D Plan Unlock ₱3,000 · Monogram Pro ₱999 → ₱1,000). Do NOT
-- "charm-correct" these back to ₱1,499 / ₱2,499.
--
-- Safe on existing orders: `orders` rows carry their own requested_total_php /
-- confirmed_total_php, so the 3 historical paid orders on these SKUs are unaffected.
-- Both SKUs remain "In build" / not purchasable — the gate is a real-event test, not price.
--
-- Idempotent: matches on service_code and re-asserts the target price.

UPDATE public.platform_retail_catalog_v2
SET    retail_price_php = 1500.00,
       updated_at       = now()
WHERE  service_code     = 'PANOOD_SYSTEM_MOBILE'
  AND  retail_price_php IS DISTINCT FROM 1500.00;

UPDATE public.platform_retail_catalog_v2
SET    retail_price_php = 2500.00,
       updated_at       = now()
WHERE  service_code     = 'PANOOD_SYSTEM'
  AND  retail_price_php IS DISTINCT FROM 2500.00;

DO $$
DECLARE
  v_mobile  numeric;
  v_desktop numeric;
BEGIN
  SELECT retail_price_php INTO v_mobile
    FROM public.platform_retail_catalog_v2 WHERE service_code = 'PANOOD_SYSTEM_MOBILE';
  SELECT retail_price_php INTO v_desktop
    FROM public.platform_retail_catalog_v2 WHERE service_code = 'PANOOD_SYSTEM';

  IF v_mobile IS NULL OR v_desktop IS NULL THEN
    RAISE EXCEPTION 'Live Studio SKU missing from platform_retail_catalog_v2 (mobile=%, desktop=%)',
      v_mobile, v_desktop;
  END IF;

  IF v_mobile <> 1500.00 OR v_desktop <> 2500.00 THEN
    RAISE EXCEPTION 'Live Studio reprice did not settle (mobile=%, expected 1500; desktop=%, expected 2500)',
      v_mobile, v_desktop;
  END IF;
END $$;
