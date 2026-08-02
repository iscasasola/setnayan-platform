-- ============================================================================
-- BATCH 2 — close the stale `anon` table grants on the 23 MOST SENSITIVE
-- tables in `public` where `anon` holds privileges that NO RLS policy can ever
-- turn into a row.
--
-- ROOT CAUSE (unchanged from batch 1, migration 20271029105532): every relation
-- created in schema `public` inherits Supabase's DEFAULT PRIVILEGES, which
-- grant the full `arwdDxtm` set to BOTH `anon` and `authenticated` at CREATE
-- TABLE time. The Supabase anon key is public by design — it ships in the page
-- source — so any browser on the internet can act as `anon`. A migration that
-- does not explicitly say `REVOKE ... FROM anon` ships the table wide open at
-- the privilege layer, leaving RLS as the ONLY thing in the way.
--
-- And the reflex fix does not work: `REVOKE ALL ... FROM PUBLIC` does NOT
-- remove a role's OWN explicit grant. The role has to be named.
-- (supabase/security/README.md:126-133.)
--
-- SIZE OF THE BACKLOG. A prod sweep on 2026-08-02 (project njrupjnvkjkitfctetvi,
-- SELECT-only) found 236 tables — after batch 1's 11 — where `anon` appears in
-- `relacl` and ZERO policies admit `anon` or PUBLIC. This migration takes 23 of
-- them, leaving 213. NOT all 236: a 236-table revoke is not a reviewable diff,
-- and some anon grants elsewhere in that set are INTENTIONAL and load-bearing
-- (the public taxonomy behind /explore — service_categories,
-- canonical_service_taxonomy, planning_deadlines, wedding_tradition_items —
-- reaches rows through policies that DO name anon, which is why the
-- zero-anon-policy filter is the discriminator and why each batch still gets
-- read table by table before it ships).
--
-- ----------------------------------------------------------------------------
-- HOW THIS BATCH WAS CHOSEN — sensitivity first, not alphabetical, not by era.
-- Four tiers, worst consequence-of-breach at the top:
--
--   TIER A — SECRETS, TOKENS AND OAUTH STATE (11). A leaked or forged row here
--   is not a privacy incident, it is an account takeover of a THIRD-PARTY
--   system we hold credentials for.
--     platform_integration_secrets     the platform's own integration secrets.
--                                      anon holds INSERT/UPDATE/DELETE (no
--                                      SELECT) and the table has ZERO policies:
--                                      nothing but service_role should ever be
--                                      near it, yet anon can name it in a write.
--     platform_secret_rotations        the rotation ledger for those secrets —
--                                      also ZERO policies.
--     api_keys                         API credentials.
--     oauth_grants                     OAuth grants (anon: DELETE — i.e. what
--                                      the grant buys is the ability to try to
--                                      DESTROY someone's authorization).
--     oauth_state                      OAuth CSRF state. Write access to a
--                                      state table is the classic auth-flow
--                                      fixation primitive.
--     patiktok_oauth_grants            TikTok tokens (anon: INSERT/UPDATE/DELETE).
--     patiktok_oauth_state             TikTok OAuth CSRF state.
--     vendor_ig_connections            Instagram connections (anon: I/U/D).
--     vendor_ig_oauth_state            Instagram OAuth CSRF state.
--     live_studio_channel_grants       YouTube channel-pool grants. ZERO policies.
--     live_studio_channel_oauth_state  YouTube OAuth CSRF state. ZERO policies.
--
--   TIER B — MONEY (7). Orders, the ledger, refunds, payments, BIR receipts,
--   the manual bank/GCash reconciliation log, and vendor payouts. Reading them
--   exposes what every customer paid and every vendor earned; writing them is
--   fraud. `manual_payment_logs` has ZERO policies and still carries the full
--   anon SIUD.
--     orders  order_ledger  order_refunds  payments  receipts
--     manual_payment_logs  vendor_payouts
--
--   TIER C — REGULATED PERSONAL DATA (2).
--     user_face_profiles   BIOMETRIC data — sensitive personal information
--                          under RA 10173. Batch 1 closed the guest-side twin
--                          (guest_face_enrollments); this is the account-side
--                          one, and it was still open.
--     dependents           MINORS' data. Guardian-owned records for children
--                          (the "Alaga" model). The highest-harm PII we hold.
--
--   TIER D — ADMIN / COMPLIANCE STATE (3). Not the crown jewels, but each one
--   is a record whose whole value is that its subject cannot edit it.
--     admin_audit_log            the tamper-evidence trail. anon holds UPDATE
--                                and DELETE on it.
--     admin_data_access_log      who-looked-at-whose-data — itself an RA 10173
--                                accountability artefact.
--     account_deletion_requests  RA 10173 erasure requests. anon DELETE here
--                                means an erasure request can be made to
--                                disappear.
--
-- ----------------------------------------------------------------------------
-- VERIFIED AGAINST LIVE PRODUCTION BEFORE WRITING (2026-08-02, SELECT-only).
-- For all 23: `relrowsecurity = true`, and `SELECT count(*) FROM pg_policies
-- WHERE schemaname='public' AND tablename=t AND ('anon' = ANY(roles) OR
-- 'public' = ANY(roles))` = 0. Five of them — platform_integration_secrets,
-- platform_secret_rotations, manual_payment_logs, live_studio_channel_grants,
-- live_studio_channel_oauth_state — have no policies AT ALL, so RLS denies
-- every non-superuser role and the anon grant is unambiguously dead weight.
-- The specs and `schema_migrations` were NOT trusted: this repo has recorded
-- migrations as APPLIED whose DDL never landed.
--
-- BEHAVIOUR CHANGE: none expected, and this was checked rather than assumed.
-- `anon` has no policy on any of the 23, so an anonymous request against them
-- already returned zero rows / zero affected rows. What changes is the LAYER at
-- which it fails: a silent empty result becomes a 42501. That distinction only
-- matters if some code path runs as `anon` against these tables and renders off
-- the empty result. It does not. Checked at eb516ed1:
--   · `grep -rl "from('<table>')" app lib components | xargs grep -l "supabase/client"`
--     returns NOTHING for all 23 — no browser/anon-session client touches any
--     of them.
--   · SEVEN files OUTSIDE the auth-gated route groups do read these tables, and
--     each was opened rather than assumed. Every one of them uses the
--     service-role client, which bypasses grants AND RLS:
--       app/papic/order/[token]/page.tsx        payments  → createAdminClient
--       app/papic/buy/actions.ts                orders    → createMoneyWriterClient
--       app/claim/[token]/page.tsx + actions.ts dependents→ createAdminClient
--                                               (its own comment says so: "the
--                                                visitor has no RLS path to the
--                                                row pre-claim")
--       app/[slug]/actions.ts                   user_face_profiles → admin
--       app/[slug]/_components/editorial/data.ts orders   → admin
--       app/panood/control/[eventId]/page.tsx   oauth_grants → session client,
--                                               but the page redirects to
--                                               /login when there is no user,
--                                               so the role is never `anon`.
--   · Every other reader is `createAdminClient()` or a `supabase/server` client
--     inside `app/dashboard/**` / `app/admin/**` / `app/vendor-dashboard/**`,
--     i.e. behind an auth gate where the role is `authenticated`, not `anon`.
--
-- SCOPE — deliberately narrow:
--   · `authenticated` is NOT touched. Post-condition P2 proves it, and it does
--     so by SNAPSHOTTING the effective privilege set BEFORE the revokes and
--     diffing after, rather than hardcoding an expected list. That matters
--     here: `vendor_ig_connections` grants `authenticated` NOTHING today (only
--     `anon` and `service_role` appear in its ACL), so a hardcoded
--     "authenticated must still hold SIUD" control would have FAILED on a table
--     that is already in the desired state. A snapshot cannot make that
--     mistake.
--   · NO policy, USING or WITH CHECK edits. Not one predicate is touched, so
--     this cannot widen anything. The exposure baseline is regenerated in the
--     same commit anyway and its diff must be REMOVALS ONLY.
--   · `service_role` untouched (P3).
--
-- REPORTED, NOT FIXED HERE — from the same default ACL, `authenticated` also
-- holds TRUNCATE on 21 of these 23 (all but `order_ledger` and
-- `vendor_ig_connections`), and REFERENCES / TRIGGER on 22 of 23 (all but
-- `vendor_ig_connections`). RLS is NEVER consulted for TRUNCATE: a logged-in
-- caller who can reach the table can empty it outright, policies
-- notwithstanding — including `admin_audit_log`, the tamper-evidence trail, and
-- `payments`. No shipped path uses any of the three. That is a real second
-- finding and it deserves its own diff, because trimming it changes what a live
-- caller can do — which this migration must not.
--
-- IDEMPOTENT: REVOKE is naturally so; re-applying is a no-op.
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- 0. POSITIVE-CONTROL SNAPSHOT — taken BEFORE the revokes.
--
--    P2 below compares against this. Taking it here, in the same transaction,
--    is what lets the control be a true before/after diff instead of a
--    hardcoded expectation that can be wrong about the starting state.
-- ----------------------------------------------------------------------------
CREATE TEMP TABLE _anon_batch2_authenticated_before ON COMMIT DROP AS
SELECT t.tbl,
       p.priv,
       has_table_privilege('authenticated', 'public.' || t.tbl, p.priv) AS held
FROM unnest(ARRAY[
  'account_deletion_requests','admin_audit_log','admin_data_access_log','api_keys',
  'dependents','live_studio_channel_grants','live_studio_channel_oauth_state',
  'manual_payment_logs','oauth_grants','oauth_state','order_ledger','order_refunds',
  'orders','patiktok_oauth_grants','patiktok_oauth_state','payments',
  'platform_integration_secrets','platform_secret_rotations','receipts',
  'user_face_profiles','vendor_ig_connections','vendor_ig_oauth_state','vendor_payouts'
]) AS t(tbl)
CROSS JOIN unnest(ARRAY[
  'SELECT','INSERT','UPDATE','DELETE','TRUNCATE','REFERENCES','TRIGGER'
]) AS p(priv);

-- ----------------------------------------------------------------------------
-- 1. The revokes. `FROM anon` names the role explicitly — a bare `FROM PUBLIC`
--    would leave every one of these grants exactly where it is.
-- ----------------------------------------------------------------------------

-- Tier A — secrets, tokens, OAuth state
REVOKE ALL ON TABLE public.platform_integration_secrets    FROM anon;
REVOKE ALL ON TABLE public.platform_secret_rotations       FROM anon;
REVOKE ALL ON TABLE public.api_keys                        FROM anon;
REVOKE ALL ON TABLE public.oauth_grants                    FROM anon;
REVOKE ALL ON TABLE public.oauth_state                     FROM anon;
REVOKE ALL ON TABLE public.patiktok_oauth_grants           FROM anon;
REVOKE ALL ON TABLE public.patiktok_oauth_state            FROM anon;
REVOKE ALL ON TABLE public.vendor_ig_connections           FROM anon;
REVOKE ALL ON TABLE public.vendor_ig_oauth_state           FROM anon;
REVOKE ALL ON TABLE public.live_studio_channel_grants      FROM anon;
REVOKE ALL ON TABLE public.live_studio_channel_oauth_state FROM anon;

-- Tier B — money
REVOKE ALL ON TABLE public.orders                          FROM anon;
REVOKE ALL ON TABLE public.order_ledger                    FROM anon;
REVOKE ALL ON TABLE public.order_refunds                   FROM anon;
REVOKE ALL ON TABLE public.payments                        FROM anon;
REVOKE ALL ON TABLE public.receipts                        FROM anon;
REVOKE ALL ON TABLE public.manual_payment_logs             FROM anon;
REVOKE ALL ON TABLE public.vendor_payouts                  FROM anon;

-- Tier C — regulated personal data
REVOKE ALL ON TABLE public.user_face_profiles              FROM anon;
REVOKE ALL ON TABLE public.dependents                      FROM anon;

-- Tier D — admin / compliance state
REVOKE ALL ON TABLE public.admin_audit_log                 FROM anon;
REVOKE ALL ON TABLE public.admin_data_access_log           FROM anon;
REVOKE ALL ON TABLE public.account_deletion_requests       FROM anon;

-- ============================================================================
-- POST-CONDITIONS
--
-- A migration that silently no-ops is the failure mode being guarded against:
-- `schema_migrations` can report a migration APPLIED while its DDL never
-- landed. Each block RAISES rather than trusting the ledger.
--
-- Every assertion below names the ROLE `anon`. It does NOT check the `public`
-- pseudo-role: a `public`-scoped check passes while a role's own explicit grant
-- sits untouched, which is precisely how a sibling change shipped with the lane
-- still open under a green post-condition.
-- ============================================================================

-- --- P0. ANTI-VACUITY: all 23 tables must exist. ----------------------------
-- Without this, a typo'd or dropped table makes P1 pass on nothing.
DO $$
DECLARE t text; missing text := ''; n int := 0;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'account_deletion_requests','admin_audit_log','admin_data_access_log','api_keys',
    'dependents','live_studio_channel_grants','live_studio_channel_oauth_state',
    'manual_payment_logs','oauth_grants','oauth_state','order_ledger','order_refunds',
    'orders','patiktok_oauth_grants','patiktok_oauth_state','payments',
    'platform_integration_secrets','platform_secret_rotations','receipts',
    'user_face_profiles','vendor_ig_connections','vendor_ig_oauth_state','vendor_payouts'
  ] LOOP
    n := n + 1;
    IF to_regclass('public.' || t) IS NULL THEN
      missing := missing || t || ' ';
    END IF;
  END LOOP;
  IF missing <> '' THEN
    RAISE EXCEPTION
      'anon-revoke batch 2 post-condition P0 FAILED: table(s) absent (%). The privilege assertions below would pass vacuously.',
      missing;
  END IF;
  IF n <> 23 THEN
    RAISE EXCEPTION
      'anon-revoke batch 2 post-condition P0 FAILED: expected 23 tables in the batch, the array holds %. Someone edited one list and not the others.',
      n;
  END IF;
END $$;

-- --- P1a. The ROLE `anon` holds none of the seven standard privileges. ------
-- has_table_privilege returns the EFFECTIVE privilege, so this also catches a
-- grant arriving via role membership rather than a direct GRANT.
DO $$
DECLARE t text; p text; held text := '';
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'account_deletion_requests','admin_audit_log','admin_data_access_log','api_keys',
    'dependents','live_studio_channel_grants','live_studio_channel_oauth_state',
    'manual_payment_logs','oauth_grants','oauth_state','order_ledger','order_refunds',
    'orders','patiktok_oauth_grants','patiktok_oauth_state','payments',
    'platform_integration_secrets','platform_secret_rotations','receipts',
    'user_face_profiles','vendor_ig_connections','vendor_ig_oauth_state','vendor_payouts'
  ] LOOP
    FOREACH p IN ARRAY ARRAY['SELECT','INSERT','UPDATE','DELETE','TRUNCATE','REFERENCES','TRIGGER'] LOOP
      IF has_table_privilege('anon', 'public.' || t, p) THEN
        held := held || t || ':' || p || ' ';
      END IF;
    END LOOP;
  END LOOP;
  IF held <> '' THEN
    RAISE EXCEPTION
      'anon-revoke batch 2 post-condition P1a FAILED: anon still holds %', held;
  END IF;
