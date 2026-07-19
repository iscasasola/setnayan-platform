-- deposit_lockfree
-- ============================================================================
-- DEPOSIT RESERVATION LOCK-FREE (Wave 3 · vendor booking-lifecycle cluster)
--
-- The MISSING booking-lifecycle state: "the host RECORDED a deposit → the date
-- is HELD → awaiting the vendor's confirmation" — DISTINCT from confirmed-paid.
-- Today `deposit_paid_php > 0` + status='deposit_paid' conflate "I logged it"
-- with "it cleared", and there's no proof artifact or vendor acknowledgement.
--
-- OFF-PLATFORM MONEY / 0% COMMISSION (owner lock): Setnayan NEVER holds funds.
-- The deposit amount is a host-entered PHP figure; this feature is RECORD +
-- ACKNOWLEDGE + date-hold ONLY — NOT money movement, no gateway, no OR, no tax.
-- Nothing here makes Setnayan the payee.
--
-- ORTHOGONAL MARKERS (owner lock): we do NOT repurpose the event_vendors.status
-- enum. "Recorded-but-unsettled" and "vendor-acknowledged" are nullable
-- timestamp/url columns orthogonal to the status ladder — exactly the precedent
-- set by contract_signed_at in 20270217864104_contract_booking_link.sql.
--
-- TWO-PARTY-ACK SERIALIZATION: the vendor's acknowledge is a single-winner
-- SECURITY DEFINER RPC modeled EXACTLY on respond_vendor_proposal()
-- (20261209000000_concurrency_guards.sql): ownership gate → SELECT … FOR UPDATE
-- → status precondition → atomic single-winner UPDATE with the same precondition
-- in the WHERE (defense in depth) → idempotent graceful re-call. NEVER a 2-way
-- write.
--
-- Idempotent: ADD COLUMN IF NOT EXISTS + CREATE OR REPLACE FUNCTION.
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- 1 · Orthogonal deposit-reservation markers on the booking ledger.
--     Nullable timestamps/url — NOT a new status enum value.
-- ----------------------------------------------------------------------------

ALTER TABLE public.event_vendors
  ADD COLUMN IF NOT EXISTS deposit_recorded_at     TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS deposit_acknowledged_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS deposit_proof_url       TEXT;

COMMENT ON COLUMN public.event_vendors.deposit_recorded_at IS
  'Set by the COUPLE (recordDeposit) the instant a deposit is logged off-platform → the date is HELD via acquire_schedule_pools keyed to this moment. NULL = no deposit recorded. Orthogonal to status (we never repurpose the status enum); "recorded" means logged-but-unsettled, distinct from a cleared payment. Setnayan never holds the money.';

COMMENT ON COLUMN public.event_vendors.deposit_acknowledged_at IS
  'Set by the VENDOR via acknowledge_vendor_deposit() — "deposit received, confirmed". NULL while awaiting vendor confirmation. Single-winner SECURITY DEFINER transition (FOR UPDATE + precondition), never a 2-way write. Acknowledge is a signal, not money movement.';

COMMENT ON COLUMN public.event_vendors.deposit_proof_url IS
  'Optional couple-uploaded proof-of-deposit artifact (R2/Storage public URL) captured at recordDeposit time. Record-keeping only — Setnayan is not the payee and does not verify funds.';

-- ----------------------------------------------------------------------------
-- 2 · acknowledge_vendor_deposit — VENDOR single-winner acknowledge RPC.
--     Modeled EXACTLY on respond_vendor_proposal (20261209000000):
--       SELECT … FOR UPDATE  → serializes concurrent acks
--       precondition guard   → recorded & not-yet-acked
--       UPDATE … WHERE precondition + rowcount → atomic single-winner
--       idempotent re-call    → already-acked returns gracefully, not an error
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.acknowledge_vendor_deposit(
  p_event_vendor_id UUID
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
  -- Ownership — DEFINER + granted to authenticated, so gate explicitly. The
  -- caller must be the booked vendor (owner/admin/agent on this booking) or a
  -- platform admin. current_vendor_event_vendor_ids() resolves the exact
  -- event_vendors.vendor_id set the vendor org owns (mirrors the read RLS in
  -- 20270315091571_vendor_read_payment_ledger_rls.sql).
  IF p_event_vendor_id NOT IN (SELECT public.current_vendor_event_vendor_ids())
     AND NOT public.is_admin() THEN
    RAISE EXCEPTION 'not_your_booking' USING ERRCODE = '42501';
  END IF;

  -- FOR UPDATE serializes concurrent acknowledgers (double-click / retry / two
  -- agents): the second waits, then re-reads the now-acked row and is caught by
  -- the idempotent branch below.
  SELECT deposit_recorded_at, deposit_acknowledged_at
    INTO v_recorded_at, v_acked_at
    FROM public.event_vendors
   WHERE vendor_id = p_event_vendor_id
   FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'booking_not_found' USING ERRCODE = 'P0002';
  END IF;

  -- Precondition: a deposit must have been recorded by the couple first.
  IF v_recorded_at IS NULL THEN
    RETURN jsonb_build_object('status', 'not_recorded');
  END IF;

  -- IDEMPOTENCY: a re-call on an already-acked row returns gracefully (the
  -- single-winner already won) instead of raising — mirrors the
  -- "already_resolved is not an error to the second caller" intent, but here
  -- the contract is a benign no-op so the vendor UX still shows "confirmed".
  IF v_acked_at IS NOT NULL THEN
    RETURN jsonb_build_object(
      'status', 'already', 'acknowledged_at', v_acked_at);
  END IF;

  -- Status precondition in the WHERE (defense in depth alongside FOR UPDATE):
  -- the transition is atomically single-winner even if the lock above is ever
  -- removed. deposit_acknowledged_at IS NULL is the single-winner gate.
  UPDATE public.event_vendors
     SET deposit_acknowledged_at = NOW(),
         updated_at = NOW()
   WHERE vendor_id = p_event_vendor_id
     AND deposit_recorded_at IS NOT NULL
     AND deposit_acknowledged_at IS NULL;
  GET DIAGNOSTICS v_rows = ROW_COUNT;
  IF v_rows = 0 THEN
    -- Lost the race to a concurrent winner between the FOR UPDATE read and the
    -- UPDATE (only possible if the lock is removed) — re-read & report acked.
    SELECT deposit_acknowledged_at INTO v_acked_at
      FROM public.event_vendors WHERE vendor_id = p_event_vendor_id;
    RETURN jsonb_build_object(
      'status', 'already', 'acknowledged_at', v_acked_at);
  END IF;

  RETURN jsonb_build_object('status', 'ok', 'acknowledged_at', NOW());
END;
$$;

REVOKE ALL ON FUNCTION public.acknowledge_vendor_deposit(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.acknowledge_vendor_deposit(UUID) FROM anon;
GRANT EXECUTE ON FUNCTION public.acknowledge_vendor_deposit(UUID) TO authenticated;

COMMENT ON FUNCTION public.acknowledge_vendor_deposit(UUID) IS
  'Vendor confirms a couple-recorded deposit ("deposit received") on a booking. Serialized via SELECT FOR UPDATE + deposit_acknowledged_at-IS-NULL precondition UPDATE so concurrent acks are single-winner; idempotent re-call returns status=already. Ownership-gated to the booked vendor (current_vendor_event_vendor_ids) or admin. Acknowledge is a SIGNAL, not money movement — Setnayan never holds funds (0% commission, off-platform pay).';

COMMIT;
