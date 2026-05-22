-- ============================================================================
-- 20260607010000_unflag_test_seed_as_demo.sql
--
-- Fix: marketplace returns 0 vendors for every category search.
--
-- Owner reported 2026-05-22: searching wedding coordinator on /vendors shows
-- "No vendors match exactly" with 0 results. Same for any other category
-- search. Investigation traced the root cause to migration
-- 20260603201000_demo_vendor_fixtures_schema.sql, which when it landed
-- ran:
--
--   UPDATE vendor_profiles
--   SET is_demo = TRUE, demo_batch_id = ...
--   WHERE business_slug LIKE 'test-%';
--
-- on the assumption that 'test-%'-prefixed vendors were fixtures. That
-- assumption was wrong for THIS data set: the 960 vendors from the
-- 20260601000000_marketplace_test_seed_960_vendors.sql seed all carry
-- `business_slug LIKE 'test-%'` AND are intended to populate the public
-- marketplace surface for pilot browsing — they're public coming_soon
-- vendors, not admin-private demo fixtures.
--
-- The marketplace query at apps/web/app/vendors/page.tsx filters out
-- `is_demo=TRUE` rows unless `?demo=1` is set. With the 960-seed flagged
-- as demo, the entire marketplace renders empty.
--
-- This migration reclassifies the 960-seed: flip `is_demo` back to FALSE
-- for vendors whose business_slug matches the 960-seed pattern (the
-- 20260601000000 seed uses `format('test-%s-%s-%s', canonical, pos, city)`
-- which always produces a slug with at least 3 hyphen segments after
-- 'test-'). Real admin-created demo fixtures (from
-- demo_vendor_fixtures_schema's intended workflow) follow a different
-- slug pattern and stay flagged.
--
-- Idempotent — re-running flips no rows because the WHERE clause
-- already finds them as is_demo=TRUE on the first pass.
--
-- Cross-ref: CLAUDE.md decision-log row for this fix.
-- ============================================================================

BEGIN;

-- Flip the 960-test-seed vendors back to non-demo so they surface on the
-- public marketplace. The 'test-%-%-%-%' pattern matches the 960-seed
-- slug shape (`test-<canonical>-<pos>-<city>`) exactly — 3+ hyphens after
-- 'test-'. Real admin demo fixtures from the dedicated fixture script
-- use a different slug pattern and aren't matched here.
UPDATE public.vendor_profiles
SET
  is_demo = FALSE,
  -- Clear the legacy demo_batch_id assigned by the earlier overreach
  -- backfill. demo_batch_id is for grouping fixture batches; without
  -- the is_demo flag the value is meaningless.
  demo_batch_id = NULL
WHERE is_demo = TRUE
  AND business_slug LIKE 'test-%-%-%';

-- Confirm via NOTICE so the supabase CLI output shows the row count.
DO $$
DECLARE
  affected INT;
  remaining_demo INT;
  marketplace_surface INT;
BEGIN
  -- The UPDATE above already ran; report the post-state counts so the
  -- operator sees a clear before/after pair when the migration applies.
  SELECT COUNT(*) INTO remaining_demo
  FROM public.vendor_profiles WHERE is_demo = TRUE;
  SELECT COUNT(*) INTO marketplace_surface
  FROM public.vendor_profiles
  WHERE is_demo = FALSE
    AND public_visibility IN ('coming_soon', 'verified')
    AND business_name IS NOT NULL
    AND business_name <> '';
  RAISE NOTICE 'Marketplace surface post-fix: % vendors browseable (% rows still flagged is_demo=TRUE)',
    marketplace_surface, remaining_demo;
END $$;

COMMIT;