END $$;

-- --- P1b. No ACL entry on any of the 23 names `anon`, at all. ---------------
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
      'account_deletion_requests','admin_audit_log','admin_data_access_log','api_keys',
      'dependents','live_studio_channel_grants','live_studio_channel_oauth_state',
      'manual_payment_logs','oauth_grants','oauth_state','order_ledger','order_refunds',
      'orders','patiktok_oauth_grants','patiktok_oauth_state','payments',
      'platform_integration_secrets','platform_secret_rotations','receipts',
      'user_face_profiles','vendor_ig_connections','vendor_ig_oauth_state','vendor_payouts'
    ])
    AND pg_get_userbyid(a.grantee) = 'anon';
  IF leftover IS NOT NULL THEN
    RAISE EXCEPTION
      'anon-revoke batch 2 post-condition P1b FAILED: relacl still carries anon entries: %', leftover;
  END IF;
END $$;

-- --- P2. POSITIVE CONTROL: `authenticated` lost NOTHING. --------------------
-- A narrowing must never break the live caller. Every shipped path on these 23
-- tables runs as `authenticated` (dashboard / admin / vendor surfaces) or as
-- `service_role` (createAdminClient). This diffs the effective privilege set
-- against the snapshot taken at the top of the transaction — so it holds
-- whatever the starting state happened to be, including `vendor_ig_connections`
-- where `authenticated` already held nothing. A hardcoded expectation would
-- have been wrong there; this cannot be.
--
-- If a future edit "simplifies" this migration by folding `authenticated` into
-- the REVOKE list above, this is the tripwire that stops it at apply time
-- rather than in production.
DO $$
DECLARE lost text; checked int;
BEGIN
  SELECT count(*) INTO checked FROM _anon_batch2_authenticated_before;
  IF checked <> 23 * 7 THEN
    RAISE EXCEPTION
      'anon-revoke batch 2 post-condition P2 FAILED: snapshot holds % rows, expected % — the control would be vacuous.',
      checked, 23 * 7;
  END IF;

  SELECT string_agg(b.tbl || ':' || b.priv, ' ') INTO lost
  FROM _anon_batch2_authenticated_before b
  WHERE b.held
    AND NOT has_table_privilege('authenticated', 'public.' || b.tbl, b.priv);

  IF lost IS NOT NULL THEN
    RAISE EXCEPTION
      'anon-revoke batch 2 post-condition P2 FAILED: authenticated LOST privilege(s) % — this migration must narrow anon ONLY, never the live caller.',
      lost;
  END IF;
