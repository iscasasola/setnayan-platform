-- ============================================================================
-- 20270814328403_guard_users_privilege_columns.sql
--
-- SECURITY — privilege-escalation guard on public.users (defense-in-depth).
--
-- The base `user_owns_row` policy is Pattern A (`FOR ALL … USING/ WITH CHECK
-- user_id = auth.uid()`), so an authenticated user may UPDATE *any* column of
-- their own row via the raw Supabase REST API — including the columns that
-- confer privilege. The app never exposes such a write, but the DB permits it.
-- Most seriously an attacker could self-set `is_internal` (the §10a owner /
-- internal-account flag) or `account_type = 'admin'` (which makes `is_admin()`
-- return TRUE), or `is_team_member` (comp-grant eligibility).
--
-- This BEFORE UPDATE trigger closes that gap WITHOUT touching the base policy
-- (load-bearing — a wrong RLS change blocks all profile edits). It mirrors the
-- house pattern from `20261214000000_guard_pax_finalize_columns.sql`: for any
-- caller that is NOT privileged, changes to the guarded columns are silently
-- reverted to their OLD value. Edits to every OTHER column (display_name, slug,
-- theme, locale, consent fields, …) still succeed, so normal profile edits are
-- completely unaffected. A privilege-escalation PATCH just no-ops.
--
-- "Privileged" = the write runs with elevated authority:
--   • auth.role() IS NULL          — direct/superuser/migration connection (no
--                                    PostgREST JWT); data migrations may touch
--                                    these columns legitimately.
--   • auth.role() = 'service_role' — the elevated admin client
--                                    (`createAdminClient`). EVERY legitimate
--                                    write to these columns goes through it:
--                                    the §10a/§10b grants + promote-to-admin in
--                                    admin/approvals + admin/users, and the
--                                    account_type='vendor' promotions in
--                                    auth/callback + open-shop.
--   • public.is_admin()            — an authenticated admin session (belt-and-
--                                    suspenders; today all admin writes use the
--                                    service-role client, but this keeps the
--                                    guard correct if that ever changes).
--
-- Legit paths verified unaffected:
--   (a) on_auth_user_created sets is_internal at INSERT time — a BEFORE UPDATE
--       trigger never fires on INSERT.
--   (b) admin grants (is_internal / is_team_member / account_type='admin') run
--       on the service-role client → privileged → pass through.
--   (c) a normal user editing display_name / slug / theme: not privileged, but
--       the guarded columns are unchanged so the revert is a no-op — the edit
--       succeeds.
--   (d) a normal user trying to self-set is_internal / is_team_member, or to
--       promote account_type to 'admin', via the raw REST API → not privileged
--       → the change is reverted → escalation blocked.
--
-- NOT guarded: `is_creator`. The product is moving to user-native creators
-- (any user may self-enable it), so it is intentionally excluded. (The column
-- does not exist yet; listing it here documents the deliberate exclusion.)
-- ============================================================================

BEGIN;

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
             OR public.is_admin();               -- authenticated admin session

  IF privileged THEN
    RETURN NEW;
  END IF;

  -- Non-privileged caller: neutralize any attempt to change a privilege flag.
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
$$;

DROP TRIGGER IF EXISTS guard_users_privilege_columns_trg ON public.users;
CREATE TRIGGER guard_users_privilege_columns_trg
  BEFORE UPDATE ON public.users
  FOR EACH ROW
  EXECUTE FUNCTION public.guard_users_privilege_columns();

COMMIT;
