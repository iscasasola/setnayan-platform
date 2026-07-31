-- 20271025100000_sec_resolve_or_claim_person_lockdown.sql
--
-- SEC · public.resolve_or_claim_person — close the anon lane and pin the claimer.
--
-- THE HOLE. The defining migration (20270514555975) created the function
-- SECURITY DEFINER with NO GRANT/REVOKE, so it inherited the PostgreSQL default:
-- EXECUTE to PUBLIC. PostgREST publishes it, so `anon` (the publishable key
-- alone, no session) could call it — and the body never checked p_claimer
-- against auth.uid(), so a caller could nominate ANY account as the claimer of
-- a person node. Two distinct defects: reachability, and an unauthenticated
-- parameter trusted as an identity.
--
-- WHY A BODY GUARD AND NOT ONLY A REVOKE. Revoking to service_role alone would
-- break the live caller: apps/web/app/dashboard/(account)/people/actions.ts
-- (:62 and :236) calls this via the RLS client as `authenticated`. So the grant
-- keeps `authenticated`, and the body enforces that a claimer may only ever be
-- the caller themselves.
--
-- BLAST RADIUS — CORRECTED 2026-07-31. The first version of this header said
-- "NOTHING in the codebase passes p_claimer" and "trigger paths are unaffected".
-- BOTH WERE WRONG, and CI proved it: four creator-loop DB tests started failing
-- with this migration's own exception.
--
--   · people/actions.ts:62   → p_email + p_creator only
--   · people/actions.ts:236  → p_email + p_creator only
--   · generate_event_connections (20270515967165:118) → p_creator only
--   · ⚠ ensure_person_for_user (20270514555975:126-134) → PASSES p_claimer.
--     It is the signup trigger — AFTER INSERT ON public.users — and it sits
--     FOURTEEN LINES BELOW the resolver this file audits, in the same migration.
--     The audit read the function and stopped before the trigger under it.
--
-- The "trigger paths are unaffected" claim conflated PRIVILEGE with IDENTITY.
-- SECURITY DEFINER changes the privileges a body runs with; it does NOT change
-- `auth.uid()`, which is a session GUC (`request.jwt.claim.sub`). So inside that
-- trigger auth.uid() is still whoever holds the connection, while p_claimer is
-- the NEW row's user_id. On any connection that carries a user JWT those differ,
-- and an unguarded version of this check would make SIGNUP ITSELF throw 42501.
--
-- Hence `pg_trigger_depth() = 0` below: the guard exists for the DIRECT
-- PostgREST surface, which is always depth 0. It weakens nothing — the one
-- trigger that reaches here hardcodes p_claimer := NEW.user_id on a row whose
-- user_id is already pinned by public.users' RLS WITH CHECK (user_id =
-- auth.uid()), so that path cannot nominate a third party even in principle.
--
-- Mirrors the sibling lockdown at 20270515967165:147-148.
--
-- IDEMPOTENT, and the ORDER is deliberate: REVOKE/GRANT first, then the
-- CREATE OR REPLACE. Postgres preserves an existing function's ACL across a
-- replace, so the revoke survives — but §3 re-asserts it after the replace
-- rather than trusting that, because a silently-restored PUBLIC EXECUTE is
-- exactly the defect being closed.
--
-- ⚠ THIS MIGRATION REDEFINES THE RESOLVER BODY (see §2b). It is the shipped
-- body reproduced verbatim plus one guard statement, so from here on THIS is
-- the live definition — a future change must be made against this file, not
-- against 20270514555975.

-- ── 1 · Reachability: off PUBLIC, and off anon ──────────────────────────────
REVOKE ALL ON FUNCTION public.resolve_or_claim_person(
  TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, DATE, UUID, UUID
) FROM PUBLIC;

