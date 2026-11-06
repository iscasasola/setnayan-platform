-- booking_fee_disputes
-- Created via `pnpm migration:new`. Idempotent: it may be re-applied.
-- ============================================================================
-- 🕵️ A SUPPLIER CAN DISPUTE A BOOKING FEE — the grace-first ladder.
--
-- Owner, 2026-07-27 (DECISION_LOG "FOUND-YOU DISPUTES — grace-first ladder"), verbatim: *"for their first dispute,
-- we will accept but remind them that this is the power and reach of setnayan's service… second dispute will be
-- upon review of our admin"*. Owner, 2026-11-05: *"switch on booking fee. and build dispute"*.
--
--   · FIRST dispute per supplier, EVER → accepted on the spot, no admin touch: the fee is waived and its open bill
--     voided. The screen answers with the reminder (`lib/booking-fee-dispute.ts`).
--   · SECOND and later → waits for an admin (`/admin/disputes`), who sees the receipts (the found-record of
--     20271313372071, a chat started from Setnayan, a save from Find) and accepts (fee waived) or rejects (the
--     bill stands).
--
-- WHAT A DISPUTE CAN TOUCH — and what it cannot:
--   · only an UNPAID charge (`status = 'pending'`). A paid fee is not disputed here: giving money back is a refund,
--     and the refund path (`booking_fee_reverse_charge`) re-opens a bill rather than waiving one. Owner question.
--   · an accepted dispute moves the charge to `waived_import` — "the supplier brought this client", which is
--     exactly what the supplier claimed. It is already a settled status in every rule that reads one (the event
--     lock, the date hold, the re-derive on an amended booking, the live-charge lookups), so no money rule had to
--     learn a new word. WHY it was waived lives HERE, on the dispute row — never as a rewrite of the facts it was
--     judged on (Integration Contract 2026-07-27 §5: "disputes act on the ledger, never retro-edit inputs").
--   · the open bill is voided by the ONE shared writer, `booking_fee_upsert_vendor_order` — the same call the
--     cancelled-booking path makes.
--   · the free-five place (`booking_fee_ledger.booking_ordinal`) is NOT given back — it is immutable by its own
--     comment, the same reason `booking_fee_reverse_charge` refuses to release it.
--
-- Nothing here reads or writes a flag or a price.
-- ============================================================================

BEGIN;

-- ── 1 · The record ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.booking_fee_disputes (
  dispute_id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  charge_id          UUID        NOT NULL UNIQUE
                                 REFERENCES public.booking_fee_charges(charge_id) ON DELETE CASCADE,
  vendor_profile_id  UUID        NOT NULL
                                 REFERENCES public.vendor_profiles(vendor_profile_id) ON DELETE CASCADE,
  opened_by_user_id  UUID        REFERENCES public.users(user_id) ON DELETE SET NULL,
  reason             TEXT        CHECK (reason IS NULL OR length(reason) BETWEEN 1 AND 1000),
  status             TEXT        NOT NULL
                                 CHECK (status IN ('auto_accepted', 'under_review', 'accepted', 'rejected')),
  decided_by_user_id UUID        REFERENCES public.users(user_id) ON DELETE SET NULL,
  decided_at         TIMESTAMPTZ,
  decision_note      TEXT        CHECK (decision_note IS NULL OR length(decision_note) BETWEEN 1 AND 1000),
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK ((status = 'under_review') = (decided_at IS NULL))
);
ALTER TABLE public.booking_fee_disputes ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS booking_fee_disputes_vendor_idx ON public.booking_fee_disputes (vendor_profile_id);
CREATE INDEX IF NOT EXISTS booking_fee_disputes_review_idx
  ON public.booking_fee_disputes (created_at) WHERE status = 'under_review';

COMMENT ON TABLE public.booking_fee_disputes IS
  'A supplier''s dispute of one unpaid booking fee (DECISION_LOG 2026-07-27 grace-first ladder; built 2026-11-05). '
  'First per supplier = auto_accepted; later ones under_review until an admin accepts or rejects. Accepted = the '
  'charge moved to waived_import and its open bill voided. Written only by booking_fee_open_dispute / '
  'booking_fee_decide_dispute (service role). The supplier reads its own; admins read all.';
COMMENT ON COLUMN public.booking_fee_disputes.status IS
  'auto_accepted (first dispute, fee waived on the spot) · under_review (waiting for an admin) · accepted (admin '
  'waived the fee) · rejected (admin: the fee stands).';

DROP POLICY IF EXISTS booking_fee_disputes_vendor_read ON public.booking_fee_disputes;
CREATE POLICY booking_fee_disputes_vendor_read
  ON public.booking_fee_disputes FOR SELECT TO authenticated
  USING (vendor_profile_id IN (SELECT public.current_vendor_profile_ids()));

