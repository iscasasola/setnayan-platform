-- one_booking_fee_bill_per_charge — THE DATABASE ITSELF REFUSES A SECOND BILL
-- FOR ONE BOOKING-FEE CHARGE (owner, verbatim "yes", 2026-09-20: "add a UNIQUE
-- index on orders.service_key so the database itself prevents a double bill").
--
-- ── WHY PARTIAL, NOT THE WHOLE COLUMN ────────────────────────────────────────
-- `orders.service_key` is a CHARGE identity only for keys that embed an id.
-- For most orders it is a SKU CODE shared by every buyer: measured on prod
-- 2026-09-20 (read-only), `ONBOARDING_SERVICES` already has 5 legitimate orders
-- from one user (3 paid, 2 cancelled). And `vendor_additional_branch__{id}`
-- REUSES its key on every renewal on purpose (sku-activation reads the prior
-- paid order under the same key to extend the window). A whole-column UNIQUE
-- would fail to build today and block every repeat purchase and renewal.
-- `vendor_booking_fee__{charge_id}` IS the charge, so the index is scoped to
-- exactly those keys (prod had 0 such orders at measurement, 0 duplicates).
-- Controller sign-off on the partial scope: 2026-09-20.
--
-- ── STATUS-BLIND ON PURPOSE ──────────────────────────────────────────────────
-- Both writers already treat ANY existing order for the key (even a cancelled
-- one) as "the bill exists" — the TS mint's existing-order check and
-- booking_fee_upsert_vendor_order's `SELECT … LIMIT 1` carry no status filter.
-- The index encodes that same rule; it adds no new behaviour, it removes the
-- race window between "check" and "insert".
--
-- ── THE TWO WRITERS ──────────────────────────────────────────────────────────
--   • TS  collectBookingFeeAtLock (lib/booking-fee-lock.server.ts): a 23505 on
--         insert is read as "already billed" and resolves to the existing order.
--   • SQL booking_fee_upsert_vendor_order (below): reproduced from
--         20271222508050 § 5 (prod's live body carries the gift clause and no
--         ON CONFLICT — checked 2026-09-20). The ONLY delta: the mint is
--         `ON CONFLICT … DO NOTHING`, and a lost race returns instead of writing
--         a payment row for an order it did not create. Without this, a race
--         would raise 23505 inside the amendment trigger and abort the couple's
--         amendment — fail-closed, but it would take their edit down with it.

CREATE UNIQUE INDEX IF NOT EXISTS orders_booking_fee_one_bill_per_charge
  ON public.orders (service_key)
  WHERE service_key LIKE 'vendor\_booking\_fee\_\_%';

COMMENT ON INDEX public.orders_booking_fee_one_bill_per_charge IS
  'One bill per booking-fee charge: service_key vendor_booking_fee__{charge_id} IS the charge. '
  'Partial because other service_keys are shared SKU codes / renewal keys. Owner 2026-09-20.';

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
  v_desc       TEXT;
BEGIN
  SELECT charge_id, event_id, vendor_profile_id, amount_charged_centavos, status, kind,
         gift_credits, gift_centavos
    INTO v_charge
    FROM public.booking_fee_charges
    WHERE charge_id = p_charge_id;
  IF NOT FOUND THEN RETURN; END IF;

  -- Mirrors bookingFeeLockServiceKey() in apps/web/lib/booking-fee-lock.ts.
  v_svc := 'vendor_booking_fee__' || p_charge_id::text;

  SELECT order_id, status, requested_total_php, description
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

  v_amount_php := round(v_charge.amount_charged_centavos
                        + COALESCE(v_charge.gift_centavos, 0))::numeric / 100.0;

  IF v_order.order_id IS NOT NULL THEN
    -- Never touch a settled/cancelled order — reconciliation there is the paid
    -- branch's supplementary-charge job, not an in-place rewrite.
    IF v_order.status IN ('paid', 'fulfilled', 'refunded', 'cancelled') THEN RETURN; END IF;
    IF v_order.requested_total_php IS DISTINCT FROM v_amount_php THEN
      v_desc := v_order.description;
      -- Rebuilt when the bill carries a gift now OR carried one before (a price
      -- cut below the floor must not leave "free Papic photos" on a bill that
      -- no longer buys any). A gift-free bill keeps its description untouched.
      IF COALESCE(v_charge.gift_credits, 0) > 0
         OR position(' + your Setnayan gift for your couple: ' IN COALESCE(v_desc, '')) > 0 THEN
        v_desc := 'Setnayan booking fee (' || public.booking_fee_schedule_summary() || ')'
          || CASE WHEN COALESCE(v_charge.gift_credits, 0) > 0
                  THEN public.setnayan_gift_bill_clause(v_charge.amount_charged_centavos,
                                                         v_charge.gift_credits,
                                                         v_charge.gift_centavos)
                  ELSE '' END
          || ' — amended booking, up for verification within 24 hrs';
      END IF;
      UPDATE public.orders
        SET requested_total_php = v_amount_php, description = v_desc, updated_at = NOW()
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
     -- DERIVED, never asserted: the fee is a taper, so a bare "(5%)" is a false
     -- statement of the rate on every booking above ₱100,000.
     'Setnayan booking fee (' || public.booking_fee_schedule_summary() || ')'
       || CASE WHEN COALESCE(v_charge.gift_credits, 0) > 0
               THEN public.setnayan_gift_bill_clause(v_charge.amount_charged_centavos,
                                                      v_charge.gift_credits,
                                                      v_charge.gift_centavos)
               ELSE '' END
       || ' — amended booking, up for verification within 24 hrs',
     v_amount_php, 'submitted', v_ref)
  -- 20271234849476: the partial unique index makes a concurrent mint for the
  -- same charge a no-op here instead of a 23505 that aborts the amendment.
  ON CONFLICT (service_key) WHERE service_key LIKE 'vendor\_booking\_fee\_\_%' DO NOTHING
  RETURNING order_id INTO v_order_id;

  -- Lost the race: the other writer's order (and its payment row) stands.
  IF v_order_id IS NULL THEN RETURN; END IF;

  INSERT INTO public.payments
    (order_id, user_id, amount_php, channel, paid_at)
  VALUES
    (v_order_id, v_payer, v_amount_php, 'manual', CURRENT_DATE);
END;
$$;

