-- Migration: provision iscasasolaii@gmail.com vendor account + remove prefilled vendors
--
-- WHY (2026-05-29 · 3 days from 2026-06-01 pilot launch):
-- Owner directive in this session:
--   (1) "Make sure that iscasasolaii@gmail.com has an active vendor account
--       just as if he created and signed it to have a vendor account"
--   (2) "Finally we want to remove all the vendors we prefilled the app."
--
-- "Prefilled" includes everything that wasn't created by a real user signup:
--   - The 960 test vendors seeded by
--     20260601000000_marketplace_test_seed_960_vendors.sql
--     (all carry is_demo=TRUE + business_slug LIKE 'test-%')
--   - The 59 admin-pre-created famous PH venues from
--     20260529000000_venue_directory_seed.sql
--     (all carry user_id IS NULL — meant to be claimed by real owners
--     via admin invite flow, but per owner directive: remove now;
--     real venues can be re-added via the vendor signup flow when they join)
--
-- Per CLAUDE.md 2026-05-15 dual-role lock: a single users row may carry
-- account_type='admin' AND own a vendor_profile row simultaneously. The
-- owner's §10a Internal Account flag (is_internal=TRUE) is untouched here —
-- only the additive vendor_profile is added so they pass roles.hasVendorAccess
-- and can navigate /vendor-dashboard with real data.
--
-- The owner's vendor profile is marked is_demo=FALSE + public_visibility='verified'
-- so they show as a fully active verified vendor in the marketplace AND pass
-- the layout gate at apps/web/app/vendor-dashboard/layout.tsx (which checks
-- roles.hasVendorAccess, computed in lib/roles.ts:165-167 as "owns
-- vendor_profile OR sits on vendor_team_members").
--
-- Cross-references:
--   - CLAUDE.md 2026-05-12 §10a Internal Accounts (owner's existing setup)
--   - CLAUDE.md 2026-05-15 dual-role lock (account_type + vendor_profile)
--   - CLAUDE.md 2026-05-16 row 8 vendor verification (normally 12-doc admin review;
--     owner directive bypasses this for the founder dogfood account)
--   - CLAUDE.md 2026-05-29 row "2 pilot blockers" (hasVendorAccess gate)
--   - apps/web/lib/roles.ts:165-167 (canonical hasVendorAccess rule)
--   - 20260601000000_marketplace_test_seed_960_vendors.sql (TEST seed)
--   - 20260529000000_venue_directory_seed.sql (famous PH venues seed)

-- ============================================================================
-- Step 0 · Drop broken phantom trigger `trigger_pioneer_verification_reward`
-- ============================================================================
-- DISCOVERED 2026-05-29 during this migration's first push attempt:
-- production has a trigger function called `trigger_pioneer_verification_reward`
-- that references `NEW.is_verified` and `OLD.is_verified` — but the column
-- `vendor_profiles.is_verified` does NOT exist (the real column is
-- `verification_state` per 20260630000000_verified_vendor_token_bonus_trigger.sql).
--
-- This trigger is NOT in any local migration source — it was created
-- out-of-band via Supabase Studio at some point and never made it back into
-- the migrations directory. Result: EVERY UPDATE / INSERT-with-ON-CONFLICT-
-- UPDATE on vendor_profiles fails with:
--   ERROR: record "new" has no field "is_verified" (SQLSTATE 42703)
--
-- This is very likely the root cause of the /vendor-dashboard Sentry digest
-- 1341067551 that PR #628, PR #631, and PR #632 collectively could not catch
-- — any UPDATE on vendor_profiles (saveVendorProfile action, last_seen
-- refresh, completeness recompute) would throw this error at the DB layer.
--
-- The legitimate verification trigger is `grant_verified_vendor_bonus` (from
-- 20260630000000_verified_vendor_token_bonus_trigger.sql) which correctly
-- uses `verification_state`. That trigger stays.
--
-- DROP IF EXISTS so this migration is idempotent · safe to re-run.

DROP TRIGGER IF EXISTS trigger_pioneer_verification_reward ON public.vendor_profiles;
DROP FUNCTION IF EXISTS public.trigger_pioneer_verification_reward() CASCADE;

-- ============================================================================
-- Step 1 · Probe pre-state (RAISE NOTICE shows in supabase db push output)
-- ============================================================================
DO $probe$
DECLARE
  v_owner_user_id UUID;
  v_total_before INT;
  v_demo_count INT;
  v_admin_count INT;
  v_test_slug_count INT;
  v_real_signup_count INT;
BEGIN
  -- Lookup owner user_id (case-insensitive)
  SELECT au.id INTO v_owner_user_id
  FROM auth.users au
  WHERE LOWER(au.email) = 'iscasasolaii@gmail.com'
  LIMIT 1;

  IF v_owner_user_id IS NULL THEN
    RAISE EXCEPTION 'Owner user iscasasolaii@gmail.com not found in auth.users — sign in once before running this migration';
  END IF;

  -- Count vendor_profiles by category
  SELECT COUNT(*) INTO v_total_before
    FROM public.vendor_profiles;
  SELECT COUNT(*) INTO v_demo_count
    FROM public.vendor_profiles WHERE is_demo = TRUE;
  SELECT COUNT(*) INTO v_admin_count
    FROM public.vendor_profiles WHERE user_id IS NULL;
  SELECT COUNT(*) INTO v_test_slug_count
    FROM public.vendor_profiles WHERE business_slug LIKE 'test-%';
  SELECT COUNT(*) INTO v_real_signup_count
    FROM public.vendor_profiles
    WHERE is_demo IS NOT TRUE
      AND user_id IS NOT NULL
      AND (business_slug IS NULL OR business_slug NOT LIKE 'test-%');

  RAISE NOTICE '─── PRE-STATE ───';
  RAISE NOTICE 'Owner user_id: %', v_owner_user_id;
  RAISE NOTICE 'vendor_profiles total: %', v_total_before;
  RAISE NOTICE '  is_demo=TRUE (test seed): %', v_demo_count;
  RAISE NOTICE '  user_id IS NULL (admin-pre-created): %', v_admin_count;
  RAISE NOTICE '  business_slug LIKE test-%%: %', v_test_slug_count;
  RAISE NOTICE '  real signups (preserved): %', v_real_signup_count;
END
$probe$;

-- ============================================================================
-- Step 2 · Delete prefilled vendor profiles
-- ============================================================================
-- Target: anything NOT created by a real signup flow.
-- Real signup = user_id IS NOT NULL AND is_demo IS NOT TRUE AND business_slug
-- doesn't start with 'test-'.
--
-- The Postgres DELETE with CASCADE on the FK relationships should clean up
-- dependent rows automatically (vendor_team_members, vendor_services,
-- vendor_packages, etc. all defined ON DELETE CASCADE per their schemas).
-- If any FK constraint blocks the delete, the migration fails atomically
-- and we know exactly which child table needs explicit cleanup first.
DELETE FROM public.vendor_profiles
WHERE is_demo = TRUE
   OR user_id IS NULL
   OR business_slug LIKE 'test-%';

-- ============================================================================
-- Step 3 · Provision owner's vendor profile (idempotent)
-- ============================================================================
-- Inserts a new vendor_profiles row for iscasasolaii@gmail.com if none
-- exists; updates the existing row to verified-active state if one does.
-- ON CONFLICT (user_id) uses the UNIQUE constraint on user_id from the
-- canonical schema at 20260513120000_iteration_0022_vendor_dashboard.sql.
INSERT INTO public.vendor_profiles (
  user_id,
  business_name,
  business_slug,
  tagline,
  location_city,
  contact_email,
  services,
  public_visibility,
  is_demo
)
SELECT
  au.id,
  'Setnayan Founder · Ice',
  'setnayan-founder-ice',
  'Founder account for pilot dogfooding the vendor surface',
  'Quezon City',
  'iscasasolaii@gmail.com',
  ARRAY['photography']::TEXT[],
  'verified',
  FALSE
FROM auth.users au
WHERE LOWER(au.email) = 'iscasasolaii@gmail.com'
ON CONFLICT (user_id) DO UPDATE
SET
  business_name    = EXCLUDED.business_name,
  business_slug    = EXCLUDED.business_slug,
  tagline          = EXCLUDED.tagline,
  location_city    = EXCLUDED.location_city,
  contact_email    = EXCLUDED.contact_email,
  services         = EXCLUDED.services,
  public_visibility = 'verified',
  is_demo          = FALSE,
  updated_at       = NOW();

-- ============================================================================
-- Step 4 · Verify post-state
-- ============================================================================
DO $verify$
DECLARE
  v_total_after INT;
  v_remaining_demo INT;
  v_remaining_admin INT;
  v_owner_vendor_profile_id UUID;
  v_owner_public_id TEXT;
  v_owner_visibility TEXT;
  v_owner_slug TEXT;
BEGIN
  SELECT COUNT(*) INTO v_total_after
    FROM public.vendor_profiles;
  SELECT COUNT(*) INTO v_remaining_demo
    FROM public.vendor_profiles WHERE is_demo = TRUE;
  SELECT COUNT(*) INTO v_remaining_admin
    FROM public.vendor_profiles WHERE user_id IS NULL;

  SELECT vp.vendor_profile_id, vp.public_id, vp.public_visibility, vp.business_slug
    INTO v_owner_vendor_profile_id, v_owner_public_id, v_owner_visibility, v_owner_slug
    FROM public.vendor_profiles vp
    JOIN auth.users au ON au.id = vp.user_id
    WHERE LOWER(au.email) = 'iscasasolaii@gmail.com';

  RAISE NOTICE '─── POST-STATE ───';
  RAISE NOTICE 'vendor_profiles total: %', v_total_after;
  RAISE NOTICE '  is_demo=TRUE remaining: %', v_remaining_demo;
  RAISE NOTICE '  user_id IS NULL remaining: %', v_remaining_admin;
  RAISE NOTICE 'Owner vendor_profile_id: %', v_owner_vendor_profile_id;
  RAISE NOTICE 'Owner public_id: %', v_owner_public_id;
  RAISE NOTICE 'Owner public_visibility: %', v_owner_visibility;
  RAISE NOTICE 'Owner business_slug: %', v_owner_slug;
  RAISE NOTICE 'Owner microsite URL: https://www.setnayan.com/v/%', v_owner_slug;

  -- Sanity assertions
  IF v_owner_vendor_profile_id IS NULL THEN
    RAISE EXCEPTION 'Owner vendor_profile was NOT created — migration failed silently';
  END IF;
  IF v_owner_visibility <> 'verified' THEN
    RAISE EXCEPTION 'Owner vendor_profile visibility is %, expected verified', v_owner_visibility;
  END IF;
  IF v_remaining_demo > 0 THEN
    RAISE WARNING 'is_demo=TRUE rows remain: % — investigate', v_remaining_demo;
  END IF;
END
$verify$;
