-- refund_over_25k_takes_two_admins — the contract names a number; the code obeys it.
--
-- ── THE FINDING ─────────────────────────────────────────────────────────────
-- `Setnayan_Vendor_Agreement.md` § 9.1, in the "major decisions" table that
-- every vendor signs:
--
--     | Refund any single transaction **> ₱25,000** | Financial control |
--
-- and, in the single-admin table directly beneath it:
--
--     | **Process a refund** ≤ ₱25,000 | Disputes Handler · Payments Handler |
--
-- So the threshold is not a judgement call and never was: **₱25,000**, with the
-- boundary itself single-admin. `refundOrder` accepted any amount up to a
-- ₱100,000,000 paste-typo ceiling, from one admin, since the pilot.
--
-- 🔑 THE NUMBER WAS NEVER MISSING — IT WAS WRITTEN IN THIS FILE'S OWN CODEBASE.
-- `apps/web/app/admin/payments/actions.ts` has carried, in a comment above the
-- action, since the pilot:
--
--     Two-admin gate per 0023 § 9.1 (refunds > ₱25K) is V1.x — this V1 action
--     is single-admin authority for the pilot cohort.
--
-- A session nonetheless reported the threshold as "a number that lives in a
-- contract, not this repo" and put it on the owner's desk. It was in the
-- contract AND in a comment six lines above the function. ⚠ An absence is a
-- claim about where you looked. Grep before escalating.
--
-- ⚠ AND A COMMENT IS NOT A GATE. "is V1.x" deferred the control and then read,
-- to every later session, as though the control existed. The comment is now
-- replaced by the constraint below plus the approval path in `actions.ts`.
--
-- ── THE VOCABULARY IS RE-LISTED FROM PRODUCTION ─────────────────────────────
-- Read 2026-09-22 with `pg_get_constraintdef` on the LIVE constraint, which
-- holds exactly six values:
--
--     grant_internal_account · grant_team_pool · promote_to_admin
--     approve_vendor_partnership · approve_fraud_wipe_ban
--     approve_journal_spotlight
--
-- `approve_comp_grant` is NOT among them — it is added by 20271240919693 in
-- this same stack, which sorts BEFORE this file and so has applied by the time
-- this runs (both in the PGlite replay, which applies in filename order, and in
-- prod via `db push --include-all`). It is therefore listed here. Dropping it
-- would fail only later, against a real row.
--
-- `approve_vendor_subscription` appears in a migration in this repo and is NOT
-- in the live CHECK. It stays out. **The migration history is not the list.**

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
    -- 2026-09-22 · the first money action (20271240919693).
    'approve_comp_grant',
    -- 2026-09-22 · Vendor Agreement § 9.1: a refund over ₱25,000.
    'approve_large_refund'
  ));

COMMENT ON CONSTRAINT admin_approval_requests_action_type_check
  ON public.admin_approval_requests IS
  'The actions that require a second admin. Six privilege actions, plus two '
  'money actions added 2026-09-22: approve_comp_grant and approve_large_refund '
  '(Vendor Agreement 9.1, refunds over PHP 25,000). Re-list from '
  'pg_get_constraintdef on PRODUCTION when adding a value — this repo holds a '
  'migration for approve_vendor_subscription that the live constraint does not '
  'have, so the migration history is not the list.';
