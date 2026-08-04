-- Booking Fee · TWO fixes to `public.booking_fee_rederive_lock_fee`, deliberately
-- in ONE migration because both are a CREATE OR REPLACE of the SAME function —
-- split across two files, whichever landed second would silently revert the other
-- unless it happened to carry both changes.
--
--   (A) the schedule-version STAMP must name the schedule actually in force, and
--       must be DERIVED rather than re-typed;
--   (B) a live UNDER-BILLING bug: a second, higher amendment left the pending
--       supplementary charge frozen at the first amendment's amount.
--
-- ── (A) THE STAMP DEFECT ─────────────────────────────────────────────────────
-- `public.booking_fee_rederive_lock_fee(p_event_vendor_id UUID, p_schedule_version TEXT)`
-- (migration 20270930120000) still carried
--     p_schedule_version TEXT DEFAULT '2026-07-24-flat5-nocap'
-- — the SUPERSEDED flat-5%/no-cap schedule. The math moved to the owner-locked
-- TAPER on 2026-07-25 (5% on the first ₱100,000, then 1%, floor ₱50 —
-- `public.booking_fee_centavos`, migration 20271009120000), and the sibling
-- `booking_fee_open_lock_charge` was correctly re-defaulted to
-- '2026-07-25-taper5-1-over-100k' by 20271009140000 / 20271009180000. The
-- re-derive function was missed.
--
-- It is reachable AUTOMATICALLY, not just by hand: the amendment trigger
-- function `booking_fee_on_event_vendor_price_change()` (20270930120000, line
-- 400) calls it with ONE argument —
--     PERFORM public.booking_fee_rederive_lock_fee(NEW.vendor_id);
-- — so the stale default applied to EVERY amendment-driven re-derive. The
-- charge AMOUNT was always right (it comes from booking_fee_centavos, i.e. the
-- taper); what was wrong is the `schedule_version` STAMPED onto the
-- amendment_delta / amendment_credit rows, which claimed the charge had been
-- computed under flat-5%. That stamp exists precisely so a future reprice
-- cannot silently rewrite history — a stamp naming a schedule the charge was
-- NOT computed under defeats its own purpose and would mislead any audit or
-- recompute. The booking fee is ARMED in production, so the first amended
-- booking would have written wrong audit data.
--
-- ── THE FIX: ONE SOURCE, NOT A SECOND LITERAL ────────────────────────────────
-- Swapping the literal for '2026-07-25-taper5-1-over-100k' would reproduce this
-- bug verbatim at the next reprice — a third copy of the string to forget. So
-- the version becomes a FUNCTION, `public.booking_fee_schedule_version()`, and
-- the parameter defaults to calling it. PostgreSQL stores a parameter default
-- as an expression tree and evaluates it PER CALL, so a future reprice that
-- CREATE OR REPLACEs the version function moves every omitted-argument caller
-- with it — no signature churn, no second edit site.
--
-- The string itself is not new: it is the byte-for-byte value of
-- `BOOKING_FEE_SCHEDULE_VERSION` in apps/web/lib/booking-fee-gate.ts (the app
-- always passes that value explicitly on the TS path). The parity is asserted
-- in apps/web/tests/db/booking-fee-rederive.db.test.ts so the two can never
-- drift.
--
-- ── (B) THE UNDER-BILLING BUG — a clobbered FOUND ────────────────────────────
-- In the `v_delta > 0` branch, 20270930120000 wrote:
--
--     SELECT charge_id, amount_charged_centavos INTO v_existing_delta ...   -- sets FOUND
--     UPDATE ... WHERE kind = 'amendment_credit' AND credit_centavos <> 0;  -- RESETS FOUND
--     IF FOUND AND v_existing_delta.charge_id IS NOT NULL THEN              -- reads the WRONG one
--
-- FOUND is reset by every statement, so that `IF` tests the credit-zeroing
-- UPDATE, not the SELECT it appears to guard. With no credit note on file — the
-- common case — the UPDATE matches 0 rows, FOUND is false, the update-in-place
-- branch is SKIPPED even though a pending delta exists, and control falls
-- through to the INSERT. The INSERT violates the partial unique index
-- booking_fee_charges_one_pending_delta_per_event_vendor, and the fail-soft
-- trigger swallows the 23505 into a WARNING — so the amendment commits, the
-- stale delta survives at its OLD amount, and Setnayan silently under-bills.
--
-- Reproduced against the replayed schema: primary ₱5,000 PAID → amend to
-- ₱200,000 opens a ₱1,000 delta → amend to ₱1,000,000 leaves it at ₱1,000 when
-- ₱9,000 is due (taper ₱14,000 − ₱5,000 paid). ₱8,000 lost, no error surfaced.
--
-- FIX: drop the `FOUND AND`. `v_existing_delta.charge_id IS NOT NULL` is exactly
-- what the SELECT … INTO was for and cannot be clobbered by a later statement.
-- The credit-zeroing UPDATE stays exactly where it is — it is correct; it is
-- just not something to branch on. See the in-body comment at that line.
--
-- NO MATH CHANGES HERE. booking_fee_centavos, the taper, the floor and the
-- free-5 courtesy are untouched. The body below is reproduced VERBATIM from
-- 20270930120000 apart from EXACTLY TWO deltas: the parameter default (A) and
-- the `FOUND AND` removal + its explanatory comment (B).
--
-- Left alone deliberately: `public.booking_fee_open_charge`'s even older
-- DEFAULT '2026-07-23-flat2' (migration 20270916909942). That function is
-- PERFORMed by nothing in SQL and has exactly one caller in the app —
-- openBookingFeeCharge() in apps/web/lib/booking-fee-charge.ts:40 — which
-- always passes p_schedule_version explicitly. Its default is unreachable, so
-- changing it would be churn on a live money RPC for no behavioural gain.

