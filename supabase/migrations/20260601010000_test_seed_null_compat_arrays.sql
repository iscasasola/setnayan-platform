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
-- ORIGINAL INTENT (preserved as comment): NULL was meant to signal "open
-- to all". BUT `vendor_profiles.compatible_ceremony_types` and
-- `compatible_venue_settings` were defined `NOT NULL DEFAULT '{}'` by
-- migration 20260521000000_iteration_0043_wedding_type_picker.sql — so
-- attempting `SET column = NULL` fails with 23502 violation.
--
-- FIX (2026-05-22): instead of NULL, set the compat arrays to the FULL
-- enum range. The .cs.{Y} clause then matches for any host ceremony_type
-- OR venue_setting, achieving "open to all" without violating the
-- NOT NULL constraint. Semantically equivalent.
--
-- Only touches test-` rows so production / PR #242 seeded data is
-- untouched. Idempotent — the WHERE clause filters on empty-array state
-- so re-runs after this migration applied won't re-match.
-- ============================================================================

BEGIN;

UPDATE public.vendor_profiles
SET
  compatible_ceremony_types = ARRAY[
    'catholic',
    'civil',
    'inc',
    'christian',
    'muslim',
    'cultural',
    'mixed'
  ]::TEXT[],
  compatible_venue_settings = ARRAY[
    'banquet_hall',
    'garden',
    'beach',
    'destination',
    'heritage',
    'outdoor_tent',
    'civil_registrar'
  ]::TEXT[]
WHERE business_slug LIKE 'test-%'
  AND (
       compatible_ceremony_types = ARRAY[]::TEXT[]
    OR compatible_venue_settings = ARRAY[]::TEXT[]
  );

COMMIT;
