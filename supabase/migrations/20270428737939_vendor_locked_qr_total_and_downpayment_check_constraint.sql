-- vendor_locked_qr_tokens — money-sanity CHECK (defense-in-depth)
-- ============================================================================
-- The issuance action (issueLockedQr) already rejects total<=0, downpayment<=0,
-- and downpayment>total. This adds a DB-level backstop so a DIRECT RLS insert
-- (bypassing the action) can't persist a token whose downpayment exceeds its
-- total or whose total is zero/negative.
--
-- total_php stays NULLABLE (legacy tokens + the claim RPC COALESCEs on it), so
-- the check only bites when a total IS present: then it must be > 0 and the
-- downpayment must not exceed it. A null total is still allowed (the app never
-- writes one now; a crafted null-total insert only yields a self-inflicted,
-- malformed token for that vendor's own booking).
--
-- Added NOT VALID: guards every future INSERT/UPDATE without validating existing
-- rows, so it can't fail on any pre-existing data. Idempotent via
-- DROP CONSTRAINT IF EXISTS + ADD.
-- ============================================================================

ALTER TABLE public.vendor_locked_qr_tokens
  DROP CONSTRAINT IF EXISTS vendor_locked_qr_money_sane;

ALTER TABLE public.vendor_locked_qr_tokens
  ADD CONSTRAINT vendor_locked_qr_money_sane
  CHECK (total_php IS NULL OR (total_php > 0 AND initial_paid_php <= total_php))
  NOT VALID;