-- ⚠ REVOKE FROM PUBLIC IS NOT ENOUGH — verified in prod 2026-07-31.
-- Supabase's default privileges GRANT EXECUTE to anon and authenticated
-- EXPLICITLY on every new function in `public`, and revoking from the PUBLIC
-- pseudo-role does not remove an explicit role grant. §2 below has explained
-- this since the first draft; §1 then relied on the PUBLIC revoke anyway.
--
-- Proof, from prod, on the very sibling this migration says it "mirrors" —
-- 20270515967165:147-148 shipped exactly REVOKE-FROM-PUBLIC + GRANT-TO-authed:
--
--     proname                     public_exec   anon_exec   authed_exec
--     generate_event_connections  false         TRUE        true
--
-- The PUBLIC revoke worked and anon kept executing. Without the line below this
-- migration would have shipped the identical hole, under a §3 post-condition
-- that only inspected PUBLIC — green migration, lane open.
REVOKE ALL ON FUNCTION public.resolve_or_claim_person(
  TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, DATE, UUID, UUID
) FROM anon;

GRANT EXECUTE ON FUNCTION public.resolve_or_claim_person(
  TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, DATE, UUID, UUID
) TO authenticated, service_role;

-- ── 1b · The sibling, proven open by the same query ─────────────────────────
-- generate_event_connections is anon-EXECUTE-able in prod today for exactly the
-- reason above. Its sole caller is a flag-guarded server action running as the
-- user, so authenticated-only is its intended reach. Closed here rather than
-- filed, because a hole you have measured and left open is a decision, not a
-- backlog item.
REVOKE ALL ON FUNCTION public.generate_event_connections(UUID, UUID) FROM anon;
GRANT EXECUTE ON FUNCTION public.generate_event_connections(UUID, UUID)
  TO authenticated, service_role;

-- ── 2 · Identity: a claimer may only be the caller ──────────────────────────
-- INLINE, deliberately. The first draft extracted this into a small
-- public.assert_claimer_is_caller() helper — and the exposure freeze correctly
-- failed the build:
--
--     ✗ func public.assert_claimer_is_caller(p_claimer uuid)
--         added: exec=anon,authenticated
--
-- Note `anon`, despite a REVOKE ALL … FROM PUBLIC. Supabase's default
-- privileges grant EXECUTE to anon/authenticated EXPLICITLY on new functions in
-- `public`, and revoking from PUBLIC does not remove an explicit role grant —
-- the same root cause as the default-ACL table exposure, applied to functions.
--
-- Adding a REVOKE for anon would have worked, but the better answer is to add no
-- new grantable object at all: a security fix should not widen the published
-- surface to close a hole. The check therefore lives in the resolver body below.

-- ── 2b · Wire the guard in. The resolver body below is the SHIPPED body from
-- 20270514555975 reproduced VERBATIM, with exactly one statement added as the
-- first line after BEGIN. Migrations are append-only and the latest definition
-- wins, so the copy is the normal pattern here — but it is a copy, so any future
-- change to the resolver must be made against THIS definition, not the 2027-05 one.

CREATE OR REPLACE FUNCTION public.resolve_or_claim_person(
  p_email        TEXT,
  p_display_name TEXT DEFAULT NULL,
  p_first_name   TEXT DEFAULT NULL,
  p_last_name    TEXT DEFAULT NULL,
  p_phone        TEXT DEFAULT NULL,
  p_photo_url    TEXT DEFAULT NULL,
  p_birth_date   DATE DEFAULT NULL,
  p_claimer      UUID DEFAULT NULL,   -- account claiming this person (NULL = leave unclaimed)
  p_creator      UUID DEFAULT NULL    -- who created the node (host); only used on create
) RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_email   TEXT := lower(nullif(trim(p_email), ''));
  v_id      UUID;
  v_claimed UUID;
  v_display TEXT := coalesce(
                      nullif(trim(p_display_name), ''),
                      nullif(trim(concat_ws(' ', nullif(trim(p_first_name), ''),
                                                 nullif(trim(p_last_name), ''))), ''));
