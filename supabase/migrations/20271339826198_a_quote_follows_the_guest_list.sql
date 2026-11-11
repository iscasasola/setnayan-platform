-- a_quote_follows_the_guest_list
-- Created via `pnpm migration:new`. Prefix auto-allocated to sort AFTER every
-- existing migration. KEEP THIS MIGRATION IDEMPOTENT (it may be re-applied).
--
-- 👥💸 A QUOTE FOLLOWS THE GUEST LIST — Piece 1 · PR-2 (specs
-- `Build_Quote_Negotiation_2026-11-12/BUILD-PIECE1-QUOTE-NEGOTIATION.md` § 2–4; DECISION_LOG 2026-11-12 rows
-- "Quotation maker pax follows…", "Follow-up to the quote-pax ruling", "Three quote rulings", "QUOTE MONEY — THREE
-- ANSWERS", "A LOCKED QUOTATION STILL FOLLOWS THE GUEST LIST", "THE QUOTE FOLLOWS EACH SERVICE'S OWN COUNT").
--
-- Owner, verbatim: *"our quotation maker will follow their pax at auto. but they will set the minimum count for their
-- pax. it only goes up as their guests go up."* · a sent/accepted quote re-prices UPWARD by itself, never below what
-- was sent or the minimum · *"paid amounts are never touched; only what is still to be settled changes"* · the
-- supplier's Quotation lock stops the couple's asks only — the price still follows the list.
--
-- ── WHAT `quote_follow_guest_count(event_id)` DOES ─────────────────────────────────────────────────────────────────
--   For every STANDING quote of the event (status sent · viewed · accepted) that carries its own per-head rate data:
--     · BOOKED deals are untouched (`vendor_requote_blocker` = 'deal_locked'). A booked rise would fire
--       `booking_fee_rederive_on_amendment` at once, which breaks "the extra fee is held until event day" — those rises
--       ship with Piece 2.
--     · a `changes_locked` quote STILL rises (the lock is the couple's asks, never the guest list).
--     · count = the per-service count: the guest list on the event's headcount basis (the same filters as
--       `lib/pax.ts` liveHeadcount) minus the guests left out of THIS service (`guests_not_counted_for_services` —
--       the "Not counted for ▾" ticks and the service's count rule).
--     · billed = max(count, the quote's Bill-at-least `merge_snapshot.min_pax`, the billed pax it already carries).
--     · each per-head line → max(its amount, rate × billed). Flat lines never move. So the total NEVER drops, and is
--       never below the minimum or below what was sent.
--     · the rise lands on the AUTO Final-balance row of the plan; every other row (and every paid row) is untouched.
--       If the auto row is paid already, a new auto row takes the rise.
--     · the SAME proposal row is updated (never a new version: `supersede_prior_vendor_proposals` would reset the
--       acceptance; owner: the couple is told, not asked).
--     · an accepted quote's `event_vendors.total_cost_php` follows (the accept wrote it); `pax_quote_base` becomes the
--       billed count and `pax_surcharge_php` stays 0, so the old added-guest surcharge can never charge it twice.
--     · one line in the conversation: "Quote rose to N pax · +₱X" (both the couple and the supplier read the thread).
--
-- ── NEVER A GUESSED NUMBER ── the rate comes from the quote's own line (`line_items[].basis = 'per_pax'` +
--    `rate_centavos`, written by the quote maker — Piece 1 · PR-1). A quote without that data (every quote sent before
--    PR-1) is never repriced: no rate is read from the service card or invented.
--
-- ── RETIRES THE SECOND PAX MECHANISM for these quotes ── `event_vendors_pax_follow_owns_the_count` refuses a
--    non-zero `pax_surcharge_php` on a not-yet-booked row whose standing quote follows the list.
--
-- Called from: `tg_events_keep_booking_history` (the guest estimate / final count), and statement-level triggers on
-- `guests`, `guest_not_counted_for` and `event_vendor_count_rules` — the guest list is the control. Each call is
-- wrapped: a repricer fault WARNs and never refuses the couple's guest-list write.
--
-- TS mirror: apps/web/lib/quote-pax-follow.ts. Held by apps/web/tests/db/a-quote-follows-the-guest-list.db.test.ts
-- (SQL and TS agree) and apps/web/lib/quote-pax-follow.test.ts.

BEGIN;

-- ── 1 · Does this quote carry its own per-head rate? ───────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.quote_follows_guest_list(p_line_items JSONB)
RETURNS BOOLEAN
LANGUAGE sql
IMMUTABLE
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1
      FROM jsonb_array_elements(CASE WHEN jsonb_typeof(p_line_items) = 'array' THEN p_line_items ELSE '[]'::jsonb END) l
     WHERE l ->> 'basis' = 'per_pax'
       AND jsonb_typeof(l -> 'rate_centavos') = 'number'
       AND (l ->> 'rate_centavos')::NUMERIC > 0
       AND jsonb_typeof(l -> 'amount_centavos') = 'number'
  );
$$;
REVOKE ALL ON FUNCTION public.quote_follows_guest_list(JSONB) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.quote_follows_guest_list(JSONB) TO service_role;

-- ── 2 · The per-service count ──────────────────────────────────────────────────────────────────────────────────────
-- The event's headcount basis over the counted guests (lib/pax.ts liveHeadcount: not removed, not a request, not
-- passed away, not represented by a proxy), minus the guests this booking leaves out. No booking → nobody left out.
-- Returns a NUMBER only (no guest ids), and no browser role may call it.
CREATE OR REPLACE FUNCTION public.quote_guest_count(p_event_id UUID, p_event_vendor_id UUID)
RETURNS INTEGER
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  WITH out AS (
    SELECT CASE WHEN p_event_vendor_id IS NULL THEN ARRAY[]::UUID[]
                ELSE public.guests_not_counted_for_services(p_event_id, ARRAY[p_event_vendor_id]) END AS ids
  )
  SELECT COUNT(*)::INT
    FROM public.guests g
    JOIN public.events e ON e.event_id = g.event_id
    CROSS JOIN out
   WHERE g.event_id = p_event_id
     AND g.deleted_at IS NULL
     AND g.entry_source <> 'self_added_unlisted'
     AND NOT g.passed_away
     AND g.represented_by_guest_id IS NULL
     AND CASE COALESCE(e.headcount_basis, 'attending')
           WHEN 'invited' THEN g.rsvp_status <> 'declined'
           WHEN 'attending_plus_maybe' THEN g.rsvp_status IN ('attending', 'maybe')
           ELSE g.rsvp_status = 'attending'
         END
     AND g.guest_id <> ALL (out.ids);
