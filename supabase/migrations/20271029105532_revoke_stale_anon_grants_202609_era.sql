-- ============================================================================
-- Close the stale `anon` table grants on 11 tables from the 202608xx–202609xx
-- migration era.
--
-- ROOT CAUSE — this repo's single most-repeated defect. Every relation created
-- in schema `public` inherits Supabase's DEFAULT PRIVILEGES, which grant the
-- full `arwdDxtm` set to BOTH `anon` and `authenticated` at CREATE TABLE time.
-- The Supabase anon key is public by design (it ships in the page source), so
-- any browser on the internet can act as `anon`. A migration that does not
-- explicitly say `REVOKE ... FROM anon` ships the table wide open at the
-- privilege layer, leaving RLS as the ONLY thing in the way.
--
-- And the reflex fix does not work: `REVOKE ALL ... FROM PUBLIC` does NOT
-- remove a role's OWN explicit grant. The role has to be named.
-- (supabase/security/README.md:126-133.)
--
-- Eighteen migrations in the 202608xx–202609xx window created tables and NOT
-- ONE of them revoked anon. Of the tables they created, these ELEVEN have
-- anon SELECT/INSERT/UPDATE/DELETE and ZERO RLS policies that admit anon —
-- every policy on all eleven is `TO authenticated`. So the grant buys `anon`
-- nothing today; it is pure standing risk, and it is removed here.
--
--   table                        created by
--   ---------------------------  ---------------------------------------------
--   taxonomy_category_requests   20260811000000_taxonomy_category_requests
--   vendor_service_agents        20260816000000_vendor_service_agents
--   vendor_payment_methods       20260820000000_vendor_payment_methods
--   budget_allocation_decisions  20260824000000_budget_allocation_decisions
--   guest_face_enrollments       20260901000000_iteration_0012_guest_face_enrollments
--   app_telemetry_logs           20260902000000_app_telemetry_logs
--   event_editorial              20260912000000_wedding_website_lifecycle_foundation
--   event_floor_plan             20260922000000_iteration_0008_event_floor_plan
--   budget_builds                20260926000000_budget_builds
--   vendor_service_time_slots    20260928000000_vendor_service_time_slots
--   admin_approval_requests      20260930000000_admin_approval_requests
--
-- WHY THIS IS MORE THAN HYGIENE — two of the eleven hold regulated data:
--
--   • guest_face_enrollments holds BIOMETRIC data. `face_vector`,
--     `vector_model` and `asset_url` (the full-res selfie on R2) are
--     sensitive personal information under RA 10173, and the table's own
--     header calls `consent_at` "structurally mandatory". Biometrics sat one
--     anon table-grant away from an anonymous PostgREST caller, with a single
--     RLS policy set standing between them.
--
--   • vendor_payment_methods holds vendors' own PAYMENT destinations —
--     `account_name`, `account_number`, `provider`, the decoded QR
--     destination and payment links. Bulk-pulling that set is a ready-made
--     payment-redirection target.
--
--   The other nine are not nothing either: event_floor_plan and
--   event_editorial are per-event content, budget_builds and
--   budget_allocation_decisions are a couple's money, admin_approval_requests
--   and app_telemetry_logs are internal operations.
--
--   RLS is currently the ONLY layer between an anonymous caller and those
--   rows. This restores the second layer. Defence in depth means the RLS
--   policy set is not allowed to be a single point of failure — and this
--   codebase has already shipped policy logic that read as correct and was
--   not.
--
-- VERIFIED AGAINST LIVE PRODUCTION before writing (2026-08-01, project
-- njrupjnvkjkitfctetvi, SELECT-only). For each of the eleven:
--     anon        SELECT/INSERT/UPDATE/DELETE = true  (plus TRUNCATE,
--                 REFERENCES, TRIGGER, MAINTAIN — the whole default ACL)
--     rowsecurity = true
--     policies admitting anon or PUBLIC = 0
-- The specs and the migration ledger were NOT trusted for this; prod was
-- queried directly, because `schema_migrations` has recorded migrations as
-- APPLIED in this repo whose DDL never landed.
--
-- BEHAVIOUR CHANGE: none. Nothing that works today stops working. `anon` has
-- no policy on any of these tables, so every anonymous request against them
-- already failed — it just failed one layer later. This narrows what is
-- POSSIBLE, not what happens. No application code is touched, and none needed
-- to be: server-side reads of these tables go through `createAdminClient()`
-- (service_role), which bypasses grants entirely, and every session-client
-- read sits behind an auth gate.
--
-- SCOPE — deliberately narrow:
--   · `authenticated` is NOT touched. A narrowing must never break the live
--     caller, and every shipped read/write path on these eleven runs as
--     `authenticated`. Post-condition P2 below asserts it kept SELECT,
--     INSERT, UPDATE and DELETE on all eleven. NOTE FOR A FUTURE PR:
--     `authenticated` also holds TRUNCATE / REFERENCES / TRIGGER on all
--     eleven (same default ACL), which no shipped path uses and which RLS is
--     NEVER consulted for in the TRUNCATE case. That is a real second
--     finding, reported rather than folded in — trimming it changes what a
--     logged-in caller can do and deserves its own diff.
--   · NO policy, USING or WITH CHECK edits. RLS is already enabled on all
--     eleven and every policy is already `TO authenticated`. Editing a
--     predicate is a different class of change with a different blast radius.
--   · The 11 sibling tables from the SAME era that DO have anon-reachable
--     policies are deliberately untouched — their grant is intentional and
--     load-bearing (the public taxonomy powers /explore):
--     budget_allocation_config, budget_leaf_benchmarks,
--     canonical_service_taxonomy, onboarding_refinement_options,
--     onboarding_refinements, planning_deadlines, service_categories,
--     wedding_tradition_items, token_burn_bands, vendor_event_unlocks,
--     vendor_token_purchases.
--
-- THIS ERA IS NOT THE ONLY ONE. A prod sweep run alongside this migration
-- found 243 of 379 tables in `public` where anon holds SELECT and no policy
-- admits anon. Every era shows the same defect. That is a standing backlog,
-- reported in the PR body, NOT fixed here — a 243-table revoke is not a
-- reviewable diff, and each batch needs its own "is this grant actually
-- reachable?" check before it can be called dead weight.
--
-- The exposure baseline fingerprints table privileges (`tpriv` lines), so this
-- removes 11 lines from it. Regenerated in the SAME commit — a baseline that
-- disagrees with the schema is exactly the failure that system exists to
-- prevent.
--
-- IDEMPOTENT: REVOKE is naturally so; re-applying is a no-op.
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- 1. The revokes. `FROM anon` names the role explicitly — a bare
--    `FROM PUBLIC` would leave every one of these grants exactly where it is.
-- ----------------------------------------------------------------------------

