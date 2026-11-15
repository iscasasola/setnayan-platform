-- account_suspend
-- Created via `pnpm migration:new`. KEEP THIS MIGRATION IDEMPOTENT (it may be re-applied).
-- ============================================================================
-- ⏸ ADMIN GAINS ACCOUNT SUSPEND — owner 2026-11-13, verbatim "Yes, add both" (DECISION_LOG
-- "ADMIN GAINS ACCOUNT SUSPEND + EDITABLE PLAN CONTENTS"). Drawn on the approved admin prototype
-- (specs repo prototypes/admin_pub/people.html: cfm-suspend-person · date-suspend ·
-- cfm-unsuspend-person · the Suspended list) and its builder panel #builder-2026-11-13.
--
-- WHAT EXISTED: a SHOP could be suspended (vendor_profiles.fraud_suspended_at, migration
-- 20270518682623 — only the fraud auto-suspend set it; unsuspendVendor in /admin/fraud lifts it
-- back to HIDDEN, never relisted). A PERSON could only be banned (blacklist + erase) or deleted.
--
-- THE DELTA, in this file:
--   1 · users.suspended_at · suspended_until · suspended_reason. NULL suspended_at = not suspended.
--       suspended_until NULL with suspended_at set = "until lifted".
--   2 · guard_users_privilege_columns learns them — a person can never lift (or set) their own
--       suspension through PostgREST. Body re-emitted from its LATEST definition,
--       20271240166185_users_record_the_terms_they_agreed_to, with three lines added per branch.
--   3 · admin_suspend_account(user, until, reason) — ONE transaction: stamps the person AND
--       suspends every shop they own the way the fraud desk already does
--       (fraud_suspended_at = <the same instant>, public_visibility = 'hidden'), so Find, the shop
--       page, booking and new messages refuse it through the gates that already read that column
--       (lib/findable-shop.ts · lib/vendor-visibility.ts · migration 20271335513615).
--       🔑 The shop is stamped with EXACTLY the person's suspended_at. That equality is how the
--       lift knows which shop suspensions are THIS one's: a shop the fraud desk had already
--       suspended keeps its own timestamp, is not touched on suspend, and is not lifted on lift.
--   4 · admin_lift_account_suspension(user) — clears the person and only the shops stamped with
--       their suspended_at. The shop comes back HIDDEN, exactly as unsuspendVendor does today —
--       relisting stays /admin/verify's call. ⚖ OPEN OWNER QUESTION (flagged in the PR): should
--       lifting relist a shop that was public before? Today's behaviour is kept.
--   5 · lift_expired_account_suspensions() — the "lifts itself on the Until date" half, run by the
--       cron-free job `account-suspension-lift` (lib/account-suspension.server.ts).
--
-- The sign-in half is NOT here: auth.users.banned_until is set through the GoTrue ADMIN API on the
-- server (updateUserById ban_duration) and the person's sessions are revoked
-- (admin_revoke_user_sessions) — app/admin/users/suspend-actions.ts.
--
-- 🔒 GRANTS: the three functions are service_role only. users carries TABLE-level grants, so no
-- column GRANT is written (precedent 20271319958455); the guard is what keeps a person off them.
-- 🛑 NEVER APPLIED BY HAND. The pipeline (`supabase db push --include-all`) applies it.
-- ============================================================================

-- ── 1 · the columns ─────────────────────────────────────────────────────────
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS suspended_at     TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS suspended_until  TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS suspended_reason TEXT;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'users_suspension_shape_ck') THEN
    ALTER TABLE public.users
      ADD CONSTRAINT users_suspension_shape_ck CHECK (
        (suspended_at IS NULL AND suspended_until IS NULL AND suspended_reason IS NULL)
        OR (suspended_at IS NOT NULL
            AND suspended_reason IS NOT NULL AND length(btrim(suspended_reason)) > 0
            AND (suspended_until IS NULL OR suspended_until > suspended_at))
      );
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS users_suspended_idx
  ON public.users (suspended_until)
  WHERE suspended_at IS NOT NULL;

COMMENT ON COLUMN public.users.suspended_at IS
  'Owner 2026-11-13 ("Yes, add both"): when an admin put this account on hold. NULL = not suspended. A suspended person cannot sign in (auth.users.banned_until, set through the admin API) and every shop they own is suspended with this same instant in vendor_profiles.fraud_suspended_at. Set and cleared ONLY by admin_suspend_account / admin_lift_account_suspension; guard_users_privilege_columns refuses a self-edit.';
COMMENT ON COLUMN public.users.suspended_until IS
  'When the hold lifts itself (7 days · 30 days). NULL with suspended_at set = until an admin lifts it. Lifted by lift_expired_account_suspensions (cron-free job account-suspension-lift).';
COMMENT ON COLUMN public.users.suspended_reason IS
  'Why — one of the reasons on the admin Suspend sheet. Shown to admins; the person is told in plain words by an in-app notice (account_suspended).';

