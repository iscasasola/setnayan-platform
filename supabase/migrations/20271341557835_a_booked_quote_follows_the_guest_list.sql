-- a_booked_quote_follows_the_guest_list
-- Created via `pnpm migration:new`. KEEP THIS MIGRATION IDEMPOTENT (it may be re-applied).
--
-- 👥💸 A BOOKED QUOTE FOLLOWS THE GUEST LIST TOO — Piece 2 (owner 2026-11-12, "A LOCKED QUOTATION STILL FOLLOWS THE
-- GUEST LIST"; recommendation 3 approved the same day).
--
-- 20271339826198 made a not-yet-booked quote RISE with the guest list; 20271340566104 made an unlocked one FALL back
-- too. Both skipped a BOOKED deal, because a booked change moves `event_vendors.total_cost_php` and the supplier's
-- booking-fee top-up would have been billed at once. 20271340632149 made that top-up HELD until the event day, so the
-- skip is retired:
--   · a booked deal (contracted · deposit_paid) is repriced like a supplier-LOCKED quote — it rises with the list and
--     never falls (the booking is the supplier's yes on that price; owner: "it really depends if the supplier already
--     locked the price");
--   · its booking total (`event_vendors.total_cost_php`) follows; a delivered or complete job is never repriced at all
--     (its proposal is skipped: lines, total, Final installment and chat line all stay put);
--   · everything else is the shipped rule: paid rows untouched, the rise on the latest unpaid auto Final balance, one
--     chat line.
--
-- `quote_follow_guest_count` is copied from 20271340566104 (its latest definition) with the edits marked ⟵ PIECE 2.
-- TS mirror: apps/web/lib/quote-pax-follow.ts (`booked` = locked, never "not repriced").

BEGIN;

CREATE OR REPLACE FUNCTION public.quote_follow_guest_count(p_event_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  r          RECORD;
  v_ev       UUID;
  v_locked   BOOLEAN;
  v_booked   BOOLEAN;
  v_count    INTEGER;
  v_min      INTEGER;
  v_prior    INTEGER;
  v_sent_pax INTEGER;
  v_billed   INTEGER;
  v_lines    JSONB;
  v_delta    BIGINT;
  v_sched    JSONB;
  v_inst     JSONB;
  v_paid     INTEGER[];
  v_paid_c   BIGINT;
  v_cap      BIGINT;
  v_left     BIGINT;
  v_take     BIGINT;
  v_amt      BIGINT;
  v_el       JSONB;
  v_auto     INTEGER;
  v_new_tot  BIGINT;
  v_moved    INTEGER := 0;
BEGIN
  IF p_event_id IS NULL THEN
    RETURN 0;
  END IF;

  FOR r IN
    SELECT vp.proposal_id, vp.vendor_profile_id, vp.status, vp.line_items, vp.total_centavos,
           vp.payment_schedule, COALESCE(vp.merge_snapshot, '{}'::jsonb) AS snap,
           COALESCE(vp.changes_locked, FALSE) AS locked
      FROM public.vendor_proposals vp
     WHERE vp.event_id = p_event_id
       AND vp.status IN ('sent', 'viewed', 'accepted')
       AND public.quote_follows_guest_list(vp.line_items)
     ORDER BY vp.created_at
       FOR UPDATE
  LOOP
    -- ⟵ PIECE 2: a FINISHED job (its anchor booking is delivered or complete) is never repriced — not its lines, not
    -- its total, not its Final installment, no chat line. `vendor_requote_blocker` calls these 'deal_locked' too, so
    -- the skip must be its own test, judged on the same anchor rows the blocker reads.
    IF EXISTS (
      SELECT 1
        FROM public.event_vendors ev
       WHERE ev.event_id = p_event_id
         AND ev.marketplace_vendor_id = r.vendor_profile_id
         AND ev.archived_at IS NULL
         AND (ev.package_role IS NULL OR ev.package_role = 'anchor')
         AND ev.status IN ('delivered', 'complete')
    ) THEN
      CONTINUE;
    END IF;

    -- ⟵ PIECE 2 (owner 2026-11-12): a BOOKED deal follows the guest list too — but like a supplier-locked quote: it
    -- RISES and never falls (the booking is the supplier's yes on that price). Its rise re-derives the booking fee,
    -- and since 20271340632149 that top-up is HELD until the event day — the reason this used to skip booked deals.
    v_booked := public.vendor_requote_blocker(p_event_id, r.vendor_profile_id) IS NOT DISTINCT FROM 'deal_locked';

    SELECT ev.vendor_id INTO v_ev
      FROM public.event_vendors ev
     WHERE ev.event_id = p_event_id
       AND ev.marketplace_vendor_id = r.vendor_profile_id
       AND ev.archived_at IS NULL
       AND (ev.package_role IS NULL OR ev.package_role = 'anchor')
     ORDER BY public.event_vendor_counts_per_head(ev.vendor_id) DESC, ev.created_at
     LIMIT 1;

    v_locked   := r.locked OR v_booked;   -- ⟵ PIECE 2
    v_count    := public.quote_guest_count(p_event_id, v_ev);
    v_min      := CASE WHEN jsonb_typeof(r.snap -> 'min_pax') = 'number' THEN GREATEST(0, floor((r.snap ->> 'min_pax')::NUMERIC)::INT) ELSE 0 END;
    v_prior    := CASE WHEN jsonb_typeof(r.snap -> 'billed_pax') = 'number' THEN GREATEST(0, floor((r.snap ->> 'billed_pax')::NUMERIC)::INT) ELSE 0 END;
    v_sent_pax := CASE WHEN jsonb_typeof(r.snap -> 'sent_billed_pax') = 'number' THEN GREATEST(0, floor((r.snap ->> 'sent_billed_pax')::NUMERIC)::INT) ELSE v_prior END;
    -- Unlocked: floored at what was SENT (so it can fall back to it). Locked: floored at what it bills now (never falls).
    v_billed   := GREATEST(v_count, v_min, CASE WHEN v_locked THEN v_prior ELSE v_sent_pax END);

    SELECT f.lines, f.delta INTO v_lines, v_delta FROM public.quote_follow_lines(r.line_items, v_billed, NOT v_locked) f;
    IF v_delta = 0 THEN
      CONTINUE;
    END IF;

    -- What has been paid on this shop's bookings of the event (rows and money).
    SELECT COALESCE(ARRAY_AGG(DISTINCT p.schedule_instance_seq) FILTER (WHERE p.schedule_instance_seq IS NOT NULL), ARRAY[]::INTEGER[]),
           COALESCE(round(SUM(p.amount_php) * 100), 0)::BIGINT
      INTO v_paid, v_paid_c
      FROM public.event_vendor_payments p
      JOIN public.event_vendors ev ON ev.vendor_id = p.vendor_id
     WHERE ev.event_id = p_event_id
       AND ev.marketplace_vendor_id = r.vendor_profile_id
       AND p.payment_refused_at IS NULL;

    v_sched := r.payment_schedule;

    IF v_delta < 0 THEN
      -- The cap: what is still to be settled — never below what is paid, and (with a plan) only the unpaid auto rows.
      v_cap := GREATEST(0, r.total_centavos - v_paid_c);
      IF jsonb_typeof(v_sched -> 'installments') = 'array' AND jsonb_array_length(v_sched -> 'installments') > 0 THEN
        v_cap := LEAST(v_cap, COALESCE((
          SELECT SUM(GREATEST(0, COALESCE((x.i ->> 'amount_centavos')::BIGINT, 0)))
            FROM jsonb_array_elements(v_sched -> 'installments') x(i)
           WHERE COALESCE((x.i ->> 'is_auto_balance')::BOOLEAN, FALSE)
             AND NOT ((x.i ->> 'seq')::INT = ANY (v_paid))), 0));
      END IF;
      -- Too big a drop → fall only as far as whole guests fit under the cap.
      WHILE -v_delta > v_cap AND v_billed < GREATEST(v_prior, v_billed) LOOP
        v_billed := v_billed + 1;
        SELECT f.lines, f.delta INTO v_lines, v_delta FROM public.quote_follow_lines(r.line_items, v_billed, TRUE) f;
      END LOOP;
      IF v_delta >= 0 OR -v_delta > v_cap THEN
        CONTINUE; -- nothing unsettled to take it from: the price stays
      END IF;
    END IF;

    v_new_tot := r.total_centavos + v_delta;

    IF jsonb_typeof(v_sched -> 'installments') = 'array'
       AND jsonb_array_length(v_sched -> 'installments') > 0 THEN
      IF v_delta > 0 THEN
        -- The rise lands on the latest unpaid auto Final balance (or a new one) — shipped, unchanged.
        SELECT (x.i ->> 'seq')::INT INTO v_auto
          FROM jsonb_array_elements(v_sched -> 'installments') x(i)
         WHERE COALESCE((x.i ->> 'is_auto_balance')::BOOLEAN, FALSE)
           AND NOT ((x.i ->> 'seq')::INT = ANY (v_paid))
         ORDER BY (x.i ->> 'seq')::INT DESC
         LIMIT 1;

        IF v_auto IS NOT NULL THEN
          SELECT jsonb_agg(
                   CASE WHEN (x.i ->> 'seq')::INT = v_auto
                        THEN x.i || jsonb_build_object(
                               'amount_centavos', COALESCE((x.i ->> 'amount_centavos')::BIGINT, 0) + v_delta,
                               'raw_centavos', COALESCE((x.i ->> 'raw_centavos')::BIGINT, 0) + v_delta)
                        ELSE x.i END
                   ORDER BY x.n)
            INTO v_inst
            FROM jsonb_array_elements(v_sched -> 'installments') WITH ORDINALITY x(i, n);
        ELSE
          v_inst := (v_sched -> 'installments') || jsonb_build_array(jsonb_build_object(
            'seq', (SELECT COALESCE(MAX((x.i ->> 'seq')::INT), -1) + 1 FROM jsonb_array_elements(v_sched -> 'installments') x(i)),
            'label', 'Final balance',
            'kind', 'auto',
            'amount_centavos', v_delta,
            'raw_centavos', v_delta,
            'percent_bps', NULL,
            'due', 'before_event',
            'offset_days', 14,
            'is_downpayment', FALSE,
            'is_auto_balance', TRUE,
            'credit_applied_centavos', 0));
        END IF;
      ELSE
        -- The drop comes off the unpaid auto rows, latest first; one reaching ₱0 leaves the plan. Paid rows untouched.
        v_left := -v_delta;
        v_inst := '[]'::jsonb;
        FOR v_el IN
          SELECT x.i
            FROM jsonb_array_elements(v_sched -> 'installments') WITH ORDINALITY x(i, n)
           ORDER BY x.n DESC
        LOOP
          IF v_left > 0
             AND COALESCE((v_el ->> 'is_auto_balance')::BOOLEAN, FALSE)
             AND NOT ((v_el ->> 'seq')::INT = ANY (v_paid)) THEN
            v_amt  := GREATEST(0, COALESCE((v_el ->> 'amount_centavos')::BIGINT, 0));
            v_take := LEAST(v_left, v_amt);
            v_left := v_left - v_take;
            IF v_amt - v_take = 0 THEN
              CONTINUE; -- settled to nothing: the row goes
            END IF;
            v_el := v_el || jsonb_build_object(
              'amount_centavos', v_amt - v_take,
              'raw_centavos', GREATEST(0, COALESCE((v_el ->> 'raw_centavos')::BIGINT, 0) - v_take));
          END IF;
          v_inst := jsonb_build_array(v_el) || v_inst;
        END LOOP;
      END IF;

      v_sched := v_sched || jsonb_build_object(
        'installments', v_inst,
        'base_centavos', COALESCE((v_sched ->> 'base_centavos')::BIGINT, r.total_centavos) + v_delta,
        'total_centavos', COALESCE((v_sched ->> 'total_centavos')::BIGINT, r.total_centavos) + v_delta);
    END IF;

    UPDATE public.vendor_proposals
       SET line_items       = v_lines,
           total_centavos   = v_new_tot,
           payment_schedule = v_sched,
           merge_snapshot   = r.snap || jsonb_build_object(
             'billed_pax', v_billed,
             'sent_billed_pax', v_sent_pax,
             'sent_total_centavos', COALESCE((r.snap ->> 'sent_total_centavos')::BIGINT, r.total_centavos),
             'pax_followed_at', now()),
           updated_at       = now()
     WHERE proposal_id = r.proposal_id;

    IF r.status = 'accepted' THEN
      UPDATE public.event_vendors ev
         SET total_cost_php    = v_new_tot::NUMERIC / 100.0,
             pax_quote_base    = v_billed,
             pax_surcharge_php = 0,
             updated_at        = now()
       WHERE ev.event_id = p_event_id
         AND ev.marketplace_vendor_id = r.vendor_profile_id
         AND ev.archived_at IS NULL
         AND ev.package_role IS NULL
         -- ⟵ PIECE 2: a booked row (contracted · deposit_paid) follows too; a delivered or complete job never moves.
         AND ev.status NOT IN ('delivered', 'complete');
    END IF;

    IF v_delta > 0 THEN
      PERFORM public.chat_record_post_line(
        p_event_id, r.vendor_profile_id,
        public.quote_rise_words(v_billed, v_delta),
        'Quote rose to ' || to_char(v_billed, 'FM999,999,990') || ' pax');
    ELSE
      PERFORM public.chat_record_post_line(
        p_event_id, r.vendor_profile_id,
        public.quote_fall_words(v_billed, -v_delta),
        'Quote fell to ' || to_char(v_billed, 'FM999,999,990') || ' pax');
    END IF;
    v_moved := v_moved + 1;
  END LOOP;

  RETURN v_moved;
END;
$$;

REVOKE ALL ON FUNCTION public.quote_follow_guest_count(UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.quote_follow_guest_count(UUID) TO service_role;

COMMENT ON FUNCTION public.quote_follow_guest_count(UUID) IS
  'Piece 1 · PR-2 + the fall-back + Piece 2 (owner 2026-11-12): every standing quote of the event whose lines carry their own per-head rate follows the per-service count. Unlocked: up and down, floored at merge_snapshot.min_pax and the pax it was first sent at (sent_billed_pax), each line never under its sent amount. changes_locked OR BOOKED (since 20271340663561+): rises only — a booked rise re-derives the supplier fee as a HELD top-up (20271340632149). Rise → latest unpaid auto Final balance; drop → off the unpaid auto rows only, capped at what is unsettled (never below paid, never a credit). Same row updated, accepted → event_vendors.total_cost_php follows; a delivered/complete job is skipped entirely (never repriced), one chat line. TS mirror lib/quote-pax-follow.ts.';

COMMIT;
