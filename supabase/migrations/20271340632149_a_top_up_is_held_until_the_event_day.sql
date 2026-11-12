-- a_top_up_is_held_until_the_event_day
-- Created via `pnpm migration:new`. Prefix auto-allocated to sort AFTER every
-- existing migration. KEEP THIS MIGRATION IDEMPOTENT (it may be re-applied).
--
-- 💸 BOOKING-FEE TOP-UP — SIX RULES (owner, DECISION_LOG 2026-11-12, "Yes, use your picks"; prototype
-- specs `Build_Booking_Fee_Hold_2026-11-12/booking-fee-hold.html`). When a booked quote rises, the supplier's booking
-- fee grows by a top-up — the `amendment_delta` charge `booking_fee_rederive_lock_fee` ALREADY mints. This migration
-- changes only WHEN that top-up is owed:
--
--   1 · The top-up is DUE on the event day and gated only from the DAY AFTER.
--       ⇒ the delta's `expires_at` is the event day (noon, Manila — the same calendar day in UTC, so every
--         `expires_at.slice(0, 10)` reader in the app reads the event day). Was: `NOW() + 7 days` from the rise.
--         A rise AFTER the event day is due the day it happens (never a date in the past). No event date → the
--         shipped seven days.
--   4 · Before the event day it is HELD, not owed: `vendor_event_fee_gate_stage` ignores a pending/failed
--       `amendment_delta` through its due day, so the event stays open (the settled primary decides).
--       The TS twin is `eventAccessUnlocked` in apps/web/lib/event-access-stage.ts (`top_up_held`).
--   3 · A FREE first booking stays free at any amended total — UNCHANGED (the `free_noop` arm below is copied
--       verbatim). Pinned by apps/web/tests/db/a-top-up-is-held-until-the-event-day.db.test.ts.
--   6 · A booked quote that later drops changes no paid amount — UNCHANGED (the credit arm records an audit row and
--       moves no money; nothing in the app shows it — pinned by apps/web/lib/a-dropped-quote-shows-no-credit.test.ts).
--   2 · 5 · (Settle early · who is told) are app-side: apps/web/lib/booking-fee-top-up.ts.
--
-- `booking_fee_rederive_lock_fee` is copied from 20271323363853_badge_rewards_land_in_the_gift_stock.sql (its latest
-- definition) with TWO edits marked ⟵ HELD; `vendor_event_fee_gate_stage` from 20271268087628_the_fee_is_made_at_the_yes.sql
-- (its only later definition) with ONE edit marked ⟵ HELD. Nothing else in either body moved.

BEGIN;

-- ── 1 · When is a top-up due? The event day, noon Manila (never before now). ───────────────────────────────────────
CREATE OR REPLACE FUNCTION public.booking_fee_top_up_due_at(p_event_id UUID)
RETURNS TIMESTAMPTZ
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT GREATEST((e.event_date + TIME '12:00') AT TIME ZONE 'Asia/Manila', NOW())
    FROM public.events e
   WHERE e.event_id = p_event_id
     AND e.event_date IS NOT NULL;