REVOKE ALL ON TABLE public.admin_approval_requests      FROM anon;
REVOKE ALL ON TABLE public.app_telemetry_logs           FROM anon;
REVOKE ALL ON TABLE public.budget_allocation_decisions  FROM anon;
REVOKE ALL ON TABLE public.budget_builds                FROM anon;
REVOKE ALL ON TABLE public.event_editorial              FROM anon;
REVOKE ALL ON TABLE public.event_floor_plan             FROM anon;
REVOKE ALL ON TABLE public.guest_face_enrollments       FROM anon;
REVOKE ALL ON TABLE public.taxonomy_category_requests   FROM anon;
REVOKE ALL ON TABLE public.vendor_payment_methods       FROM anon;
REVOKE ALL ON TABLE public.vendor_service_agents        FROM anon;
REVOKE ALL ON TABLE public.vendor_service_time_slots    FROM anon;

-- ============================================================================
-- POST-CONDITIONS
--
-- A migration that silently no-ops is the failure mode being guarded against:
-- `schema_migrations` can report a migration APPLIED while its DDL never
-- landed. Each block RAISES rather than trusting the ledger.
--
-- Every assertion below names the ROLE `anon`. It does NOT check the `public`
-- pseudo-role: a `public`-scoped check passes while a role's own explicit
-- grant sits untouched, which is precisely how a sibling change shipped with
-- the lane still open under a green post-condition.
-- ============================================================================

