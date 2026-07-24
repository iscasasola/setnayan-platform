-- Booking Fee · re-derive on a POST-LOCK price change (amendments / change-orders).
--
-- The 5% Booking Fee is computed ONCE at LOCK, off the couple-confirmed
-- event_vendors.total_cost_php (migration 20270927120000). But an accepted
-- change-order / proposal amendment can RAISE or LOWER that agreed total AFTER the
-- lock — and until now the frozen fee kept charging the stale number. This closes
-- that gap ENTIRELY IN THE FEE LANE: an AFTER-UPDATE trigger on event_vendors
-- watches total_cost_php and re-derives the fee, so it fires no matter WHO moved
-- the price (the amendment-accept RPC, respond_vendor_proposal, a change-order
-- settle, or a manual admin edit) WITHOUT this migration touching any amendment /
-- change-order app code (that flow is owned by a parallel session).
--
-- SHIP-DARK / FLAG CONTRACT (mirrors the rest of the fee system's "ships INERT"):
--   The re-derive only ever acts on an EXISTING primary charge for the booking.
--   Charges are minted only by the LOCK path, which is gated by
--   NEXT_PUBLIC_BOOKING_FEE_ENABLED in TS (collectBookingFeeAtLock returns
--   {disabled} before ever calling the RPC). So while the flag is off — the
--   current prod state — NO booking has a charge, the trigger universally no-ops,
--   and event_vendors UPDATEs are byte-behaviour-identical to today. "Charge
--   exists" IS the DB-native proxy for "the fee was on when this booking locked":
--   the first fee for a booking is only ever minted at lock, never by an amendment.
--
-- HONEST ADJUSTMENT by the charge's settlement state (LIVE money code):
--   • primary charge still PENDING (unpaid) → update its amount to the new fee in
--     place (+ its QR order/payment). The simplest correct case. Amended to
--     ₱0/barter → clear it (paid at 0) and cancel the QR order.
--   • primary charge already PAID (settled) → NEVER rewrite a settled charge.
--     - new fee > already-paid → open ONE supplementary 'amendment_delta' charge
--       for the difference + its own QR order (settled by the same
--       sku-activation 'vendor_booking_fee__{id}' bridge, unchanged).
--     - new fee < already-paid → record an 'amendment_credit' audit row for the
--       overpayment. NO auto-refund (positioning doc 2026-07-22: money is settled
--       off-platform; a refund is a manual ops decision, never a silent money move).
--   • free-5 booking → stays FREE at ANY amended total (the frozen courtesy wins).
--
-- IDEMPOTENT by construction: re-running on the same total is a no-op (amounts
-- compared before every write; one live primary / one pending delta / one credit
-- per event_vendor enforced by partial unique indexes). FAIL-SOFT: the trigger
-- swallows any error into a WARNING so a fee hiccup can never roll back the
-- couple's amendment.
--
-- RLS-safe: all writes go through SECURITY DEFINER functions (the vendor-payer
-- order is written under the couple's session — the same bypass collectBookingFeeAtLock
-- relies on). No new client-callable surface; reads stay on the existing SELECT RLS.

BEGIN;

-- ── 1) Charge shape — supplementary (delta) + credit children of a paid charge ─
-- A LOCK booking now has ONE 'primary' charge plus, after a post-paid amendment,
-- at most one pending 'amendment_delta' (money owed on the increase) and at most
-- one 'amendment_credit' (audit-only record of an overpayment). Additive columns.
ALTER TABLE public.booking_fee_charges
  ADD COLUMN IF NOT EXISTS kind TEXT NOT NULL DEFAULT 'primary'
    CHECK (kind IN ('primary', 'amendment_delta', 'amendment_credit')),
  -- The primary charge this supplement/credit reconciles against (audit lineage).
  ADD COLUMN IF NOT EXISTS parent_charge_id UUID
    REFERENCES public.booking_fee_charges(charge_id) ON DELETE SET NULL,
  -- For an amendment_credit: the overpaid amount (centavos). Informational — NO
  -- money moves, NO refund is issued; ops decides any goodwill off-platform.
  ADD COLUMN IF NOT EXISTS credit_centavos BIGINT
    CHECK (credit_centavos IS NULL OR credit_centavos >= 0);

COMMENT ON COLUMN public.booking_fee_charges.kind IS
  'primary = the charge opened at lock; amendment_delta = a supplementary charge '
  'for a post-PAID price increase; amendment_credit = an audit-only record of a '
  'post-PAID price decrease (no refund). Only ''primary'' takes the one-live guard.';