BEGIN
  -- SEC 2026-07-30 · a claim may only ever nominate the CALLING account.
  -- Inline rather than a helper — see §2 on why a new public function would
  -- itself widen the exposure surface. NULL claimer ("leave unclaimed") is the
  -- only shape any current caller uses; a JWT-less context is service_role or a
  -- trigger, both trusted server paths; admins are exempt.
  IF pg_trigger_depth() = 0
     AND p_claimer IS NOT NULL
     AND auth.uid() IS NOT NULL
     AND p_claimer <> auth.uid()
     AND NOT public.is_admin() THEN
    RAISE EXCEPTION 'resolve_or_claim_person: p_claimer must be the calling account'
      USING ERRCODE = '42501';
  END IF;

  -- No email AND no claimer → a name-only guest (weak signal). Do NOT auto-seed;
  -- signal "skip" to the caller so it leaves the link null until a confirm.
  IF v_email IS NULL AND p_claimer IS NULL THEN
    RETURN NULL;
  END IF;

  LOOP
    -- (a) Find by email (the dedup anchor).
    v_id := NULL;
    IF v_email IS NOT NULL THEN
      SELECT person_id, claimed_by_user_id INTO v_id, v_claimed
      FROM public.people
      WHERE lower(email) = v_email AND deleted_at IS NULL
      LIMIT 1;
    END IF;

    IF v_id IS NOT NULL THEN
      -- Found. If a claimer is present and the node is still unclaimed, CLAIM it
      -- ("your history was waiting") and fill any blank profile fields. The
      -- `claimed_by_user_id IS NULL` guard makes a concurrent double-claim a no-op.
      IF p_claimer IS NOT NULL AND v_claimed IS NULL THEN
        UPDATE public.people SET
          claimed_by_user_id = p_claimer,
          display_name       = coalesce(display_name, v_display),
          first_name         = coalesce(first_name, p_first_name),
          last_name          = coalesce(last_name, p_last_name),
          phone              = coalesce(phone, p_phone),
          profile_photo_url  = coalesce(profile_photo_url, p_photo_url),
          birth_date         = coalesce(birth_date, p_birth_date)
        WHERE person_id = v_id AND claimed_by_user_id IS NULL;
      END IF;
      RETURN v_id;
    END IF;

    -- (b) Not found → create. Race-safe: a concurrent create of the same email
    -- raises unique_violation; catch it and loop back to the find branch.
    BEGIN
      INSERT INTO public.people (
        claimed_by_user_id, created_by_user_id,
        display_name, first_name, last_name, email, phone, profile_photo_url, birth_date
      ) VALUES (
        p_claimer, coalesce(p_creator, p_claimer),
        v_display, p_first_name, p_last_name, v_email, p_phone, p_photo_url, p_birth_date
      )
      RETURNING person_id INTO v_id;
      RETURN v_id;
    EXCEPTION WHEN unique_violation THEN
      -- another txn created this email first — retry the SELECT.
    END;
  END LOOP;
END;
$$;


-- ── 3 · Post-condition: fail the migration if the lane is still open ────────
-- Checking only 'public' is what let the hole hide: PUBLIC is a pseudo-role and
-- anon holds its own explicit grant, so the original assertion passed while the
-- lane it claimed to close stayed open. Assert the ROLES.
DO $$
DECLARE
  r RECORD;
  leaked TEXT;
BEGIN
  FOR r IN
    SELECT p.oid, p.proname
      FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = 'public'
       AND p.proname IN ('resolve_or_claim_person', 'generate_event_connections')
  LOOP
    IF has_function_privilege('public', r.oid, 'EXECUTE') THEN
      leaked := coalesce(leaked || ', ', '') || r.proname || ' (PUBLIC)';
    END IF;
    IF has_function_privilege('anon', r.oid, 'EXECUTE') THEN
      leaked := coalesce(leaked || ', ', '') || r.proname || ' (anon)';
    END IF;
    -- positive control: the narrowing must not have taken the live caller with it
    IF NOT has_function_privilege('authenticated', r.oid, 'EXECUTE') THEN
      RAISE EXCEPTION '% lost EXECUTE for authenticated — the live caller is broken', r.proname;
    END IF;
  END LOOP;

  IF leaked IS NOT NULL THEN
    RAISE EXCEPTION 'still EXECUTE-able after revoke: %', leaked;
  END IF;
END $$;