-- --- P0. ANTI-VACUITY: all eleven tables must exist. ------------------------
-- Without this, a typo'd or dropped table makes P1 pass on nothing.
DO $$
DECLARE t text; missing text := '';
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'admin_approval_requests','app_telemetry_logs','budget_allocation_decisions',
    'budget_builds','event_editorial','event_floor_plan','guest_face_enrollments',
    'taxonomy_category_requests','vendor_payment_methods','vendor_service_agents',
    'vendor_service_time_slots'
  ] LOOP
    IF to_regclass('public.' || t) IS NULL THEN
      missing := missing || t || ' ';
    END IF;
  END LOOP;
  IF missing <> '' THEN
    RAISE EXCEPTION
      'anon-revoke post-condition P0 FAILED: table(s) absent (%). The privilege assertions below would pass vacuously.',
      missing;
  END IF;
END $$;

-- --- P1a. The ROLE `anon` holds none of the seven standard privileges. ------
-- has_table_privilege returns the EFFECTIVE privilege, so this also catches a
-- grant arriving via role membership rather than a direct GRANT.
DO $$
DECLARE t text; p text; held text := '';
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'admin_approval_requests','app_telemetry_logs','budget_allocation_decisions',
    'budget_builds','event_editorial','event_floor_plan','guest_face_enrollments',
    'taxonomy_category_requests','vendor_payment_methods','vendor_service_agents',
    'vendor_service_time_slots'
  ] LOOP
    FOREACH p IN ARRAY ARRAY['SELECT','INSERT','UPDATE','DELETE','TRUNCATE','REFERENCES','TRIGGER'] LOOP
      IF has_table_privilege('anon', 'public.' || t, p) THEN
        held := held || t || ':' || p || ' ';
      END IF;
    END LOOP;
  END LOOP;
  IF held <> '' THEN
    RAISE EXCEPTION
      'anon-revoke post-condition P1a FAILED: anon still holds %', held;
  END IF;
END $$;

-- --- P1b. No ACL entry on any of the eleven names `anon`, at all. -----------
-- P1a enumerates privilege types by name, so a class it does not list would
-- slip through (MAINTAIN exists on prod today; PG will add more). This scans
-- relacl itself and names no privilege type, so it cannot go stale.
DO $$
DECLARE leftover text;
BEGIN
  SELECT string_agg(DISTINCT c.relname || ':' || a.privilege_type, ' ')
    INTO leftover
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  CROSS JOIN LATERAL aclexplode(c.relacl) a
  WHERE n.nspname = 'public'
    AND c.relname = ANY (ARRAY[
      'admin_approval_requests','app_telemetry_logs','budget_allocation_decisions',
      'budget_builds','event_editorial','event_floor_plan','guest_face_enrollments',
      'taxonomy_category_requests','vendor_payment_methods','vendor_service_agents',
      'vendor_service_time_slots'
    ])
    AND pg_get_userbyid(a.grantee) = 'anon';
  IF leftover IS NOT NULL THEN
    RAISE EXCEPTION
      'anon-revoke post-condition P1b FAILED: relacl still carries anon entries: %', leftover;
  END IF;
END $$;

