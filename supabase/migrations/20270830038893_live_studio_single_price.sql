-- live_studio_single_price
--
-- ONE Live Studio price: ₱2,500/day unlocks everything (owner-locked 2026-07-21).
--
-- Collapses the two device tiers into a single SKU. `PANOOD_SYSTEM` becomes simply
-- "Live Studio" at ₱2,500/day and grants the full capability — 8 cameras, offline-capable,
-- both console layouts. `PANOOD_SYSTEM_MOBILE` (₱1,500) is deactivated.
--
-- WHY THIS IS A CLEANUP, NOT A REPRICE. The Mobile tier was never purchasable: the only buy
-- surface in the app (dashboard/[eventId]/studio/panood/page.tsx) posts `PANOOD_SYSTEM` and
-- nothing else, and its own comment already calls it "a single per-day multicam SKU". The row
-- existed in the catalog and was advertised on /pricing, but no code path could sell it —
-- confirmed against prod: **zero `PANOOD_SYSTEM_MOBILE` orders, ever.** So this ratifies the
-- shipped behaviour and stops the public pricing page advertising a phantom ₱1,500 product.
--
-- NO GRANDFATHERING CLAUSE IS NEEDED — and none is written. Deactivating a catalog row does not
-- revoke anything: entitlement reads off `orders.status`, so a hypothetical historical holder
-- would keep their access. There are none.
--
-- The device split survives where it belongs: as a LAYOUT decision made from the operator's
-- hardware (lib/panood-console-layout.ts), never from what they paid. A phone operator and a
-- laptop operator now buy the same thing and each get the console their device can run.
--
-- Idempotent.

-- Retitle: the SKU is no longer "the Desktop one of two".
UPDATE public.platform_retail_catalog_v2
SET    title       = 'Live Studio',
       description = 'The full multicam control room for your event day — connect up to 8 cameras, switch angles live, add overlays and split cam, and reach remote guests through your own YouTube. Works on a laptop or a phone. Per event-day.',
       updated_at  = now()
WHERE  service_code = 'PANOOD_SYSTEM'
  AND  (title IS DISTINCT FROM 'Live Studio');

-- Price is already ₱2,500 (migration 20270827190298). Re-assert so this migration alone is
-- sufficient to reach the owner-locked state on any environment.
UPDATE public.platform_retail_catalog_v2
SET    retail_price_php = 2500.00,
       updated_at       = now()
WHERE  service_code     = 'PANOOD_SYSTEM'
  AND  retail_price_php IS DISTINCT FROM 2500.00;

-- Retire the never-sellable Mobile row so /pricing stops advertising it.
UPDATE public.platform_retail_catalog_v2
SET    is_active  = FALSE,
       updated_at = now()
WHERE  service_code = 'PANOOD_SYSTEM_MOBILE'
  AND  is_active IS DISTINCT FROM FALSE;

DO $$
DECLARE
  v_price  numeric;
  v_mobile boolean;
  v_orders integer;
BEGIN
  SELECT retail_price_php INTO v_price
    FROM public.platform_retail_catalog_v2 WHERE service_code = 'PANOOD_SYSTEM';
  SELECT is_active INTO v_mobile
    FROM public.platform_retail_catalog_v2 WHERE service_code = 'PANOOD_SYSTEM_MOBILE';

  IF v_price IS NULL THEN
    RAISE EXCEPTION 'PANOOD_SYSTEM missing from platform_retail_catalog_v2';
  END IF;
  IF v_price <> 2500.00 THEN
    RAISE EXCEPTION 'Live Studio price did not settle (got %, expected 2500)', v_price;
  END IF;
  IF v_mobile IS NOT NULL AND v_mobile THEN
    RAISE EXCEPTION 'PANOOD_SYSTEM_MOBILE is still active';
  END IF;

  -- Informational: prove the no-grandfathering claim on whatever environment this runs against,
  -- rather than trusting the comment above. Never fails the migration.
  SELECT count(*) INTO v_orders FROM public.orders WHERE service_key = 'PANOOD_SYSTEM_MOBILE';
  IF v_orders > 0 THEN
    RAISE NOTICE 'NOTE: % historical PANOOD_SYSTEM_MOBILE order(s) exist. They keep access (entitlement reads orders.status); only the catalog row is retired.', v_orders;
  END IF;
END $$;
