-- ============================================================================
-- 20260601010000_test_seed_null_compat_arrays.sql
--
-- Companion fix for the test-data marketplace seed shipped in
-- 20260601000000_marketplace_test_seed_960_vendors.sql. That migration
-- set `compatible_ceremony_types = ARRAY[]::TEXT[]` and
-- `compatible_venue_settings = ARRAY[]::TEXT[]` (empty arrays), intending
-- empty = "open to all".
--
-- But the marketplace's Match-my-wedding filter checks
-- `compatible_X.is.null OR compatible_X.cs.{Y}` — empty arrays satisfy
-- NEITHER clause (an empty array isn't NULL, and doesn't contain Y), so
-- every test vendor gets hidden when a couple has Match my wedding ON.
--
-- The actual "open to all" sentinel everywhere else in the codebase is
-- NULL. Bring the test rows in line so they surface for any ceremony_type
-- + venue_setting combination.
--
-- Only touches test-` rows so production / PR #242 seeded data is
-- untouched. Idempotent.
-- ============================================================================

BEGIN;

UPDATE public.vendor_profiles
SET
  compatible_ceremony_types = NULL,
  compatible_venue_settings = NULL
WHERE business_slug LIKE 'test-%'
  AND (
       compatible_ceremony_types = ARRAY[]::TEXT[]
    OR compatible_venue_settings = ARRAY[]::TEXT[]
  );

COMMIT;