-- --- P2. POSITIVE CONTROL: `authenticated` lost nothing. --------------------
-- A narrowing must never break the live caller. Every shipped path on these
-- eleven tables runs as `authenticated` — the couple's budget builder, the
-- vendor's payment-method and time-slot editors, the seat-plan floor editor,
-- the editorial editor, the admin approval queue. If a future edit
-- "simplifies" this migration by folding `authenticated` into the REVOKE
-- above, this is the tripwire that stops it at apply time rather than in
-- production.
DO $$
DECLARE t text; p text; lost text := '';
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'admin_approval_requests','app_telemetry_logs','budget_allocation_decisions',
    'budget_builds','event_editorial','event_floor_plan','guest_face_enrollments',
    'taxonomy_category_requests','vendor_payment_methods','vendor_service_agents',
    'vendor_service_time_slots'
  ] LOOP
    FOREACH p IN ARRAY ARRAY['SELECT','INSERT','UPDATE','DELETE'] LOOP
      IF NOT has_table_privilege('authenticated', 'public.' || t, p) THEN
        lost := lost || t || ':' || p || ' ';
      END IF;
    END LOOP;
  END LOOP;
  IF lost <> '' THEN
    RAISE EXCEPTION
      'anon-revoke post-condition P2 FAILED: authenticated LOST privilege(s) % — this migration must narrow anon ONLY, never the live caller.',
      lost;
  END IF;
END $$;

-- --- P3. `service_role` lost nothing either. --------------------------------
-- Every server-side read and write on these tables goes through
-- createAdminClient() (service_role), which bypasses grants. If service_role
-- were caught by a stray revoke, the /admin surfaces and every server action
-- would 42501 at runtime with nothing having failed at apply time.
DO $$
DECLARE t text; lost text := '';
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'admin_approval_requests','app_telemetry_logs','budget_allocation_decisions',
    'budget_builds','event_editorial','event_floor_plan','guest_face_enrollments',
    'taxonomy_category_requests','vendor_payment_methods','vendor_service_agents',
    'vendor_service_time_slots'
  ] LOOP
    IF NOT has_table_privilege('service_role', 'public.' || t, 'SELECT')
       OR NOT has_table_privilege('service_role', 'public.' || t, 'INSERT') THEN
      lost := lost || t || ' ';
    END IF;
  END LOOP;
  IF lost <> '' THEN
    RAISE EXCEPTION
      'anon-revoke post-condition P3 FAILED: service_role lost access on % — every server action reads these through it.',
      lost;
  END IF;
END $$;

-- --- P4. RLS is still enabled, and no policy admits anon. -------------------
-- The premise of the whole migration is "anon has no policy here, so the
-- grant buys nothing". If that premise ever stops being true, a reader of
-- this file should learn it from a failure rather than by re-deriving it.
DO $$
DECLARE bad text; norls text;
BEGIN
  SELECT string_agg(c.relname, ' ') INTO norls
  FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public'
    AND c.relname = ANY (ARRAY[
      'admin_approval_requests','app_telemetry_logs','budget_allocation_decisions',
      'budget_builds','event_editorial','event_floor_plan','guest_face_enrollments',
      'taxonomy_category_requests','vendor_payment_methods','vendor_service_agents',
      'vendor_service_time_slots'
    ])
    AND NOT c.relrowsecurity;
  IF norls IS NOT NULL THEN
    RAISE EXCEPTION 'anon-revoke post-condition P4 FAILED: RLS disabled on %', norls;
  END IF;

  SELECT string_agg(p.tablename || ':' || p.policyname, ' ') INTO bad
  FROM pg_policies p
  WHERE p.schemaname = 'public'
    AND p.tablename = ANY (ARRAY[
      'admin_approval_requests','app_telemetry_logs','budget_allocation_decisions',
      'budget_builds','event_editorial','event_floor_plan','guest_face_enrollments',
      'taxonomy_category_requests','vendor_payment_methods','vendor_service_agents',
      'vendor_service_time_slots'
    ])
    AND ('anon' = ANY (p.roles) OR 'public' = ANY (p.roles));
  IF bad IS NOT NULL THEN
    RAISE EXCEPTION
      'anon-revoke post-condition P4 FAILED: policy/policies admit anon — the revoke above may have removed a REACHABLE grant: %', bad;
  END IF;
END $$;

COMMIT;
