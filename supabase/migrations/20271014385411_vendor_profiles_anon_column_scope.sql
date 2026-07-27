-- =====================================================================
-- Close anon column exposure on public.vendor_profiles.
--
-- WHY: table-level SELECT is granted to anon on all 93 columns, and the
-- RLS policy vendor_profiles_public_read admits roles {anon, authenticated}
-- for every verified vendor. RLS filters ROWS; it cannot hide COLUMNS. The
-- exposed set includes a complete BIR/Form-2307 tax identity (tin_number,
-- tin_type, registered_business_name, registered_address, registered_zip,
-- bir_service_category), DTI/SEC registration numbers, the business owner's
-- personal name, contact_phone, fraud-enforcement state, and user_id.
--
-- SCOPE: anon ONLY. `authenticated` is deliberately left at table-level
-- SELECT -- apps/web/app/api/profile/export/route.ts:229 does select('*')
-- on the session client for the RA 10173 data-subject export, and a
-- column-level grant would 42501 it. Narrowing `authenticated` is tracked
-- separately and requires enumerating that export first. THE HOLE THIS
-- MIGRATION DOES NOT CLOSE: any logged-in user can still read every
-- verified vendor's TIN and registered address.
--
-- NO APPLICATION CODE CHANGES ARE REQUIRED. Every public/SEO surface that
-- reads this table already uses createAdminClient() (service_role), which
-- bypasses grants. Verified across all `.from('vendor_profiles')` call
-- sites; zero 'use client' modules query it. Do NOT "fix" a public page
-- in response to this migration -- that work is already done.
--
-- TRUNCATE: revoked deliberately. RLS is NEVER consulted for TRUNCATE, so
-- "there are no anon write policies" was never sufficient reasoning for
-- leaving it granted. Not reachable via PostgREST today (no TRUNCATE verb,
-- anon is NOLOGIN); the realistic path is a future anon-callable SECURITY
-- INVOKER RPC. Cost to remove is zero.
--
-- Verified against prod 2026-07-27 before writing: 93 columns (91 at audit
-- time + inner_radius_km/outer_radius_km from PR #3816, neither sensitive
-- nor referenced by the view or any policy); vendor_market_stats is still
-- security_invoker=true; anon+authenticated each hold all 7 table
-- privileges; PUBLIC holds none; service_role and postgres hold their own
-- explicit grants and are therefore untouched by the REVOKE below.
--
-- IDEMPOTENT: REVOKE-then-GRANT is safe to re-apply.
-- =====================================================================

BEGIN;

-- ---------------------------------------------------------------------
-- 1. Revoke everything from the low-trust roles. Always name the roles;
--    a bare `FROM PUBLIC` leaves the role-specific grants in place
--    (supabase/security/README.md:126-133).
--    NOTE: `authenticated` is intentionally ABSENT from this REVOKE.
-- ---------------------------------------------------------------------
REVOKE ALL ON TABLE public.vendor_profiles FROM PUBLIC;
REVOKE ALL ON TABLE public.vendor_profiles FROM anon;

-- ---------------------------------------------------------------------
-- 2. Re-grant SELECT on exactly the columns anon must still reach.
--
--    Columns 1-19 are precisely what public.vendor_market_stats projects
--    from this table (confirmed against the LIVE view body, not the
--    migration that created it). That view is WITH (security_invoker =
--    true), so an anon SELECT on the VIEW is evaluated against anon's own
--    column privileges on THIS table. Without these 19,
--    GET /rest/v1/vendor_market_stats returns 42501 for every logged-out
--    caller -- a break that is INVISIBLE to CI, because the exposure
--    baseline still records the view as anon-granted.
--
--    is_published  -- required by policy vendor_ig_media_public_read
--    user_id       -- required by six owner-check policies on other tables
--                     whose USING clause inlines EXISTS (SELECT 1 FROM
--                     vendor_profiles ...). A policy runs as the querying
--                     role, so without it those anon reads flip from
--                     "returns []" to 42501.
--
--    NO WRITE GRANTS ARE RESTORED. anon gets SELECT on 21 of 93 columns
--    and nothing else.
-- ---------------------------------------------------------------------
GRANT SELECT (
  vendor_profile_id,
  public_id,
  business_name,
  business_slug,
  tagline,
  logo_url,
  services,
  location_city,
  hq_latitude,
  hq_longitude,
  contact_email,
  public_visibility,
  event_types,
  compatible_ceremony_types,
  compatible_venue_settings,
  created_at,
  hq_region,
  tier_state,
  verification_state,
  is_published,
  user_id
) ON public.vendor_profiles TO anon;

