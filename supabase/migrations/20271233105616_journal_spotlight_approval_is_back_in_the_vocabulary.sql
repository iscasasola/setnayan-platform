-- journal spotlight approval is back in the vocabulary (LAU-20)
--
-- THE BUG. 20270323790338_journal_vendor_spotlights added
-- 'approve_journal_spotlight' to admin_approval_requests_action_type_check.
-- Two months later 20270518682623_fraud_enforcement_state_and_audit rebuilt the
-- same CHECK to add 'approve_fraud_wipe_ban' — and re-listed the vocabulary from
-- an OLDER migration, so 'approve_journal_spotlight' fell out. Since then every
-- initiateSponsored() (apps/web/app/admin/journal-spotlights/actions.ts) has
-- been refused at INSERT, so a sponsored journal spotlight can never open its
-- two-admin approval and can never publish.
--
-- MEASURED LIVE, read-only, 2026-09-18:
--   pg_get_constraintdef = CHECK (action_type = ANY (ARRAY[
--     'grant_internal_account','grant_team_pool','promote_to_admin',
--     'approve_vendor_partnership','approve_fraud_wipe_ban']))
--   select action_type, count(*) from admin_approval_requests  →  0 rows
--
-- THE FIX. The list below is the CURRENT prod vocabulary (the five values
-- above, copied from the live constraint — not from any older migration) plus
-- the one that was dropped. Nothing is removed, so no existing row can be
-- refused when ALTER TABLE validates.
--
-- NEXT TIME: tests/db/every-approval-type-the-code-writes-is-allowed.db.test.ts
-- inserts every action_type the code emits against the replayed schema, so a
-- rebuild that drops a value goes red in CI instead of in production.

BEGIN;

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
    'approve_journal_spotlight'
  ));

COMMIT;
