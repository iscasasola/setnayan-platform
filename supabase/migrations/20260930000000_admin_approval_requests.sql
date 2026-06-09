-- ============================================================================
-- 20260930000000_admin_approval_requests.sql
--
-- Two-admin ("four-eyes") approval queue — iteration 0023 §4 / Vendor
-- Agreement §9.1. The admin nav redesign (Admin_Console_Nav_Redesign_2026-06-08)
-- promotes this to a first-class /admin/approvals Work surface. The audit found
-- the loop was UNBUILT (a comment in users/actions.ts said "ships V1.x"); this
-- migration creates the primitive table.
--
-- V1 scope: the queue governs the canonical PRIVILEGE-ESCALATION actions
-- (§4.2 "major decisions" that are simple + reversible single-column updates on
-- public.users):
--   * grant_internal_account  → users.is_internal = TRUE  (§10a 🟣)
--   * grant_team_pool         → users.is_team_member = TRUE (§10b 🟢)
--   * promote_to_admin        → users.account_type = 'admin'
-- The executor (apps/web/app/admin/approvals/actions.ts) enforces is_internal
-- XOR is_team_member in application code (the DB-level XOR constraint is a
-- future hardening — not added here to avoid failing on any pre-existing row).
-- Other §4.2 action types (large refunds, brand-mark flips, etc.) opt into the
-- same primitive later via `action_type` + `payload`.
--
-- FOUR-EYES is enforced three ways: (1) the CHECK below (decided_by <>
-- initiated_by), (2) a `.neq('initiated_by', me)` predicate on the atomic claim
-- UPDATE in the action, and (3) the UI disables the buttons on your own row.
--
-- RLS mirrors the other admin-only tables (concierge_abuse_flags etc.):
-- public.is_admin() for read/insert/update. NOTE is_admin() checks
-- account_type='admin' ONLY; internal/team-pool admins operate through the
-- service-role client after the app-level requireAdmin() guard (the established
-- pattern), so RLS here is defense-in-depth.
--
-- Idempotent: CREATE TABLE IF NOT EXISTS + DROP/CREATE POLICY.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.admin_approval_requests (
  approval_id      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  public_id        TEXT UNIQUE NOT NULL DEFAULT public.generate_public_id('A'),
  action_type      TEXT NOT NULL CHECK (action_type IN (
                     'grant_internal_account',
                     'grant_team_pool',
                     'promote_to_admin'
                   )),
  target_user_id   UUID REFERENCES public.users(user_id) ON DELETE CASCADE,
  payload          JSONB NOT NULL DEFAULT '{}'::jsonb,
  rationale        TEXT NOT NULL CHECK (char_length(rationale) BETWEEN 1 AND 2000),
  status           TEXT NOT NULL DEFAULT 'pending'
                   CHECK (status IN ('pending', 'approved', 'rejected', 'expired')),
  initiated_by     UUID NOT NULL REFERENCES public.users(user_id) ON DELETE CASCADE,
  decided_by       UUID REFERENCES public.users(user_id) ON DELETE SET NULL,
  decision_reason  TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  decided_at       TIMESTAMPTZ,
  expires_at       TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '7 days'),
  -- four-eyes: a request can never be decided by the admin who initiated it.
  CONSTRAINT admin_approval_four_eyes
    CHECK (decided_by IS NULL OR decided_by <> initiated_by)
);

CREATE INDEX IF NOT EXISTS admin_approval_requests_status_idx
  ON public.admin_approval_requests(status, created_at DESC);
CREATE INDEX IF NOT EXISTS admin_approval_requests_target_idx
  ON public.admin_approval_requests(target_user_id);

COMMENT ON TABLE public.admin_approval_requests IS
  'Two-admin (four-eyes) approval queue per §9.1 / §4. One admin initiates a major decision; a DIFFERENT admin approves before it executes. V1 governs privilege-escalation grants (internal §10a / team-pool §10b / promote-to-admin).';

ALTER TABLE public.admin_approval_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS admin_approval_requests_admin_read   ON public.admin_approval_requests;
DROP POLICY IF EXISTS admin_approval_requests_admin_write  ON public.admin_approval_requests;
DROP POLICY IF EXISTS admin_approval_requests_admin_update ON public.admin_approval_requests;

CREATE POLICY admin_approval_requests_admin_read
  ON public.admin_approval_requests FOR SELECT
  TO authenticated
  USING (public.is_admin());

CREATE POLICY admin_approval_requests_admin_write
  ON public.admin_approval_requests FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin());

CREATE POLICY admin_approval_requests_admin_update
  ON public.admin_approval_requests FOR UPDATE
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());