END $$;

-- --- P3. `service_role` lost nothing either. --------------------------------
-- Every server-side read and write on these tables goes through
-- createAdminClient() (service_role), which bypasses grants and RLS. If
-- service_role were caught by a stray revoke, the payment, OAuth and admin
-- surfaces would 42501 at runtime with nothing having failed at apply time.
DO $$
DECLARE t text; lost text := '';
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'account_deletion_requests','admin_audit_log','admin_data_access_log','api_keys',
    'dependents','live_studio_channel_grants','live_studio_channel_oauth_state',
    'manual_payment_logs','oauth_grants','oauth_state','order_ledger','order_refunds',
    'orders','patiktok_oauth_grants','patiktok_oauth_state','payments',
    'platform_integration_secrets','platform_secret_rotations','receipts',
    'user_face_profiles','vendor_ig_connections','vendor_ig_oauth_state','vendor_payouts'
  ] LOOP
    IF NOT has_table_privilege('service_role', 'public.' || t, 'SELECT')
       OR NOT has_table_privilege('service_role', 'public.' || t, 'INSERT') THEN
      lost := lost || t || ' ';
    END IF;
  END LOOP;
  IF lost <> '' THEN
    RAISE EXCEPTION
      'anon-revoke batch 2 post-condition P3 FAILED: service_role lost access on % — every server action reads these through it.',
      lost;
  END IF;