$$;
REVOKE ALL ON FUNCTION public.booking_fee_top_up_due_at(UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.booking_fee_top_up_due_at(UUID) TO service_role;

COMMENT ON FUNCTION public.booking_fee_top_up_due_at(UUID) IS
  'Owner 2026-11-12 (BOOKING-FEE TOP-UP rule 1): an amendment_delta top-up is due on the EVENT DAY — noon Manila of events.event_date, or NOW() when that has passed. NULL when the event has no date. Migration 20271340632149.';

-- ── 2 · Is this charge a HELD top-up (owed from the day after its due day, not before)? ────────────────────────────
-- Day precision in Manila, the same comparison as `feeDueStage` (apps/web/lib/booking-fee-disclosure.ts): due day ≥
-- today ⇒ held. An unknown due date is NOT held (the shipped behaviour: it decides as before).
CREATE OR REPLACE FUNCTION public.booking_fee_top_up_is_held(p_kind TEXT, p_status TEXT, p_expires_at TIMESTAMPTZ)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SET search_path = public, pg_temp
AS $$
  SELECT COALESCE(
    p_kind = 'amendment_delta'
    AND p_status IN ('pending', 'failed')
    AND p_expires_at IS NOT NULL
    AND (p_expires_at AT TIME ZONE 'Asia/Manila')::date >= (NOW() AT TIME ZONE 'Asia/Manila')::date,
    FALSE
  );
$$;
REVOKE ALL ON FUNCTION public.booking_fee_top_up_is_held(TEXT, TEXT, TIMESTAMPTZ) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.booking_fee_top_up_is_held(TEXT, TEXT, TIMESTAMPTZ) TO service_role;

COMMENT ON FUNCTION public.booking_fee_top_up_is_held(TEXT, TEXT, TIMESTAMPTZ) IS
  'Owner 2026-11-12 (BOOKING-FEE TOP-UP rule 4): a pending/failed amendment_delta is HELD, not owed, through its due day (Manila). TS twin: topUpIsHeld in apps/web/lib/booking-fee-top-up.ts. Migration 20271340632149.';

-- ── 3 · The re-derive: the top-up it opens is due on the event day ─────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.booking_fee_rederive_lock_fee(p_event_vendor_id uuid, p_schedule_version text DEFAULT booking_fee_schedule_version())
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
         -- § 7 · THE ONE CHANGE: the agreed total INCLUDING the changes agreed
         -- since (is_change_delta lines), floored at zero — the same base
         -- booking_fee_open_lock_charge reads (§ 6).
         GREATEST(
           COALESCE(round((
             COALESCE(total_cost_php, 0)
             + COALESCE((SELECT SUM(li.amount_php)
                           FROM public.event_vendor_line_items li
                          WHERE li.vendor_id = p_event_vendor_id
                            AND li.is_change_delta), 0)
           ) * 100)::BIGINT, 0),
           0
         ) AS amount_centavos
    INTO v_ev
    FROM public.event_vendors
    WHERE vendor_id = p_event_vendor_id;
  IF NOT FOUND THEN RETURN jsonb_build_object('action', 'no_booking'); END IF;

  -- The FLAG/DARK gate: only a booking that already carries a primary charge (i.e.
  -- one locked while the fee was on) is ever re-derived. No charge → nothing to do.
  SELECT charge_id, ledger_id, status, amount_charged_centavos, proposal_amount_centavos,
         badge_reward_id   -- ⟵ BADGE
    INTO v_primary
    FROM public.booking_fee_charges
    WHERE event_vendor_id = p_event_vendor_id AND kind = 'primary'
      AND status IN ('pending', 'paid', 'waived_import', 'waived_free5', 'waived_promo', 'waived_launch')
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
  -- A booking waived by a free-fee window stays waived when its total is later
  -- amended. The promise was "this booking is free"; re-billing it because the
  -- couple added a second hour — or because the window has since closed — would
  -- withdraw a promise the shop already accepted.
  IF v_primary.status = 'waived_promo' THEN
    RETURN jsonb_build_object('action', 'promo_noop');
  END IF;
  -- ⟵ NEW (the launch offer): a launch booking is free for the same reason a
  -- promo one is — the promise was "this booking is free", and an amendment, or
  -- the offer closing since, must not withdraw it.
  IF v_primary.status = 'waived_launch' THEN
    RETURN jsonb_build_object('action', 'launch_noop');
  END IF;
  -- ⟵ BADGE (owner 2026-11-05): a booking whose fee a badge reward paid stays
  -- free when its total is amended — the promise was "this booking's fee is
  -- ₱0". Without this arm the ₱0 `paid` primary reads as underpaid by the WHOLE
  -- new fee and opens an amendment delta for it.
  IF v_primary.badge_reward_id IS NOT NULL THEN
    RETURN jsonb_build_object('action', 'badge_noop');
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
            proposal_amount_centavos = v_new_total,
            -- ⟵ HELD (owner 2026-11-12 #1): the top-up is due on the EVENT DAY.
            expires_at = COALESCE(public.booking_fee_top_up_due_at(v_ev.event_id), expires_at),
            updated_at = NOW()
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
       v_delta, p_schedule_version, 'pending',
       -- ⟵ HELD (owner 2026-11-12 #1): due on the EVENT DAY, not seven days from the rise. No event date → the
       -- shipped seven days (nothing is invented).
       COALESCE(public.booking_fee_top_up_due_at(v_ev.event_id), NOW() + INTERVAL '7 days'))
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
$function$;

REVOKE ALL ON FUNCTION public.booking_fee_rederive_lock_fee(UUID, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.booking_fee_rederive_lock_fee(UUID, TEXT) TO service_role;

-- ── 4 · The gate: a held top-up decides nothing ────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.vendor_event_fee_gate_stage(
  p_event_id UUID,
  p_booked   BOOLEAN
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
DECLARE
  v_enforced BOOLEAN;
  v_profile  UUID;
  v_status   TEXT;
  v_open     TEXT;
BEGIN
  v_open := CASE WHEN COALESCE(p_booked, TRUE) THEN 'unlocked' ELSE 'quoting' END;

  BEGIN
    SELECT ps.fee_unlocks_event_enforced INTO v_enforced
    FROM public.platform_settings ps
    WHERE ps.id = 1;
  EXCEPTION WHEN OTHERS THEN
    RETURN 'unlocked';
  END;
  IF COALESCE(v_enforced, FALSE) IS NOT TRUE THEN
    RETURN 'unlocked';
  END IF;

  BEGIN
    SELECT vp.vendor_profile_id INTO v_profile
    FROM public.vendor_profiles vp
    WHERE vp.user_id = auth.uid()
    LIMIT 1;

    IF v_profile IS NULL THEN
      SELECT tm.vendor_profile_id INTO v_profile
      FROM public.vendor_team_members tm
      WHERE tm.user_id = auth.uid()
      ORDER BY tm.created_at
      LIMIT 1;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    RETURN 'unlocked';
  END;
  IF v_profile IS NULL THEN
    RETURN 'unlocked';
  END IF;

  BEGIN
    SELECT c.status INTO v_status
    FROM public.booking_fee_charges c
    WHERE c.vendor_profile_id = v_profile
      AND c.event_id = p_event_id
      -- ⟵ CHANGED: a voided former booking's charge decides nothing.
      AND c.status <> 'cancelled_unbilled'
      -- ⟵ CHANGED (owner 2026-10-13): neither does a STALE amendment top-up.
      -- `booking_fee_rederive_lock_fee` is the only writer of `expired`, and it
      -- writes it to a pending amendment delta it is VOIDING (the total moved
      -- again). Read as "still owed" it locked a booking over a bill that no
      -- longer exists.
      AND NOT (c.kind = 'amendment_delta' AND c.status = 'expired')
      -- ⟵ HELD (owner 2026-11-12 #1 + #4): a top-up is HELD, not owed, up to and including its due day (the event
      -- day). It decides nothing until the day after — no gate before then.
      AND NOT public.booking_fee_top_up_is_held(c.kind, c.status, c.expires_at)
    ORDER BY (c.status IN ('pending', 'failed', 'expired')) DESC, c.created_at DESC
    LIMIT 1;
  EXCEPTION WHEN OTHERS THEN
    RETURN v_open;
  END;

  -- ⟵ CHANGED: no charge at all. Not booked ⇒ still quoting (nothing is owed
  -- and nothing beyond a quote is theirs). BOOKED ⇒ no handshake has made the
  -- fee, so the rest of the event waits for it (`{ kind: 'none' }` in the TS
  -- rule, which now answers the same).
  IF v_status IS NULL THEN
    RETURN CASE WHEN COALESCE(p_booked, TRUE) THEN 'booked_fee_due' ELSE 'quoting' END;
  END IF;

  IF v_status NOT IN ('pending', 'failed', 'expired') THEN
    RETURN v_open;
  END IF;

  RETURN 'booked_fee_due';
END;
$$;

REVOKE ALL ON FUNCTION public.vendor_event_fee_gate_stage(UUID, BOOLEAN) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.vendor_event_fee_gate_stage(UUID, BOOLEAN) FROM anon;
REVOKE ALL ON FUNCTION public.vendor_event_fee_gate_stage(UUID, BOOLEAN) FROM authenticated;

COMMENT ON FUNCTION public.vendor_event_fee_gate_stage(UUID, BOOLEAN) IS
  'THE BOOKING FEE UNLOCKS THE EVENT, in SQL — `resolveEventAccessStage` from apps/web/lib/event-access-stage.ts. Returns ''unlocked'' | ''booked_fee_due'' | ''quoting''. Switched by platform_settings.fee_unlocks_event_enforced: NULL/FALSE returns ''unlocked'' always. Picks the deciding booking_fee_charges row (unsettled beating settled; cancelled_unbilled, a voided top-up and — since 20271340632149, owner 2026-11-12 — a HELD top-up ignored). A booked shop with no charge is ''booked_fee_due''. FAILS OPEN on every read error and on no resolvable shop. INTERNAL: no role holds EXECUTE.';

COMMIT;
