-- =====================================================================
-- A SHOP'S TAX IDENTITY IS NOT READABLE BY EVERY SIGNED-IN ACCOUNT.
--
-- WHY: 20271014385411 closed this hole for `anon` and said, in its own
-- docblock, exactly what it was leaving open:
--
--     "SCOPE: anon ONLY. `authenticated` is deliberately left at
--      table-level SELECT ... THE HOLE THIS MIGRATION DOES NOT CLOSE:
--      any logged-in user can still read every verified vendor's TIN
--      and registered address."
--
-- This is that migration's second half. Measured in prod by the catalogue
-- immediately before writing (106 columns, not the 93 of the anon pass):
--   anon          -> 21 of 106 columns, and NONE of the eleven below.
--   authenticated -> 106 of 106, including all eleven.
-- Policy `vendor_profiles_public_read` admits {anon, authenticated} for
-- every verified shop, and RLS filters ROWS -- it can never hide a COLUMN.
-- So any couple, and any rival supplier, could read a verified shop's BIR
-- tax identity, its DTI/SEC registration number and its owner's personal
-- name straight off /rest/v1/vendor_profiles with the public anon key and
-- any signed-in session.
--
-- ── WHY THE ANON PASS COULD NOT DO THIS, AND WHY WE CAN NOW ────────────
-- That migration named ONE blocker: `app/api/profile/export/route.ts`
-- read vendor_profiles with `select('*')` on the SESSION client for the
-- RA 10173 subject-access export, so a column grant would 42501 it.
-- THAT BLOCKER IS GONE. Read on origin/main, not assumed: the route now
-- issues that read on the SERVICE-ROLE client, filtered `.eq('user_id',
-- user.id)`, with the named projection `VENDOR_PROFILE_EXPORT_SELECT`
-- (lib/export-vendor-profile-columns.ts). Its own docblock records the
-- change and says it was made for exactly this migration. Tests T11/T12
-- pin both halves. The export is therefore UNAFFECTED below.
--
-- ── THE DENIED ELEVEN ─────────────────────────────────────────────────
-- Deliberately the SAME axis, not the whole anon deny-list: the identity
-- documents a shop hands the government. Verification work about to start
-- is what FILLS these columns, which is why this is worth doing before it
-- rather than after.
--   tax identity (BIR / Form 2307):
--     tin_number, tin_type, registered_business_name, registered_address,
--     registered_zip, bir_service_category
--   government registration (DTI/SEC, anti-farm gate 20270925937630):
--     registration_number_raw, registration_number_normalized,
--     registration_number_submitted_at, registration_number_needs_review
--   the owner as a PRIVATE PERSON:
--     business_owner_name
--
-- ⚠ NOT harmless-because-empty, which is what the brief for this work
-- assumed. Measured in prod: tin_number, registered_address and
-- registration_number_raw are NULL on both shops -- but
-- `business_owner_name` IS SET on one of them, and that shop is
-- verified + publicly visible, so `vendor_profiles_public_read` admits
-- it. One real person's legal name is readable by every signed-in
-- account today. The tax columns are the FUTURE exposure; the owner name
-- is a LIVE one.
--
-- ⚠ NOT NARROWED HERE, on purpose: contact_phone, hq_address and the
-- fraud/enforcement + billing columns. anon cannot read them either, but
-- a signed-in couple reading a supplier's phone number is arguably the
-- product working. Widening this deny-list is a product call, not a
-- security repair, and a narrowing that also breaks a couple contacting
-- a supplier is worse than the exposure. Named, not attempted.
-- `authenticated` also still holds table-level TRUNCATE on this table
-- (RLS is NEVER consulted for TRUNCATE). Not reachable through PostgREST
-- today; named here so the next person does not have to rediscover it.
--
-- ── WHERE THE SHOP READS ITS OWN: public.vendor_profiles_self ──────────
-- Column privileges are ROLE-level, never row-level, so the moment the
-- REVOKE lands the SHOP CANNOT READ ITS OWN tin_number either -- and
-- PostgREST fails the WHOLE statement (42501), not the one column.
--
-- 🚨 AND THE FAILURE WOULD HAVE BEEN SILENT, WHICH IS THE WHOLE REASON
-- THIS MIGRATION SHIPS WITH CODE. `lib/vendor-profile.ts` retries its
-- FULL projection against LEGACY_VENDOR_PROFILE_SELECT on ANY error and
-- back-fills `business_owner_name: null`. So a naive revoke does not
-- crash the vendor dashboard: it makes the shop's own owner name read as
-- MISSING, and `businessProfileChecklist` then asks the supplier for
-- their own name -- the product asking again for something it is
-- holding. Four registration-number probes degrade the same way, and
-- `app/vendor-dashboard/verify/actions.ts` turns that into a HARD block:
-- the shop is redirected away from submitting verification because it
-- "has no registration number on file", forever.
--
-- So, exactly as SEC-2b (20271008731642) did for hosts with
-- `public.events_host`: a view over vendor_profiles, owned by postgres
-- with security_invoker = FALSE (definer semantics, so it is not subject
-- to the invoker's column grants), whose WHERE clause admits ONLY the
-- caller's own shops.
--
-- Its predicate is an EXACT MIRROR of the two RLS policies that already
-- govern this today -- `vendor_profiles_owner` (user_id = auth.uid()) and
-- `vendor_profiles_member_read` (vendor_profile_id IN
-- current_vendor_ids('viewer')) -- both read out of prod by
-- pg_get_expr/pg_get_functiondef, not from a migration file. The set of
-- people who can read these eleven columns is therefore UNCHANGED for
-- owners and teammates and CLOSED for everyone else. It deliberately
-- does NOT add an is_admin() arm: there is no admin RLS policy on a
-- CLAIMED vendor row (`vendor_profiles_admin_unclaimed_*` are both
-- gated on `user_id IS NULL`), and every admin surface that reads these
-- columns already runs on createAdminClient() -- /admin/verify,
-- /admin/corrections and the RA 10173 export were each checked by their
-- client, not by their name.
--
-- A VIEW rather than an RPC for SEC-2b's reason: the readers each select
-- a different mix of columns, and against a view every one of them is a
-- one-token edit -- `.from('vendor_profiles')` ->
-- `.from('vendor_profiles_self')` -- with the select string, the filters
-- and the row shape untouched.
--
-- It is READ-ONLY. A single-table view with a simple WHERE is
-- auto-updatable in Postgres, and an auto-updatable DEFINER view would
-- let a teammate UPDATE straight past vendor_profiles_owner. Only SELECT
-- is granted, and post-condition 7 asserts it.
--
-- ── WHAT IS UNAFFECTED ────────────────────────────────────────────────
--   * WRITES. This migration touches SELECT ONLY. `authenticated` keeps
--     its table-level INSERT/UPDATE/DELETE, so the shop editor,
--     /open-shop and the docs upload are untouched. Scanned mechanically:
--     of the 401 `.from('vendor_profiles')` call sites, FIFTEEN are
--     writes with a RETURNING projection and NONE of them returns a
--     denied column (the widest is 'vendor_profile_id, business_slug').
--   * anon. Not named in any statement here. Post-condition 3 asserts its
--     21-column surface is byte-identical afterwards.
--   * service_role / postgres. Not named. Every public and SEO surface
--     (app/v/[slug], the sitemap, the frontdoor, api/v1) already reads
--     this table through createAdminClient(); post-condition 5 asserts
--     service_role still holds table SELECT.
--   * public.vendor_market_stats -- security_invoker = true, and it
--     projects none of the eleven (checked against the LIVE view body).
--   * SECURITY DEFINER functions reading vendor_profiles: they run as
--     their owner, so the invoker's column privileges do not apply.
--   * RLS policy expressions on this table reference only user_id and
--     vendor_profile_id, both of which stay granted.
--
-- ── THE COST, STATED PLAINLY ──────────────────────────────────────────
-- After this, `authenticated` has NO table-level SELECT on
-- vendor_profiles, so a column added by a future migration is born
-- UNREADABLE to every signed-in caller and PostgREST refuses the WHOLE
-- query that names it. This is the `public.events` trap, and the db
-- tests structurally CANNOT catch it (the replay harness recomputes the
-- allowlist over the new column in before()). The guard is therefore at
-- SOURCE level: scripts/lint-vendor-profiles-column-grants.mjs, modelled
-- on lint-events-column-grants.mjs, which reads the migration TEXT.
--
-- IDEMPOTENT: REVOKE-then-GRANT and CREATE OR REPLACE VIEW are both safe
-- to re-apply.
--
-- REVERSIBLE:
--   GRANT SELECT ON public.vendor_profiles TO authenticated;
--   DROP VIEW IF EXISTS public.vendor_profiles_self;
-- =====================================================================

BEGIN;

-- ---------------------------------------------------------------------
-- 1. Take the eleven identity columns off `authenticated`'s read
--    surface, and re-grant every OTHER column.
--
--    REVOKE SELECT, *not* REVOKE ALL: the anon pass could take everything
--    because anon writes nothing. `authenticated` legitimately holds
--    INSERT/UPDATE/DELETE here (policy vendor_profiles_owner is FOR ALL),
--    and REVOKE ALL would silently break every shop editing its own row.
--
--    The allowlist is COMPUTED from information_schema, never hand-typed:
--    a hand-typed list of 95 columns is a bill that goes stale on the next
--    ADD COLUMN, and the failure mode of a missed column is an entire
--    query refused rather than one field going null.
-- ---------------------------------------------------------------------
DO $$
DECLARE
  denied CONSTANT text[] := ARRAY[
    'tin_number','tin_type','registered_business_name','registered_address',
    'registered_zip','bir_service_category',
    'registration_number_raw','registration_number_normalized',
    'registration_number_submitted_at','registration_number_needs_review',
    'business_owner_name'
  ];
  allow text;
  n_allow int;
BEGIN
  -- ANTI-VACUITY FIRST. If the canary columns are absent (wrong database,
  -- drifted schema) every post-condition below passes trivially.
  IF (SELECT count(*) FROM information_schema.columns
       WHERE table_schema='public' AND table_name='vendor_profiles'
         AND column_name = ANY(denied)) <> cardinality(denied) THEN
    RAISE EXCEPTION
      'ANTI-VACUITY FAILED: expected all % denied columns to exist on public.vendor_profiles',
      cardinality(denied);
  END IF;

  SELECT string_agg(quote_ident(column_name), ', ' ORDER BY column_name), count(*)
    INTO allow, n_allow
    FROM information_schema.columns
   WHERE table_schema='public' AND table_name='vendor_profiles'
     AND NOT (column_name = ANY(denied));

  IF n_allow < 50 THEN
    RAISE EXCEPTION
      'REFUSING TO APPLY: computed allowlist is only % columns -- that is not this table', n_allow;
  END IF;

  EXECUTE 'REVOKE SELECT ON TABLE public.vendor_profiles FROM authenticated';
  EXECUTE format('GRANT SELECT (%s) ON public.vendor_profiles TO authenticated', allow);
END $$;

-- ---------------------------------------------------------------------
-- 2. Where a shop reads its OWN identity columns.
--
--    DROP + CREATE rather than CREATE OR REPLACE: replace refuses any
--    change to the column list, which is precisely what a future
--    ADD COLUMN needs.
-- ---------------------------------------------------------------------
DROP VIEW IF EXISTS public.vendor_profiles_self;

DO $$
DECLARE
  cols text;
BEGIN
  SELECT string_agg('vp.' || quote_ident(column_name), ', ' ORDER BY ordinal_position)
    INTO cols
    FROM information_schema.columns
   WHERE table_schema='public' AND table_name='vendor_profiles';

  IF cols IS NULL THEN
    RAISE EXCEPTION 'refusing to apply: computed vendor_profiles_self projection is empty';
  END IF;

  EXECUTE format($v$
    CREATE VIEW public.vendor_profiles_self
      WITH (security_invoker = false) AS
      SELECT %s
        FROM public.vendor_profiles vp
       WHERE vp.user_id = auth.uid()
          OR vp.vendor_profile_id IN (SELECT public.current_vendor_ids('viewer'))
  $v$, cols);
END $$;

ALTER VIEW public.vendor_profiles_self OWNER TO postgres;

REVOKE ALL ON public.vendor_profiles_self FROM PUBLIC;
REVOKE ALL ON public.vendor_profiles_self FROM anon;
REVOKE ALL ON public.vendor_profiles_self FROM authenticated;
GRANT SELECT ON public.vendor_profiles_self TO authenticated, service_role;

COMMENT ON VIEW public.vendor_profiles_self IS
  'Definer view: the caller''s OWN shops (owner via user_id = auth.uid(), or a '
  'team member via current_vendor_ids(''viewer'')), projecting every '
  'vendor_profiles column INCLUDING the eleven tax/registration/owner-identity '
  'columns that 20271217955839 revoked from `authenticated` at table level. '
  'Predicate mirrors policies vendor_profiles_owner + vendor_profiles_member_read '
  'exactly -- it widens nothing. SELECT ONLY: an auto-updatable definer view '
  'would let a teammate write past vendor_profiles_owner. Admin and public '
  'surfaces do NOT use this -- they read the table on the service-role client.';

-- =====================================================================
-- POST-CONDITIONS
-- =====================================================================

-- 1 -- the eleven are NOT selectable by authenticated. has_column_privilege()
--      returns the EFFECTIVE privilege (table OR column level), so this
--      also catches a leftover table-level grant.
DO $$
DECLARE
  leaked text[];
BEGIN
  SELECT array_agg(c)
    INTO leaked
    FROM unnest(ARRAY[
      'tin_number','tin_type','registered_business_name','registered_address',
      'registered_zip','bir_service_category',
      'registration_number_raw','registration_number_normalized',
      'registration_number_submitted_at','registration_number_needs_review',
      'business_owner_name'
    ]) AS c
   WHERE has_column_privilege('authenticated','public.vendor_profiles', c, 'SELECT');
  IF leaked IS NOT NULL THEN
    RAISE EXCEPTION
      'POST-CONDITION 1 FAILED: authenticated can still SELECT %: %',
      cardinality(leaked), leaked;
  END IF;
END $$;

-- 2 -- every OTHER column IS still selectable by authenticated. This is the
--      half that keeps the product working: a column missed by the GRANT
--      makes PostgREST refuse the whole query that names it.
DO $$
DECLARE
  missing text[];
  denied CONSTANT text[] := ARRAY[
    'tin_number','tin_type','registered_business_name','registered_address',
    'registered_zip','bir_service_category',
    'registration_number_raw','registration_number_normalized',
    'registration_number_submitted_at','registration_number_needs_review',
    'business_owner_name'
  ];
BEGIN
  SELECT array_agg(column_name::text)
    INTO missing
    FROM information_schema.columns
   WHERE table_schema='public' AND table_name='vendor_profiles'
     AND NOT (column_name = ANY(denied))
     AND NOT has_column_privilege('authenticated','public.vendor_profiles', column_name, 'SELECT');
  IF missing IS NOT NULL THEN
    RAISE EXCEPTION
      'POST-CONDITION 2 FAILED: authenticated LOST SELECT on non-denied column(s): %', missing;
  END IF;
END $$;

-- 3 -- anon is UNTOUCHED. Not named in any statement above; asserted rather
--      than repaired. The two halves of 20271014385411 are both re-checked:
--      its 21 stay readable, and its wider deny-set stays denied.
DO $$
DECLARE
  n int;
  leaked text[];
BEGIN
  SELECT count(*) INTO n
    FROM information_schema.columns
   WHERE table_schema='public' AND table_name='vendor_profiles'
     AND has_column_privilege('anon','public.vendor_profiles', column_name, 'SELECT');
  IF n <> 21 THEN
    RAISE EXCEPTION
      'POST-CONDITION 3 FAILED: anon column surface moved from 21 to % -- this migration must not touch anon', n;
  END IF;

  SELECT array_agg(c) INTO leaked
    FROM unnest(ARRAY['tin_number','registered_address','business_owner_name','registration_number_raw']) AS c
   WHERE has_column_privilege('anon','public.vendor_profiles', c, 'SELECT');
  IF leaked IS NOT NULL THEN
    RAISE EXCEPTION 'POST-CONDITION 3 FAILED: anon regained %', leaked;
  END IF;
END $$;

-- 4 -- WRITES SURVIVE. The single most likely way to get this migration
--      wrong is REVOKE ALL instead of REVOKE SELECT, which reads as
--      "tighter" and silently breaks every shop editing its own row.
DO $$
DECLARE
  lost text[];
BEGIN
  SELECT array_agg(p)
    INTO lost
    FROM unnest(ARRAY['INSERT','UPDATE','DELETE']) AS p
   WHERE NOT has_table_privilege('authenticated','public.vendor_profiles', p);
  IF lost IS NOT NULL THEN
    RAISE EXCEPTION
      'POST-CONDITION 4 FAILED: authenticated lost table privilege(s) % -- the shop editor and /open-shop are broken', lost;
  END IF;
  IF has_table_privilege('authenticated','public.vendor_profiles','SELECT') THEN
    RAISE EXCEPTION
      'POST-CONDITION 4 FAILED: authenticated still holds TABLE-level SELECT -- the REVOKE did not land and every column grant above is decoration';
  END IF;
END $$;

-- 5 -- service_role is UNAFFECTED. Every public vendor surface reads through
--      it; if the REVOKE had caught it they would all 500.
DO $$
BEGIN
  IF NOT has_table_privilege('service_role','public.vendor_profiles','SELECT') THEN
    RAISE EXCEPTION 'POST-CONDITION 5 FAILED: service_role lost SELECT on public.vendor_profiles';
  END IF;
  IF NOT has_column_privilege('service_role','public.vendor_profiles','tin_number','SELECT') THEN
    RAISE EXCEPTION 'POST-CONDITION 5 FAILED: service_role lost tin_number -- the RA 10173 export reads it';
  END IF;
END $$;

-- 6 -- the self-view exists, is DEFINER, and projects EVERY column of the
--      table. A view that silently drops a column is how the shop's own
--      dashboard goes quietly blank in one field.
DO $$
DECLARE
  bad text[] := ARRAY[]::text[];
  missing text[];
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_views WHERE schemaname='public' AND viewname='vendor_profiles_self') THEN
    RAISE EXCEPTION 'POST-CONDITION 6 FAILED: public.vendor_profiles_self is missing';
  END IF;

  IF EXISTS (
        SELECT 1 FROM pg_class
         WHERE oid = 'public.vendor_profiles_self'::regclass
           AND COALESCE(reloptions::text, '') LIKE '%security_invoker=true%'
      ) THEN
    bad := array_append(bad, 'view-is-security-invoker');
  END IF;

  SELECT array_agg(t.column_name::text)
    INTO missing
    FROM information_schema.columns t
   WHERE t.table_schema='public' AND t.table_name='vendor_profiles'
     AND NOT EXISTS (
       SELECT 1 FROM information_schema.columns v
        WHERE v.table_schema='public' AND v.table_name='vendor_profiles_self'
          AND v.column_name = t.column_name);
  IF missing IS NOT NULL THEN
    bad := array_append(bad, 'view-drops-columns:' || array_to_string(missing, ','));
  END IF;

  -- The predicate must still be the mirror of the two RLS policies. A future
  -- editor widening it (an is_admin() arm, a bare team-membership union with
  -- no role floor, a dropped auth.uid()) re-opens exactly what this closes.
  IF pg_get_viewdef('public.vendor_profiles_self'::regclass, true) NOT LIKE '%auth.uid()%' THEN
    bad := array_append(bad, 'view-lost-auth-uid');
  END IF;
  IF pg_get_viewdef('public.vendor_profiles_self'::regclass, true) NOT LIKE '%current_vendor_ids%' THEN
    bad := array_append(bad, 'view-lost-team-arm');
  END IF;

  IF cardinality(bad) > 0 THEN
    RAISE EXCEPTION 'POST-CONDITION 6 FAILED: %', bad;
  END IF;