COMMENT ON COLUMN public.booking_fee_charges.credit_centavos IS
  'amendment_credit only: overpaid centavos after a post-lock price DECREASE. '
  'Audit trail — Setnayan issues no automatic refund (settled off-platform).';

-- The one-live guard now applies to the PRIMARY charge only, so a paid primary and
-- a pending delta can coexist for the same event_vendor.
DROP INDEX IF EXISTS public.booking_fee_charges_one_live_per_event_vendor;
CREATE UNIQUE INDEX IF NOT EXISTS booking_fee_charges_one_live_primary_per_event_vendor
  ON public.booking_fee_charges(event_vendor_id)
  WHERE event_vendor_id IS NOT NULL
    AND kind = 'primary'
    AND status IN ('pending', 'paid', 'waived_import', 'waived_free5');

-- At most ONE pending supplementary delta per booking (the re-derive updates it in
-- place rather than stacking deltas), and at most one credit record per booking.
CREATE UNIQUE INDEX IF NOT EXISTS booking_fee_charges_one_pending_delta_per_event_vendor
  ON public.booking_fee_charges(event_vendor_id)
  WHERE event_vendor_id IS NOT NULL AND kind = 'amendment_delta' AND status = 'pending';
CREATE UNIQUE INDEX IF NOT EXISTS booking_fee_charges_one_credit_per_event_vendor
  ON public.booking_fee_charges(event_vendor_id)
  WHERE event_vendor_id IS NOT NULL AND kind = 'amendment_credit';

