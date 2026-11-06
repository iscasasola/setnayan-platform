-- grant_team_member_takes_two_admins — making someone staff takes two admins.
--
-- ── The clause ──────────────────────────────────────────────────────────────
-- Vendor Agreement § 9.1, first row of the major-decisions table:
--
--     "Promote a user to any admin role | Privilege escalation —
--      irreversible damage potential"
--
-- `users.is_team_member = TRUE` IS an admin role: `isAdminProfile`
-- (apps/web/lib/admin/admin-predicate.ts) admits `is_internal OR
-- is_team_member OR account_type = 'admin'`, and so does every admin gate
-- that copies it. A team member can open /admin, approve payouts and decide
-- other admins' two-admin requests.
--
-- ── Why now ─────────────────────────────────────────────────────────────────
-- Until 2026-11-05 there were two ways to set the flag: `grant_team_pool`
-- (two admins) and the "Add to team" button on the Users list
-- (`toggleTeamMember`, ONE admin). On 2026-11-05 the owner retired the team
-- service-credit pool, and `grant_team_pool` with it. That left the one-admin
-- button as the only way in — a single admin could make anyone an admin.
--
-- This adds `grant_team_member`. Turning the flag ON now opens an approval
-- that a DIFFERENT admin must confirm. Turning it OFF stays one admin:
-- removing access must never wait on a quorum.
--
-- ── The vocabulary is re-listed FROM PRODUCTION ─────────────────────────────
-- Read 2026-11-05 with `pg_get_constraintdef` on the live constraint: exactly
-- the ten values of migration 20271244152236. All ten are carried below.
-- `grant_team_pool` stays: old rows must remain readable, and the dispatcher
-- refuses to execute it.

ALTER TABLE public.admin_approval_requests
  DROP CONSTRAINT IF EXISTS admin_approval_requests_action_type_check;

ALTER TABLE public.admin_approval_requests
  ADD CONSTRAINT admin_approval_requests_action_type_check
  CHECK (action_type IN (
    'grant_internal_account',
    'grant_team_pool',
    'promote_to_admin',
    'approve_vendor_partnership',
    'approve_fraud_wipe_ban',
    'approve_journal_spotlight',
    -- 2026-09-22 · money actions.
    'approve_comp_grant',
    'approve_large_refund',
    'approve_payment_account_change',
    -- 2026-09-23 · § 9.1: what a customer is charged.
    'approve_retail_price_change',
    -- 2026-11-05 · § 9.1: "Add to team" makes someone an admin.
    'grant_team_member'
  ));

COMMENT ON CONSTRAINT admin_approval_requests_action_type_check
  ON public.admin_approval_requests IS
  'The actions that require a second admin. Privilege actions '
  '(grant_internal_account, grant_team_pool [retired 2026-11-05, kept so old '
  'rows stay readable], promote_to_admin, grant_team_member [9.1: '
  'is_team_member is an admin role], approve_vendor_partnership, '
  'approve_fraud_wipe_ban, approve_journal_spotlight) and money actions '
  '(approve_comp_grant, approve_large_refund, approve_payment_account_change, '
  'approve_retail_price_change). Re-list from pg_get_constraintdef on '
  'PRODUCTION when adding a value — the migration history is not the list.';
