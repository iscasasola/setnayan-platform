-- a_quote_falls_back_with_the_guest_list
-- Created via `pnpm migration:new`. Prefix auto-allocated to sort AFTER every
-- existing migration. KEEP THIS MIGRATION IDEMPOTENT (it may be re-applied).
--
-- 📉 WHEN A GUEST IS REMOVED, THE PRICE FALLS BACK — UNLESS THE SUPPLIER LOCKED IT (DECISION_LOG 2026-11-12).
-- Owner, verbatim: *"if the price is paid, then it stays, meaning that price is already agreed upon, it really depends
-- if the supplier already locked the price."* Extends the shipped repricer (migration 20271339826198, PR #7516), which
-- only rose. Also held by DECISION_LOG 2026-11-12 "BOOKING-FEE TOP-UP — SIX RULES" (6): a drop changes no paid amount
-- and shows no credit.
--
-- ── WHAT CHANGES IN `quote_follow_guest_count(event_id)` ───────────────────────────────────────────────────────────
--   · A quote the supplier has NOT locked (`vendor_proposals.changes_locked` false) follows the list DOWN as well as up:
--       billed = max(per-service count, Bill-at-least `merge_snapshot.min_pax`, the pax it was first SENT at).
--     The sent pax is the shipped floor (`merge_snapshot.billed_pax` as the quote maker wrote it); the repricer now
--     remembers it as `sent_billed_pax` the first time it moves the quote, because it rewrites `billed_pax`.
--     ⚠ A quote that already ROSE before this migration has no `sent_billed_pax`; its current `billed_pax` is then the
--       floor — it never falls (we never guess the count it was sent at).
--   · Each per-head line → max(its SENT amount, rate × billed). A line's sent amount is remembered on the line
--     (`sent_amount_centavos` + `sent_detail`) the first time it moves; a line that never moved IS its sent amount, so
--     it can never fall below it — a line quoted above rate × pax is never cut.
--   · A quote the supplier HAS locked still rises (shipped) but never falls: each line → max(its amount, rate × billed)
--     with billed floored at the pax it carries now. The locked price is the floor.
--   · PAID AMOUNTS NEVER CHANGE. A drop comes off the unpaid AUTO Final-balance row(s), latest first; an auto row that
--     reaches ₱0 is dropped from the plan. The drop is capped at what is still unsettled (the unpaid auto rows, and
--     never below what has been paid on the booking): when the full drop would pass it, the quote falls only as far as
--     whole guests fit under the cap — never a refund, never a credit, never a total under what is paid.
--   · BOOKED deals stay untouched, as for the rise (`vendor_requote_blocker` = 'deal_locked').
--   · One chat line, "Quote fell to N pax · −₱X" (SQL `quote_fall_words`, read by lib/chat-card-lines.ts
--     `quoteFallFromLine`).
--   · Ticking a guest "Not counted for ▾" a service now moves the quote too (a new INSERT trigger), since it can lower it.
--
-- TS mirror: apps/web/lib/quote-pax-follow.ts. Held by apps/web/tests/db/a-quote-follows-the-guest-list.db.test.ts
-- (SQL and TS agree) and apps/web/lib/quote-pax-follow.test.ts.

BEGIN;