-- ── 2) Vendor-payer QR order upsert for a charge (SQL twin of the TS minter) ──
-- collectBookingFeeAtLock mints the vendor's manual GCash/BDO `orders` row in TS.
-- An amendment moves the price with NO TS in the loop (a DB trigger fires), so the
-- order side must also live in SQL. This helper makes the charge's order MATCH the
-- charge's current collectible amount, idempotently:
--   • charge pending & amount > 0 → mint the order+payment if missing, else sync
--     the amount; a no-op when already equal.
--   • charge not collectible (non-pending, or amount 0) → cancel the open order +
--     reject its placeholder payment. Never rewrites a paid/fulfilled order.
--   • no claimable vendor (unclaimed profile → no payer) → leave the charge with
--     no order for ops to resolve, exactly like collectBookingFeeAtLock's no_payer.
CREATE OR REPLACE FUNCTION public.booking_fee_upsert_vendor_order(p_charge_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_charge     RECORD;
  v_order      RECORD;
  v_svc        TEXT;
  v_amount_php NUMERIC(12, 2);
  v_payer      UUID;
  v_ref        TEXT;
  v_order_id   UUID;
BEGIN
  SELECT charge_id, event_id, vendor_profile_id, amount_charged_centavos, status, kind
    INTO v_charge
    FROM public.booking_fee_charges
    WHERE charge_id = p_charge_id;
  IF NOT FOUND THEN RETURN; END IF;

  -- Mirrors bookingFeeLockServiceKey() in apps/web/lib/booking-fee-lock.ts.
  v_svc := 'vendor_booking_fee__' || p_charge_id::text;

  SELECT order_id, status, requested_total_php
    INTO v_order
    FROM public.orders
    WHERE service_key = v_svc
    LIMIT 1;

  -- Not collectible → make sure no OPEN order lingers.
  IF v_charge.status <> 'pending' OR COALESCE(v_charge.amount_charged_centavos, 0) <= 0 THEN
    IF v_order.order_id IS NOT NULL
       AND v_order.status NOT IN ('paid', 'fulfilled', 'refunded', 'cancelled') THEN
      UPDATE public.orders
        SET status = 'cancelled', updated_at = NOW()
        WHERE order_id = v_order.order_id;
      UPDATE public.payments
        SET status = 'rejected',
            admin_notes = COALESCE(admin_notes || ' ', '') || '[auto-void: booking amended]'
        WHERE order_id = v_order.order_id AND status = 'pending';
    END IF;
    RETURN;
  END IF;

  v_amount_php := round(v_charge.amount_charged_centavos)::numeric / 100.0;

  IF v_order.order_id IS NOT NULL THEN
    -- Never touch a settled/cancelled order — reconciliation there is the paid
    -- branch's supplementary-charge job, not an in-place rewrite.
    IF v_order.status IN ('paid', 'fulfilled', 'refunded', 'cancelled') THEN RETURN; END IF;
    IF v_order.requested_total_php IS DISTINCT FROM v_amount_php THEN
      UPDATE public.orders
        SET requested_total_php = v_amount_php, updated_at = NOW()
        WHERE order_id = v_order.order_id;
      UPDATE public.payments
        SET amount_php = v_amount_php
        WHERE order_id = v_order.order_id AND status = 'pending';
    END IF;
    RETURN;
  END IF;

  -- No order yet → mint one (needs a claimable vendor user as payer).
  SELECT user_id INTO v_payer
    FROM public.vendor_profiles
    WHERE vendor_profile_id = v_charge.vendor_profile_id;
  IF v_payer IS NULL THEN RETURN; END IF;

  v_ref := 'SN' || upper(substr(md5(gen_random_uuid()::text), 1, 8));
  INSERT INTO public.orders
    (event_id, user_id, vendor_profile_id, service_key, description,
     requested_total_php, status, reference_code)
  VALUES
    (v_charge.event_id, v_payer, v_charge.vendor_profile_id, v_svc,
     'Setnayan booking fee (5%) — amended booking, up for verification within 24 hrs',
     v_amount_php, 'submitted', v_ref)
  RETURNING order_id INTO v_order_id;

  INSERT INTO public.payments
    (order_id, user_id, amount_php, channel, paid_at)
  VALUES
    (v_order_id, v_payer, v_amount_php, 'manual', CURRENT_DATE);
END;
$$;
COMMENT ON FUNCTION public.booking_fee_upsert_vendor_order(UUID) IS
  'Make a booking-fee charge''s vendor-payer QR order match its collectible amount '
  '(mint / sync / cancel), idempotently. SQL twin of collectBookingFeeAtLock''s '
  'order minter, for the amendment path where no TS is in the loop. service_role-only.';

-- ── 3) The re-derivation core ────────────────────────────────────────────────
-- Bring a locked booking's fee into line with its CURRENT event_vendors.total_cost_php.
-- No-ops unless a primary charge exists (the flag/dark gate). Returns a JSONB
-- action tag for observability + tests.
CREATE OR REPLACE FUNCTION public.booking_fee_rederive_lock_fee(
  p_event_vendor_id  UUID,
  p_schedule_version TEXT DEFAULT '2026-07-24-flat5-nocap'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ev             RECORD;
  v_primary        RECORD;
  v_ledger         RECORD;
  v_new_total      BIGINT;
  v_new_fee        BIGINT;
  v_paid_total     BIGINT;
  v_delta          BIGINT;
  v_overpaid       BIGINT;
  v_existing_delta RECORD;
  v_delta_id       UUID;
  v_stale          RECORD;
BEGIN
  SELECT vendor_id, event_id, marketplace_vendor_id AS vpid, status,
         COALESCE(round(total_cost_php * 100)::BIGINT, 0) AS amount_centavos
    INTO v_ev
    FROM public.event_vendors
    WHERE vendor_id = p_event_vendor_id;
  IF NOT FOUND THEN RETURN jsonb_build_object('action', 'no_booking'); END IF;

  -- The FLAG/DARK gate: only a booking that already carries a primary charge (i.e.
  -- one locked while the fee was on) is ever re-derived. No charge → nothing to do.
  SELECT charge_id, ledger_id, status, amount_charged_centavos, proposal_amount_centavos
    INTO v_primary
    FROM public.booking_fee_charges
    WHERE event_vendor_id = p_event_vendor_id AND kind = 'primary'
      AND status IN ('pending', 'paid', 'waived_import', 'waived_free5')
    ORDER BY created_at
    LIMIT 1;
  IF NOT FOUND THEN RETURN jsonb_build_object('action', 'no_charge'); END IF;

  SELECT is_free_booking INTO v_ledger
    FROM public.booking_fee_ledger WHERE ledger_id = v_primary.ledger_id;

  -- Free-5 bookings never accrue a fee — the frozen courtesy wins at any total.
  IF COALESCE(v_ledger.is_free_booking, false) OR v_primary.status = 'waived_free5' THEN
    RETURN jsonb_build_object('action', 'free_noop');
  END IF;
  -- Import-attributed (free-forever) bookings likewise never bill.
  IF v_primary.status = 'waived_import' THEN
    RETURN jsonb_build_object('action', 'import_noop');
  END IF;

  v_new_total := v_ev.amount_centavos;
  v_new_fee   := public.booking_fee_centavos(v_new_total);

  -- Keep the ledger high-water mark honest (harmless audit field).
  UPDATE public.booking_fee_ledger
    SET highest_declared_centavos =
          GREATEST(COALESCE(highest_declared_centavos, 0), v_new_total),
        updated_at = NOW()
    WHERE ledger_id = v_primary.ledger_id;

  -- ── PENDING primary (unpaid) → update in place ──────────────────────────────
  IF v_primary.status = 'pending' THEN
    IF v_primary.amount_charged_centavos = v_new_fee
       AND v_primary.proposal_amount_centavos = v_new_total THEN
      RETURN jsonb_build_object('action', 'pending_noop');
    END IF;

    IF v_new_fee <= 0 THEN
      -- Amended down to ₱0 / barter → nothing to collect. Clear + cancel the order.
      UPDATE public.booking_fee_charges
        SET amount_charged_centavos = 0, computed_fee_centavos = 0,
            proposal_amount_centavos = v_new_total,
            status = 'paid', paid_at = NOW(), expires_at = NULL, updated_at = NOW()
        WHERE charge_id = v_primary.charge_id;
      PERFORM public.booking_fee_upsert_vendor_order(v_primary.charge_id);
      RETURN jsonb_build_object('action', 'pending_cleared_zero',
        'charge_id', v_primary.charge_id);
    END IF;

    UPDATE public.booking_fee_charges
      SET amount_charged_centavos = v_new_fee, computed_fee_centavos = v_new_fee,
          proposal_amount_centavos = v_new_total, updated_at = NOW()
      WHERE charge_id = v_primary.charge_id;
    PERFORM public.booking_fee_upsert_vendor_order(v_primary.charge_id);
    RETURN jsonb_build_object('action', 'pending_updated',
      'charge_id', v_primary.charge_id, 'amount_charged_centavos', v_new_fee);
  END IF;

  -- ── PAID primary (settled) → reconcile with a delta or a credit, never rewrite ─
  -- Everything already PAID for this booking (primary + any settled deltas).
  SELECT COALESCE(SUM(amount_charged_centavos), 0) INTO v_paid_total
    FROM public.booking_fee_charges
    WHERE event_vendor_id = p_event_vendor_id AND status = 'paid'
      AND kind IN ('primary', 'amendment_delta');

  v_delta := v_new_fee - v_paid_total;

  IF v_delta > 0 THEN
    -- Underpaid → open / adjust the single pending supplementary delta.
    SELECT charge_id, amount_charged_centavos INTO v_existing_delta
      FROM public.booking_fee_charges
      WHERE event_vendor_id = p_event_vendor_id AND kind = 'amendment_delta'
        AND status = 'pending'
      LIMIT 1;

    -- A prior overpayment credit is now stale (we owe more) → zero it.
    UPDATE public.booking_fee_charges
      SET credit_centavos = 0, updated_at = NOW()
      WHERE event_vendor_id = p_event_vendor_id AND kind = 'amendment_credit'
        AND COALESCE(credit_centavos, 0) <> 0;

    IF FOUND AND v_existing_delta.charge_id IS NOT NULL THEN
      IF v_existing_delta.amount_charged_centavos = v_delta THEN
        RETURN jsonb_build_object('action', 'delta_noop', 'delta_centavos', v_delta);
      END IF;
      UPDATE public.booking_fee_charges
        SET amount_charged_centavos = v_delta, computed_fee_centavos = v_new_fee,
            proposal_amount_centavos = v_new_total, updated_at = NOW()
        WHERE charge_id = v_existing_delta.charge_id;
      PERFORM public.booking_fee_upsert_vendor_order(v_existing_delta.charge_id);
      RETURN jsonb_build_object('action', 'delta_updated',
        'delta_centavos', v_delta, 'charge_id', v_existing_delta.charge_id);
    END IF;

    INSERT INTO public.booking_fee_charges
      (ledger_id, proposal_id, event_vendor_id, source, kind, parent_charge_id,
       vendor_profile_id, event_id, proposal_amount_centavos, computed_fee_centavos,
       amount_charged_centavos, schedule_version, status, expires_at)
    VALUES
      (v_primary.ledger_id, NULL, p_event_vendor_id, 'lock', 'amendment_delta',
       v_primary.charge_id, v_ev.vpid, v_ev.event_id, v_new_total, v_new_fee,
       v_delta, p_schedule_version, 'pending', NOW() + INTERVAL '7 days')
    RETURNING charge_id INTO v_delta_id;
    PERFORM public.booking_fee_upsert_vendor_order(v_delta_id);
    RETURN jsonb_build_object('action', 'delta_opened',
      'delta_centavos', v_delta, 'charge_id', v_delta_id);

  ELSIF v_delta < 0 THEN
    -- Overpaid → cancel any outstanding delta, record a credit note (NO refund).
    v_overpaid := -v_delta;
    FOR v_stale IN
      SELECT charge_id FROM public.booking_fee_charges
        WHERE event_vendor_id = p_event_vendor_id AND kind = 'amendment_delta'
          AND status = 'pending'
    LOOP
      UPDATE public.booking_fee_charges
        SET status = 'expired', expires_at = NOW(), updated_at = NOW()
        WHERE charge_id = v_stale.charge_id;
      PERFORM public.booking_fee_upsert_vendor_order(v_stale.charge_id);
    END LOOP;

    UPDATE public.booking_fee_charges
      SET credit_centavos = v_overpaid, computed_fee_centavos = v_new_fee,
          proposal_amount_centavos = v_new_total, updated_at = NOW()
      WHERE event_vendor_id = p_event_vendor_id AND kind = 'amendment_credit';
    IF NOT FOUND THEN
      INSERT INTO public.booking_fee_charges
        (ledger_id, proposal_id, event_vendor_id, source, kind, parent_charge_id,
         vendor_profile_id, event_id, proposal_amount_centavos, computed_fee_centavos,
         amount_charged_centavos, credit_centavos, schedule_version, status, paid_at)
      VALUES
        (v_primary.ledger_id, NULL, p_event_vendor_id, 'lock', 'amendment_credit',
         v_primary.charge_id, v_ev.vpid, v_ev.event_id, v_new_total, v_new_fee,
         0, v_overpaid, p_schedule_version, 'paid', NOW());
    END IF;
    RETURN jsonb_build_object('action', 'credit_recorded', 'credit_centavos', v_overpaid);

  ELSE
    -- Exactly reconciled → cancel any dangling delta, zero any stale credit.
    FOR v_stale IN
      SELECT charge_id FROM public.booking_fee_charges
        WHERE event_vendor_id = p_event_vendor_id AND kind = 'amendment_delta'
          AND status = 'pending'
    LOOP
      UPDATE public.booking_fee_charges
        SET status = 'expired', expires_at = NOW(), updated_at = NOW()
        WHERE charge_id = v_stale.charge_id;
      PERFORM public.booking_fee_upsert_vendor_order(v_stale.charge_id);
    END LOOP;
    UPDATE public.booking_fee_charges
      SET credit_centavos = 0, updated_at = NOW()
      WHERE event_vendor_id = p_event_vendor_id AND kind = 'amendment_credit'
        AND COALESCE(credit_centavos, 0) <> 0;
    RETURN jsonb_build_object('action', 'reconciled_exact');
  END IF;
END;
$$;
COMMENT ON FUNCTION public.booking_fee_rederive_lock_fee(UUID, TEXT) IS
  'Re-derive a locked booking''s 5% fee to its current event_vendors.total_cost_php. '
  'No-op unless a primary charge exists (the dark/flag gate). Pending → update in '
  'place; paid → supplementary delta (increase) or audit credit (decrease, no '
  'refund); free-5 stays free. Idempotent. service_role-only.';

-- ── 4) The fee-lane trigger — fires however the price moved ───────────────────
-- AFTER UPDATE OF total_cost_php so it stays off the hot path for other column
-- writes. Fail-soft: any error becomes a WARNING and never rolls back the caller's
-- amendment (the price change already committed; a fee hiccup must not undo it).
CREATE OR REPLACE FUNCTION public.booking_fee_on_event_vendor_price_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  BEGIN
    PERFORM public.booking_fee_rederive_lock_fee(NEW.vendor_id);
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'booking_fee_rederive_lock_fee failed for event_vendor %: %',
      NEW.vendor_id, SQLERRM;
  END;
  RETURN NULL; -- AFTER trigger — return value ignored.
END;
$$;
COMMENT ON FUNCTION public.booking_fee_on_event_vendor_price_change() IS
  'AFTER-UPDATE trigger fn: re-derive the booking fee when a locked booking''s '
  'total_cost_php changes. Fail-soft (WARNING, never rolls back the amendment).';

DROP TRIGGER IF EXISTS event_vendors_booking_fee_rederive ON public.event_vendors;
CREATE TRIGGER event_vendors_booking_fee_rederive
  AFTER UPDATE OF total_cost_php ON public.event_vendors
  FOR EACH ROW
  WHEN (OLD.total_cost_php IS DISTINCT FROM NEW.total_cost_php
        AND NEW.status IN ('contracted', 'deposit_paid', 'delivered', 'complete'))
  EXECUTE FUNCTION public.booking_fee_on_event_vendor_price_change();

-- ── Grants — money writes are service_role-only; no new client surface ────────
REVOKE ALL ON FUNCTION public.booking_fee_upsert_vendor_order(UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.booking_fee_upsert_vendor_order(UUID) TO service_role;
REVOKE ALL ON FUNCTION public.booking_fee_rederive_lock_fee(UUID, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.booking_fee_rederive_lock_fee(UUID, TEXT) TO service_role;

COMMIT;
