-- payment_gated_lock_deposit_method
-- ============================================================================
-- PAYMENT-GATED LOCK · deposit-method provenance (Vendor↔Couple connection).
--
-- Reverses the "Lock-Free" default (20270320429117_deposit_lockfree.sql) behind
-- a feature flag: when NEXT_PUBLIC_PAYMENT_GATED_LOCK_ENABLED=true, locking a
-- vendor prompts the couple for a DOWNPAYMENT paid via the vendor's PUBLISHED
-- payment method (vendor_payment_methods) with a REQUIRED screenshot, recorded
-- the instant the lock lands. These two columns capture WHICH published method
-- the couple paid through, so the vendor's "please confirm" surface + the
-- couple's workspace can name it — and the label survives even if the vendor
-- later edits/deletes that method row.
--
-- OFF-PLATFORM MONEY / 0% COMMISSION (owner lock): unchanged. Setnayan NEVER
-- holds funds. This is still RECORD + ACKNOWLEDGE only — the couple pays the
-- vendor directly off-platform and uploads proof; nothing here makes Setnayan
-- the payee. deposit_method_id/label are provenance, not a charge.
--
-- ORTHOGONAL MARKERS (owner lock): unchanged — we do NOT repurpose the
-- event_vendors.status enum. These are nullable columns alongside the existing
-- deposit_recorded_at / deposit_acknowledged_at / deposit_proof_url markers.
--
-- Additive + idempotent (ADD COLUMN IF NOT EXISTS). No RLS change — the columns
-- inherit event_vendors' existing couple/vendor/admin policies. Reads by the
-- vendor go through the same acknowledge path; no new grant surface.
-- ============================================================================

BEGIN;

ALTER TABLE public.event_vendors
  ADD COLUMN IF NOT EXISTS deposit_method_id    UUID
    REFERENCES public.vendor_payment_methods(payment_method_id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS deposit_method_label TEXT;

COMMENT ON COLUMN public.event_vendors.deposit_method_id IS
  'The vendor_payment_methods row the couple paid the lock DOWNPAYMENT through (payment-gated lock). NULL for legacy / off-platform / free-text deposits. ON DELETE SET NULL so deleting the method never orphans the booking; deposit_method_label retains the human label. Provenance only — Setnayan is not the payee (0% commission, off-platform).';

COMMENT ON COLUMN public.event_vendors.deposit_method_label IS
  'Frozen human label of the published payment method used for the lock downpayment (e.g. "BDO · Savings · 0012-3456"), snapshotted at pay-time so it survives the vendor editing/deleting the method. NULL when no gated downpayment was recorded.';

COMMIT;
