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
-- BLAST RADIUS — every call site was checked at origin/main c273ae015:
--   · people/actions.ts:62   → p_email + p_creator only
--   · people/actions.ts:236  → p_email + p_creator only
--   · generate_event_connections (20270515967165:118) → p_email + p_creator only
-- NOTHING in the codebase passes p_claimer. The guard is therefore a no-op for
-- every current caller and cannot regress a live path. The SQL caller is itself
-- SECURITY DEFINER and already REVOKEd from PUBLIC, so its nested call runs with
-- the definer's rights and is unaffected by the REVOKE below.
--
-- Trigger paths are unaffected for the same reason: a trigger executes with the
-- privileges of its own definer, not the session role.
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

GRANT EXECUTE ON FUNCTION public.resolve_or_claim_person(
  TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, DATE, UUID, UUID
) TO authenticated, service_role;

-- ── 2 · Identity: a claimer may only be the caller ──────────────────────────
-- Enforced by a wrapper guard so the resolver's own body stays untouched: the
-- guard runs BEFORE any read/write, raises on mismatch, and is a no-op for the
-- service_role (server-side seeding) and for admins.
CREATE OR REPLACE FUNCTION public.assert_claimer_is_caller(p_claimer UUID)
RETURNS VOID
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  -- NULL claimer = "leave unclaimed", the only shape any current caller uses.
  IF p_claimer IS NULL THEN RETURN; END IF;
  -- service_role / trigger context has no JWT subject — trusted server paths.
  IF auth.uid() IS NULL THEN RETURN; END IF;
  IF p_claimer <> auth.uid() AND NOT public.is_admin() THEN
    RAISE EXCEPTION 'resolve_or_claim_person: p_claimer must be the calling account'
      USING ERRCODE = '42501';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.assert_claimer_is_caller(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.assert_claimer_is_caller(UUID) TO authenticated, service_role;

COMMENT ON FUNCTION public.assert_claimer_is_caller(UUID) IS
  'SEC 2026-07-30: a person-claim may only ever nominate the calling account. Called at the top of resolve_or_claim_person. NULL claimer and JWT-less (service_role / trigger) contexts pass through; admins are exempt. Raises 42501 otherwise.';

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
  -- SEC 2026-07-30: a claim may only ever nominate the calling account.
  PERFORM public.assert_claimer_is_caller(p_claimer);

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
DO $$
DECLARE
  v_public_exec BOOLEAN;
BEGIN
  SELECT has_function_privilege('public', p.oid, 'EXECUTE')
    INTO v_public_exec
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
   WHERE n.nspname = 'public' AND p.proname = 'resolve_or_claim_person'
   LIMIT 1;

  IF v_public_exec THEN
    RAISE EXCEPTION 'resolve_or_claim_person is still EXECUTE-able by PUBLIC after revoke';
  END IF;
END $$;
