-- approve_comp_grant_takes_two_admins — a comp is money, so it takes two admins.
--
-- ── WHAT WAS TRUE BEFORE ───────────────────────────────────────────────────
-- `admin_approval_requests` has enforced four eyes in the DATABASE since
-- 20260930000000 (`admin_approval_four_eyes`: decided_by <> initiated_by), and
-- its vocabulary gated, in production, exactly six things:
--
--     grant_internal_account · grant_team_pool · promote_to_admin
--     approve_vendor_partnership · approve_fraud_wipe_ban
--     approve_journal_spotlight
--
-- Every one of those is a PRIVILEGE. None is money. So a single admin could
-- extend a vendor's paid entitlement and write a `comp_grants` row carrying
-- `retail_value_centavos`, with nobody else involved.
--
-- 🔑 THE INTENT WAS ALREADY IN THE SCHEMA. `comp_grants.approved_by` exists and
-- the grant path set it to NULL on every row. The column was built for the
-- second admin and never given one. This is that admin.
--
-- ⚠ THE VOCABULARY WAS READ FROM PRODUCTION, NOT FROM THE MIGRATIONS.
-- `pg_get_constraintdef` on the live constraint lists the six above.
-- `approve_vendor_subscription` appears in a migration in this repo and is NOT
-- in the live CHECK — so re-listing from the migration history would have
-- ADDED a value production never had, and dropping one it does have would fail
-- only later, against real rows. A re-listed CHECK is only as good as where the
-- list came from.
--
--     select pg_get_constraintdef(oid) from pg_constraint
--      where conname = 'admin_approval_requests_action_type_check';

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
    -- Added 2026-09-22. The first MONEY action in this vocabulary.
    'approve_comp_grant'
  ));

COMMENT ON CONSTRAINT admin_approval_requests_action_type_check
  ON public.admin_approval_requests IS
  'The actions that require a second admin. Six privilege actions, and since '
  '2026-09-22 one money action (approve_comp_grant). Re-list from '
  'pg_get_constraintdef on PRODUCTION when adding a value — this repo holds a '
  'migration for approve_vendor_subscription that the live constraint does not '
  'have, so the migration history is not the list.';