-- ---------------------------------------------------------------------
-- POST-CONDITION 1 -- the sensitive set is NOT anon-selectable.
-- has_column_privilege() returns the EFFECTIVE privilege (table-level OR
-- column-level), so this catches a leftover table grant too.
-- ---------------------------------------------------------------------
DO $$
DECLARE
  leaked text[];
  denied CONSTANT text[] := ARRAY[
    'tin_number','tin_type','registered_business_name','registered_address',
    'registered_zip','bir_service_category','registration_number_raw',
    'registration_number_normalized','registration_number_submitted_at',
    'registration_number_needs_review','business_owner_name','contact_phone',
    'hq_address','fraud_suspended_at','fraud_banned_at','fraud_tombstoned',
    'created_by_admin_user_id','is_demo','demo_batch_id','is_founder',
    'ai_addon_expires_at','ai_addon_trial_used_at','ai_addon_level',
    'booth_addon_expires_at','booth_addon_trial_used_at','extra_agent_seats',
    'next_renewal_due_at','tier_expires_at','tier_billing_cycle',
    'absorbs_convenience_fee','demotion_count','last_demoted_at',
    'last_verified_at','experience_verified_at','experience_verified_by',
    'name_revealed_at','real_name_unlocked_at','max_soft_holds_per_date',
    'max_waitlist_acceptances','show_team_bookings_in_backend_count',
    'social_feature_opt_out','social_featured_at','social_post_url'
  ];
BEGIN
  SELECT array_agg(c)
    INTO leaked
    FROM unnest(denied) AS c
   WHERE EXISTS (
           SELECT 1 FROM information_schema.columns
            WHERE table_schema='public' AND table_name='vendor_profiles'
              AND column_name = c
         )
     AND has_column_privilege('anon','public.vendor_profiles', c, 'SELECT');

  IF leaked IS NOT NULL THEN
    RAISE EXCEPTION
      'POST-CONDITION FAILED: anon can still SELECT % column(s) on public.vendor_profiles: %',
      cardinality(leaked), leaked;
  END IF;
END $$;

-- ---------------------------------------------------------------------
-- POST-CONDITION 2 -- the intended-public set IS still anon-selectable,
-- and the view-derived half is checked against the LIVE view definition
-- rather than a hardcoded copy. If a future migration adds a
-- vendor_profiles column to vendor_market_stats without extending this
-- grant, THAT migration fails at apply time instead of 500-ing in prod.
-- ---------------------------------------------------------------------
DO $$
DECLARE
  missing text[];
  needed CONSTANT text[] := ARRAY[
    'vendor_profile_id','public_id','business_name','business_slug','tagline',
    'logo_url','services','location_city','hq_latitude','hq_longitude',
    'contact_email','public_visibility','event_types','compatible_ceremony_types',
    'compatible_venue_settings','created_at','hq_region','tier_state',
    'verification_state','is_published','user_id'
  ];
  viewdef text;
  strays text[];
BEGIN
  SELECT array_agg(c)
    INTO missing
    FROM unnest(needed) AS c
   WHERE NOT has_column_privilege('anon','public.vendor_profiles', c, 'SELECT');

  IF missing IS NOT NULL THEN
    RAISE EXCEPTION
      'POST-CONDITION FAILED: anon LOST SELECT on intended-public column(s): %',
      missing;
  END IF;

  -- Drift guard: every vendor_profiles column named in the live view body
  -- must be anon-selectable, or GET /rest/v1/vendor_market_stats 42501s.
  IF to_regclass('public.vendor_market_stats') IS NULL THEN
    RAISE EXCEPTION
      'POST-CONDITION FAILED: public.vendor_market_stats is missing -- the drift guard cannot run';
  END IF;

  viewdef := pg_get_viewdef('public.vendor_market_stats'::regclass, true);

  SELECT array_agg(c.column_name::text)
    INTO strays
    FROM information_schema.columns c
   WHERE c.table_schema='public' AND c.table_name='vendor_profiles'
     AND viewdef ~ ('\mvp\.' || c.column_name || '\M')
     AND NOT has_column_privilege('anon','public.vendor_profiles', c.column_name, 'SELECT');

  IF strays IS NOT NULL THEN
    RAISE EXCEPTION
      'POST-CONDITION FAILED: vendor_market_stats references vendor_profiles column(s) anon cannot read -- the view will 42501 for anon: %',
      strays;
  END IF;
