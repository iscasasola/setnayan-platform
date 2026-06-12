-- ============================================================================
-- 20261125000000_force_logout_revoke_sessions.sql
-- Force-logout pair (account-security follow-up): revoke ALL of a user's auth
-- sessions by user id, server-side.
--
-- WHY A SQL FUNCTION (and not the GoTrue admin API)
-- -------------------------------------------------
-- Verified against supabase/auth master (internal/api/api.go route table +
-- openapi.yaml): the GoTrue ADMIN API has NO per-user logout endpoint — the
-- /admin/users/{user_id} subtree exposes only GET/PUT/DELETE + /factors +
-- /passkeys. The only logout the SDK offers is `auth.admin.signOut(jwt)`,
-- which needs the TARGET USER'S access token (we never have it server-side).
-- So we do what GoTrue's own /logout does internally: delete the user's rows
-- in auth.sessions (+ sweep auth.refresh_tokens).
--
-- WHAT DELETING auth.sessions ACHIEVES
-- ------------------------------------
-- 1. Refresh is dead instantly — refresh_tokens cascade from sessions
--    (session_id FK ON DELETE CASCADE); the explicit user_id sweep also
--    catches legacy tokens that predate session tracking (NULL session_id).
-- 2. getUser() is dead instantly — the app validates every request via
--    supabase.auth.getUser(), which hits GoTrue /user; GoTrue resolves the
--    access token's session_id claim against auth.sessions and returns
--    session_not_found once the row is gone. So the kicked user is logged
--    out on the very next request, not at access-token expiry.
--
-- CALLERS (both server-side, service-role only)
-- ---------------------------------------------
-- - Vendor team: Owner removes a member → best-effort revoke of the REMOVED
--   member's sessions (their vendor-data access already died via the
--   per-request current_vendor_ids rank check; this ends the login too).
-- - Setnayan HQ /admin/users: "Force sign-out" per-user action (compromised-
--   account remedy), audit-logged via admin_audit_log.
--
-- SAFETY: EXECUTE is restricted to service_role — NEVER granted to
-- authenticated/anon. A signed-in user must not be able to log out arbitrary
-- accounts. Application-level authorization (vendor Owner check / requireAdmin)
-- happens in the calling server actions.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.admin_revoke_user_sessions(p_user_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_sessions INT;
BEGIN
  -- Sweep refresh tokens first: tokens that predate session tracking carry a
  -- NULL session_id and would survive the session-delete cascade.
  -- auth.refresh_tokens.user_id is VARCHAR (legacy column) — cast the uuid.
  DELETE FROM auth.refresh_tokens WHERE user_id = p_user_id::text;

  -- Deleting the sessions kills getUser() + refresh on every device.
  DELETE FROM auth.sessions WHERE user_id = p_user_id;
  GET DIAGNOSTICS v_sessions = ROW_COUNT;

  RETURN v_sessions;
END;
$$;

COMMENT ON FUNCTION public.admin_revoke_user_sessions(UUID) IS
  'Force-logout: deletes ALL of a user''s auth.sessions (+ refresh-token sweep) so getUser() + refresh fail on every device immediately. GoTrue admin API has no per-user logout endpoint (verified 2026-06-12), hence this SECURITY DEFINER fallback. Service-role only — called from the vendor remove-member action (best-effort, removed member only) and the Setnayan HQ /admin/users Force sign-out action (audit-logged). Returns the number of sessions revoked.';

REVOKE ALL ON FUNCTION public.admin_revoke_user_sessions(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_revoke_user_sessions(UUID) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_revoke_user_sessions(UUID) TO service_role;