-- ── 1 · One line-follow, both directions ───────────────────────────────────────────────────────────────────────────
-- p_can_fall = the quote is not locked. Returns the new lines and the signed delta (centavos).
CREATE OR REPLACE FUNCTION public.quote_follow_lines(p_line_items JSONB, p_billed INTEGER, p_can_fall BOOLEAN)
RETURNS TABLE (lines JSONB, delta BIGINT)
LANGUAGE sql
IMMUTABLE
SET search_path = public, pg_temp
AS $$
  WITH x AS (
    SELECT l, n,
           (l ->> 'basis' = 'per_pax'
             AND jsonb_typeof(l -> 'rate_centavos') = 'number'
             AND (l ->> 'rate_centavos')::NUMERIC > 0
             AND jsonb_typeof(l -> 'amount_centavos') = 'number') AS follows
      FROM jsonb_array_elements(CASE WHEN jsonb_typeof(p_line_items) = 'array' THEN p_line_items ELSE '[]'::jsonb END)
           WITH ORDINALITY AS t(l, n)
  ), y AS (
    SELECT l, n, follows,
           CASE WHEN follows THEN (l ->> 'amount_centavos')::NUMERIC END AS amt,
           CASE WHEN follows THEN CASE WHEN jsonb_typeof(l -> 'sent_amount_centavos') = 'number'
                                       THEN (l ->> 'sent_amount_centavos')::NUMERIC
                                       ELSE (l ->> 'amount_centavos')::NUMERIC END END AS sent,
           CASE WHEN follows THEN round((l ->> 'rate_centavos')::NUMERIC) END AS rate
      FROM x
  ), z AS (
    SELECT l, n, follows, amt, sent, rate, rate * p_billed AS want,
           CASE WHEN NOT follows THEN NULL
                WHEN p_can_fall THEN GREATEST(sent, rate * p_billed)
                ELSE GREATEST(amt, rate * p_billed) END AS target
      FROM y
  )
  SELECT COALESCE(jsonb_agg(
           CASE WHEN follows AND target <> amt
                THEN l || jsonb_build_object(
                       'amount_centavos', target::BIGINT,
                       'pax', p_billed,
                       'sent_amount_centavos', sent::BIGINT,
                       'sent_detail', COALESCE(l -> 'sent_detail', l -> 'detail', 'null'::jsonb),
                       'detail', CASE WHEN target = want
                                      THEN to_jsonb(to_char(p_billed, 'FM999,999,990') || ' pax × '
                                                    || public.booking_change_php_words(rate / 100.0))
                                      ELSE COALESCE(l -> 'sent_detail', l -> 'detail', 'null'::jsonb) END)
                ELSE l END
           ORDER BY n), '[]'::jsonb),
         COALESCE(SUM(CASE WHEN follows THEN target - amt ELSE 0 END), 0)::BIGINT
    FROM z;
$$;
REVOKE ALL ON FUNCTION public.quote_follow_lines(JSONB, INTEGER, BOOLEAN) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.quote_follow_lines(JSONB, INTEGER, BOOLEAN) TO service_role;

-- ── 2 · The chat line for a fall (lib/chat-card-lines.ts `quoteFallFromLine` reads exactly these words) ────────────
CREATE OR REPLACE FUNCTION public.quote_fall_words(p_pax INTEGER, p_drop_centavos BIGINT)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
SET search_path = public, pg_temp
AS $$
  SELECT 'Quote fell to ' || to_char(p_pax, 'FM999,999,990') || ' pax · −'
         || public.booking_change_php_words(p_drop_centavos / 100.0);
$$;
REVOKE ALL ON FUNCTION public.quote_fall_words(INTEGER, BIGINT) FROM PUBLIC, anon, authenticated;

-- ── 3 · The repricer, both directions ──────────────────────────────────────────────────────────────────────────────
-- Returns how many quotes moved.
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
    -- A booked deal is untouched, up or down (Piece 2 — a booked change re-derives the booking fee at once).
    IF public.vendor_requote_blocker(p_event_id, r.vendor_profile_id) IS NOT DISTINCT FROM 'deal_locked' THEN
      CONTINUE;
    END IF;

    SELECT ev.vendor_id INTO v_ev
      FROM public.event_vendors ev
     WHERE ev.event_id = p_event_id
       AND ev.marketplace_vendor_id = r.vendor_profile_id
       AND ev.archived_at IS NULL
       AND (ev.package_role IS NULL OR ev.package_role = 'anchor')
     ORDER BY public.event_vendor_counts_per_head(ev.vendor_id) DESC, ev.created_at
     LIMIT 1;

    v_locked   := r.locked;
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
         AND ev.status NOT IN ('contracted', 'deposit_paid', 'delivered', 'complete');
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

-- ── 4 · A "Not counted for ▾" tick lowers one service's count — it moves the quote now too ─────────────────────────
DROP TRIGGER IF EXISTS guest_not_counted_for_moves_the_quote_ins ON public.guest_not_counted_for;
CREATE TRIGGER guest_not_counted_for_moves_the_quote_ins AFTER INSERT ON public.guest_not_counted_for
  REFERENCING NEW TABLE AS new_rows FOR EACH STATEMENT EXECUTE FUNCTION public.tg_guest_list_moves_the_quote();

COMMENT ON FUNCTION public.quote_follow_guest_count(UUID) IS
  'Piece 1 · PR-2 + the fall-back (owner 2026-11-12): every standing, not-yet-booked quote of the event whose lines carry their own per-head rate follows the per-service count. Unlocked: up and down, floored at merge_snapshot.min_pax and the pax it was first sent at (sent_billed_pax), each line never under its sent amount. changes_locked: rises only. Rise → latest unpaid auto Final balance; drop → off the unpaid auto rows only, capped at what is unsettled (never below paid, never a credit). Same row updated, accepted → event_vendors.total_cost_php follows, one chat line. TS mirror lib/quote-pax-follow.ts. Migrations 20271339826198 + 20271340566104.';

COMMIT;
