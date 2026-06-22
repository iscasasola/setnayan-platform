-- account_privacy_subject_access
-- ============================================================================
-- Admin account-access model — Phase 3d (user-facing privacy / RA 10173
-- right-to-know + self-serve force-end). Stacks on the Phase-3 takeover scaffold
-- (admin_takeover_sessions) + Phase-1a (admin_data_access_log).
-- ============================================================================
-- Gives the data subject (the couple) two RA-10173 rights over the admin
-- account-access machinery, via ADDITIVE couple-scoped RLS policies (the
-- existing admin-only policies are untouched; RLS policies are OR'd):
--
--   1. READ who accessed their account — their OWN rows of admin_data_access_log
--      (accessed_user_id = auth.uid()) + admin_takeover_sessions targeting them
--      (target_user_id = auth.uid()). The "right to know who accessed my data."
--   2. FORCE-END an active takeover of their account — UPDATE their own OPEN
--      admin_takeover_sessions row to ended_by = 'user_force_end'. The couple
--      can always pull the plug on a session against them.
--
-- These are READ + a tightly-fenced END only — the couple can never start a
-- session, see someone else's, or read another account's access trail.
--
-- NOT applied to prod by the author (ships with the Phase-3 scaffold, behind the
-- same flag-gated review). Idempotent (DROP POLICY IF EXISTS before CREATE).
-- ============================================================================

-- 1a. Subject reads their OWN access-trail rows (RA 10173 right-to-know).
DROP POLICY IF EXISTS admin_data_access_log_subject_read ON public.admin_data_access_log;
CREATE POLICY admin_data_access_log_subject_read
  ON public.admin_data_access_log
  FOR SELECT
  TO authenticated
  USING (accessed_user_id = auth.uid());

-- 2a. Subject reads takeover sessions targeting them.
DROP POLICY IF EXISTS admin_takeover_sessions_target_read ON public.admin_takeover_sessions;
CREATE POLICY admin_takeover_sessions_target_read
  ON public.admin_takeover_sessions
  FOR SELECT
  TO authenticated
  USING (target_user_id = auth.uid());

-- 2b. Subject FORCE-ENDS their own OPEN session. USING gates the row (their own,
-- still open); WITH CHECK constrains the result to a user-force-ended,
-- closed row — so this policy can ONLY be used to end a session against them,
-- never to alter who/why or reopen one.
DROP POLICY IF EXISTS admin_takeover_sessions_target_force_end ON public.admin_takeover_sessions;
CREATE POLICY admin_takeover_sessions_target_force_end
  ON public.admin_takeover_sessions
  FOR UPDATE
  TO authenticated
  USING (target_user_id = auth.uid() AND ended_at IS NULL)
  WITH CHECK (
    target_user_id = auth.uid()
    AND ended_by = 'user_force_end'
    AND ended_at IS NOT NULL
  );
