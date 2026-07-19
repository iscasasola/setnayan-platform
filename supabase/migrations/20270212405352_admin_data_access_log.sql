-- admin_data_access_log
-- ============================================================================
-- Admin account-access model — Phase 1a (Admin_Account_Access_Model_2026-06-22.md
-- · DECISION_LOG 2026-06-22).
-- ============================================================================
-- RA 10173 "right to know WHO accessed my data" substrate: records which admin
-- VIEWED which account's data, when, and on which surface. Distinct from
-- admin_audit_log (which records admin ACTIONS / writes) — this is the READ /
-- access trail the consolidated read-only page + takeover both build on.
--
-- Append-only by design: admin-read via is_admin(); NO insert/update/delete
-- policy → RLS denies all writes to authenticated/anon, so the app writes only
-- via the service-role admin client (in an after() hook). Trigger-based
-- immutability that also blocks the service-role client lands with the
-- audit-immutability hardening (Phase 1b).
--
-- Idempotent.

CREATE TABLE IF NOT EXISTS public.admin_data_access_log (
  access_log_id     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_user_id     UUID REFERENCES public.users(user_id) ON DELETE SET NULL,
  accessed_user_id  UUID REFERENCES public.users(user_id) ON DELETE SET NULL,
  surface           TEXT NOT NULL,
  context           JSONB,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Fast "who looked at this account, most recent first" lookup (subject-access).
CREATE INDEX IF NOT EXISTS idx_admin_data_access_log_accessed_user
  ON public.admin_data_access_log (accessed_user_id, created_at DESC);

ALTER TABLE public.admin_data_access_log ENABLE ROW LEVEL SECURITY;

-- Admins may READ the access trail (mirrors admin_audit_log_admin_read). No
-- write policy is intentional — writes are service-role only, and the absence
-- of UPDATE/DELETE policies keeps it append-only for every non-service role.
DROP POLICY IF EXISTS admin_data_access_log_admin_read ON public.admin_data_access_log;
CREATE POLICY admin_data_access_log_admin_read
  ON public.admin_data_access_log
  FOR SELECT
  TO authenticated
  USING (public.is_admin());