END $$;

-- ---------------------------------------------------------------------
-- POST-CONDITION 3 -- anon holds NO table-level privilege of any kind,
-- and specifically no write bit. Catches the "REVOKE ran but something
-- re-granted" and "someone restored TRUNCATE" cases.
-- ---------------------------------------------------------------------
DO $$
DECLARE
  remaining text[];
  held     text[];
BEGIN
  SELECT array_agg(DISTINCT privilege_type::text)
    INTO remaining
    FROM information_schema.role_table_grants
   WHERE table_schema='public' AND table_name='vendor_profiles'
     AND grantee IN ('anon','PUBLIC');

  IF remaining IS NOT NULL THEN
    RAISE EXCEPTION
      'POST-CONDITION FAILED: table-level privilege(s) still held by anon/PUBLIC on public.vendor_profiles: % (column-level SELECT is expected and does NOT appear here)',
      remaining;
  END IF;

  -- BELT AND SUSPENDERS. information_schema.role_table_grants only exposes
  -- grants whose grantee is a CURRENTLY ENABLED role, so if this migration is
  -- ever applied by a role that is not a member of `anon`, the check above
  -- passes vacuously. has_table_privilege() has no such restriction, so the
  -- write bits are re-asserted authoritatively here.
  SELECT array_agg(p)
    INTO held
    FROM unnest(ARRAY['SELECT','INSERT','UPDATE','DELETE','TRUNCATE','REFERENCES','TRIGGER']) AS p
   WHERE has_table_privilege('anon','public.vendor_profiles', p);

  IF held IS NOT NULL THEN
    RAISE EXCEPTION
      'POST-CONDITION FAILED: anon still holds TABLE-level privilege(s) on public.vendor_profiles: % -- the REVOKE did not land',
      held;
  END IF;
END $$;

-- ---------------------------------------------------------------------
-- POST-CONDITION 4 -- anti-vacuity. If the sensitive columns do not exist
-- at all (wrong DB, drifted schema), post-condition 1 passes trivially.
-- Assert the table is the one we think it is.
-- ---------------------------------------------------------------------
DO $$
DECLARE
  n int;
BEGIN
  SELECT count(*) INTO n FROM information_schema.columns
   WHERE table_schema='public' AND table_name='vendor_profiles'
     AND column_name IN ('tin_number','registration_number_raw','business_owner_name','user_id');
  IF n <> 4 THEN
    RAISE EXCEPTION
      'ANTI-VACUITY FAILED: expected 4 canary columns on public.vendor_profiles, found % -- post-conditions would pass vacuously', n;
  END IF;
END $$;

-- ---------------------------------------------------------------------
-- POST-CONDITION 5 -- the server side must be UNAFFECTED. Every public
-- surface reads this table through createAdminClient() (service_role); if
-- the REVOKE above ever caught service_role, every logged-out vendor page
-- would 500. service_role holds its own explicit grant in prod and is not
-- named in the REVOKE, so this asserts a fact rather than repairing one.
-- The `authenticated` assertion is the guard against a future editor
-- "improving" this migration by adding authenticated to the REVOKE.
-- ---------------------------------------------------------------------
DO $$
BEGIN
  IF NOT has_table_privilege('service_role','public.vendor_profiles','SELECT') THEN
    RAISE EXCEPTION
      'POST-CONDITION FAILED: service_role lost SELECT on public.vendor_profiles -- every public vendor surface would 500';
  END IF;
  IF NOT has_column_privilege('authenticated','public.vendor_profiles','tin_number','SELECT') THEN
    RAISE EXCEPTION
      'POST-CONDITION FAILED: authenticated lost SELECT on tin_number -- the RA 10173 data-subject export (api/profile/export) does select(*) and would 42501. This migration must NOT touch `authenticated`.';
  END IF;
END $$;

COMMIT;
