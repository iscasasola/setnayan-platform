-- one_price_app_store_equals_website
--
-- 💲 THE ONE PRICE — APP STORE = WEBSITE (owner, 2026-10-28; corpus DECISION_LOG
-- "THE ONE PRICE — APP STORE = WEBSITE"). The owner typed each App Store price on
-- the price sheet; App Store Connect already carries these figures. This sets the
-- SAME figure as the website's regular price, row by row, so one item has one
-- price wherever it is bought.
--
-- • `retail_price_php` ← the owner's App Store price (PHP, whole pesos).
-- • `onboarding_price_php`: the sign-up copies were set against the OLD prices, so
--   each becomes the house dial (`platform_settings.onboarding_discount_pct`, 40)
--   of the NEW price — the owner's intent ("the welcome is the house 40% of the
--   new price"), written the way the shipped model writes it:
--     – the Papic rungs and the Setnayan AI bands (`familyForServiceCode`) STORE
--       a derived copy — `signupPriceFor(regular, pct)`, nearest peso, ties down
--       — which the admin dial save re-derives (migration
--       20271260581880_one_signup_discount_is_forty.sql). A NULL there would be
--       read as "no sign-up discount" by the Setnayan AI resolvers.
--     – the other four rows (Event Hub Pro, Live Watch, Music Maker, Patiktok)
--       are set to NULL: no override, so `setupPricePhp` applies the dial live.
--       Event Hub Pro's owner-set ₱3,000 (2026-09-25) was 40% of ₱5,000; at
--       ₱6,590 the dial gives ₱3,954.
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
  v_pct numeric;
BEGIN
  SELECT onboarding_discount_pct INTO v_pct FROM public.platform_settings WHERE id = 1;
  IF v_pct IS NULL OR v_pct < 0 OR v_pct >= 100 THEN
    RAISE EXCEPTION 'one price: onboarding_discount_pct is %, cannot derive the sign-up copies', v_pct;
  END IF;

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
           onboarding_price_php = CASE
             WHEN r.service_code LIKE 'PAPIC_GUEST%'
               OR r.service_code IN ('SETNAYAN_AI', 'SETNAYAN_AI_B', 'SETNAYAN_AI_C', 'SETNAYAN_AI_D')
             THEN CASE
                    WHEN (r.price * (1 - v_pct / 100)) - FLOOR(r.price * (1 - v_pct / 100)) = 0.5
                      THEN FLOOR(r.price * (1 - v_pct / 100))
                    ELSE ROUND(r.price * (1 - v_pct / 100), 0)
                  END
             ELSE NULL
           END,
           updated_at = NOW()
     WHERE service_code = r.service_code;
    GET DIAGNOSTICS n = ROW_COUNT;
    IF n <> 1 THEN
      RAISE EXCEPTION 'one price: % matched % row(s) of platform_retail_catalog_v2, expected exactly 1', r.service_code, n;
    END IF;
  END LOOP;
END
$$;
