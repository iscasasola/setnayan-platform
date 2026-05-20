-- ============================================================================
-- 20260523010000_launch_promo_until_jan_2027_relock.sql
--
-- Re-locks the launch promo end date from 2027-03-31 → 2027-01-30 to align
-- the sunset with the end of peak Filipino wedding-search season (Jan-Mar).
-- Aligns the DB with the TS constant flip in apps/web/lib/sku-catalog.ts
-- (LAUNCH_PROMO_UNTIL = 2027-01-30T23:59:59+08:00).
--
-- Source: CLAUDE.md decision log row 2026-05-20
--   "15-month → 8-month launch promo locked: FREE Pro + 50km radius for
--    all new vendors until Jan 30, 2027."
--
-- Behavior: every row in service_catalog whose launch_promo_until was set
-- to the original 2027-03-31 23:59:59+08:00 by migration
-- 20260518100000_launch_promo_until_mar_2027.sql is updated to
-- 2027-01-30 23:59:59+08:00. Any rows that already hold a different
-- timestamp are left alone (defensive — preserves manual admin overrides
-- and any newer rows seeded with a different promo end).
--
-- Idempotent. No new columns, no drops. Re-running this on top of itself
-- is a no-op because the WHERE clause filters on the original Mar 31
-- timestamp.
-- ============================================================================

BEGIN;

UPDATE public.service_catalog
   SET launch_promo_until = '2027-01-30 23:59:59+08'::TIMESTAMPTZ,
       updated_at = NOW()
 WHERE launch_promo_until = '2027-03-31 23:59:59+08'::TIMESTAMPTZ;

COMMIT;
