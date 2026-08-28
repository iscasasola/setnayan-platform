-- ════════════════════════════════════════════════════════════════════════════
-- LIVE STUDIO IS PRICED PER EVENT-DAY, AND ITS LABEL SAID OTHERWISE
--
-- ⚖ OWNER, 2026-08-28: *"per day."*
--
-- `LIVE_STUDIO` carried `billing_period = 'one_time'` in production. The
-- 2026-05-09 lock is explicit — *Live Studio, ONE SKU, per event-day, no
-- per-camera fee* — and its own retired predecessors `PANOOD_SYSTEM`,
-- `PANOOD_SYSTEM_MOBILE` and `LIVE_STUDIO_ROAM` are ALL correctly `per_day`.
-- Only the row actually on sale was wrong.
--
-- 🔑 THIS MOVES NO MONEY, AND THAT WAS MEASURED BEFORE IT WAS WRITTEN — the
-- obvious fear was that `per_day` multiplies a charge by the number of event
-- days, which would take a three-day celebration from PHP 3,000 to PHP 9,000.
-- It does not. Traced through every reader:
--   • `resolveRetailChargeCentavos` — THE charge path — does not even SELECT
--     `billing_period`. The column never reaches the arithmetic.
--   • Its ONLY consumer is `BILLING_PERIOD_SUFFIX` in lib/v2-catalog-pure.ts,
--     which maps the value to a display string (`' / day'`) appended to a price.
--   • `PATIKTOK_COMPILER` is already live at `per_day` and is not multiplied
--     either; that map's own comment says so: *"the amount is flat per purchase,
--     the couple activates it per day."*
-- ⇒ `per_day` is a LABEL everywhere in this product today. This corrects what a
-- customer READS on a price card — "PHP 3,000" becomes "PHP 3,000 / day" — and
-- changes nothing about what they are charged.
--
-- ⚠ A CLAIM THAT CAME WITH THIS TASK, CORRECTED: `billing_period` was described
-- as one of the fields nobody can edit, and therefore as a field that drifted
-- because it was unreachable. It is EDITABLE and has been:
-- `app/admin/pricing/_components/catalog-editor.tsx` renders a
-- `<select name="billing_period">` whose options include "Per day of the
-- celebration", and `lib/admin/pricing-row-diff.ts` validates and persists it.
-- The row drifted for some other reason; the "un-editable fields drift" lesson
-- is real but this row is not an instance of it. Worth saying, because acting on
-- the wrong cause is how the next one is missed.
--
-- Idempotent, and scoped to the single row by service_code.
-- ════════════════════════════════════════════════════════════════════════════

BEGIN;

UPDATE public.platform_retail_catalog_v2
   SET billing_period = 'per_day',
       updated_at = NOW()
 WHERE service_code = 'LIVE_STUDIO'
   AND billing_period IS DISTINCT FROM 'per_day';

COMMIT;

DO $$
DECLARE
  v_period TEXT;
  v_price  NUMERIC;
BEGIN
  SELECT billing_period, retail_price_php
    INTO v_period, v_price
    FROM public.platform_retail_catalog_v2
   WHERE service_code = 'LIVE_STUDIO';

  IF v_period IS NULL THEN
    RAISE EXCEPTION 'live studio: the LIVE_STUDIO row is missing';
  END IF;
  IF v_period <> 'per_day' THEN
    RAISE EXCEPTION 'live studio: billing_period is %, want per_day', v_period;
  END IF;

  -- ⚠ THE ASSERTION THAT MATTERS: this is a LABEL correction, so the PRICE must
  -- be untouched by it. If a future edit to this file ever moves the amount, it
  -- has stopped being the change it says it is.
  IF v_price IS DISTINCT FROM 3000 THEN
    RAISE NOTICE 'live studio: price is PHP % (not the PHP 3,000 this migration was written against) — '
                 'no price was changed here, but check the row is what you expect.', v_price;
  END IF;

  -- The whole Live Studio family should now agree, live row included.
  IF EXISTS (
    SELECT 1 FROM public.platform_retail_catalog_v2
     WHERE service_code IN ('LIVE_STUDIO','PANOOD_SYSTEM','PANOOD_SYSTEM_MOBILE','LIVE_STUDIO_ROAM')
       AND billing_period <> 'per_day'
  ) THEN
    RAISE EXCEPTION 'live studio: a row in the family still disagrees about per_day';
  END IF;
END $$;

-- ════════════════════════════════════════════════════════════════════════════
-- VERIFICATION:
--   SELECT service_code, retail_price_php, billing_period
--     FROM public.platform_retail_catalog_v2
--    WHERE service_code LIKE '%LIVE_STUDIO%' OR service_code LIKE 'PANOOD%';
--   -- → every row per_day · LIVE_STUDIO still PHP 3,000
-- ════════════════════════════════════════════════════════════════════════════