$$;
REVOKE ALL ON FUNCTION public.quote_guest_count(UUID, UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.quote_guest_count(UUID, UUID) TO service_role;

-- ── 3 · The repricer ───────────────────────────────────────────────────────────────────────────────────────────────
-- Returns how many quotes rose. Upward only.
CREATE OR REPLACE FUNCTION public.quote_follow_guest_count(p_event_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  r          RECORD;
  v_ev       UUID;
  v_count    INTEGER;
  v_min      INTEGER;
  v_prior    INTEGER;
  v_billed   INTEGER;
  v_lines    JSONB;
  v_delta    BIGINT;
  v_sched    JSONB;
  v_inst     JSONB;
  v_paid     INTEGER[];
  v_auto     INTEGER;
  v_new_tot  BIGINT;
  v_rose     INTEGER := 0;
BEGIN
  IF p_event_id IS NULL THEN
    RETURN 0;
  END IF;

  FOR r IN
    SELECT vp.proposal_id, vp.vendor_profile_id, vp.status, vp.line_items, vp.total_centavos,
           vp.payment_schedule, COALESCE(vp.merge_snapshot, '{}'::jsonb) AS snap
      FROM public.vendor_proposals vp
     WHERE vp.event_id = p_event_id
       AND vp.status IN ('sent', 'viewed', 'accepted')
       AND public.quote_follows_guest_list(vp.line_items)
     ORDER BY vp.created_at
       FOR UPDATE
  LOOP
    -- A booked deal is untouched (Piece 2 — a booked rise re-derives the booking fee at once).
    IF public.vendor_requote_blocker(p_event_id, r.vendor_profile_id) IS NOT DISTINCT FROM 'deal_locked' THEN
      CONTINUE;
    END IF;

    -- The booking the per-service count is read for (a per-head one first).
    SELECT ev.vendor_id INTO v_ev
      FROM public.event_vendors ev
     WHERE ev.event_id = p_event_id
       AND ev.marketplace_vendor_id = r.vendor_profile_id
       AND ev.archived_at IS NULL
       AND (ev.package_role IS NULL OR ev.package_role = 'anchor')
     ORDER BY public.event_vendor_counts_per_head(ev.vendor_id) DESC, ev.created_at
     LIMIT 1;

    v_count := public.quote_guest_count(p_event_id, v_ev);
    v_min   := CASE WHEN jsonb_typeof(r.snap -> 'min_pax') = 'number' THEN GREATEST(0, floor((r.snap ->> 'min_pax')::NUMERIC)::INT) ELSE 0 END;
    v_prior := CASE WHEN jsonb_typeof(r.snap -> 'billed_pax') = 'number' THEN GREATEST(0, floor((r.snap ->> 'billed_pax')::NUMERIC)::INT) ELSE 0 END;
    v_billed := GREATEST(v_count, v_min, v_prior);

    -- Each per-head line → max(its amount, rate × billed); flat lines as they are.
    SELECT COALESCE(jsonb_agg(
             CASE
               WHEN x.l ->> 'basis' = 'per_pax'
                AND jsonb_typeof(x.l -> 'rate_centavos') = 'number'
                AND (x.l ->> 'rate_centavos')::NUMERIC > 0
                AND jsonb_typeof(x.l -> 'amount_centavos') = 'number'
                AND round((x.l ->> 'rate_centavos')::NUMERIC) * v_billed > (x.l ->> 'amount_centavos')::NUMERIC
               THEN x.l || jsonb_build_object(
                      'amount_centavos', (round((x.l ->> 'rate_centavos')::NUMERIC) * v_billed)::BIGINT,
                      'pax', v_billed,
                      'detail', to_char(v_billed, 'FM999,999,990') || ' pax × '
                                || public.booking_change_php_words(round((x.l ->> 'rate_centavos')::NUMERIC) / 100.0))
               ELSE x.l
             END ORDER BY x.n), '[]'::jsonb),
           COALESCE(SUM(
             CASE
               WHEN x.l ->> 'basis' = 'per_pax'
                AND jsonb_typeof(x.l -> 'rate_centavos') = 'number'
                AND (x.l ->> 'rate_centavos')::NUMERIC > 0
                AND jsonb_typeof(x.l -> 'amount_centavos') = 'number'
               THEN GREATEST(0, round((x.l ->> 'rate_centavos')::NUMERIC) * v_billed - (x.l ->> 'amount_centavos')::NUMERIC)
               ELSE 0
             END), 0)::BIGINT
      INTO v_lines, v_delta
      FROM jsonb_array_elements(r.line_items) WITH ORDINALITY AS x(l, n);

    IF v_delta <= 0 THEN
      CONTINUE; -- never down, never sideways
    END IF;
    v_new_tot := r.total_centavos + v_delta;

    -- The plan: the rise lands on the auto Final balance; paid rows never change.
    v_sched := r.payment_schedule;
    IF jsonb_typeof(v_sched -> 'installments') = 'array'
       AND jsonb_array_length(v_sched -> 'installments') > 0 THEN
      SELECT COALESCE(ARRAY_AGG(DISTINCT p.schedule_instance_seq), ARRAY[]::INTEGER[])
        INTO v_paid
        FROM public.event_vendor_payments p
        JOIN public.event_vendors ev ON ev.vendor_id = p.vendor_id
       WHERE ev.event_id = p_event_id
         AND ev.marketplace_vendor_id = r.vendor_profile_id
         AND p.schedule_instance_seq IS NOT NULL
         AND p.payment_refused_at IS NULL;

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
        -- No unpaid auto row: a new one takes the rise (the shipped default's words and timing).
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

    PERFORM public.chat_record_post_line(
      p_event_id, r.vendor_profile_id,
      public.quote_rise_words(v_billed, v_delta),
      'Quote rose to ' || to_char(v_billed, 'FM999,999,990') || ' pax');
    v_rose := v_rose + 1;
  END LOOP;

  RETURN v_rose;
END;
$$;
REVOKE ALL ON FUNCTION public.quote_follow_guest_count(UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.quote_follow_guest_count(UUID) TO service_role;

-- The chat line, in one place (lib/chat-card-lines.ts `quoteRiseFromLine` reads exactly these words).
CREATE OR REPLACE FUNCTION public.quote_rise_words(p_pax INTEGER, p_delta_centavos BIGINT)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
SET search_path = public, pg_temp
AS $$
  SELECT 'Quote rose to ' || to_char(p_pax, 'FM999,999,990') || ' pax · +'
         || public.booking_change_php_words(p_delta_centavos / 100.0);
$$;
REVOKE ALL ON FUNCTION public.quote_rise_words(INTEGER, BIGINT) FROM PUBLIC, anon, authenticated;

-- A wrapper that never refuses the guest-list write that called it.
CREATE OR REPLACE FUNCTION public.quote_follow_guest_count_quietly(p_event_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  PERFORM public.quote_follow_guest_count(p_event_id);
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'quote_follow_guest_count event %: % %', p_event_id, SQLSTATE, SQLERRM;
END;
$$;
REVOKE ALL ON FUNCTION public.quote_follow_guest_count_quietly(UUID) FROM PUBLIC, anon, authenticated;

-- ── 4 · Who calls it: the events trigger (the estimate / final count) ─────────────────────────────────────────────
-- 20271329937802's body, unchanged, plus § "the quote follows" at the end.
CREATE OR REPLACE FUNCTION public.tg_events_keep_booking_history()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid      UUID := auth.uid();
  v_old_date TEXT;
  v_new_date TEXT;
BEGIN
  -- ── the date ──
  BEGIN
    v_old_date := public.booking_change_date_text(OLD.event_date, OLD.event_date_precision);
    v_new_date := public.booking_change_date_text(NEW.event_date, NEW.event_date_precision);
    IF v_old_date IS DISTINCT FROM v_new_date THEN
      INSERT INTO public.booking_changes (event_id, field, from_value, to_value, changed_by)
      VALUES (NEW.event_id, 'event_date', v_old_date, v_new_date, v_uid);

      PERFORM public.chat_record_post_event_line(NEW.event_id,
        CASE
          WHEN OLD.event_date IS NULL THEN
            'Event date set · ' || public.booking_change_date_words(NEW.event_date, NEW.event_date_precision)
          WHEN NEW.event_date IS NULL THEN
            'Event date cleared · it was ' || public.booking_change_date_words(OLD.event_date, OLD.event_date_precision)
          ELSE
            'Event date changed · ' || public.booking_change_date_words(OLD.event_date, OLD.event_date_precision)
              || ' → ' || public.booking_change_date_words(NEW.event_date, NEW.event_date_precision)
        END);
    END IF;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'tg_events_keep_booking_history (date) event %: % %', NEW.event_id, SQLSTATE, SQLERRM;
  END;

  -- ── the host's guest estimate ──
  BEGIN
    IF NEW.estimated_pax IS DISTINCT FROM OLD.estimated_pax THEN
      INSERT INTO public.booking_changes (event_id, field, from_value, to_value, changed_by)
      VALUES (NEW.event_id, 'guest_estimate', OLD.estimated_pax::TEXT, NEW.estimated_pax::TEXT, v_uid);

      -- While the list is finalized the binding count is final_pax and the
      -- estimate moves nothing a supplier prices on — logged, not announced.
      IF NEW.final_pax IS NULL AND NEW.guest_count_locked_at IS NULL THEN
        PERFORM public.chat_record_post_event_line(NEW.event_id,
          CASE
            WHEN NEW.estimated_pax IS NULL THEN 'Guest count cleared · it was ' || OLD.estimated_pax || ' guests'
            WHEN OLD.estimated_pax IS NULL THEN 'Guest count set · ' || NEW.estimated_pax || ' guests'
            ELSE 'Guest count changed · ' || OLD.estimated_pax || ' → ' || NEW.estimated_pax || ' guests'
          END);
      END IF;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'tg_events_keep_booking_history (estimate) event %: % %', NEW.event_id, SQLSTATE, SQLERRM;
  END;

  -- ── the finalized count ──
  BEGIN
    IF NEW.final_pax IS DISTINCT FROM OLD.final_pax THEN
      INSERT INTO public.booking_changes (event_id, field, from_value, to_value, changed_by)
      VALUES (NEW.event_id, 'guest_count_final', OLD.final_pax::TEXT, NEW.final_pax::TEXT, v_uid);

      PERFORM public.chat_record_post_event_line(NEW.event_id,
        CASE
          WHEN NEW.final_pax IS NULL THEN 'Guest list reopened · the guest count is live again'
          WHEN OLD.final_pax IS NULL THEN 'Guest list finalized · ' || NEW.final_pax || ' guests'
          ELSE 'Final guest count changed · ' || OLD.final_pax || ' → ' || NEW.final_pax || ' guests'
        END);
    END IF;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'tg_events_keep_booking_history (final) event %: % %', NEW.event_id, SQLSTATE, SQLERRM;
  END;

  -- ── the quote follows (PR-2, 20271339826198) — after the count's own line, so the chat reads in order ──
  IF NEW.estimated_pax IS DISTINCT FROM OLD.estimated_pax OR NEW.final_pax IS DISTINCT FROM OLD.final_pax THEN
    PERFORM public.quote_follow_guest_count_quietly(NEW.event_id);
  END IF;

  RETURN NULL;
END;
$$;
REVOKE ALL ON FUNCTION public.tg_events_keep_booking_history() FROM PUBLIC, anon, authenticated;

-- ── 5 · …and the guest list itself (statement level: one call per event per write, however many rows) ────────────
CREATE OR REPLACE FUNCTION public.tg_guest_list_moves_the_quote()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_event UUID;
BEGIN
  IF TG_OP = 'DELETE' THEN
    FOR v_event IN SELECT DISTINCT o.event_id FROM old_rows o WHERE o.event_id IS NOT NULL LOOP
      PERFORM public.quote_follow_guest_count_quietly(v_event);
    END LOOP;
  ELSE
    FOR v_event IN SELECT DISTINCT n.event_id FROM new_rows n WHERE n.event_id IS NOT NULL LOOP
      PERFORM public.quote_follow_guest_count_quietly(v_event);
    END LOOP;
  END IF;
  RETURN NULL;
END;
$$;
REVOKE ALL ON FUNCTION public.tg_guest_list_moves_the_quote() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS guests_move_the_quote_ins ON public.guests;
CREATE TRIGGER guests_move_the_quote_ins AFTER INSERT ON public.guests
  REFERENCING NEW TABLE AS new_rows FOR EACH STATEMENT EXECUTE FUNCTION public.tg_guest_list_moves_the_quote();
DROP TRIGGER IF EXISTS guests_move_the_quote_upd ON public.guests;
CREATE TRIGGER guests_move_the_quote_upd AFTER UPDATE ON public.guests
  REFERENCING NEW TABLE AS new_rows FOR EACH STATEMENT EXECUTE FUNCTION public.tg_guest_list_moves_the_quote();
DROP TRIGGER IF EXISTS guests_move_the_quote_del ON public.guests;
CREATE TRIGGER guests_move_the_quote_del AFTER DELETE ON public.guests
  REFERENCING OLD TABLE AS old_rows FOR EACH STATEMENT EXECUTE FUNCTION public.tg_guest_list_moves_the_quote();

-- An untick (or a widened count rule) can raise one service's count.
DROP TRIGGER IF EXISTS guest_not_counted_for_moves_the_quote ON public.guest_not_counted_for;
CREATE TRIGGER guest_not_counted_for_moves_the_quote AFTER DELETE ON public.guest_not_counted_for
  REFERENCING OLD TABLE AS old_rows FOR EACH STATEMENT EXECUTE FUNCTION public.tg_guest_list_moves_the_quote();
DROP TRIGGER IF EXISTS event_vendor_count_rules_move_the_quote_ins ON public.event_vendor_count_rules;
CREATE TRIGGER event_vendor_count_rules_move_the_quote_ins AFTER INSERT ON public.event_vendor_count_rules
  REFERENCING NEW TABLE AS new_rows FOR EACH STATEMENT EXECUTE FUNCTION public.tg_guest_list_moves_the_quote();
DROP TRIGGER IF EXISTS event_vendor_count_rules_move_the_quote_upd ON public.event_vendor_count_rules;
CREATE TRIGGER event_vendor_count_rules_move_the_quote_upd AFTER UPDATE ON public.event_vendor_count_rules
  REFERENCING NEW TABLE AS new_rows FOR EACH STATEMENT EXECUTE FUNCTION public.tg_guest_list_moves_the_quote();
DROP TRIGGER IF EXISTS event_vendor_count_rules_move_the_quote_del ON public.event_vendor_count_rules;
CREATE TRIGGER event_vendor_count_rules_move_the_quote_del AFTER DELETE ON public.event_vendor_count_rules
  REFERENCING OLD TABLE AS old_rows FOR EACH STATEMENT EXECUTE FUNCTION public.tg_guest_list_moves_the_quote();

-- ── 6 · Retire the added-guest surcharge where the quote follows the list (one mechanism, never two) ─────────────
CREATE OR REPLACE FUNCTION public.event_vendors_pax_follow_owns_the_count()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF COALESCE(NEW.pax_surcharge_php, 0) <> 0
     AND NEW.pax_surcharge_php IS DISTINCT FROM OLD.pax_surcharge_php
     AND NEW.status NOT IN ('contracted', 'deposit_paid', 'delivered', 'complete')
     AND NEW.marketplace_vendor_id IS NOT NULL
     AND EXISTS (
       SELECT 1 FROM public.vendor_proposals vp
        WHERE vp.event_id = NEW.event_id
          AND vp.vendor_profile_id = NEW.marketplace_vendor_id
          AND vp.status IN ('sent', 'viewed', 'accepted')
          AND public.quote_follows_guest_list(vp.line_items)) THEN
    RAISE EXCEPTION 'event_vendors: PAX_FOLLOWED_BY_QUOTE — this quote already follows the guest list; no added-guest charge on top'
      USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.event_vendors_pax_follow_owns_the_count() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS event_vendors_pax_follow_owns_the_count ON public.event_vendors;
CREATE TRIGGER event_vendors_pax_follow_owns_the_count
  BEFORE UPDATE OF pax_surcharge_php ON public.event_vendors
  FOR EACH ROW EXECUTE FUNCTION public.event_vendors_pax_follow_owns_the_count();

COMMENT ON FUNCTION public.quote_follow_guest_count(UUID) IS
  'Piece 1 · PR-2 (owner 2026-11-12): every standing, not-yet-booked quote of the event whose lines carry their own per-head rate rises (never falls) to max(per-service count, merge_snapshot.min_pax, billed_pax); the rise lands on the auto Final balance, paid rows untouched, same row updated, accepted → event_vendors.total_cost_php follows, one chat line. TS mirror lib/quote-pax-follow.ts. Migration 20271339826198.';

COMMIT;