END $$;

-- --- P4. RLS is still enabled, and no policy admits anon. -------------------
-- The premise of the whole migration is "anon has no policy here, so the grant
-- buys nothing". If that premise ever stops being true, a reader of this file
-- should learn it from a failure rather than by re-deriving it — and a policy
-- that DOES admit anon would mean the revoke above removed a REACHABLE grant,
-- i.e. broke a real public surface.
DO $$
DECLARE bad text; norls text;
BEGIN
  SELECT string_agg(c.relname, ' ') INTO norls
  FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public'
    AND c.relname = ANY (ARRAY[
      'account_deletion_requests','admin_audit_log','admin_data_access_log','api_keys',
      'dependents','live_studio_channel_grants','live_studio_channel_oauth_state',
      'manual_payment_logs','oauth_grants','oauth_state','order_ledger','order_refunds',
      'orders','patiktok_oauth_grants','patiktok_oauth_state','payments',
      'platform_integration_secrets','platform_secret_rotations','receipts',
      'user_face_profiles','vendor_ig_connections','vendor_ig_oauth_state','vendor_payouts'
    ])
    AND NOT c.relrowsecurity;
  IF norls IS NOT NULL THEN
    RAISE EXCEPTION 'anon-revoke batch 2 post-condition P4 FAILED: RLS disabled on %', norls;
  END IF;

  SELECT string_agg(p.tablename || ':' || p.policyname, ' ') INTO bad
  FROM pg_policies p
  WHERE p.schemaname = 'public'
    AND p.tablename = ANY (ARRAY[
      'account_deletion_requests','admin_audit_log','admin_data_access_log','api_keys',
      'dependents','live_studio_channel_grants','live_studio_channel_oauth_state',
      'manual_payment_logs','oauth_grants','oauth_state','order_ledger','order_refunds',
      'orders','patiktok_oauth_grants','patiktok_oauth_state','payments',
      'platform_integration_secrets','platform_secret_rotations','receipts',
      'user_face_profiles','vendor_ig_connections','vendor_ig_oauth_state','vendor_payouts'
    ])
    AND ('anon' = ANY (p.roles) OR 'public' = ANY (p.roles));
  IF bad IS NOT NULL THEN
    RAISE EXCEPTION
      'anon-revoke batch 2 post-condition P4 FAILED: policy/policies admit anon — the revoke above may have removed a REACHABLE grant: %', bad;
  END IF;
END $$;

COMMIT;
