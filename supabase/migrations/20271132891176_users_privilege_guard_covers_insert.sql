-- ============================================================================
-- A GUARD THAT WATCHED ONLY ONE VERB.  (privilege escalation — CRITICAL)
-- ============================================================================
--
-- ── WHAT WAS POSSIBLE ─────────────────────────────────────────────────────
-- Anyone who signed up for a free account could make themselves a Setnayan
-- admin. Reproduced end to end in the full-corpus replay as an ordinary
-- `authenticated` customer session:
--
--   UPDATE public.users SET account_type='admin' …   → silently reverted ✅
--   DELETE FROM public.users WHERE user_id = <self> → 1 row deleted
--   INSERT INTO public.users (user_id, …, account_type)
--     VALUES (<self>, …, 'admin')                    → ACCEPTED
--   SELECT public.is_admin()                         → TRUE
--
-- `is_admin()` is `EXISTS (SELECT 1 FROM public.users WHERE user_id=auth.uid()
-- AND account_type='admin')`. It is trusted by ~298 RLS policies and by the
-- /admin gate in middleware.ts, so this was full read/write of the platform:
-- vendor government IDs, guest face-enrolment records, payments, everything.
--
-- ── WHY THE EXISTING GUARD MISSED IT ──────────────────────────────────────
-- `guard_users_privilege_columns` is correct and does its job. It was simply
-- attached `BEFORE UPDATE` only. Every escalation it was written to stop was
-- imagined as an EDIT — and the row can also be replaced.
--
-- 🔑 The lesson is not "add INSERT". It is that a guard is only as wide as the
-- verbs it fires on, and DELETE+INSERT is a rename for UPDATE that no amount of
-- correctness in the function body can catch.
--
-- ── WHY THE POLICIES DID NOT STOP IT ──────────────────────────────────────
-- `user_owns_row` is PERMISSIVE **FOR ALL** with `USING/WITH CHECK
-- (user_id = auth.uid())`. FOR ALL covers DELETE and INSERT. Deleting your own
-- row and inserting your own row both satisfy it perfectly — the policy is
-- about WHOSE row, and never had an opinion about what is IN it. Exactly the
-- shape of the two sender-forgery fixes shipped earlier today
-- (20271132839561 · 20271132843141): the row is legitimately yours, and the
-- privileged FIELD inside it was never anybody's to choose.
--
-- ── THE FIX, TWO HALVES, EACH PROVEN SEPARATELY IN THE DB TEST ────────────
-- 1. The guard now fires BEFORE INSERT **OR** UPDATE. On INSERT there is no
--    OLD row to fall back to, so a non-privileged session simply gets an
--    ordinary account: is_internal/is_team_member forced FALSE and an 'admin'
--    account_type rewritten to 'customer'.
-- 2. `authenticated` and `anon` lose INSERT and DELETE on public.users
--    altogether. Nothing in the product ever needed either: the ONLY insert and
--    the ONLY delete anywhere in apps/web are in
--    scripts/stress-test-lock-unlock.ts, both through the service-role client.
--    Real account provisioning is the SECURITY DEFINER signup trigger
--    (handle_new_auth_user), and account deletion ANONYMISES rather than
--    deletes (lib/erasure/*, service-role).
--
-- Half 2 alone would close the hole today. Half 1 is what survives somebody
-- re-granting INSERT later for an unrelated reason — and the db test proves
-- each half fires on its own by removing the other.
--
-- ── AND REVOKING DELETE FIXES A SECOND, QUIETER PROBLEM ───────────────────
-- 116 foreign keys reference public.users; 29 of them CASCADE. A user deleting
-- their own row was destroying data across the product with one request, quite
-- apart from the escalation. Nothing in the app has ever asked to do that.
--
-- ── WHAT DELIBERATELY DOES NOT CHANGE ─────────────────────────────────────
-- • The privileged test stays `auth.role()`-based, matching the guard's own
--   existing convention. (The two migrations earlier today used `current_user`
--   for the same job on other tables; this file follows the convention already
--   proven on THIS table rather than introducing a second one beside it.)
-- • SELECT and UPDATE stay granted — profile edits are legitimate and the
--   guard already neutralises the privileged columns on UPDATE.
-- • customer ⇄ vendor stays freely self-settable on UPDATE; those are peer
--   identities that confer nothing, and open-shop/callback self-heal them.
-- • The signup trigger is SECURITY DEFINER and runs with `auth.role()` unset,
--   so it is `privileged` and passes through untouched — including the § 10a
--   hardcoded is_internal for the owner's address. The db test asserts BOTH
--   that owner flag and vendor signup still land, because a fix that quietly
--   downgrades the owner's own account would look exactly like success.
-- ============================================================================

-- ── 1 · THE GUARD LEARNS THE OTHER VERB ────────────────────────────────────
CREATE OR REPLACE FUNCTION public.guard_users_privilege_columns()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
DECLARE
  v_role      TEXT := auth.role();  -- NULL under a direct/superuser connection
  privileged  BOOLEAN;
BEGIN
  privileged := (v_role IS NULL)                 -- migration / superuser / direct DB
             OR (v_role = 'service_role')        -- elevated admin client
             -- The DB role actually executing. PostgREST does SET LOCAL ROLE
             -- authenticated|anon for a request; anything else is the server —
             -- a migration, a direct connection, or a SECURITY DEFINER function
             -- running as its owner, which is how the signup trigger provisions
             -- this very row.
             --
             -- This clause is NOT redundant with `v_role IS NULL`, and finding
             -- out why is the reason it is here. In production auth.role() is
             -- `coalesce(nullif(claim,''), claims->>'role')` and IS null on a
             -- direct connection. In the PGlite replay the shim is
             -- `COALESCE(NULLIF(claim,''), 'anon')` — it can NEVER return null.
             -- So the first clause is dead code in every db test, and without
             -- this one the signup trigger reads as an ordinary `anon` caller
             -- under test: the § 10a owner flag was silently stripped, and the
             -- suite would have been asserting a harness artifact rather than
             -- production behaviour. Deriving from the DB role is true in both.
             OR (current_user NOT IN ('authenticated', 'anon'))
             OR public.is_admin();               -- authenticated admin session

  IF privileged THEN
    RETURN NEW;
  END IF;

  -- INSERT: there is no OLD to restore from, and this branch is the whole
  -- reason this file exists. A row created by a non-privileged session is an
  -- ordinary account, full stop. Without this, DELETE-then-INSERT was a
  -- complete bypass of the UPDATE branch below.
  IF TG_OP = 'INSERT' THEN
    NEW.is_internal    := FALSE;
    NEW.is_team_member := FALSE;
    IF NEW.account_type = 'admin' THEN
      NEW.account_type := 'customer';
    END IF;
    RETURN NEW;
  END IF;

  -- UPDATE: unchanged from the original guard.
  NEW.is_internal    := OLD.is_internal;
  NEW.is_team_member := OLD.is_team_member;

  -- account_type: customer <-> vendor are peer identities (open-shop / callback
  -- self-heal them and confer no privilege), so only block ESCALATION to
  -- 'admin' — is_admin() keys off account_type = 'admin'.
  IF NEW.account_type = 'admin' AND OLD.account_type IS DISTINCT FROM 'admin' THEN
    NEW.account_type := OLD.account_type;
  END IF;

  RETURN NEW;
END;
$function$;

COMMENT ON FUNCTION public.guard_users_privilege_columns() IS
  'Neutralises privilege columns (account_type=admin, is_internal, '
  'is_team_member) for non-privileged sessions. Fires BEFORE INSERT OR UPDATE — '
  'INSERT matters because DELETE-then-INSERT was a complete bypass of the '
  'UPDATE branch and yielded is_admin() = true (migration 20271132891176).';

-- Recreated rather than added alongside, so there is ONE trigger covering both
-- verbs and no chance of the pair drifting apart later.
DROP TRIGGER IF EXISTS guard_users_privilege_columns_trg ON public.users;
CREATE TRIGGER guard_users_privilege_columns_trg
  BEFORE INSERT OR UPDATE ON public.users
  FOR EACH ROW
  EXECUTE FUNCTION public.guard_users_privilege_columns();

-- ── 2 · THE BROWSER MAY NOT CREATE OR DESTROY AN ACCOUNT ROW ───────────────
-- Verified against the whole of apps/web: the only INSERT and the only DELETE
-- of public.users are in scripts/stress-test-lock-unlock.ts, both service-role.
-- No route, action or component creates or deletes one under a user session.
REVOKE INSERT, DELETE ON public.users FROM authenticated;
REVOKE INSERT, DELETE ON public.users FROM anon;
