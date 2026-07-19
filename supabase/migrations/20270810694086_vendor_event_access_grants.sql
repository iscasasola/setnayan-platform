-- ============================================================================
-- 20270810694086_vendor_event_access_grants.sql
--
-- Vendor "On the Day" launcher · PR-5 (step 3) — PER-EVENT ACCOUNT GRANTS.
--
-- Owner override 2026-07-16 (council verdict §8): the launcher's step 3 lets a
-- vendor grant a specific ACCOUNT access to ONE event's day-of app — chosen over
-- the council's device-pairing alternative. `vendor_team_members` is workspace-
-- wide (current_vendor_ids has no event_id), so per-event-day account scoping is
-- a NET-NEW RLS pattern; the CLAUDE.md "no invented RLS patterns" bar is cleared
-- by the explicit owner sign-off recorded in DECISION_LOG (2026-07-16).
--
-- Model: the vendor OWNER/ADMIN grants an existing account (typically a team
-- member — the UI grants teammates) read access to the launched console for a
-- single (vendor, event). Grants are revocable (soft revoke). The launched
-- console admits: the vendor owner/team-admin ALWAYS; any other account ONLY
-- with an active grant for that (vendor, event).
--
-- NEW canonical helper (the documented 9th, scoped to (vendor, event)):
--   current_vendor_dayof_grant_event_ids() → SETOF event_id the current user is
--   granted day-of access to (revoked_at IS NULL). Mirrors the SECURITY DEFINER
--   / STABLE / search_path=public shape of the existing four helpers.
--
-- No money, no PII beyond the grantee's user id. RLS at create time, idempotent.
-- ============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS public.vendor_event_access_grants (
  grant_id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_profile_id UUID NOT NULL,
  event_id          UUID NOT NULL
                    REFERENCES public.events(event_id) ON DELETE CASCADE,
  -- The account being granted access. Referenced to auth.users so a deleted
  -- account's grants vanish.
  grantee_user_id   UUID NOT NULL
                    REFERENCES auth.users(id) ON DELETE CASCADE,
  -- The owner/admin who issued it (audit).
  granted_by        UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- Soft revoke — a revoked grant stays for the audit trail.
  revoked_at        TIMESTAMPTZ,
  UNIQUE (vendor_profile_id, event_id, grantee_user_id)
);

CREATE INDEX IF NOT EXISTS vendor_event_access_grants_grantee_idx
  ON public.vendor_event_access_grants (grantee_user_id, event_id)
  WHERE revoked_at IS NULL;
CREATE INDEX IF NOT EXISTS vendor_event_access_grants_vendor_idx
  ON public.vendor_event_access_grants (vendor_profile_id, event_id);

COMMENT ON TABLE public.vendor_event_access_grants IS
  'Vendor On-the-Day launcher step 3 — per-event account grants (owner override 2026-07-16). A vendor owner/admin grants an account read access to the launched day-of console for ONE (vendor, event). Soft-revocable. The launched console admits the vendor owner/team-admin always; other accounts only with an active grant. Net-new event-scoped RLS pattern, owner-signed-off (DECISION_LOG 2026-07-16).';

-- The 9th canonical helper — event ids the current user is granted day-of access
-- to. SECURITY DEFINER so the grantee can resolve their own grants without a
-- direct read policy race; STABLE; search_path pinned.
CREATE OR REPLACE FUNCTION public.current_vendor_dayof_grant_event_ids()
RETURNS SETOF UUID
LANGUAGE SQL
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT event_id
  FROM public.vendor_event_access_grants
  WHERE grantee_user_id = auth.uid()
    AND revoked_at IS NULL;
$$;

GRANT EXECUTE ON FUNCTION public.current_vendor_dayof_grant_event_ids() TO authenticated;

-- RLS AT CREATE TIME.
ALTER TABLE public.vendor_event_access_grants ENABLE ROW LEVEL SECURITY;

-- Vendor owner/admin: full manage (read/insert/update/delete) of grants for
-- their OWN vendor profile, only on events they're booked on.
DROP POLICY IF EXISTS vendor_event_access_grants_manage_read ON public.vendor_event_access_grants;
CREATE POLICY vendor_event_access_grants_manage_read
  ON public.vendor_event_access_grants FOR SELECT TO authenticated
  USING (vendor_profile_id IN (SELECT public.current_vendor_ids('admin')));

DROP POLICY IF EXISTS vendor_event_access_grants_manage_insert ON public.vendor_event_access_grants;
CREATE POLICY vendor_event_access_grants_manage_insert
  ON public.vendor_event_access_grants FOR INSERT TO authenticated
  WITH CHECK (
    vendor_profile_id IN (SELECT public.current_vendor_ids('admin'))
    AND event_id IN (SELECT public.current_vendor_booked_event_ids())
  );

DROP POLICY IF EXISTS vendor_event_access_grants_manage_update ON public.vendor_event_access_grants;
CREATE POLICY vendor_event_access_grants_manage_update
  ON public.vendor_event_access_grants FOR UPDATE TO authenticated
  USING (vendor_profile_id IN (SELECT public.current_vendor_ids('admin')))
  WITH CHECK (vendor_profile_id IN (SELECT public.current_vendor_ids('admin')));

-- Grantee: READ their own active grants (so the launched console can resolve
-- which vendor/event they may open).
DROP POLICY IF EXISTS vendor_event_access_grants_grantee_read ON public.vendor_event_access_grants;
CREATE POLICY vendor_event_access_grants_grantee_read
  ON public.vendor_event_access_grants FOR SELECT TO authenticated
  USING (grantee_user_id = auth.uid());

-- Admin: read all (support / audit).
DROP POLICY IF EXISTS vendor_event_access_grants_admin_read ON public.vendor_event_access_grants;
CREATE POLICY vendor_event_access_grants_admin_read
  ON public.vendor_event_access_grants FOR SELECT TO authenticated
  USING (public.is_admin());

COMMIT;
