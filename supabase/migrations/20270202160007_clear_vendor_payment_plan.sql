-- ============================================================================
-- 20270202160007_clear_vendor_payment_plan.sql
--
-- Vendor Transaction Lifecycle · Phase 2 · PR-D (FINAL) — the vendor marks a
-- booking's PAYMENT PLAN fully CLEARED once every installment is paid +
-- confirmed.
--
-- PR-A landed the reusable schedule TEMPLATE on a vendor_services row.
-- PR-B froze that template into a per-booking PLAN
-- (event_vendor_payment_plan.instances_json — one frozen installment per seq,
-- plus the still-empty cleared_at/cleared_by columns) and registered the 4
-- payment-lifecycle notification_type values (incl. payment_cleared).
-- PR-C wired the CONFIRM half (event_vendor_payments.schedule_instance_seq /
-- vendor_confirmed_at / vendor_confirmed_by + confirm_vendor_payment(p_payment_id)).
--
-- This migration wires the CLEAR action (lifecycle stage 8):
--
--   clear_vendor_payment_plan(p_event_vendor_id) — the money DB GUARD, modeled
--   EXACTLY on PR-C's confirm_vendor_payment shape (SECURITY DEFINER +
--   SET search_path + ownership precondition + REVOKE public/anon +
--   GRANT authenticated):
--     (a) resolve the event_vendors booking by vendor_id = p_event_vendor_id →
--         its marketplace_vendor_id;
--     (b) RAISE 42501 unless the caller (auth.uid()) OWNS that marketplace
--         vendor (marketplace_vendor_id IN vendor_profiles WHERE user_id=auth.uid());
--     (c) GATE: clear only when there are NO unconfirmed installments — for
--         every installment `seq` in the booking's plan instances_json there
--         must exist a matching event_vendor_payments row with that
--         schedule_instance_seq AND vendor_confirmed_at IS NOT NULL. An empty
--         instances_json (no formal schedule) is vacuously satisfied → the
--         vendor may clear at their discretion. RAISE a friendly error if any
--         installment is still unconfirmed;
--     (d) set event_vendor_payment_plan.cleared_at = now(), cleared_by =
--         auth.uid() for that (event_id, event_vendor_id). Idempotent: a re-clear
--         is a no-op.
--   It deliberately touches ONLY the plan's cleared_at/by — never the amount,
--   the installments, or the booking.
--
-- workspace_status DECISION: event_vendors.workspace_status (the dead 7-value
-- column from 20260604130000) is intentionally LEFT IN PLACE. A repo-wide grep
-- after PR-A..C still found READS of it (the couple workspace page's SELECT list
-- + a typed field), so dropping it here would break that query. The plan
-- (cleared_at) — not workspace_status — is the source of truth for the stepper,
-- and this PR does not revive the column.
--
-- BARE migration (no BEGIN/COMMIT wrapper): the function body is self-contained
-- and CREATE OR REPLACE makes this idempotent + re-run safe.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- clear_vendor_payment_plan(p_event_vendor_id uuid) — the DB guard.
--   SECURITY DEFINER: it writes the COUPLE-owned plan row
--   (event_vendor_payment_plan, host-RLS), so it bypasses RLS but enforces the
--   vendor-ownership check in the body. The vendor must OWN the booking the plan
--   belongs to.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.clear_vendor_payment_plan(
  p_event_vendor_id UUID
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_event_id        UUID;
  v_marketplace_id  UUID;
  v_owns            BOOLEAN;
  v_already         TIMESTAMPTZ;
  v_unconfirmed     INTEGER;
BEGIN
  -- (a) Resolve the booking → its event + marketplace vendor.
  SELECT event_id, marketplace_vendor_id
    INTO v_event_id, v_marketplace_id
  FROM public.event_vendors
  WHERE vendor_id = p_event_vendor_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'booking_not_found' USING ERRCODE = 'P0002';
  END IF;
  IF v_marketplace_id IS NULL THEN
    -- No marketplace vendor on this booking (off-platform / manual vendor):
    -- there is no vendor account that could clear it.
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

  -- (a, cont.) Lock the plan row so a concurrent clear / unconfirmed check is a
  -- single-winner. The host-RLS read elsewhere is unaffected (definer write).
  SELECT cleared_at
    INTO v_already
  FROM public.event_vendor_payment_plan
  WHERE event_id = v_event_id
    AND event_vendor_id = p_event_vendor_id
  FOR UPDATE;
  IF NOT FOUND THEN
    -- No frozen plan at all (pre-PR-B booking / never locked). Nothing to clear.
    RAISE EXCEPTION 'no_payment_plan' USING ERRCODE = 'P0002';
  END IF;

  -- (d, early) Idempotent: a second clear (or a concurrent one waiting on the
  -- lock) no-ops once the first has stamped cleared_at.
  IF v_already IS NOT NULL THEN
    RETURN;
  END IF;

  -- (c) GATE: every installment seq in the plan must have a CONFIRMED payment.
  -- Count the plan installments that lack any matching event_vendor_payments row
  -- with that schedule_instance_seq AND vendor_confirmed_at set. An empty
  -- instances_json yields zero rows here → vacuously satisfied (vendor may clear
  -- a no-schedule / direct-pay booking at their discretion).
  SELECT COUNT(*)
    INTO v_unconfirmed
  FROM public.event_vendor_payment_plan p
  CROSS JOIN LATERAL jsonb_array_elements(p.instances_json) AS inst
  WHERE p.event_id = v_event_id
    AND p.event_vendor_id = p_event_vendor_id
    AND NOT EXISTS (
      SELECT 1
      FROM public.event_vendor_payments ev
      WHERE ev.vendor_id = p_event_vendor_id
        AND ev.schedule_instance_seq = (inst->>'seq')::int
        AND ev.vendor_confirmed_at IS NOT NULL
    );
  IF v_unconfirmed > 0 THEN
    RAISE EXCEPTION
      'Cannot mark cleared — % installment(s) still need a confirmed payment.',
      v_unconfirmed
      USING ERRCODE = 'P0001';
  END IF;

  -- (d) Stamp the plan cleared. Precondition (cleared_at IS NULL) keeps this a
  -- single-winner even without the lock.
  UPDATE public.event_vendor_payment_plan
  SET cleared_at = NOW(),
      cleared_by = auth.uid(),
      updated_at = NOW()
  WHERE event_id = v_event_id
    AND event_vendor_id = p_event_vendor_id
    AND cleared_at IS NULL;
END;
$$;

-- (d) Lock it down to authenticated callers only — mirrors PR-C exactly.
REVOKE ALL ON FUNCTION public.clear_vendor_payment_plan(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.clear_vendor_payment_plan(UUID) FROM anon;
GRANT EXECUTE ON FUNCTION public.clear_vendor_payment_plan(UUID) TO authenticated;

COMMENT ON FUNCTION public.clear_vendor_payment_plan(UUID) IS
  'Vendor Transaction Lifecycle Phase 2 PR-D — the owning marketplace vendor marks a booking''s payment plan fully cleared. SECURITY DEFINER DB guard: resolves event_vendor → marketplace_vendor_id, verifies auth.uid() owns that vendor_profiles row (RAISE 42501 otherwise), then GATES on every plan installment seq having a vendor_confirmed payment (empty instances_json = vacuously OK), and sets ONLY event_vendor_payment_plan.cleared_at/by. Idempotent (no-op if already cleared) + serialized via SELECT FOR UPDATE. Does NOT touch amounts/installments/the booking — that''s the rest of the lifecycle. workspace_status left untouched (the plan is the source of truth).';