-- ── 2 · the guard (VERBATIM from 20271240166185 + the suspension lines) ─────
CREATE OR REPLACE FUNCTION public.guard_users_privilege_columns()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_role      TEXT := auth.role();  -- NULL under a direct/superuser connection
  privileged  BOOLEAN;
BEGIN
  privileged := (v_role IS NULL)                 -- migration / superuser / direct DB
             OR (v_role = 'service_role')        -- elevated admin client
             OR (current_user NOT IN ('authenticated', 'anon'))
             OR public.is_admin();               -- authenticated admin session

  IF privileged THEN
    RETURN NEW;
  END IF;

  -- ⛔ DO NOT DROP THIS BRANCH WHEN YOU CREATE OR REPLACE THIS FUNCTION.
  -- The trigger is BEFORE INSERT OR UPDATE (migration 20271132891176), because
  -- DELETE-then-INSERT was a complete bypass of the UPDATE branch below and
  -- yielded is_admin() = true. On INSERT there is no OLD row, so the UPDATE
  -- branch's `NEW.x := OLD.x` writes NULL into a NOT NULL column and refuses
  -- EVERY insert. Both halves are load-bearing — one is a privilege
  -- escalation, the other is a crash. This migration lost both once.
  IF TG_OP = 'INSERT' THEN
    NEW.is_internal    := FALSE;
    NEW.is_team_member := FALSE;
    -- A self-inserted row may not arrive carrying its own consent record.
    -- Both NULL together satisfies users_terms_agreement_ck.
    NEW.terms_accepted_at := NULL;
    NEW.terms_version     := NULL;
    -- 2026-11-13: nor its own suspension (all three NULL satisfies users_suspension_shape_ck).
    NEW.suspended_at     := NULL;
    NEW.suspended_until  := NULL;
    NEW.suspended_reason := NULL;
    IF NEW.account_type = 'admin' THEN
      NEW.account_type := 'customer';
    END IF;
    RETURN NEW;
  END IF;

  -- Non-privileged caller: neutralize any attempt to change a privilege flag.
  NEW.is_internal    := OLD.is_internal;
  NEW.is_team_member := OLD.is_team_member;

  -- CTRL-B3 build 2, added 2026-09-22. The clickwrap record is evidence ABOUT
  -- the subject, so the subject must not be able to write it — forward (to
  -- manufacture an agreement) or backward (to erase one). `signUp` writes both
  -- on the service-role client, which is privileged above and passes through.
  NEW.terms_accepted_at := OLD.terms_accepted_at;
  NEW.terms_version     := OLD.terms_version;

  -- 2026-11-13 · ACCOUNT SUSPEND. An admin's decision ABOUT the subject: the
  -- subject may neither lift their own hold nor shorten it.
  NEW.suspended_at     := OLD.suspended_at;
  NEW.suspended_until  := OLD.suspended_until;
  NEW.suspended_reason := OLD.suspended_reason;

  -- account_type: customer <-> vendor are peer identities (open-shop / callback
  -- self-heal them and confer no privilege), so only block ESCALATION to
  -- 'admin' — is_admin() keys off account_type = 'admin'.
  IF NEW.account_type = 'admin' AND OLD.account_type IS DISTINCT FROM 'admin' THEN
    NEW.account_type := OLD.account_type;
  END IF;

  RETURN NEW;
END;
$$;

