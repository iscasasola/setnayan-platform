-- price_change_takes_two_admins — what a customer is charged takes two.
--
-- ── The clause ──────────────────────────────────────────────────────────────
-- Vendor Agreement § 9.1: *"Mid-quarter price change on any in-app SKU |
-- Pricing governance (per § 8)"*, and § 9 itself:
--
--     "Setnayan's in-app service prices … remain constant with reviews
--      scheduled at the start of each calendar quarter. Mid-quarter changes
--      are rare and require two-admin approval."
--
-- `platform_retail_catalog_v2` is admin-managed and is the ONLY price a
-- customer is charged. One admin could change it alone.
--
-- ── ⛔ WHY THIS GATES EVERY PRICE CHANGE, NOT ONLY MID-QUARTER ONES ─────────
-- The clause turns on "mid-quarter", and the corpus NEVER DEFINES where a
-- quarter's review window ends. "At the start of each calendar quarter" has no
-- duration. Grepped § 3.8, § 9, § 9.1 and the 0034 cart fixture — all four use
-- the term, none bounds it.
--
-- Picking one would decide whether a given money change needs two admins.
-- Owner ruling 2026-08-31, on a different invented default: "don't guess."
--
-- So this gates EVERY customer-price change: stricter than the contract, never
-- looser, therefore incapable of breaching it. § 9.1 requires two admins for
-- mid-quarter changes and is silent on quarterly ones; requiring two for both
-- is a self-imposed control on Setnayan's own admins and takes nothing from a
-- vendor. § 9.1's own note agrees with the direction — these happen "once a
-- week or less, where the two-admin friction is a feature not a bug."
--
-- ⚖ Narrowing to mid-quarter-only is one line in `priceChangeNeedsTwoAdmins`.
-- It needs the owner to state where the review window ends, and nothing else.
--
-- ⚠ VERIFIED BEFORE SHIPPING: production has 2 admins, so
-- `decided_by <> initiated_by` is satisfiable. With one admin every gate in
-- this family would make its operation impossible rather than careful.
--
-- 🔑 NOT EVERY FIELD ON THE FORM IS A PRICE. The row card also submits the
-- title, the customer-facing description, the active flag and
-- `saas_overhead_cost_php`. Renaming a SKU is copy; the cost column is OUR
-- margin, not anyone's bill. Only the fields in `CUSTOMER_PRICE_FIELDS` are
-- gated — see `apps/web/lib/retail-price-change.ts`.
--
-- ── The vocabulary is re-listed FROM PRODUCTION ─────────────────────────────
-- Read 2026-09-23 with `pg_get_constraintdef` on the live constraint, which
-- holds exactly nine values — the six original privilege actions plus the
-- three money actions shipped 2026-09-22. All nine are carried below.
--
-- `approve_vendor_subscription` appears in a migration in this repo and is NOT
-- in the live CHECK. It stays out. The migration history is not the list.

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
    'approve_retail_price_change'
  ));

COMMENT ON CONSTRAINT admin_approval_requests_action_type_check
  ON public.admin_approval_requests IS
  'The actions that require a second admin. Six privilege actions, plus four '
  'money actions: approve_comp_grant, approve_large_refund (9.1, refunds over '
  'PHP 25,000), approve_payment_account_change (9.1, the BDO/GCash receiving '
  'account) and approve_retail_price_change (9.1, what a customer is charged). '
  'Re-list from pg_get_constraintdef on PRODUCTION when adding a value — this '
  'repo holds a migration for approve_vendor_subscription that the live '
  'constraint does not have, so the history is not the list.';
