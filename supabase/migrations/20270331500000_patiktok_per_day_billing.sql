-- ============================================================================
-- 20270331500000_patiktok_per_day_billing.sql
--
-- Patiktok is billed PER EVENT-DAY at ₱1,499/day (owner 2026-07-01).
--
-- The un-retire (20270331200000) restored PATIKTOK_COMPILER at ₱1,499 with
-- billing_period='one_time' (flat). The owner clarified the model is per-day —
-- same event-day shape as Panood ("covers one event-day; add a day wherever").
-- The PRICE is unchanged (₱1,499, admin-managed); only the billing UNIT becomes
-- per-day so the buy surface renders "₱1,499 / day".
--
-- billing_period is DISPLAY-ONLY in the charge path: formatBillingPeriodSuffix
-- appends the unit ("" / " / 28 days" / now " / day"); the amount charged is
-- always retail_price_php. There is NO generic "recurring if billing_period <>
-- one_time" logic — the SETNAYAN_AI subscription/renewal is keyed on that
-- specific SKU, not on billing_period — so 'per_day' is a pure display unit and
-- charges a flat ₱1,499 per purchase (the couple activates it per event-day,
-- exactly like Panood). The CHECK constraint only allowed ('one_time','per_28d'),
-- so it must be widened before the UPDATE.
--
-- Idempotent.
-- ============================================================================

BEGIN;

-- 1. Widen the billing_period CHECK to allow 'per_day'. Drop whatever the
--    existing billing_period check is named (robust to the auto-generated name)
--    then re-add the widened constraint.
DO $$
DECLARE c TEXT;
BEGIN
  FOR c IN
    SELECT conname
      FROM pg_constraint
     WHERE conrelid = 'public.platform_retail_catalog_v2'::regclass
       AND contype = 'c'
       AND pg_get_constraintdef(oid) ILIKE '%billing_period%'
  LOOP
    EXECUTE format('ALTER TABLE public.platform_retail_catalog_v2 DROP CONSTRAINT %I', c);
  END LOOP;
END $$;

ALTER TABLE public.platform_retail_catalog_v2
  ADD CONSTRAINT platform_retail_catalog_v2_billing_period_check
  CHECK (billing_period IN ('one_time', 'per_28d', 'per_day'));

-- 2. Flip Patiktok to per-day. Price (retail_price_php) is left untouched —
--    admin-managed; this only changes the billing UNIT.
UPDATE public.platform_retail_catalog_v2
   SET billing_period = 'per_day'
 WHERE service_code = 'PATIKTOK_COMPILER'
   AND billing_period IS DISTINCT FROM 'per_day';

COMMIT;