-- ── 3 · suspend ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.admin_suspend_account(
  p_user_id uuid,
  p_until   timestamptz,
  p_reason  text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_now      TIMESTAMPTZ := clock_timestamp();
  v_internal BOOLEAN;
  v_already  TIMESTAMPTZ;
  v_deleted  TIMESTAMPTZ;
  v_shops    UUID[];
BEGIN
  IF p_reason IS NULL OR length(btrim(p_reason)) = 0 THEN
    RAISE EXCEPTION 'suspend_needs_reason' USING ERRCODE = 'check_violation';
  END IF;
  IF p_until IS NOT NULL AND p_until <= v_now THEN
    RAISE EXCEPTION 'suspend_until_in_past' USING ERRCODE = 'check_violation';
  END IF;

  SELECT is_internal, suspended_at, deleted_at
    INTO v_internal, v_already, v_deleted
    FROM public.users
   WHERE user_id = p_user_id
   FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'suspend_no_such_account' USING ERRCODE = 'no_data_found';
  END IF;
  -- § 10a — an internal account is never suspended (prototype: "Locked (internal): … no suspend").
  IF COALESCE(v_internal, FALSE) THEN
    RAISE EXCEPTION 'suspend_internal_account' USING ERRCODE = 'check_violation';
  END IF;
  IF v_deleted IS NOT NULL THEN
    RAISE EXCEPTION 'suspend_deleted_account' USING ERRCODE = 'check_violation';
  END IF;
  IF v_already IS NOT NULL THEN
    RAISE EXCEPTION 'suspend_already_suspended' USING ERRCODE = 'check_violation';
  END IF;

  UPDATE public.users
     SET suspended_at     = v_now,
         suspended_until  = p_until,
         suspended_reason = btrim(p_reason)
   WHERE user_id = p_user_id;

  -- Every shop they own, suspended the way the fraud desk does. A shop already suspended or banned
  -- keeps its own stamp and is left alone (so the lift cannot clear the fraud desk's suspension).
  WITH s AS (
    UPDATE public.vendor_profiles
       SET fraud_suspended_at = v_now,
           public_visibility  = 'hidden'
     WHERE user_id = p_user_id
       AND fraud_suspended_at IS NULL
       AND fraud_banned_at IS NULL
    RETURNING vendor_profile_id
  )
  SELECT COALESCE(array_agg(vendor_profile_id), '{}') INTO v_shops FROM s;

  RETURN jsonb_build_object('suspended_at', v_now, 'suspended_until', p_until, 'shops', to_jsonb(v_shops));
END;
$function$;

COMMENT ON FUNCTION public.admin_suspend_account(uuid, timestamptz, text) IS
  'Owner 2026-11-13: put an account on hold. Stamps users.suspended_* and suspends every shop the person owns with the SAME instant in vendor_profiles.fraud_suspended_at (+ public_visibility hidden). Refuses internal (§ 10a), deleted and already-suspended accounts. The sign-in ban (auth.users.banned_until) is set by the caller through the GoTrue admin API. service_role only.';

-- ── 4 · lift ────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.admin_lift_account_suspension(p_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_at     TIMESTAMPTZ;
  v_until  TIMESTAMPTZ;
  v_reason TEXT;
  v_shops  UUID[];
BEGIN
  SELECT suspended_at, suspended_until, suspended_reason
    INTO v_at, v_until, v_reason
    FROM public.users
   WHERE user_id = p_user_id
   FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'suspend_no_such_account' USING ERRCODE = 'no_data_found';
  END IF;
  IF v_at IS NULL THEN
    RAISE EXCEPTION 'suspend_not_suspended' USING ERRCODE = 'check_violation';
  END IF;

  UPDATE public.users
     SET suspended_at = NULL, suspended_until = NULL, suspended_reason = NULL
   WHERE user_id = p_user_id;

  -- Only the shops THIS suspension stamped. They come back HIDDEN (unchanged) — the shop
  -- unsuspend that ships (unsuspendVendor) does the same; relisting is /admin/verify's call.
  WITH s AS (
    UPDATE public.vendor_profiles
       SET fraud_suspended_at = NULL
     WHERE user_id = p_user_id
       AND fraud_suspended_at = v_at
       AND fraud_banned_at IS NULL
    RETURNING vendor_profile_id
  )
  SELECT COALESCE(array_agg(vendor_profile_id), '{}') INTO v_shops FROM s;

  RETURN jsonb_build_object(
    'was_suspended_at', v_at,
    'was_suspended_until', v_until,
    'was_reason', v_reason,
    'shops', to_jsonb(v_shops)
  );
END;
$function$;

COMMENT ON FUNCTION public.admin_lift_account_suspension(uuid) IS
  'Owner 2026-11-13: lift an account hold. Clears users.suspended_* and the fraud_suspended_at of exactly the shops this suspension stamped (equal timestamp); those shops stay hidden until /admin/verify relists them, as unsuspendVendor does. Returns what was lifted so the admin screen can offer Undo. service_role only.';

-- ── 5 · the self-lift ───────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.lift_expired_account_suspensions()
RETURNS TABLE (lifted_user_id uuid, lifted jsonb)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_id UUID;
BEGIN
  FOR v_id IN
    SELECT u.user_id FROM public.users u
     WHERE u.suspended_at IS NOT NULL
       AND u.suspended_until IS NOT NULL
       AND u.suspended_until <= clock_timestamp()
     ORDER BY u.suspended_until
     LIMIT 200
  LOOP
    lifted_user_id := v_id;
    lifted := public.admin_lift_account_suspension(v_id);
    RETURN NEXT;
  END LOOP;
  RETURN;
END;
$function$;

COMMENT ON FUNCTION public.lift_expired_account_suspensions() IS
  'Lifts every account hold whose suspended_until has passed (at most 200 a run) and returns whose, with what each lift returned (its shops). Driven by the cron-free job account-suspension-lift. The sign-in ban needs no lift — GoTrue''s banned_until expires on the same instant. service_role only.';

REVOKE ALL ON FUNCTION public.admin_suspend_account(uuid, timestamptz, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.admin_lift_account_suspension(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.lift_expired_account_suspensions() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_suspend_account(uuid, timestamptz, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.admin_lift_account_suspension(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.lift_expired_account_suspensions() TO service_role;