END $$;

-- 7 -- the self-view is READ-ONLY to authenticated, and invisible to anon.
--      A definer view that is auto-updatable is a write door past
--      vendor_profiles_owner.
DO $$
DECLARE
  writable text[];
  anon_holds text[];
BEGIN
  SELECT array_agg(p) INTO writable
    FROM unnest(ARRAY['INSERT','UPDATE','DELETE','TRUNCATE']) AS p
   WHERE has_table_privilege('authenticated','public.vendor_profiles_self', p);
  IF writable IS NOT NULL THEN
    RAISE EXCEPTION
      'POST-CONDITION 7 FAILED: authenticated can % through the definer view -- that writes past RLS', writable;
  END IF;
  IF NOT has_table_privilege('authenticated','public.vendor_profiles_self','SELECT') THEN
    RAISE EXCEPTION 'POST-CONDITION 7 FAILED: authenticated cannot SELECT the self view -- every repointed read is broken';
  END IF;

  SELECT array_agg(p) INTO anon_holds
    FROM unnest(ARRAY['SELECT','INSERT','UPDATE','DELETE','TRUNCATE']) AS p
   WHERE has_table_privilege('anon','public.vendor_profiles_self', p);
  IF anon_holds IS NOT NULL THEN
    RAISE EXCEPTION
      'POST-CONDITION 7 FAILED: anon holds % on the self view -- a logged-out caller would read every unclaimed shop''s identity', anon_holds;
  END IF;
END $$;

COMMIT;