BEGIN;

-- ── 1) The single SQL source of the fee schedule's version string ────────────
-- IMMUTABLE + LANGUAGE sql so it is inlinable and legal as a parameter default.
-- A reprice edits THIS function (and the TS constant it mirrors) — nowhere else.
CREATE OR REPLACE FUNCTION public.booking_fee_schedule_version()
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
AS $$ SELECT '2026-07-25-taper5-1-over-100k'::text $$;

COMMENT ON FUNCTION public.booking_fee_schedule_version() IS
  'The booking-fee schedule version stamped on every charge. Mirrors '
  'BOOKING_FEE_SCHEDULE_VERSION in apps/web/lib/booking-fee-gate.ts byte-for-byte '
  '(parity asserted in tests/db/booking-fee-rederive.db.test.ts). Exists so the '
  'string has ONE definition in SQL instead of a literal re-typed into every '
  'RPC default. service_role-only.';

-- Money-lane function: no client surface (mirrors 20270930120000's grants).
REVOKE ALL ON FUNCTION public.booking_fee_schedule_version() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.booking_fee_schedule_version() TO service_role;

-- ── 2) Re-derive: same signature, DERIVED default, un-clobbered branch guard ──
-- Reproduced verbatim from 20270930120000 § 3 apart from EXACTLY TWO deltas:
--   (A) p_schedule_version TEXT DEFAULT '2026-07-24-flat5-nocap'
--     → p_schedule_version TEXT DEFAULT public.booking_fee_schedule_version()
--   (B) IF FOUND AND v_existing_delta.charge_id IS NOT NULL THEN
--     → IF v_existing_delta.charge_id IS NOT NULL THEN   (+ the comment saying why)
CREATE OR REPLACE FUNCTION public.booking_fee_rederive_lock_fee(
  p_event_vendor_id  UUID,
  p_schedule_version TEXT DEFAULT public.booking_fee_schedule_version()
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

    -- ⚠ DELIBERATELY NOT `IF FOUND AND …`. FOUND is reset by EVERY statement, so
    -- by the time control reaches this line it reflects the credit-zeroing UPDATE
    -- five lines up — NOT the `SELECT … INTO v_existing_delta` it looks like it is
    -- guarding. That UPDATE matches 0 rows whenever no credit note exists (the
    -- common case), which made FOUND false, skipped this update-in-place branch
    -- despite a pending delta existing, and dropped through to the INSERT below —
    -- where it violated booking_fee_charges_one_pending_delta_per_event_vendor and
    -- the fail-soft trigger swallowed the 23505 into a WARNING. The stale delta
    -- then survived at its OLD amount and Setnayan under-billed the difference.
    -- `v_existing_delta.charge_id IS NOT NULL` is the correct and sufficient test:
    -- it is exactly what the SELECT … INTO was for, and it cannot be clobbered by
    -- an intervening statement. (Fixed 2026-07-27; introduced by 20270930120000.)
    IF v_existing_delta.charge_id IS NOT NULL THEN
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

-- CREATE OR REPLACE keeps grants but drops nothing else we rely on; the COMMENT
-- and the grants are re-issued verbatim so a replay from scratch is identical.
COMMENT ON FUNCTION public.booking_fee_rederive_lock_fee(UUID, TEXT) IS
  'Re-derive a locked booking''s fee to its current event_vendors.total_cost_php. '
  'No-op unless a primary charge exists (the dark/flag gate). Pending → update in '
  'place; paid → supplementary delta (increase) or audit credit (decrease, no '
  'refund); free-5 stays free. Idempotent. service_role-only. The schedule_version '
  'stamp defaults to public.booking_fee_schedule_version() — evaluated per call, so '
  'the one-argument trigger path (booking_fee_on_event_vendor_price_change) always '
  'stamps the schedule actually in force.';

REVOKE ALL ON FUNCTION public.booking_fee_rederive_lock_fee(UUID, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.booking_fee_rederive_lock_fee(UUID, TEXT) TO service_role;

COMMIT;
