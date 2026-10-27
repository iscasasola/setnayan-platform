-- one_price_app_store_equals_website
--
-- 💲 THE ONE PRICE — APP STORE = WEBSITE (owner, 2026-10-28; corpus DECISION_LOG
-- "THE ONE PRICE — APP STORE = WEBSITE"). The owner typed each App Store price on
-- the price sheet; App Store Connect already carries these figures. This sets the
-- SAME figure as the website's regular price, row by row, so one item has one
-- price wherever it is bought.
--
-- • `retail_price_php` ← the owner's App Store price (PHP, whole pesos).
-- • `onboarding_price_php` ← NULL on the same rows: the per-row sign-up overrides
--   were set against the OLD prices. With them cleared, the set-up / welcome price
--   is the house dial (`platform_settings.onboarding_discount_pct`, 40) of the NEW
--   price — one rule, `lib/onboarding-discount.ts` `setupPricePhp`.
-- • `is_active` is NOT touched: Setnayan AI tiers B / C / D stay price-source-only.
--
-- ⚠ SHIPS WITH the App Store check in `lib/iap/fulfil.server.ts`
-- (`appStorePriceMatchesWeb`, same PR). The retired "web ÷ 0.85" floor would
-- fault-log every App Store sale at these prices.
--
-- 🔒 EACH UPDATE MUST TOUCH EXACTLY ITS ROW. A zero-row UPDATE is success-shaped —
-- a renamed or missing service_code would leave the old price standing with a
-- green migration — so every row count is asserted and the migration RAISES.
--
-- Idempotent: re-applying matches the same 13 rows and writes the same values.

DO $$
DECLARE
  r record;
  n integer;
BEGIN
  FOR r IN
    SELECT * FROM (VALUES
      ('COUPLE_WEBSITE_PRO', 6590::numeric),
      ('LIVE_STUDIO',        3300::numeric),
      ('PAPIC_GUEST_100',      95::numeric),
      ('PAPIC_GUEST_500',     465::numeric),
      ('PAPIC_GUEST_1K',      929::numeric),
      ('PAPIC_GUEST_5K',     3690::numeric),
      ('PAPIC_GUEST_10K',    5950::numeric),
      ('SETNAYAN_AI',        3300::numeric),
      ('SETNAYAN_AI_B',      1980::numeric),
      ('SETNAYAN_AI_C',      1190::numeric),
      ('SETNAYAN_AI_D',       265::numeric),
      ('PAKANTA',            3300::numeric),
      ('PATIKTOK_COMPILER',  1980::numeric)
    ) AS p(service_code, price)
  LOOP
    UPDATE public.platform_retail_catalog_v2
       SET retail_price_php     = r.price,
           onboarding_price_php = NULL
     WHERE service_code = r.service_code;
    GET DIAGNOSTICS n = ROW_COUNT;
    IF n <> 1 THEN
      RAISE EXCEPTION 'one price: % matched % row(s) of platform_retail_catalog_v2, expected exactly 1', r.service_code, n;
    END IF;
  END LOOP;
END
$$;
