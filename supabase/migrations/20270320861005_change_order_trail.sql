-- change_order_trail
-- ============================================================================
-- CHANGE-ORDER TRAIL (Wave 3 · vendor booking-lifecycle cluster)
--
-- The missing booking-lifecycle artifact: a BOTH-ACKNOWLEDGED record of a
-- mid-plan add-on or removal. Today line items (event_vendor_line_items) are
-- UNILATERALLY couple-edited — there's no audit trail and no vendor sign-off
-- when scope/price changes after booking. A change order is a propose →
-- accept/decline/withdraw STATE MACHINE on a ROW, exactly like vendor_proposals
-- and event_schedule_suggestions — NEVER a 2-way write into the other side's
-- data.
--
-- OFF-PLATFORM MONEY / 0% COMMISSION (owner lock): Setnayan NEVER holds funds.
-- delta_amount_php is a host/vendor-entered PHP figure (signed: +add-on /
-- −removal). On ACCEPT we settle it into the existing budget ledger
-- (event_vendor_line_items) — the SINGLE source of truth for the ledger; we do
-- NOT invent a parallel money store. No gateway, no OR, no tax. Nothing here
-- makes Setnayan the payee.
--
-- LEDGER SIGN HANDLING: event_vendor_line_items.amount_php carries a
-- CHECK (amount_php >= 0), so a removal (negative delta) cannot store a negative
-- amount. We settle ABS(delta) and encode the sign in the line label
-- ("Change order: …" for an add-on, "Change order (credit): …" for a removal).
-- The signed delta_amount_php on the change-order row remains the canonical
-- audited figure for the trail. (label is CHECK length <= 64 → we truncate.)
--
-- SINGLE-WINNER SERIALIZATION: accept/decline are SECURITY DEFINER RPCs modeled
-- EXACTLY on respond_vendor_proposal() (20261209000000_concurrency_guards.sql)
-- and acknowledge_vendor_deposit() (20270320429117_deposit_lockfree.sql):
--   ownership gate (the COUNTERPARTY responds) → SELECT … FOR UPDATE →
--   status='proposed' precondition → atomic single-winner UPDATE with the same
--   precondition in the WHERE (defense in depth) → GET DIAGNOSTICS ROW_COUNT →
--   idempotent graceful re-call (a resolved order returns its state, not error).
--
-- Idempotent: CREATE TABLE IF NOT EXISTS, RLS at CREATE, CREATE OR REPLACE fns.
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- 1 · vendor_change_orders — the propose→accept/decline/withdraw state row.
--     RLS ENABLED + policies in THIS migration (RLS-at-create).
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.vendor_change_orders (
  change_order_id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- The booking this change order belongs to. event_vendors PK is vendor_id.
  event_vendor_id         UUID NOT NULL REFERENCES public.event_vendors(vendor_id) ON DELETE CASCADE,
  event_id                UUID NOT NULL REFERENCES public.events(event_id) ON DELETE CASCADE,
  -- Denormalized vendor profile for the vendor-side read RLS + queue display.
  vendor_profile_id       UUID,
  raised_by               TEXT NOT NULL CHECK (raised_by IN ('couple', 'vendor')),
  title                   TEXT CHECK (title IS NULL OR char_length(title) BETWEEN 1 AND 120),
  description             TEXT CHECK (description IS NULL OR char_length(description) <= 2000),
  -- Signed: +add-on / −removal. Host/vendor-entered PHP — never hardcoded.
  delta_amount_php        NUMERIC(12, 2) NOT NULL,
  proposed_due_date       DATE,
  status                  TEXT NOT NULL DEFAULT 'proposed'
                            CHECK (status IN ('proposed', 'accepted', 'declined', 'withdrawn')),
  proposed_by_user_id     UUID,
  acknowledged_by_user_id UUID,
  acknowledged_at         TIMESTAMPTZ,
  decline_reason          TEXT CHECK (decline_reason IS NULL OR char_length(decline_reason) <= 500),
  -- Set on accept: links the settled budget ledger line (audit trail).
  settled_line_item_id    UUID REFERENCES public.event_vendor_line_items(line_item_id) ON DELETE SET NULL,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS vendor_change_orders_event_status_idx
  ON public.vendor_change_orders (event_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS vendor_change_orders_event_vendor_idx
  ON public.vendor_change_orders (event_vendor_id, created_at DESC);
CREATE INDEX IF NOT EXISTS vendor_change_orders_vendor_profile_idx
  ON public.vendor_change_orders (vendor_profile_id, created_at DESC);

ALTER TABLE public.vendor_change_orders ENABLE ROW LEVEL SECURITY;

-- COUPLE + delegates: read every change order on their events.
DROP POLICY IF EXISTS vendor_change_orders_couple_read ON public.vendor_change_orders;
CREATE POLICY vendor_change_orders_couple_read
  ON public.vendor_change_orders FOR SELECT TO authenticated
  USING (
    event_id IN (SELECT public.current_couple_event_ids())
    OR event_id IN (SELECT public.current_moderator_event_ids())
  );

-- COUPLE: raise (insert) a couple-side change order on their own event. The
-- state transitions (accept/decline/withdraw) all flow through the SECURITY
-- DEFINER RPCs below — there is NO couple UPDATE policy, so a couple can never
-- direct-edit a row's status (the RPC is the only writer of resolved states).
DROP POLICY IF EXISTS vendor_change_orders_couple_insert ON public.vendor_change_orders;
CREATE POLICY vendor_change_orders_couple_insert
  ON public.vendor_change_orders FOR INSERT TO authenticated
  WITH CHECK (
    event_id IN (SELECT public.current_couple_event_ids())
    AND raised_by = 'couple'
    AND status = 'proposed'
    AND proposed_by_user_id = auth.uid()
  );

-- VENDOR: read change orders on bookings their org owns (booked event + own
-- vendor profile), mirroring the schedule-suggestion + payment-ledger read RLS.
DROP POLICY IF EXISTS vendor_change_orders_vendor_read ON public.vendor_change_orders;
CREATE POLICY vendor_change_orders_vendor_read
  ON public.vendor_change_orders FOR SELECT TO authenticated
  USING (
    event_id IN (SELECT public.current_vendor_booked_event_ids())
    AND vendor_profile_id IN (SELECT public.current_vendor_profile_ids())
  );

-- VENDOR: raise (insert) a vendor-side change order on a booking they own.
-- No vendor UPDATE policy either — resolution is RPC-only.
DROP POLICY IF EXISTS vendor_change_orders_vendor_insert ON public.vendor_change_orders;
CREATE POLICY vendor_change_orders_vendor_insert
  ON public.vendor_change_orders FOR INSERT TO authenticated
  WITH CHECK (
    event_id IN (SELECT public.current_vendor_booked_event_ids())
    AND vendor_profile_id IN (SELECT public.current_vendor_profile_ids())
    AND raised_by = 'vendor'
    AND status = 'proposed'
    AND proposed_by_user_id = auth.uid()
  );

-- ADMIN: full read (immutable trail in the dispute/booking console).
DROP POLICY IF EXISTS vendor_change_orders_admin_read ON public.vendor_change_orders;
CREATE POLICY vendor_change_orders_admin_read
  ON public.vendor_change_orders FOR SELECT TO authenticated
  USING (public.is_admin());

COMMENT ON TABLE public.vendor_change_orders IS
  'Both-acknowledged change-order trail for mid-plan add-ons/removals (Wave 3 vendor benefits). Propose->accept/decline/withdraw STATE MACHINE on a row — never a 2-way write into the other side''s data. On accept the signed delta_amount_php settles into event_vendor_line_items (the single budget-ledger source of truth). Resolution flows only through the SECURITY DEFINER RPCs (single-winner + idempotent); there is no couple/vendor UPDATE policy. Off-platform money, 0% commission — Setnayan never holds funds.';

-- ----------------------------------------------------------------------------
-- 2 · accept_change_order — single-winner ACCEPT by the COUNTERPARTY.
--
-- A couple-raised order is accepted by the VENDOR; a vendor-raised order is
-- accepted by the COUPLE (the proposer can't accept their own). On accept we
-- atomically: flip status='accepted' (single-winner), INSERT the settled
-- event_vendor_line_items row for ABS(delta) with a sign-encoding label, link
-- it back via settled_line_item_id, and bump event_vendors.updated_at.
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.accept_change_order(
  p_change_order_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_event_id          UUID;
  v_event_vendor_id   UUID;
  v_raised_by         TEXT;
  v_status            TEXT;
  v_title             TEXT;
  v_delta             NUMERIC(12, 2);
  v_due_date          DATE;
  v_is_couple         BOOLEAN;
  v_is_vendor         BOOLEAN;
  v_line_item_id      UUID;
  v_label             TEXT;
  v_rows              INTEGER;
BEGIN
  -- FOR UPDATE serializes concurrent responders (two accepts, or
  -- accept-vs-decline): the second waits, then re-reads the now-resolved status
  -- and is caught by the idempotent branch / precondition below.
  SELECT event_id, event_vendor_id, raised_by, status, title, delta_amount_php,
         proposed_due_date
    INTO v_event_id, v_event_vendor_id, v_raised_by, v_status, v_title, v_delta,
         v_due_date
    FROM public.vendor_change_orders
   WHERE change_order_id = p_change_order_id
   FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'change_order_not_found' USING ERRCODE = 'P0002';
  END IF;

  -- Ownership: the ACCEPTING party must be the COUNTERPARTY to raised_by.
  --   couple-raised -> vendor accepts;  vendor-raised -> couple accepts.
  v_is_couple := v_event_id IN (SELECT public.current_couple_event_ids());
  v_is_vendor := v_event_vendor_id IN (SELECT public.current_vendor_event_vendor_ids());

  IF v_raised_by = 'couple' THEN
    IF NOT (v_is_vendor OR public.is_admin()) THEN
      RAISE EXCEPTION 'not_counterparty' USING ERRCODE = '42501';
    END IF;
  ELSE -- raised_by = 'vendor'
    IF NOT (v_is_couple OR public.is_admin()) THEN
      RAISE EXCEPTION 'not_counterparty' USING ERRCODE = '42501';
    END IF;
  END IF;

  -- IDEMPOTENCY: a re-call on an already-resolved order returns its state
  -- gracefully (the single-winner already won) — not an error.
  IF v_status <> 'proposed' THEN
    RETURN jsonb_build_object('status', 'already', 'resolved_status', v_status);
  END IF;

  -- Settle the signed delta into the budget ledger (single source of truth).
  -- amount_php >= 0 CHECK -> store ABS(delta); the sign lives in the label and
  -- in the audited delta_amount_php on the change-order row.
  v_label := CASE
    WHEN v_delta < 0 THEN 'Change order (credit): ' || COALESCE(v_title, 'scope reduction')
    ELSE 'Change order: ' || COALESCE(v_title, 'add-on')
  END;
  v_label := left(v_label, 64);  -- event_vendor_line_items.label CHECK <= 64

  INSERT INTO public.event_vendor_line_items
    (event_id, vendor_id, label, amount_php, due_date)
  VALUES
    (v_event_id, v_event_vendor_id, v_label, ABS(v_delta), v_due_date)
  RETURNING line_item_id INTO v_line_item_id;

  -- Status precondition in the WHERE (defense in depth alongside FOR UPDATE):
  -- the transition is atomically single-winner even if the lock is ever
  -- removed. status='proposed' is the single-winner gate.
  UPDATE public.vendor_change_orders
     SET status = 'accepted',
         acknowledged_by_user_id = auth.uid(),
         acknowledged_at = NOW(),
         settled_line_item_id = v_line_item_id,
         updated_at = NOW()
   WHERE change_order_id = p_change_order_id
     AND status = 'proposed';
  GET DIAGNOSTICS v_rows = ROW_COUNT;
  IF v_rows = 0 THEN
    -- Lost the race to a concurrent winner between the FOR UPDATE read and the
    -- UPDATE (only possible if the lock is removed). Raising rolls back our
    -- ledger insert above — the whole RPC is one transaction, so the orphan
    -- line item never lands.
    RAISE EXCEPTION 'already_resolved' USING ERRCODE = '22023';
  END IF;

  -- Bump the booking row so layout-cached vendor fields refresh.
  UPDATE public.event_vendors
     SET updated_at = NOW()
   WHERE vendor_id = v_event_vendor_id;

  RETURN jsonb_build_object(
    'status', 'ok',
    'line_item_id', v_line_item_id,
    'delta_amount_php', v_delta
  );
END;
$$;

REVOKE ALL ON FUNCTION public.accept_change_order(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.accept_change_order(UUID) FROM anon;
GRANT EXECUTE ON FUNCTION public.accept_change_order(UUID) TO authenticated;

COMMENT ON FUNCTION public.accept_change_order(UUID) IS
  'Counterparty accepts a proposed change order (couple-raised -> vendor accepts; vendor-raised -> couple accepts; or admin). Serialized via SELECT FOR UPDATE + status=proposed precondition UPDATE -> single-winner; idempotent re-call returns status=already. On accept settles ABS(delta_amount_php) into event_vendor_line_items (sign encoded in the label; signed delta stays canonical on the change-order row) and links it via settled_line_item_id — all in one transaction. No money moves; 0% commission, off-platform pay.';

-- ----------------------------------------------------------------------------
-- 3 · decline_change_order — single-winner DECLINE by the COUNTERPARTY.
--     Same ownership gate + FOR UPDATE + precondition + idempotent re-call.
--     No ledger write (a declined change order changes nothing).
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.decline_change_order(
  p_change_order_id UUID,
  p_reason          TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_event_id        UUID;
  v_event_vendor_id UUID;
  v_raised_by       TEXT;
  v_status          TEXT;
  v_is_couple       BOOLEAN;
  v_is_vendor       BOOLEAN;
  v_rows            INTEGER;
BEGIN
  SELECT event_id, event_vendor_id, raised_by, status
    INTO v_event_id, v_event_vendor_id, v_raised_by, v_status
    FROM public.vendor_change_orders
   WHERE change_order_id = p_change_order_id
   FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'change_order_not_found' USING ERRCODE = 'P0002';
  END IF;

  v_is_couple := v_event_id IN (SELECT public.current_couple_event_ids());
  v_is_vendor := v_event_vendor_id IN (SELECT public.current_vendor_event_vendor_ids());

  IF v_raised_by = 'couple' THEN
    IF NOT (v_is_vendor OR public.is_admin()) THEN
      RAISE EXCEPTION 'not_counterparty' USING ERRCODE = '42501';
    END IF;
  ELSE
    IF NOT (v_is_couple OR public.is_admin()) THEN
      RAISE EXCEPTION 'not_counterparty' USING ERRCODE = '42501';
    END IF;
  END IF;

  IF v_status <> 'proposed' THEN
    RETURN jsonb_build_object('status', 'already', 'resolved_status', v_status);
  END IF;

  UPDATE public.vendor_change_orders
     SET status = 'declined',
         acknowledged_by_user_id = auth.uid(),
         acknowledged_at = NOW(),
         decline_reason = NULLIF(left(COALESCE(p_reason, ''), 500), ''),
         updated_at = NOW()
   WHERE change_order_id = p_change_order_id
     AND status = 'proposed';
  GET DIAGNOSTICS v_rows = ROW_COUNT;
  IF v_rows = 0 THEN
    RETURN jsonb_build_object('status', 'already', 'resolved_status', 'declined');
  END IF;

  RETURN jsonb_build_object('status', 'ok');
END;
$$;

REVOKE ALL ON FUNCTION public.decline_change_order(UUID, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.decline_change_order(UUID, TEXT) FROM anon;
GRANT EXECUTE ON FUNCTION public.decline_change_order(UUID, TEXT) TO authenticated;

COMMENT ON FUNCTION public.decline_change_order(UUID, TEXT) IS
  'Counterparty declines a proposed change order (couple-raised -> vendor declines; vendor-raised -> couple declines; or admin). Serialized via SELECT FOR UPDATE + status=proposed precondition UPDATE -> single-winner; idempotent re-call returns status=already. No ledger write — a declined change order changes nothing.';

-- ----------------------------------------------------------------------------
-- 4 · withdraw_change_order — the PROPOSER retracts their own proposed order.
--     This is the one transition the originator drives (not the counterparty):
--     a couple withdraws a couple-raised order; a vendor withdraws a
--     vendor-raised order. Same single-winner + idempotent contract.
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.withdraw_change_order(
  p_change_order_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_event_id        UUID;
  v_event_vendor_id UUID;
  v_raised_by       TEXT;
  v_status          TEXT;
  v_is_couple       BOOLEAN;
  v_is_vendor       BOOLEAN;
  v_rows            INTEGER;
BEGIN
  SELECT event_id, event_vendor_id, raised_by, status
    INTO v_event_id, v_event_vendor_id, v_raised_by, v_status
    FROM public.vendor_change_orders
   WHERE change_order_id = p_change_order_id
   FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'change_order_not_found' USING ERRCODE = 'P0002';
  END IF;

  -- The PROPOSER withdraws their own side.
  v_is_couple := v_event_id IN (SELECT public.current_couple_event_ids());
  v_is_vendor := v_event_vendor_id IN (SELECT public.current_vendor_event_vendor_ids());

  IF v_raised_by = 'couple' THEN
    IF NOT (v_is_couple OR public.is_admin()) THEN
      RAISE EXCEPTION 'not_proposer' USING ERRCODE = '42501';
    END IF;
  ELSE
    IF NOT (v_is_vendor OR public.is_admin()) THEN
      RAISE EXCEPTION 'not_proposer' USING ERRCODE = '42501';
    END IF;
  END IF;

  IF v_status <> 'proposed' THEN
    RETURN jsonb_build_object('status', 'already', 'resolved_status', v_status);
  END IF;

  UPDATE public.vendor_change_orders
     SET status = 'withdrawn',
         updated_at = NOW()
   WHERE change_order_id = p_change_order_id
     AND status = 'proposed';
  GET DIAGNOSTICS v_rows = ROW_COUNT;
  IF v_rows = 0 THEN
    RETURN jsonb_build_object('status', 'already', 'resolved_status', 'withdrawn');
  END IF;

  RETURN jsonb_build_object('status', 'ok');
END;
$$;

REVOKE ALL ON FUNCTION public.withdraw_change_order(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.withdraw_change_order(UUID) FROM anon;
GRANT EXECUTE ON FUNCTION public.withdraw_change_order(UUID) TO authenticated;

COMMENT ON FUNCTION public.withdraw_change_order(UUID) IS
  'Proposer retracts their own proposed change order (couple withdraws couple-raised; vendor withdraws vendor-raised; or admin). Serialized via SELECT FOR UPDATE + status=proposed precondition UPDATE -> single-winner; idempotent re-call returns status=already. No ledger write.';

COMMIT;
