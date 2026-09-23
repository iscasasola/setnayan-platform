-- payment_account_change_takes_two_admins — where the money lands takes two.
--
-- ── The clause ──────────────────────────────────────────────────────────────
-- Vendor Agreement § 9.1, major-decisions table:
--
--     | Modify Setnayan's static BDO / GCash payment-receiving account numbers
--     | Payment redirection = fraud risk |
--
-- Until now one admin could change, alone and silently, the account every
-- customer pays into. Of the nine rows in § 9.1 this is the one that redirects
-- EVERY FUTURE PAYMENT rather than moving a single amount, which is why it was
-- built before the three remaining rows.
--
-- ── What is gated, and what is deliberately not ─────────────────────────────
-- GATED — the destination: `bdo_account_name`, `bdo_account_number`,
-- `gcash_account_name`, `gcash_number`, and the QR images (`*_qr_url` +
-- `*_qr_payload`).
--
-- ⚠ A QR IS A DESTINATION AND IT IS A SEPARATE DOOR. `uploadMerchantQr` never
-- touches the text fields; it writes the image customers actually scan. Gating
-- only `savePaymentInstruments` would have protected the account number while
-- leaving the thing money is really sent to wide open.
--
-- 🔒 NOT GATED, ON PURPOSE — the kill switches (`gcash_enabled`, `bdo_enabled`),
-- the caps, and the available-balance readings. `savePaymentInstruments`'s own
-- docblock says an unchecked box must mean OFF because that is "the direction
-- that matters when an account is at its cap and transfers are bouncing."
-- Requiring a second admin to CLOSE a failing rail would hold it open while
-- payments bounce. A control whose job is to STOP money must never wait on a
-- quorum. § 9.1 gates redirection, not availability.
--
-- `removeMerchantQr` is likewise ungated: withdrawing a payment option is not
-- pointing one somewhere new, and re-pointing requires an upload, which IS
-- gated.
--
-- ── The vocabulary is re-listed FROM PRODUCTION ─────────────────────────────
-- Read 2026-09-22 with `pg_get_constraintdef` on the live constraint, which
-- holds exactly six values:
--
--     grant_internal_account · grant_team_pool · promote_to_admin
--     approve_vendor_partnership · approve_fraud_wipe_ban
--     approve_journal_spotlight
--
-- `approve_comp_grant` (20271240919693) and `approve_large_refund`
-- (20271241619056) are added earlier in this same stack; both sort BEFORE this
-- file, so they have applied by the time this runs — in the PGlite replay,
-- which applies in filename order, and in prod via `db push --include-all`.
-- Both are listed. Dropping either would fail later, against real rows.
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
    -- 2026-09-22 · money actions, in the order they were built.
    'approve_comp_grant',
    'approve_large_refund',
    -- 2026-09-22 · § 9.1: the receiving account itself, text fields or QR.
    'approve_payment_account_change'
  ));

COMMENT ON CONSTRAINT admin_approval_requests_action_type_check
  ON public.admin_approval_requests IS
  'The actions that require a second admin. Six privilege actions, plus three '
  'money actions added 2026-09-22: approve_comp_grant, approve_large_refund '
  '(Vendor Agreement 9.1, refunds over PHP 25,000) and '
  'approve_payment_account_change (9.1, the BDO/GCash receiving account, text '
  'fields or QR image). Re-list from pg_get_constraintdef on PRODUCTION when '
  'adding a value — this repo holds a migration for approve_vendor_subscription '
  'that the live constraint does not have, so the history is not the list.';
