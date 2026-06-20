-- ============================================================================
-- 20270202160006_event_vendor_payment_confirm.sql
--
-- Vendor Transaction Lifecycle · Phase 2 · PR-C — the couple logs a payment
-- (with proof) against an installment, the VENDOR accepts (confirms) it.
--
-- PR-A landed the reusable schedule TEMPLATE on a vendor_services row.
-- PR-B snapshotted that template into a CONCRETE per-booking PLAN
-- (event_vendor_payment_plan.instances_json — one frozen installment per seq)
-- and registered the 4 payment-lifecycle notification_type values.
--
-- This migration wires the CONFIRM half of the loop (lifecycle stage 7):
--
--   1. event_vendor_payments gets 3 additive columns:
--        • schedule_instance_seq — links a logged payment to a plan installment
--          by its `seq` in event_vendor_payment_plan.instances_json. Nullable =
--          a generic payment not attributed to any installment.
--        • vendor_confirmed_at    — set when the vendor confirms receipt.
--        • vendor_confirmed_by    — the auth.uid() that confirmed (the vendor).
--
--   2. confirm_vendor_payment(p_payment_id) — the DB GUARD. The payment row
--      lives on the COUPLE's table (couple-RLS), so the money-adjacent write
--      that flips it "vendor confirmed" must be gated to the OWNING vendor and
--      cannot run as a plain couple-client write. Modeled on Phase 1 PR3's
--      respond_vendor_proposal (SECURITY DEFINER + ownership precondition +
--      idempotent guard) and on the vendor-side ownership gate in
--      vendor-dashboard/messages/[threadId]/pax-actions.ts:
--        (a) resolve payment → its event_vendor → marketplace_vendor_id;
--        (b) verify auth.uid() OWNS that marketplace vendor
--            (marketplace_vendor_id IN vendor_profiles WHERE user_id=auth.uid())
--            — RAISE 42501 otherwise;
--        (c) set ONLY vendor_confirmed_at = now(), vendor_confirmed_by =
--            auth.uid() (idempotent: no-op if already confirmed);
--        (d) REVOKE ALL FROM public/anon; GRANT EXECUTE TO authenticated.
--      It deliberately does NOT touch amount/clear the plan — "cleared" + the
--      lifecycle stepper are PR-D.
--
-- BARE migration (no BEGIN/COMMIT wrapper): the function body is self-contained
-- and the ALTER ... ADD COLUMN statements auto-commit safely. CREATE OR REPLACE
-- + ADD COLUMN IF NOT EXISTS make this idempotent + re-run safe.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. event_vendor_payments — link-to-installment + vendor-confirm columns.
--    Additive + nullable; the existing 0007 logPayment flow + every existing
--    row are unaffected (all three default NULL).
-- ----------------------------------------------------------------------------
ALTER TABLE public.event_vendor_payments
  ADD COLUMN IF NOT EXISTS schedule_instance_seq INT,
  ADD COLUMN IF NOT EXISTS vendor_confirmed_at   TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS vendor_confirmed_by   UUID;

COMMENT ON COLUMN public.event_vendor_payments.schedule_instance_seq IS
  'Vendor Transaction Lifecycle Phase 2 PR-C — links this payment to a plan installment by its seq in event_vendor_payment_plan.instances_json. NULL = generic payment, not attributed to an installment.';
COMMENT ON COLUMN public.event_vendor_payments.vendor_confirmed_at IS
  'Vendor Transaction Lifecycle Phase 2 PR-C — set by confirm_vendor_payment() when the owning vendor confirms the couple''s logged payment was received. NULL = still pending vendor confirmation.';
COMMENT ON COLUMN public.event_vendor_payments.vendor_confirmed_by IS
  'Vendor Transaction Lifecycle Phase 2 PR-C — the auth.uid() (vendor owner) that confirmed receipt. Set alongside vendor_confirmed_at.';

-- ----------------------------------------------------------------------------
-- 2. confirm_vendor_payment(p_payment_id uuid) — the DB guard.
--    SECURITY DEFINER: it writes a COUPLE-owned row (event_vendor_payments,
--    couple-RLS), so it bypasses RLS but enforces the vendor-ownership check in
--    the body. The vendor must OWN the booking the payment belongs to.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.confirm_vendor_payment(
  p_payment_id UUID
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_event_vendor_id  UUID;
  v_already          TIMESTAMPTZ;
  v_marketplace_id   UUID;
  v_owns             BOOLEAN;
  v_rows             INTEGER;
BEGIN
  -- (a) Resolve the payment → its booking. FOR UPDATE serializes a concurrent
  --     double-confirm so the idempotent guard below is a true single-winner.
  SELECT vendor_id, vendor_confirmed_at
    INTO v_event_vendor_id, v_already
  FROM public.event_vendor_payments
  WHERE payment_id = p_payment_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'payment_not_found' USING ERRCODE = 'P0002';
  END IF;

  -- (a, cont.) → the event_vendors booking → its marketplace_vendor_id.
  SELECT marketplace_vendor_id
    INTO v_marketplace_id
  FROM public.event_vendors
  WHERE vendor_id = v_event_vendor_id;
  IF NOT FOUND OR v_marketplace_id IS NULL THEN
    -- No marketplace vendor on this booking (off-platform / manual vendor):
    -- there is no vendor account that could confirm it.
    RAISE EXCEPTION 'not_a_marketplace_booking' USING ERRCODE = '42501';
  END IF;

  -- (b) Ownership gate: the CALLER must own that marketplace vendor.
  SELECT EXISTS (
    SELECT 1 FROM public.vendor_profiles
    WHERE vendor_profile_id = v_marketplace_id
      AND user_id = auth.uid()
  ) INTO v_owns;
  IF NOT v_owns THEN
    RAISE EXCEPTION 'not_your_booking' USING ERRCODE = '42501';
  END IF;

  -- (c) Idempotent: a second confirm (or a concurrent one waiting on the lock)
  --     no-ops once the first has stamped vendor_confirmed_at.
  IF v_already IS NOT NULL THEN
    RETURN;
  END IF;

  UPDATE public.event_vendor_payments
  SET vendor_confirmed_at = NOW(),
      vendor_confirmed_by = auth.uid()
  WHERE payment_id = p_payment_id
    AND vendor_confirmed_at IS NULL;  -- precondition: single-winner even sans lock
  GET DIAGNOSTICS v_rows = ROW_COUNT;
  -- v_rows = 0 only if a racer confirmed between the lock read + here; that's a
  -- successful idempotent no-op, not an error.
END;
$$;

-- (d) Lock it down to authenticated callers only.
REVOKE ALL ON FUNCTION public.confirm_vendor_payment(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.confirm_vendor_payment(UUID) FROM anon;
GRANT EXECUTE ON FUNCTION public.confirm_vendor_payment(UUID) TO authenticated;

COMMENT ON FUNCTION public.confirm_vendor_payment(UUID) IS
  'Vendor Transaction Lifecycle Phase 2 PR-C — the owning marketplace vendor confirms the couple''s logged payment was received. SECURITY DEFINER DB guard: resolves payment → event_vendors → marketplace_vendor_id, verifies auth.uid() owns that vendor_profiles row (RAISE 42501 otherwise), then sets ONLY vendor_confirmed_at/by. Idempotent (no-op if already confirmed) + serialized via SELECT FOR UPDATE. Does NOT clear the plan or touch the amount — that''s PR-D.';