DROP POLICY IF EXISTS booking_fee_disputes_admin_read ON public.booking_fee_disputes;
CREATE POLICY booking_fee_disputes_admin_read
  ON public.booking_fee_disputes FOR SELECT TO authenticated
  USING ((SELECT public.is_admin()));

REVOKE ALL ON public.booking_fee_disputes FROM PUBLIC;
REVOKE ALL ON public.booking_fee_disputes FROM anon;
REVOKE ALL ON public.booking_fee_disputes FROM authenticated;
GRANT SELECT ON public.booking_fee_disputes TO authenticated;
GRANT ALL ON public.booking_fee_disputes TO service_role;

-- ── 2 · Waive one charge for an accepted dispute (internal) ────────────────
CREATE OR REPLACE FUNCTION public.booking_fee_waive_for_dispute(p_charge_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only an unpaid bill moves. A charge paid while the dispute waited is left exactly as it is.
  UPDATE public.booking_fee_charges
     SET status = 'waived_import', expires_at = NULL, updated_at = now()
   WHERE charge_id = p_charge_id AND status = 'pending';
  IF NOT FOUND THEN
    RETURN FALSE;
  END IF;
  -- The one writer of a fee bill: a charge that is no longer pending has its open order cancelled.
  PERFORM public.booking_fee_upsert_vendor_order(p_charge_id);
  RETURN TRUE;
END;
$$;

COMMENT ON FUNCTION public.booking_fee_waive_for_dispute(UUID) IS
  'An accepted booking-fee dispute: pending -> waived_import and the open bill voided (booking_fee_upsert_vendor_order). '
  'A charge that is no longer pending is untouched and FALSE is returned. Internal: no role holds EXECUTE.';

REVOKE ALL ON FUNCTION public.booking_fee_waive_for_dispute(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.booking_fee_waive_for_dispute(UUID) FROM anon;
REVOKE ALL ON FUNCTION public.booking_fee_waive_for_dispute(UUID) FROM authenticated;

-- ── 3 · The supplier opens a dispute ───────────────────────────────────────
CREATE OR REPLACE FUNCTION public.booking_fee_open_dispute(
  p_charge_id UUID,
  p_user_id   UUID,
  p_reason    TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_charge   RECORD;
  v_existing RECORD;
  v_prior    INTEGER;
  v_reason   TEXT := NULLIF(btrim(COALESCE(p_reason, '')), '');
  v_id       UUID;
  v_found    RECORD;
BEGIN
  SELECT charge_id, vendor_profile_id, event_id, status
    INTO v_charge
    FROM public.booking_fee_charges
   WHERE charge_id = p_charge_id
   FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('result', 'no_charge');
  END IF;

  -- Only the shop's own account (the payer of its fee bills) may dispute.
  IF NOT EXISTS (
    SELECT 1 FROM public.vendor_profiles vp
     WHERE vp.vendor_profile_id = v_charge.vendor_profile_id AND vp.user_id = p_user_id
  ) THEN
    RETURN jsonb_build_object('result', 'not_yours');
  END IF;

  -- One dispute per charge: asking again reports the first one.
  SELECT dispute_id, status INTO v_existing FROM public.booking_fee_disputes WHERE charge_id = p_charge_id;
  IF FOUND THEN
    RETURN jsonb_build_object('result', 'already', 'dispute_id', v_existing.dispute_id, 'status', v_existing.status);
  END IF;

  IF v_charge.status <> 'pending' THEN
    RETURN jsonb_build_object('result', 'not_disputable', 'charge_status', v_charge.status);
  END IF;

  -- The receipts the reminder quotes (found-record, 20271313372071). Absent = said without a count.
  SELECT first_found_at, view_count INTO v_found
    FROM public.event_vendor_found
   WHERE event_id = v_charge.event_id AND vendor_profile_id = v_charge.vendor_profile_id;

  -- Grace-first: the shop's FIRST dispute ever, whatever became of any other, is accepted on the spot.
  SELECT count(*) INTO v_prior FROM public.booking_fee_disputes WHERE vendor_profile_id = v_charge.vendor_profile_id;

  IF v_prior = 0 THEN
    INSERT INTO public.booking_fee_disputes
      (charge_id, vendor_profile_id, opened_by_user_id, reason, status, decided_at)
    VALUES
      (p_charge_id, v_charge.vendor_profile_id, p_user_id, left(v_reason, 1000), 'auto_accepted', now())
    RETURNING dispute_id INTO v_id;
    PERFORM public.booking_fee_waive_for_dispute(p_charge_id);
    RETURN jsonb_build_object(
      'result', 'auto_accepted', 'dispute_id', v_id,
      'first_found_at', v_found.first_found_at, 'view_count', v_found.view_count
    );
  END IF;

  INSERT INTO public.booking_fee_disputes
    (charge_id, vendor_profile_id, opened_by_user_id, reason, status)
  VALUES
    (p_charge_id, v_charge.vendor_profile_id, p_user_id, left(v_reason, 1000), 'under_review')
  RETURNING dispute_id INTO v_id;
  RETURN jsonb_build_object('result', 'under_review', 'dispute_id', v_id);
END;
$$;

COMMENT ON FUNCTION public.booking_fee_open_dispute(UUID, UUID, TEXT) IS
  'A supplier disputes one UNPAID booking fee (DECISION_LOG 2026-07-27 grace-first ladder). Their first dispute ever '
  '-> auto_accepted (fee waived, bill voided); later ones -> under_review. One per charge. Service role only — the '
  'server action proves the caller owns the bill, and this re-checks it.';

REVOKE ALL ON FUNCTION public.booking_fee_open_dispute(UUID, UUID, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.booking_fee_open_dispute(UUID, UUID, TEXT) FROM anon;
REVOKE ALL ON FUNCTION public.booking_fee_open_dispute(UUID, UUID, TEXT) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.booking_fee_open_dispute(UUID, UUID, TEXT) TO service_role;

-- ── 4 · An admin decides a dispute under review ────────────────────────────
CREATE OR REPLACE FUNCTION public.booking_fee_decide_dispute(
  p_dispute_id UUID,
  p_admin_id   UUID,
  p_accept     BOOLEAN,
  p_note       TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_d      RECORD;
  v_waived BOOLEAN := FALSE;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.users WHERE user_id = p_admin_id AND account_type = 'admin') THEN
    RETURN jsonb_build_object('result', 'not_admin');
  END IF;

  SELECT dispute_id, charge_id, vendor_profile_id, status INTO v_d
    FROM public.booking_fee_disputes
   WHERE dispute_id = p_dispute_id
   FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('result', 'no_dispute');
  END IF;
  IF v_d.status <> 'under_review' THEN
    RETURN jsonb_build_object('result', 'already', 'status', v_d.status);
  END IF;

  IF p_accept THEN
    v_waived := public.booking_fee_waive_for_dispute(v_d.charge_id);
  END IF;

  UPDATE public.booking_fee_disputes
     SET status             = CASE WHEN p_accept THEN 'accepted' ELSE 'rejected' END,
         decided_by_user_id = p_admin_id,
         decided_at         = now(),
         decision_note      = left(NULLIF(btrim(COALESCE(p_note, '')), ''), 1000)
   WHERE dispute_id = p_dispute_id;

  RETURN jsonb_build_object(
    'result', CASE WHEN p_accept THEN 'accepted' ELSE 'rejected' END,
    'fee_waived', v_waived,
    'vendor_profile_id', v_d.vendor_profile_id,
    'charge_id', v_d.charge_id
  );
END;
$$;

COMMENT ON FUNCTION public.booking_fee_decide_dispute(UUID, UUID, BOOLEAN, TEXT) IS
  'An admin accepts (fee waived, bill voided — only if still unpaid) or rejects (the bill stands) a booking-fee '
  'dispute under review. Re-checks the caller is an admin. Service role only.';

REVOKE ALL ON FUNCTION public.booking_fee_decide_dispute(UUID, UUID, BOOLEAN, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.booking_fee_decide_dispute(UUID, UUID, BOOLEAN, TEXT) FROM anon;
REVOKE ALL ON FUNCTION public.booking_fee_decide_dispute(UUID, UUID, BOOLEAN, TEXT) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.booking_fee_decide_dispute(UUID, UUID, BOOLEAN, TEXT) TO service_role;

-- ── Post-conditions ────────────────────────────────────────────────────────
DO $$
BEGIN
  IF NOT (SELECT relrowsecurity FROM pg_class WHERE oid = 'public.booking_fee_disputes'::regclass) THEN
    RAISE EXCEPTION 'booking_fee_disputes: RLS is off';
  END IF;
  IF has_table_privilege('authenticated', 'public.booking_fee_disputes', 'INSERT')
     OR has_table_privilege('authenticated', 'public.booking_fee_disputes', 'UPDATE')
     OR has_table_privilege('anon', 'public.booking_fee_disputes', 'SELECT') THEN
    RAISE EXCEPTION 'booking_fee_disputes: a browser session can write disputes, or anon can read them';
  END IF;
  IF has_function_privilege('authenticated', 'public.booking_fee_open_dispute(uuid,uuid,text)', 'EXECUTE')
     OR has_function_privilege('authenticated', 'public.booking_fee_decide_dispute(uuid,uuid,boolean,text)', 'EXECUTE') THEN
    RAISE EXCEPTION 'booking_fee_disputes: a browser session can call the dispute functions';
  END IF;
END $$;

COMMIT;
