-- reject_vendor_deposit
-- ============================================================================
-- Payment-gated lock · the VENDOR-REJECT path (companion to
-- acknowledge_vendor_deposit, 20270320429117_deposit_lockfree.sql).
--
-- The couple recorded a downpayment (proof + published method) at lock, but the
-- vendor CANNOT confirm it ("I never received this"). This is the vendor's
-- explicit "not received" — it CLEARS the recorded-deposit markers so the couple
-- must re-submit (recordLockDownpayment re-records fresh, COALESCE-idempotent).
-- It does NOT un-lock the booking (the couple's commitment stands; only the
-- disputed payment is cleared) and NEVER touches deposit_acknowledged_at (a
-- confirmed deposit is final and cannot be rejected).
--
-- Modeled EXACTLY on acknowledge_vendor_deposit: ownership gate →
-- SELECT … FOR UPDATE → precondition (recorded & not-yet-acked) → single-winner
-- UPDATE with the same precondition in the WHERE → idempotent graceful re-call.
-- SECURITY DEFINER + granted to authenticated; ownership enforced via
-- current_vendor_event_vendor_ids (the vendor org owns this booking) or is_admin.
-- No money moves — reject is a signal. Setnayan never holds funds.
--
-- Idempotent: CREATE OR REPLACE.
-- ============================================================================

BEGIN;

CREATE OR REPLACE FUNCTION public.reject_vendor_deposit(
  p_event_vendor_id UUID,
  p_reason TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_recorded_at TIMESTAMPTZ;
  v_acked_at    TIMESTAMPTZ;
  v_rows        INTEGER;
BEGIN
  -- Ownership — the caller must be the booked vendor (owner/admin/agent) or a
  -- platform admin. Mirrors acknowledge_vendor_deposit exactly.
  IF p_event_vendor_id NOT IN (SELECT public.current_vendor_event_vendor_ids())
     AND NOT public.is_admin() THEN
    RAISE EXCEPTION 'not_your_booking' USING ERRCODE = '42501';
  END IF;

  SELECT deposit_recorded_at, deposit_acknowledged_at
    INTO v_recorded_at, v_acked_at
    FROM public.event_vendors
   WHERE vendor_id = p_event_vendor_id
   FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'booking_not_found' USING ERRCODE = 'P0002';
  END IF;

  -- Nothing recorded → nothing to reject.
  IF v_recorded_at IS NULL THEN
    RETURN jsonb_build_object('status', 'not_recorded');
  END IF;
  -- Already confirmed → a settled deposit is final; cannot be rejected.
  IF v_acked_at IS NOT NULL THEN
    RETURN jsonb_build_object('status', 'already_confirmed');
  END IF;

  -- Single-winner clear: wipe the recorded-deposit markers + method provenance so
  -- the couple must re-submit. The precondition in the WHERE (recorded & not
  -- acked) is the atomic gate — concurrent rejects/acks resolve to one winner.
  UPDATE public.event_vendors
     SET deposit_recorded_at  = NULL,
         deposit_proof_url    = NULL,
         deposit_method_id    = NULL,
         deposit_method_label = NULL,
         updated_at           = NOW()
   WHERE vendor_id = p_event_vendor_id
     AND deposit_recorded_at IS NOT NULL
     AND deposit_acknowledged_at IS NULL;
  GET DIAGNOSTICS v_rows = ROW_COUNT;
  IF v_rows = 0 THEN
    -- Lost the race to a concurrent ack/reject between the FOR UPDATE and here.
    RETURN jsonb_build_object('status', 'already');
  END IF;

  -- Void the couple's un-acknowledged deposit ledger row(s) for this booking.
  -- Clearing deposit_recorded_at above breaks the monotonic-marker invariant the
  -- ledger-insert guards rely on (`if (!deposit_recorded_at)`), so without this a
  -- re-submit would insert a SECOND event_vendor_payments row for the same real
  -- payment — over-reporting the couple's budget "paid so far". These rows are
  -- the couple's own record of a claimed-but-now-disputed downpayment; the vendor
  -- says it never arrived, so it must not count. Matched by the deposit notes the
  -- record paths stamp ("… awaiting vendor confirmation"); a confirmed deposit is
  -- unreachable here (already_confirmed short-circuit above), so this only ever
  -- removes un-acknowledged claimed rows.
  DELETE FROM public.event_vendor_payments
   WHERE vendor_id = p_event_vendor_id
     AND notes LIKE '%awaiting vendor confirmation%';

  RETURN jsonb_build_object('status', 'ok');
END;
$$;

REVOKE ALL     ON FUNCTION public.reject_vendor_deposit(UUID, TEXT) FROM PUBLIC;
REVOKE ALL     ON FUNCTION public.reject_vendor_deposit(UUID, TEXT) FROM anon;
GRANT  EXECUTE ON FUNCTION public.reject_vendor_deposit(UUID, TEXT) TO authenticated;

COMMENT ON FUNCTION public.reject_vendor_deposit(UUID, TEXT) IS
  'Vendor "downpayment not received" — clears the couple-recorded deposit markers (recorded_at/proof/method) so they must re-submit. Single-winner (FOR UPDATE + recorded & not-acked precondition); idempotent. Ownership-gated to the booked vendor (current_vendor_event_vendor_ids) or admin. Does NOT un-lock the booking and NEVER touches deposit_acknowledged_at (a confirmed deposit is final). No money moves.';

COMMIT;
