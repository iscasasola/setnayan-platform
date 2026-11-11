-- a_counter_a_plan_and_one_tap_accept
-- Created via `pnpm migration:new`. KEEP THIS MIGRATION IDEMPOTENT.
-- ════════════════════════════════════════════════════════════════════════════
-- PIECE 1 · PR-3 — COUNTER WITH A PRICE · PROPOSE A PAYMENT PLAN · ONE-TAP ACCEPT
-- (plan controller-2026-11-11/BUILD-PIECE1-QUOTE-NEGOTIATION.md; approved design quote-maker-polish.html;
--  DECISION_LOG 2026-11-12 "QUOTE MONEY — THREE ANSWERS" (2) and "FIVE GUARDS").
--
-- RULE 0: this EXTENDS the shipped Ask-for-a-change record (`booking_change_asks`, migration 20271332041210) —
-- no new table. An ask stays "words only" when it carries neither an amount nor a plan; a COUNTER carries
-- `amount_centavos` (the whole quote, or one line named by `scope_label`), a PLAN PROPOSAL carries `proposed_plan`.
-- Either side may raise a counter or a plan (`raised_by`); only the hosts' side raises a words-only ask.
--
-- ONE-TAP ACCEPT WRITES EXACTLY ONE VERSION, in one transaction (`change_ask_write_version`, internal):
--   • the counter is accepted by the OTHER side; it must still be about the LIVE quote (QUOTE_MOVED otherwise),
--     never on a locked item (ITEM_LOCKED), never on a booked deal (DEAL_LOCKED — booked deals keep the amendments
--     path), never once its Good until has passed (COUNTER_EXPIRED — "Expired · ask again" is derived, no job).
--   • the new version is the live one with the counter applied: the whole quote → one "Counter accepted" line
--     carries the difference; one line → that line's amount is replaced.
--   • THE PLAN RE-SPLITS, PAID ROWS NEVER CHANGE (owner 12 Nov (3): "paid amounts are never touched; only what is
--     still to be settled changes"): `change_ask_resplit` moves only UNPAID rows — a rise lands on the Final balance,
--     a drop comes off the Final balance first, then the latest unpaid rows. No row ever goes below zero.
--   • 💸 FIVE GUARDS (owner 12 Nov): a drop that would go under what was already PAID is money OWED BACK to the
--     couple, never a negative row — `change_ask_resplit` returns it as `owed_back_centavos`, and the accept is
--     refused (BELOW_WHAT_WAS_PAID) because the paid quotation is the floor (DECISION_LOG 2026-11-08 🧾, held by
--     `vendor_proposals_money_rules`). Note to the owner: under the 8 Nov floor a version can never go under what
--     was paid, so "owed back" is shown, not written.
--   • 🤝 owner 12 Nov (2): "when the supplier accepts the couple's counter, the new version lands ACCEPTED (the
--     counter is the couple's yes)". A supplier's counter accepted by the hosts is their yes too — it lands
--     ACCEPTED either way, stamped as the hosts' acceptance (`resolved_by_user_id` = the host who said yes).
--   • the money write is the record_agreed_price_change pattern: the caller is PROVED (auth.uid() against the ask,
--     the thread and the shop) inside a SECURITY DEFINER function; the money itself is never taken from the browser —
--     a counter's amount and a plan's rows were fixed when the OTHER side raised them and are re-checked here.
--
-- RLS is unchanged (members read; only these functions write). No new FK to auth.users (actor stamps stay un-keyed).
-- Never applied by hand — the pipeline's `supabase db push --include-all`.
-- ════════════════════════════════════════════════════════════════════════════

BEGIN;

-- ── 1 · The record grows: a counter, a plan, a Good until, who raised it, and the version an accept wrote ──
ALTER TABLE public.booking_change_asks
  ADD COLUMN IF NOT EXISTS amount_centavos     BIGINT,
  ADD COLUMN IF NOT EXISTS scope_label         TEXT,
  ADD COLUMN IF NOT EXISTS proposed_plan       JSONB,
  ADD COLUMN IF NOT EXISTS good_until          DATE,
  ADD COLUMN IF NOT EXISTS raised_by           TEXT NOT NULL DEFAULT 'host',
  ADD COLUMN IF NOT EXISTS answer_proposal_id  UUID REFERENCES public.vendor_proposals(proposal_id) ON DELETE SET NULL;

ALTER TABLE public.booking_change_asks DROP CONSTRAINT IF EXISTS booking_change_asks_raised_by_check;
ALTER TABLE public.booking_change_asks
  ADD CONSTRAINT booking_change_asks_raised_by_check CHECK (raised_by IN ('host', 'supplier'));

ALTER TABLE public.booking_change_asks DROP CONSTRAINT IF EXISTS booking_change_asks_status_check;
ALTER TABLE public.booking_change_asks
  ADD CONSTRAINT booking_change_asks_status_check
  CHECK (status IN ('open', 'revised', 'declined', 'accepted', 'countered'));

-- A counter or a plan may come without words; a words-only ask still needs them.
ALTER TABLE public.booking_change_asks DROP CONSTRAINT IF EXISTS booking_change_asks_note_check;
ALTER TABLE public.booking_change_asks DROP CONSTRAINT IF EXISTS booking_change_asks_note_is_said;
ALTER TABLE public.booking_change_asks
  ADD CONSTRAINT booking_change_asks_note_is_said CHECK (
    char_length(note) <= 1000
    AND (char_length(btrim(note)) >= 1 OR amount_centavos IS NOT NULL OR proposed_plan IS NOT NULL)
  );

-- What a counter / plan is, whole: a counter is on the quote with an amount above ₱0; a plan is on the plan; never both.
ALTER TABLE public.booking_change_asks DROP CONSTRAINT IF EXISTS booking_change_asks_counter_is_whole;
ALTER TABLE public.booking_change_asks
  ADD CONSTRAINT booking_change_asks_counter_is_whole CHECK (
    (amount_centavos IS NULL OR (amount_centavos > 0 AND subject = 'quote' AND proposed_plan IS NULL))
    AND (proposed_plan IS NULL OR subject = 'plan')
    AND (scope_label IS NULL OR (amount_centavos IS NOT NULL AND char_length(btrim(scope_label)) BETWEEN 1 AND 200))
    AND (raised_by = 'host' OR amount_centavos IS NOT NULL OR proposed_plan IS NOT NULL)
  );

COMMENT ON COLUMN public.booking_change_asks.amount_centavos IS
  'A COUNTER (owner 12 Nov design): the price asked for — the whole quote, or the one line named by scope_label. NULL = not a counter. Migration 20271340018194.';
COMMENT ON COLUMN public.booking_change_asks.scope_label IS
  'The quote line a counter is about (its label), or NULL = the whole quote. Migration 20271340018194.';
COMMENT ON COLUMN public.booking_change_asks.proposed_plan IS
  'A PLAN PROPOSAL: the payment rows proposed instead ({installments:[{seq,label,amount_centavos,…}]}), paying the live quote total in full with every paid row unchanged. NULL = not a plan proposal. Migration 20271340018194.';
COMMENT ON COLUMN public.booking_change_asks.good_until IS
  'The last day a counter or plan may be accepted (Asia/Manila). After it the card reads "Expired · ask again" — derived, never written. NULL = no limit. Migration 20271340018194.';
COMMENT ON COLUMN public.booking_change_asks.raised_by IS
  'Which side raised it: host (the hosts and the coordinator) or supplier (a counter back, or a plan the supplier proposes). The OTHER side answers. Migration 20271340018194.';
COMMENT ON COLUMN public.booking_change_asks.answer_proposal_id IS
  'The ONE quote version an accept wrote (status accepted). Migration 20271340018194.';

-- ── 2 · The plan re-splits — paid rows never change, no row below zero (pure; mirrored by resplitAfterCounter) ──
CREATE OR REPLACE FUNCTION public.change_ask_resplit(p_installments JSONB, p_new_total BIGINT, p_paid_seqs INTEGER[])
RETURNS JSONB
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $$
DECLARE
  v_rows   JSONB := COALESCE(p_installments, '[]'::jsonb);
  v_sum    BIGINT;
  v_delta  BIGINT;
  v_need   BIGINT;
  v_take   BIGINT;
  v_amt    BIGINT;
  v_idx    INTEGER;
  v_target INTEGER;
  v_max    INTEGER;
  r        RECORD;
BEGIN
  IF jsonb_typeof(v_rows) <> 'array' THEN
    v_rows := '[]'::jsonb;
  END IF;
  -- Rows in seq order (the payments reference schedule_instance_seq, so seqs are never renumbered).
  SELECT COALESCE(jsonb_agg(e ORDER BY (e ->> 'seq')::INTEGER), '[]'::jsonb) INTO v_rows FROM jsonb_array_elements(v_rows) e;
  SELECT COALESCE(SUM((e ->> 'amount_centavos')::BIGINT), 0), COALESCE(MAX((e ->> 'seq')::INTEGER), -1)
    INTO v_sum, v_max FROM jsonb_array_elements(v_rows) e;
  v_delta := GREATEST(0, p_new_total) - v_sum;

  IF v_delta > 0 THEN
    -- A rise lands on the unpaid Final balance; else on the latest unpaid row; else a new Final balance row.
    SELECT o - 1 INTO v_target
      FROM jsonb_array_elements(v_rows) WITH ORDINALITY AS t(e, o)
     WHERE NOT ((e ->> 'seq')::INTEGER = ANY (COALESCE(p_paid_seqs, '{}')))
     ORDER BY COALESCE((e ->> 'is_auto_balance')::BOOLEAN, FALSE) DESC, (e ->> 'seq')::INTEGER DESC
     LIMIT 1;
    IF v_target IS NULL THEN
      v_rows := v_rows || jsonb_build_array(jsonb_build_object(
        'seq', v_max + 1, 'label', 'Final balance', 'kind', 'auto', 'amount_centavos', v_delta, 'raw_centavos', v_delta,
        'percent_bps', NULL, 'due', 'before_event', 'offset_days', 7, 'is_downpayment', v_max < 0,
        'is_auto_balance', TRUE, 'credit_applied_centavos', 0));
    ELSE
      v_amt := (v_rows -> v_target ->> 'amount_centavos')::BIGINT + v_delta;
      v_rows := jsonb_set(jsonb_set(v_rows, ARRAY[v_target::TEXT, 'amount_centavos'], to_jsonb(v_amt)),
                          ARRAY[v_target::TEXT, 'raw_centavos'],
                          to_jsonb(COALESCE((v_rows -> v_target ->> 'raw_centavos')::BIGINT, v_amt - v_delta) + v_delta));
    END IF;
    RETURN jsonb_build_object('installments', v_rows, 'owed_back_centavos', 0);
  END IF;

  -- A drop comes off unpaid rows only: the Final balance first, then the latest unpaid rows. Never below zero.
  v_need := -v_delta;
  FOR r IN
    SELECT o - 1 AS idx
      FROM jsonb_array_elements(v_rows) WITH ORDINALITY AS t(e, o)
     WHERE NOT ((e ->> 'seq')::INTEGER = ANY (COALESCE(p_paid_seqs, '{}')))
     ORDER BY COALESCE((e ->> 'is_auto_balance')::BOOLEAN, FALSE) DESC, (e ->> 'seq')::INTEGER DESC
  LOOP
    EXIT WHEN v_need <= 0;
    v_idx := r.idx;
    v_amt := GREATEST(0, (v_rows -> v_idx ->> 'amount_centavos')::BIGINT);
    v_take := LEAST(v_amt, v_need);
    v_rows := jsonb_set(jsonb_set(v_rows, ARRAY[v_idx::TEXT, 'amount_centavos'], to_jsonb(v_amt - v_take)),
                        ARRAY[v_idx::TEXT, 'raw_centavos'],
                        to_jsonb(GREATEST(0, COALESCE((v_rows -> v_idx ->> 'raw_centavos')::BIGINT, v_amt) - v_take)));
    v_need := v_need - v_take;
  END LOOP;
  -- 💸 What is left is more than what is still to be settled: it is money OWED BACK, never a negative row.
  RETURN jsonb_build_object('installments', v_rows, 'owed_back_centavos', GREATEST(0, v_need));
END;
$$;
REVOKE ALL ON FUNCTION public.change_ask_resplit(JSONB, BIGINT, INTEGER[]) FROM PUBLIC, anon, authenticated;
COMMENT ON FUNCTION public.change_ask_resplit(JSONB, BIGINT, INTEGER[]) IS
  'Internal, pure: re-split a stored plan''s rows to a new total. Paid rows (seq in p_paid_seqs) never change; a rise lands on the unpaid Final balance; a drop comes off the Final balance, then the latest unpaid rows; no row goes below zero — what is left is returned as owed_back_centavos (money owed back to the couple, owner 12 Nov "FIVE GUARDS"). Mirrored in TS by lib/chat-cards.ts resplitAfterCounter (the db test holds them equal). Migration 20271340018194.';

-- The plan rows already paid on this booking (a confirmed, unrefused payment carrying its schedule_instance_seq).
CREATE OR REPLACE FUNCTION public.change_ask_paid_seqs(p_event_id UUID, p_vendor_profile_id UUID)
RETURNS INTEGER[]
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(array_agg(DISTINCT p.schedule_instance_seq), '{}')
    FROM public.event_vendor_payments p
    JOIN public.event_vendors ev ON ev.vendor_id = p.vendor_id
   WHERE ev.event_id = p_event_id
     AND ev.marketplace_vendor_id = p_vendor_profile_id
     AND p.vendor_confirmed_at IS NOT NULL
     AND p.payment_refused_at IS NULL
     AND p.schedule_instance_seq IS NOT NULL;
$$;
REVOKE ALL ON FUNCTION public.change_ask_paid_seqs(UUID, UUID) FROM PUBLIC, anon, authenticated;

-- Why a proposed plan may not stand against the live quote, or NULL. Pays the total in full; every paid row unchanged.
CREATE OR REPLACE FUNCTION public.change_ask_plan_refusal(p_plan JSONB, p_live_schedule JSONB, p_total BIGINT, p_paid_seqs INTEGER[])
RETURNS TEXT
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $$
DECLARE
  v_rows JSONB := p_plan -> 'installments';
  v_sum  BIGINT;
  v_neg  INTEGER;
  v_seq  INTEGER;
BEGIN
  IF jsonb_typeof(v_rows) <> 'array' OR jsonb_array_length(v_rows) = 0 OR jsonb_array_length(v_rows) > 12 THEN
    RETURN 'BAD_PLAN';
  END IF;
  SELECT COALESCE(SUM((e ->> 'amount_centavos')::BIGINT), 0),
         COUNT(*) FILTER (WHERE (e ->> 'amount_centavos') IS NULL OR (e ->> 'amount_centavos')::BIGINT < 0)
    INTO v_sum, v_neg FROM jsonb_array_elements(v_rows) e;
  IF v_neg > 0 THEN
    RETURN 'BAD_PLAN';
  END IF;
  IF v_sum <> p_total THEN
    RETURN 'PLAN_DOES_NOT_PAY_IN_FULL';
  END IF;
  FOREACH v_seq IN ARRAY COALESCE(p_paid_seqs, '{}') LOOP
    IF NOT EXISTS (
      SELECT 1
        FROM jsonb_array_elements(v_rows) n
        JOIN jsonb_array_elements(COALESCE(p_live_schedule -> 'installments', '[]'::jsonb)) o
          ON (o ->> 'seq')::INTEGER = v_seq
       WHERE (n ->> 'seq')::INTEGER = v_seq
         AND (n ->> 'amount_centavos')::BIGINT = (o ->> 'amount_centavos')::BIGINT) THEN
      RETURN 'PAID_ROW_CHANGED';
    END IF;
  END LOOP;
  RETURN NULL;
END;
$$;
REVOKE ALL ON FUNCTION public.change_ask_plan_refusal(JSONB, JSONB, BIGINT, INTEGER[]) FROM PUBLIC, anon, authenticated;

-- "₱60,000" / "₱60,000.50" — the chat line's words.
CREATE OR REPLACE FUNCTION public.change_ask_peso(p_centavos BIGINT)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT '₱' || to_char(p_centavos / 100, 'FM999,999,999,990')
         || CASE WHEN p_centavos % 100 <> 0 THEN '.' || lpad((p_centavos % 100)::TEXT, 2, '0') ELSE '' END;
$$;
REVOKE ALL ON FUNCTION public.change_ask_peso(BIGINT) FROM PUBLIC, anon;

-- ── 3 · Ask · counter · propose a plan ────────────────────────────────────────
DROP FUNCTION IF EXISTS public.ask_for_a_change(UUID, TEXT, TEXT, UUID, UUID);

CREATE OR REPLACE FUNCTION public.ask_for_a_change(
  p_thread_id        UUID,
  p_subject          TEXT,
  p_note             TEXT,
  p_proposal_id      UUID DEFAULT NULL,
  p_form_id          UUID DEFAULT NULL,
  p_amount_centavos  BIGINT DEFAULT NULL,
  p_scope_label      TEXT DEFAULT NULL,
  p_proposed_plan    JSONB DEFAULT NULL,
  p_good_until       DATE DEFAULT NULL,
  p_counters         UUID DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid      UUID := auth.uid();
  v_thread   public.chat_threads%ROWTYPE;
  v_live     public.vendor_proposals%ROWTYPE;
  v_prior    public.booking_change_asks%ROWTYPE;
  v_locked   BOOLEAN := FALSE;
  v_supplier BOOLEAN;
  v_counter  BOOLEAN := p_amount_centavos IS NOT NULL;
  v_plan     BOOLEAN := p_proposed_plan IS NOT NULL;
  v_scope    TEXT := NULLIF(btrim(COALESCE(p_scope_label, '')), '');
  v_today    DATE := (NOW() AT TIME ZONE 'Asia/Manila')::DATE;
  v_line_amt BIGINT;
  v_new_tot  BIGINT;
  v_floor    BIGINT;
  v_refusal  TEXT;
  v_id       UUID;
  v_name     TEXT;
  v_what     TEXT;
  v_note     TEXT := btrim(COALESCE(p_note, ''));
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'ask_for_a_change: NOT_SIGNED_IN' USING ERRCODE = '42501';
  END IF;
  IF p_subject NOT IN ('quote', 'plan', 'form')
     OR char_length(v_note) > 1000
     OR (v_counter AND v_plan)
     OR (v_counter AND (p_subject <> 'quote' OR p_amount_centavos <= 0))
     OR (v_plan AND p_subject <> 'plan')
     OR (v_scope IS NOT NULL AND NOT v_counter)
     OR (NOT v_counter AND NOT v_plan AND char_length(v_note) < 1) THEN
    RAISE EXCEPTION 'ask_for_a_change: BAD_ASK — say what should change (1–1000 characters)' USING ERRCODE = '22023';
  END IF;
  SELECT * INTO v_thread FROM public.chat_threads WHERE thread_id = p_thread_id;
  IF v_thread.thread_id IS NULL THEN
    RAISE EXCEPTION 'ask_for_a_change: NOT_IN_THIS_CHAT' USING ERRCODE = '42501';
  END IF;
  v_supplier := v_thread.vendor_profile_id IN (SELECT public.current_vendor_ids())
             OR v_thread.vendor_profile_id IN (SELECT public.current_vendor_profile_ids());
  -- The shop never ASKS (it writes); it may counter a counter or propose a plan, both answered by the hosts.
  IF v_supplier AND NOT (v_counter OR v_plan) THEN
    RAISE EXCEPTION 'ask_for_a_change: NOT_THE_HOSTS_SIDE' USING ERRCODE = '42501';
  END IF;
  IF NOT v_supplier AND NOT (p_thread_id IN (SELECT public.current_thread_ids())) THEN
    RAISE EXCEPTION 'ask_for_a_change: NOT_IN_THIS_CHAT' USING ERRCODE = '42501';
  END IF;

  IF p_subject IN ('quote', 'plan') THEN
    IF p_proposal_id IS NULL THEN
      RAISE EXCEPTION 'ask_for_a_change: NO_QUOTE' USING ERRCODE = '22023';
    END IF;
    SELECT * INTO v_live
      FROM public.vendor_proposals vp
     WHERE vp.proposal_id = p_proposal_id
       AND vp.event_id = v_thread.event_id
       AND vp.vendor_profile_id = v_thread.vendor_profile_id;
    IF v_live.proposal_id IS NULL THEN
      RAISE EXCEPTION 'ask_for_a_change: NO_QUOTE' USING ERRCODE = '22023';
    END IF;
    v_locked := CASE WHEN p_subject = 'quote' THEN v_live.changes_locked ELSE v_live.plan_locked END;
  ELSE
    IF p_form_id IS NOT NULL THEN
      SELECT fs.locked INTO v_locked FROM public.event_form_sends fs
       WHERE fs.event_id = v_thread.event_id AND fs.form_id = p_form_id
         AND fs.vendor_profile_id = v_thread.vendor_profile_id;
    ELSE
      SELECT qr.locked INTO v_locked FROM public.event_question_requests qr
       WHERE qr.event_id = v_thread.event_id AND qr.vendor_profile_id = v_thread.vendor_profile_id;
    END IF;
    IF v_locked IS NULL THEN
      RAISE EXCEPTION 'ask_for_a_change: NO_FORM' USING ERRCODE = '22023';
    END IF;
  END IF;

  IF v_locked THEN
    RAISE EXCEPTION 'ask_for_a_change: ITEM_LOCKED — the supplier made this final' USING ERRCODE = 'P0001';
  END IF;

  IF v_counter OR v_plan THEN
    -- Only on the LIVE quote, never on a booked deal (booked deals keep the change-order path), never already lapsed.
    IF v_live.status NOT IN ('sent', 'viewed', 'accepted') OR EXISTS (
         SELECT 1 FROM public.vendor_proposals o
          WHERE o.event_id = v_live.event_id AND o.vendor_profile_id = v_live.vendor_profile_id
            AND o.status IN ('sent', 'viewed', 'accepted') AND o.created_at > v_live.created_at) THEN
      RAISE EXCEPTION 'ask_for_a_change: QUOTE_MOVED — the quote changed since; look at the new one' USING ERRCODE = '22023';
    END IF;
    IF public.vendor_requote_blocker(v_live.event_id, v_live.vendor_profile_id) IS NOT NULL THEN
      RAISE EXCEPTION 'ask_for_a_change: DEAL_LOCKED — this booking is confirmed; use a change order' USING ERRCODE = 'P0001';
    END IF;
    IF p_good_until IS NOT NULL AND p_good_until < v_today THEN
      RAISE EXCEPTION 'ask_for_a_change: GOOD_UNTIL_PAST' USING ERRCODE = '22023';
    END IF;
  END IF;

  IF v_counter THEN
    v_new_tot := p_amount_centavos;
    IF v_scope IS NOT NULL THEN
      SELECT (e ->> 'amount_centavos')::BIGINT INTO v_line_amt
        FROM jsonb_array_elements(COALESCE(v_live.line_items, '[]'::jsonb)) e
       WHERE lower(btrim(e ->> 'label')) = lower(v_scope) AND (e ->> 'amount_centavos') IS NOT NULL
       LIMIT 1;
      IF v_line_amt IS NULL THEN
        RAISE EXCEPTION 'ask_for_a_change: NO_SUCH_LINE' USING ERRCODE = '22023';
      END IF;
      v_new_tot := v_live.total_centavos - v_line_amt + p_amount_centavos;
    END IF;
    v_floor := public.quote_floor_of(v_live.event_id, v_live.vendor_profile_id);
    IF v_floor IS NOT NULL AND v_new_tot < v_floor THEN
      RAISE EXCEPTION 'ask_for_a_change: BELOW_PAID_FLOOR — a counter may not go below the paid quotation' USING ERRCODE = '23514';
    END IF;
  END IF;

  IF v_plan THEN
    v_refusal := public.change_ask_plan_refusal(p_proposed_plan, v_live.payment_schedule, v_live.total_centavos,
                                                public.change_ask_paid_seqs(v_live.event_id, v_live.vendor_profile_id));
    IF v_refusal IS NOT NULL THEN
      RAISE EXCEPTION 'ask_for_a_change: %', v_refusal USING ERRCODE = '23514';
    END IF;
  END IF;

  -- Countering an open counter (or plan) from the OTHER side: it becomes 'countered', this one is the live answer.
  IF p_counters IS NOT NULL THEN
    SELECT * INTO v_prior FROM public.booking_change_asks WHERE ask_id = p_counters FOR UPDATE;
    IF v_prior.ask_id IS NULL OR v_prior.thread_id <> p_thread_id OR v_prior.status <> 'open'
       OR v_prior.raised_by = (CASE WHEN v_supplier THEN 'supplier' ELSE 'host' END)
       OR (v_prior.amount_centavos IS NULL AND v_prior.proposed_plan IS NULL) THEN
      RAISE EXCEPTION 'ask_for_a_change: COUNTER_NOT_OPEN' USING ERRCODE = '22023';
    END IF;
    IF v_prior.good_until IS NOT NULL AND v_prior.good_until < v_today THEN
      RAISE EXCEPTION 'ask_for_a_change: COUNTER_EXPIRED — ask again' USING ERRCODE = '22023';
    END IF;
    UPDATE public.booking_change_asks
       SET status = 'countered', answered_by = v_uid, answered_at = NOW()
     WHERE ask_id = p_counters;
  END IF;

  INSERT INTO public.booking_change_asks
    (thread_id, event_id, vendor_profile_id, subject, proposal_id, form_id, note, asked_by,
     amount_centavos, scope_label, proposed_plan, good_until, raised_by)
  VALUES
    (p_thread_id, v_thread.event_id, v_thread.vendor_profile_id, p_subject,
     CASE WHEN p_subject = 'form' THEN NULL ELSE p_proposal_id END,
     CASE WHEN p_subject = 'form' THEN p_form_id ELSE NULL END,
     v_note, v_uid,
     p_amount_centavos, v_scope, p_proposed_plan,
     CASE WHEN v_counter OR v_plan THEN p_good_until ELSE NULL END,
     CASE WHEN v_supplier THEN 'supplier' ELSE 'host' END)
  RETURNING ask_id INTO v_id;

  IF v_supplier THEN
    SELECT NULLIF(btrim(vp.business_name), '') INTO v_name FROM public.vendor_profiles vp WHERE vp.vendor_profile_id = v_thread.vendor_profile_id;
  ELSE
    SELECT NULLIF(btrim(u.first_name), '') INTO v_name FROM public.users u WHERE u.user_id = v_uid;
  END IF;
  v_name := COALESCE(v_name, CASE WHEN v_supplier THEN 'The supplier' ELSE 'A host' END);

  IF v_counter THEN
    -- "Counter · the total · ₱57,000 · Ana" — the stream draws its card (lib/chat-card-lines.ts changeAskFromLine).
    PERFORM public.chat_record_post_line(
      v_thread.event_id, v_thread.vendor_profile_id,
      'Counter · ' || COALESCE(v_scope, 'the total') || ' · ' || public.change_ask_peso(p_amount_centavos) || ' · ' || v_name,
      'Counter · ' || CASE WHEN v_scope IS NULL THEN 'the total' ELSE 'one line' END || ' · ' || v_name);
  ELSIF v_plan THEN
    PERFORM public.chat_record_post_line(v_thread.event_id, v_thread.vendor_profile_id, 'Plan proposed · ' || v_name, 'Plan proposed · ' || v_name);
  ELSE
    v_what := CASE p_subject WHEN 'quote' THEN 'Quotation' WHEN 'plan' THEN 'Payment plan' ELSE 'Form' END;
    PERFORM public.chat_record_post_line(
      v_thread.event_id, v_thread.vendor_profile_id,
      'Asked for a change · ' || v_what || ' · ' || v_name || ' — “' || left(v_note, 300) || '”',
      'Asked for a change · ' || v_what || ' · ' || v_name);
  END IF;
  RETURN v_id;
END;
$$;
REVOKE ALL ON FUNCTION public.ask_for_a_change(UUID, TEXT, TEXT, UUID, UUID, BIGINT, TEXT, JSONB, DATE, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ask_for_a_change(UUID, TEXT, TEXT, UUID, UUID, BIGINT, TEXT, JSONB, DATE, UUID) TO authenticated;
COMMENT ON FUNCTION public.ask_for_a_change(UUID, TEXT, TEXT, UUID, UUID, BIGINT, TEXT, JSONB, DATE, UUID) IS
  'Ask for a change (words, hosts'' side only) · Counter with a price (p_amount_centavos; the whole quote or the line p_scope_label) · Propose a payment plan (p_proposed_plan) — a counter or plan from either side, answered by the other; p_counters marks the countered one ''countered''. Refuses a LOCKED item (ITEM_LOCKED — plan_locked refuses a plan), a booked deal (DEAL_LOCKED), a quote that moved (QUOTE_MOVED), a counter under the paid floor, a plan that does not pay in full or moves a paid row. Posts its chat line. Migrations 20271332041210 · 20271340018194.';

-- ── 4 · The one-tap accept writes exactly ONE version (internal) ─────────────
CREATE OR REPLACE FUNCTION public.change_ask_write_version(p_ask_id UUID, p_host_uid UUID)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ask      public.booking_change_asks%ROWTYPE;
  v_live     public.vendor_proposals%ROWTYPE;
  v_paid     INTEGER[];
  v_lines    JSONB;
  v_total    BIGINT;
  v_sched    JSONB;
  v_split    JSONB;
  v_owed     BIGINT;
  v_refusal  TEXT;
  v_found    BOOLEAN := FALSE;
  v_today    DATE := (NOW() AT TIME ZONE 'Asia/Manila')::DATE;
  v_event_on DATE;
  v_until    DATE;
  v_new      UUID;
  v_ev       public.event_vendors%ROWTYPE;
  v_shop     TEXT;
  v_owner    UUID;
  e          RECORD;
BEGIN
  SELECT * INTO v_ask FROM public.booking_change_asks WHERE ask_id = p_ask_id;
  SELECT * INTO v_live
    FROM public.vendor_proposals
   WHERE event_id = v_ask.event_id AND vendor_profile_id = v_ask.vendor_profile_id
     AND status IN ('sent', 'viewed', 'accepted')
   ORDER BY created_at DESC
   LIMIT 1
   FOR UPDATE;
  IF v_live.proposal_id IS NULL OR v_live.proposal_id IS DISTINCT FROM v_ask.proposal_id THEN
    RAISE EXCEPTION 'answer_change_ask: QUOTE_MOVED — the quote changed since; counter again' USING ERRCODE = '22023';
  END IF;
  IF (v_ask.subject = 'quote' AND v_live.changes_locked) OR (v_ask.subject = 'plan' AND v_live.plan_locked) THEN
    RAISE EXCEPTION 'answer_change_ask: ITEM_LOCKED — the supplier made this final' USING ERRCODE = 'P0001';
  END IF;
  IF public.vendor_requote_blocker(v_live.event_id, v_live.vendor_profile_id) IS NOT NULL THEN
    RAISE EXCEPTION 'answer_change_ask: DEAL_LOCKED — this booking is confirmed; use a change order' USING ERRCODE = 'P0001';
  END IF;
  v_paid := public.change_ask_paid_seqs(v_live.event_id, v_live.vendor_profile_id);
  v_lines := COALESCE(v_live.line_items, '[]'::jsonb);
  v_sched := COALESCE(v_live.payment_schedule, '{}'::jsonb);

  IF v_ask.amount_centavos IS NOT NULL THEN
    IF v_ask.scope_label IS NULL THEN
      -- The whole quote: one named line carries the difference (the itemization still reconciles to the total).
      v_total := v_ask.amount_centavos;
      IF v_total <> v_live.total_centavos THEN
        v_lines := v_lines || jsonb_build_array(jsonb_build_object(
          'label', 'Counter accepted', 'detail', NULL, 'amount_centavos', v_total - v_live.total_centavos));
      END IF;
    ELSE
      -- One line: its amount is replaced (the first line of that name that carries a price).
      SELECT COALESCE(jsonb_agg(
               CASE WHEN o = (SELECT MIN(o2) FROM jsonb_array_elements(v_lines) WITH ORDINALITY AS t2(e2, o2)
                               WHERE lower(btrim(e2 ->> 'label')) = lower(v_ask.scope_label) AND (e2 ->> 'amount_centavos') IS NOT NULL)
                    THEN jsonb_set(jsonb_set(ln, '{amount_centavos}', to_jsonb(v_ask.amount_centavos)), '{detail}', to_jsonb('Counter accepted'::TEXT))
                    ELSE ln END
               ORDER BY o), '[]'::jsonb),
             bool_or(lower(btrim(ln ->> 'label')) = lower(v_ask.scope_label) AND (ln ->> 'amount_centavos') IS NOT NULL)
        INTO v_lines, v_found
        FROM jsonb_array_elements(v_lines) WITH ORDINALITY AS t(ln, o);
      IF NOT COALESCE(v_found, FALSE) THEN
        RAISE EXCEPTION 'answer_change_ask: NO_SUCH_LINE — that line is no longer on the quote' USING ERRCODE = '22023';
      END IF;
      SELECT GREATEST(0, COALESCE(SUM((ln ->> 'amount_centavos')::BIGINT), 0)) INTO v_total FROM jsonb_array_elements(v_lines) ln;
    END IF;
    -- The plan re-splits; paid rows never change; no row below zero (what is left is owed back — refused here).
    IF jsonb_typeof(v_sched -> 'installments') = 'array' AND jsonb_array_length(v_sched -> 'installments') > 0 THEN
      v_split := public.change_ask_resplit(v_sched -> 'installments', v_total, v_paid);
      v_owed := (v_split ->> 'owed_back_centavos')::BIGINT;
      IF v_owed > 0 THEN
        RAISE EXCEPTION 'answer_change_ask: BELOW_WHAT_WAS_PAID — % would be owed back; the paid quotation is the floor', public.change_ask_peso(v_owed)
          USING ERRCODE = '23514';
      END IF;
      v_sched := v_sched || jsonb_build_object(
        'installments', v_split -> 'installments',
        'total_centavos', v_total,
        'base_centavos', v_total + COALESCE((v_sched ->> 'credit_centavos')::BIGINT, 0),
        'balances', TRUE, 'over_by_centavos', 0);
    END IF;
  ELSE
    -- A plan: the same lines and total; the proposed rows, re-checked against the live quote now.
    v_total := v_live.total_centavos;
    v_refusal := public.change_ask_plan_refusal(v_ask.proposed_plan, v_sched, v_total, v_paid);
    IF v_refusal IS NOT NULL THEN
      RAISE EXCEPTION 'answer_change_ask: %', v_refusal USING ERRCODE = '23514';
    END IF;
    v_sched := v_sched || jsonb_build_object(
      'version', 1,
      'installments', v_ask.proposed_plan -> 'installments',
      'total_centavos', v_total,
      'base_centavos', v_total + COALESCE((v_sched ->> 'credit_centavos')::BIGINT, 0),
      'credit_centavos', COALESCE((v_sched ->> 'credit_centavos')::BIGINT, 0),
      'balances', TRUE, 'over_by_centavos', 0, 'credit_over_centavos', 0);
  END IF;

  -- Valid until: the live quote's own, or (an accepted quote whose date has passed) a week on, never past the event day.
  SELECT CASE WHEN ev.event_date_precision IS NULL OR ev.event_date_precision = 'day' THEN ev.event_date END
    INTO v_event_on FROM public.events ev WHERE ev.event_id = v_live.event_id;
  v_until := CASE WHEN v_live.valid_until > v_today THEN v_live.valid_until ELSE v_today + 7 END;
  IF v_event_on IS NOT NULL AND v_until > v_event_on THEN
    v_until := GREATEST(v_event_on, v_today + 1);
  END IF;

  -- ONE new version, sent (so the money rules — the paid floor, pay in full — judge it), then accepted.
  INSERT INTO public.vendor_proposals
    (vendor_profile_id, event_id, template_id, title, merge_snapshot, rendered_body, rendered_terms,
     line_items, total_centavos, payment_schedule, payment_method_ids, valid_until,
     includes_setnayan_gift, service_card_ids, changes_locked, plan_locked, status, sent_at)
  VALUES
    (v_live.vendor_profile_id, v_live.event_id, v_live.template_id, v_live.title,
     COALESCE(v_live.merge_snapshot, '{}'::jsonb) || jsonb_build_object('source', 'counter_accepted', 'change_ask_id', v_ask.ask_id, 'from_proposal_id', v_live.proposal_id),
     v_live.rendered_body, v_live.rendered_terms,
     v_lines, v_total, v_sched, v_live.payment_method_ids, v_until,
     v_live.includes_setnayan_gift, v_live.service_card_ids, v_live.changes_locked, v_live.plan_locked, 'sent', NOW())
  RETURNING proposal_id INTO v_new;

  -- Every earlier live version retires (the shipped supersede, done here: the caller may be the hosts' side).
  UPDATE public.vendor_proposals
     SET status = 'superseded', updated_at = NOW()
   WHERE event_id = v_live.event_id AND vendor_profile_id = v_live.vendor_profile_id
     AND proposal_id <> v_new AND status IN ('sent', 'viewed', 'accepted');

  -- 🤝 It lands ACCEPTED — the counter was the hosts' yes (owner 12 Nov), or the hosts just said it.
  UPDATE public.vendor_proposals
     SET status = 'accepted', resolved_at = NOW(), resolved_by_user_id = p_host_uid, updated_at = NOW()
   WHERE proposal_id = v_new;

  -- The accept's own booking write (respond_vendor_proposal's): the agreed price on the event's supplier row.
  SELECT * INTO v_ev FROM public.event_vendors
   WHERE event_id = v_live.event_id AND marketplace_vendor_id = v_live.vendor_profile_id AND archived_at IS NULL
   ORDER BY created_at
   LIMIT 1
   FOR UPDATE;
  IF v_ev.vendor_id IS NOT NULL THEN
    UPDATE public.event_vendors
       SET total_cost_php = v_total::NUMERIC / 100.0,
           status = CASE WHEN status = 'considering' THEN 'shortlisted'::public.vendor_status ELSE status END,
           pax_surcharge_php = 0,
           cost_basis_pax = NULL,
           updated_at = NOW()
     WHERE vendor_id = v_ev.vendor_id;
  ELSE
    SELECT NULLIF(btrim(business_name), '') INTO v_shop FROM public.vendor_profiles WHERE vendor_profile_id = v_live.vendor_profile_id;
    INSERT INTO public.event_vendors
      (event_id, marketplace_vendor_id, linked_vendor_profile_id, category, vendor_name, status, total_cost_php, source)
    VALUES
      (v_live.event_id, v_live.vendor_profile_id, v_live.vendor_profile_id, 'misc'::public.vendor_category,
       COALESCE(v_shop, 'Vendor'), 'shortlisted'::public.vendor_status, v_total::NUMERIC / 100.0, 'proposal_accept');
  END IF;

  -- The new version's card in the chat, from the shop (the stream draws a quote card for a proposal_id message).
  SELECT user_id INTO v_owner FROM public.vendor_profiles WHERE vendor_profile_id = v_live.vendor_profile_id;
  BEGIN
    INSERT INTO public.chat_messages (thread_id, event_id, vendor_profile_id, sender_user_id, sender_role, body, proposal_id)
    VALUES (v_ask.thread_id, v_live.event_id, v_live.vendor_profile_id, v_owner,
            CASE WHEN v_owner IS NULL THEN 'system' ELSE 'vendor' END::public.chat_sender_role,
            '📄 Updated quote — “' || COALESCE(v_live.title, 'Quote') || '” · ' || public.change_ask_peso(v_total)
              || CASE WHEN v_ask.amount_centavos IS NOT NULL THEN '. Counter accepted' ELSE '. Payment plan accepted' END
              || ' — this is the quote now.',
            v_new);
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'change_ask_write_version: no quote card posted for %: %', v_new, SQLERRM;
  END;
  RETURN v_new;
END;
$$;
REVOKE ALL ON FUNCTION public.change_ask_write_version(UUID, UUID) FROM PUBLIC, anon, authenticated;
COMMENT ON FUNCTION public.change_ask_write_version(UUID, UUID) IS
  'Internal: the ONE quote version an accepted counter or plan writes — the live quote with the counter applied (or the proposed plan), the plan re-split with paid rows unchanged (change_ask_resplit), sent then accepted in one transaction, the earlier versions superseded, the agreed price on event_vendors, the version''s card in the chat. Refuses QUOTE_MOVED · ITEM_LOCKED · DEAL_LOCKED · BELOW_WHAT_WAS_PAID; the money-rules trigger refuses below the paid floor. Migration 20271340018194.';

-- ── 5 · The answer: revise · decline · accept (the OTHER side answers) ──────
CREATE OR REPLACE FUNCTION public.answer_change_ask(
  p_ask_id UUID,
  p_answer TEXT,
  p_note   TEXT DEFAULT NULL
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid      UUID := auth.uid();
  v_ask      public.booking_change_asks%ROWTYPE;
  v_supplier BOOLEAN;
  v_priced   BOOLEAN;
  v_new      UUID;
  v_total    BIGINT;
  v_what     TEXT;
  v_line     TEXT;
  v_note     TEXT := NULLIF(btrim(COALESCE(p_note, '')), '');
BEGIN
  IF v_uid IS NULL OR p_answer NOT IN ('revised', 'declined', 'accepted') THEN
    RAISE EXCEPTION 'answer_change_ask: BAD_ANSWER' USING ERRCODE = '22023';
  END IF;
  SELECT * INTO v_ask FROM public.booking_change_asks WHERE ask_id = p_ask_id FOR UPDATE;
  IF v_ask.ask_id IS NULL THEN
    RAISE EXCEPTION 'answer_change_ask: NOT_THE_SUPPLIER' USING ERRCODE = '42501';
  END IF;
  v_supplier := v_ask.vendor_profile_id IN (SELECT public.current_vendor_ids())
             OR v_ask.vendor_profile_id IN (SELECT public.current_vendor_profile_ids());
  -- The OTHER side answers: the shop answers the hosts; the hosts' side (in this chat) answers the shop.
  IF v_ask.raised_by = 'host' AND NOT v_supplier THEN
    RAISE EXCEPTION 'answer_change_ask: NOT_THE_SUPPLIER' USING ERRCODE = '42501';
  END IF;
  IF v_ask.raised_by = 'supplier' AND (v_supplier OR NOT (v_ask.thread_id IN (SELECT public.current_thread_ids()))) THEN
    RAISE EXCEPTION 'answer_change_ask: NOT_THE_HOSTS_SIDE' USING ERRCODE = '42501';
  END IF;
  IF v_ask.status <> 'open' THEN
    RETURN 'already';
  END IF;
  v_priced := v_ask.amount_centavos IS NOT NULL OR v_ask.proposed_plan IS NOT NULL;
  IF (p_answer = 'revised' AND v_priced) OR (p_answer = 'accepted' AND NOT v_priced) THEN
    RAISE EXCEPTION 'answer_change_ask: BAD_ANSWER' USING ERRCODE = '22023';
  END IF;
  IF p_answer = 'accepted' THEN
    -- "Expired · ask again" — a counter whose Good until has passed can never be accepted.
    IF v_ask.good_until IS NOT NULL AND v_ask.good_until < (NOW() AT TIME ZONE 'Asia/Manila')::DATE THEN
      RAISE EXCEPTION 'answer_change_ask: COUNTER_EXPIRED — ask again' USING ERRCODE = '22023';
    END IF;
    v_new := public.change_ask_write_version(p_ask_id, CASE WHEN v_ask.raised_by = 'host' THEN v_ask.asked_by ELSE v_uid END);
  END IF;

  UPDATE public.booking_change_asks
     SET status = p_answer, answer_note = left(v_note, 500), answered_by = v_uid, answered_at = NOW(),
         answer_proposal_id = v_new
   WHERE ask_id = p_ask_id;

  IF v_priced THEN
    v_what := CASE WHEN v_ask.amount_centavos IS NOT NULL THEN 'Counter' ELSE 'Plan' END;
    IF p_answer = 'accepted' THEN
      SELECT total_centavos INTO v_total FROM public.vendor_proposals WHERE proposal_id = v_new;
      v_line := v_what || ' accepted · ' || public.change_ask_peso(v_total) || ' is the quote now';
    ELSE
      v_line := v_what || ' declined';
    END IF;
    PERFORM public.chat_record_post_line(v_ask.event_id, v_ask.vendor_profile_id, v_line, v_line);
    RETURN p_answer;
  END IF;

  v_what := CASE v_ask.subject WHEN 'quote' THEN 'Quotation' WHEN 'plan' THEN 'Payment plan' ELSE 'Form' END;
  PERFORM public.chat_record_post_line(
    v_ask.event_id, v_ask.vendor_profile_id,
    CASE p_answer
      WHEN 'revised' THEN 'Change asked · ' || v_what || ' · the supplier is sending a new version'
      ELSE 'Change asked · ' || v_what || ' · declined by the supplier' || COALESCE(' — “' || left(v_note, 300) || '”', '')
    END,
    CASE p_answer
      WHEN 'revised' THEN 'Change asked · ' || v_what || ' · the supplier is sending a new version'
      ELSE 'Change asked · ' || v_what || ' · declined by the supplier'
    END);
  RETURN p_answer;
END;
$$;
REVOKE ALL ON FUNCTION public.answer_change_ask(UUID, TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.answer_change_ask(UUID, TEXT, TEXT) TO authenticated;
COMMENT ON FUNCTION public.answer_change_ask(UUID, TEXT, TEXT) IS
  'The OTHER side answers an open ask: a words-only ask is revised/declined by the shop; a counter or plan is accepted/declined by whoever did not raise it. Accept writes exactly ONE new quote version, ACCEPTED (change_ask_write_version); an expired counter is refused (COUNTER_EXPIRED). Idempotent (an answered ask returns already). Posts the answer into the chat. Migrations 20271332041210 · 20271340018194.';

COMMIT;
