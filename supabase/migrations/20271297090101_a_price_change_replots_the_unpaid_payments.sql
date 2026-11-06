-- ═══════════════════════════════════════════════════════════════════════════
-- AN ACCEPTED PRICE CHANGE ALWAYS RE-PLOTS THE UNPAID PAYMENTS
-- + "HOW TO PAY THEM" ON THE COUPLE'S OWN SUPPLIER RECORD          (2026-10-29)
-- ═══════════════════════════════════════════════════════════════════════════
--
-- Owner, verbatim (29 Oct ~04:10): "Re-split payments after a price change? yes. allow this. replot the payments
-- always." — DECISION_LOG 2026-10-29 "AN ACCEPTED PRICE CHANGE ALWAYS RE-PLOTS THE UNPAID PAYMENTS".
-- And (29 Oct ~17:20): "also manually add payment method/s" · "via QR or text details" — Booked prototype v4.
--
-- 🔴 THE GAP. A booking's plan (`event_vendor_payment_plan.instances_json`) is frozen when the booking is made. A
-- price change after that lands as a change line (`event_vendor_line_items.is_change_delta`, written only by
-- `accept_change_order` and `record_agreed_price_change`) — and NOTHING touched the plan. ₱100,000 agreed, a
-- +₱20,000 change accepted: the budget said ₱120,000, the plan still added up to ₱100,000, and ₱20,000 was owed
-- that no instalment ever asked for. Same for a couple re-pricing a supplier they added.
--
-- ✅ THE RULE (`plan_replot_instances`, the twin of `apps/web/lib/plan-replot.ts` `replotInstances` — the db test
-- `a-price-change-replots-the-unpaid-payments.db.test.ts` runs both over the same plans and holds them equal):
--   · an instalment with a payment logged against its seq that was not refused NEVER changes;
--   · the unpaid ones share (new total − settled) in the proportions they had, whole pesos, the rounding on the
--     last unpaid one;
--   · all settled and the price went up → one new "Balance" instalment; the price fell to or below what is settled
--     → the unpaid ones go (no negative instalment).
-- The plan BEFORE is kept, never overwritten: `replot_history` gets one entry per re-plot
-- `{at, from_php, to_php, source, instances}` — what the card's "Price changed ₱A → ₱B · plan updated" reads.
--
-- 🔑 WHERE IT FIRES — in the database, so no door can forget it:
--   1 · AFTER INSERT of a change line (`is_change_delta`) — every accepted change, both writers;
--   2 · AFTER UPDATE OF total_cost_php on a booking with NO Setnayan shop (a supplier the couple added) whose old
--       price was set — the couple re-priced their own record. A Setnayan booking's headline is not re-plotted here:
--       its price moves only through change lines (1).
-- A plan that was CLEARED (fully paid and closed) is left alone — reopening it is a ruling not yet made.
-- Fail-soft, like the booking-fee re-derive beside it: a failed re-plot raises a WARNING and never refuses the price
-- change itself (refusing it would lose the change the two sides agreed).
--
-- "HOW TO PAY THEM": `event_manual_vendors.pay_ways` — the couple's own contact card for the supplier, beside the
-- `payment_method_note` it supersedes on the record card. JSONB array of {method, details, qr}; the QR is a private
-- `r2://` object in the event's own payment folder. INERT: words and a picture, no money moves.
--
-- Additive. Never applied by hand — the pipeline's `supabase db push --include-all` applies it.
-- ═══════════════════════════════════════════════════════════════════════════

BEGIN;

-- ── 1 · The two columns ───────────────────────────────────────────────────
ALTER TABLE public.event_manual_vendors
  ADD COLUMN IF NOT EXISTS pay_ways JSONB NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE public.event_manual_vendors
  DROP CONSTRAINT IF EXISTS event_manual_vendors_pay_ways_is_a_short_list;
ALTER TABLE public.event_manual_vendors
  ADD CONSTRAINT event_manual_vendors_pay_ways_is_a_short_list
  CHECK (jsonb_typeof(pay_ways) = 'array' AND jsonb_array_length(pay_ways) <= 8);
COMMENT ON COLUMN public.event_manual_vendors.pay_ways IS
  'How to pay a supplier the couple added (record card, 2026-10-29): [{method, details, qr}] — method one of gcash · maya · bank · qrph · cash · check · other; qr a private r2:// ref under payment-proof/events/<event>/. A NOTE, not a payment rail: nothing reads it to move money (the-payment-note-is-inert.test.ts).';

ALTER TABLE public.event_vendor_payment_plan
  ADD COLUMN IF NOT EXISTS replot_history JSONB NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE public.event_vendor_payment_plan
  DROP CONSTRAINT IF EXISTS event_vendor_payment_plan_replot_history_is_a_list;
ALTER TABLE public.event_vendor_payment_plan
  ADD CONSTRAINT event_vendor_payment_plan_replot_history_is_a_list
  CHECK (jsonb_typeof(replot_history) = 'array');
COMMENT ON COLUMN public.event_vendor_payment_plan.replot_history IS
  'Every plan a price change replaced, oldest first: [{at, from_php, to_php, source: change|price, instances}]. Written only by plan_replot_for_booking (2026-10-29).';

-- ── 2 · The rule — pure, the twin of lib/plan-replot.ts replotInstances ──────
CREATE OR REPLACE FUNCTION public.plan_replot_instances(
  p_instances JSONB,
  p_settled INT[],
  p_new_total NUMERIC
) RETURNS JSONB
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public, pg_temp
AS $function$
DECLARE
  v_rows JSONB[];
  v_row JSONB;
  v_n INT;
  v_i INT;
  v_k INT;
  v_amt NUMERIC;
  v_old_sum NUMERIC := 0;
  v_paid NUMERIC := 0;
  v_remaining NUMERIC;
  v_unpaid INT[] := '{}';
  v_w NUMERIC[] := '{}';
  v_wsum NUMERIC := 0;
  v_given NUMERIC := 0;
  v_next NUMERIC[];
  v_out JSONB := '[]'::jsonb;
  v_settled INT[] := COALESCE(p_settled, '{}');
  v_bps NUMERIC;
  v_max_seq INT := 0;
  v_due TEXT := NULL;
  v_last JSONB;
  v_bal JSONB;
BEGIN
  IF p_instances IS NULL OR jsonb_typeof(p_instances) <> 'array' OR jsonb_array_length(p_instances) = 0
     OR p_new_total IS NULL THEN
    RETURN p_instances;
  END IF;

  SELECT array_agg(e ORDER BY (e->>'seq')::int) INTO v_rows FROM jsonb_array_elements(p_instances) e;
  v_n := array_length(v_rows, 1);
  v_next := array_fill(NULL::numeric, ARRAY[v_n]);

  FOR v_i IN 1..v_n LOOP
    v_row := v_rows[v_i];
    v_amt := COALESCE(CASE WHEN jsonb_typeof(v_row->'amount_php') = 'number' THEN (v_row->>'amount_php')::numeric END, 0);
    v_old_sum := v_old_sum + v_amt;
    v_max_seq := CASE WHEN v_i = 1 THEN (v_row->>'seq')::int ELSE GREATEST(v_max_seq, (v_row->>'seq')::int) END;
    IF jsonb_typeof(v_row->'due_date') = 'string' AND (v_due IS NULL OR v_row->>'due_date' > v_due) THEN
      v_due := v_row->>'due_date';
    END IF;
    IF (v_row->>'seq')::int = ANY (v_settled) THEN
      v_paid := v_paid + v_amt;
      v_next[v_i] := v_amt;
    ELSE
      v_unpaid := v_unpaid || v_i;
      v_w := v_w || GREATEST(v_amt, 0);
      v_wsum := v_wsum + GREATEST(v_amt, 0);
    END IF;
  END LOOP;

  -- Already adds up to the new price: nothing to re-plot (and nothing to keep).
  IF abs(v_old_sum - p_new_total) < 0.005 THEN
    RETURN p_instances;
  END IF;

  v_paid := round(v_paid, 2);
  v_remaining := round(p_new_total - v_paid, 2);

  IF COALESCE(array_length(v_unpaid, 1), 0) > 0 AND v_remaining > 0 THEN
    IF v_wsum <= 0 THEN
      v_w := array_fill(1::numeric, ARRAY[array_length(v_unpaid, 1)]);
      v_wsum := array_length(v_unpaid, 1);
    END IF;
    FOR v_k IN 1..array_length(v_unpaid, 1) LOOP
      IF v_k < array_length(v_unpaid, 1) THEN
        v_amt := round(v_remaining * v_w[v_k] / v_wsum);
        v_given := v_given + v_amt;
      ELSE
        v_amt := round(v_remaining - v_given, 2);
      END IF;
      v_next[v_unpaid[v_k]] := CASE WHEN v_amt > 0 THEN v_amt ELSE NULL END;
    END LOOP;
  END IF;

  FOR v_i IN 1..v_n LOOP
    v_row := v_rows[v_i];
    IF (v_row->>'seq')::int = ANY (v_settled) THEN
      v_out := v_out || jsonb_build_array(v_row);
      CONTINUE;
    END IF;
    IF v_next[v_i] IS NULL THEN
      CONTINUE; -- nothing left for this instalment to ask
    END IF;
    v_amt := trim_scale(v_next[v_i]);
    v_bps := CASE WHEN jsonb_typeof(v_row->'percent_bps') = 'number' THEN (v_row->>'percent_bps')::numeric END;
    IF v_row->>'amount_kind' = 'percent' AND v_bps IS NOT NULL
       AND abs(round(p_new_total * v_bps / 100) / 100 - v_amt) < 0.005 THEN
      v_out := v_out || jsonb_build_array(jsonb_set(v_row, '{amount_php}', to_jsonb(v_amt)));
    ELSE
      v_row := v_row || jsonb_build_object('amount_php', v_amt, 'amount_kind', 'fixed', 'percent_bps', NULL);
      IF jsonb_typeof(v_row->'authored') = 'object' THEN
        v_row := jsonb_set(v_row, '{authored}',
          (v_row->'authored') || jsonb_build_object('amount_kind', 'fixed', 'value', v_amt::text));
      END IF;
      v_out := v_out || jsonb_build_array(v_row);
    END IF;
  END LOOP;

  -- Everything was settled and the price went up: one new instalment for the rest.
  IF COALESCE(array_length(v_unpaid, 1), 0) = 0 AND v_remaining > 0 THEN
    v_last := v_rows[v_n];
    v_bal := jsonb_build_object(
      'seq', v_max_seq + 1,
      'label', 'Balance',
      'amount_php', trim_scale(v_remaining),
      'due_date', to_jsonb(v_due),
      'amount_kind', 'fixed',
      'percent_bps', NULL
    );
    IF jsonb_typeof(v_last->'authored') = 'object' THEN
      v_bal := v_bal || jsonb_build_object('authored',
        (v_last->'authored') || jsonb_build_object('amount_kind', 'fixed', 'value', trim_scale(v_remaining)::text));
    END IF;
    v_out := v_out || jsonb_build_array(v_bal);
  END IF;

  RETURN v_out;
END;
$function$;

REVOKE ALL ON FUNCTION public.plan_replot_instances(JSONB, INT[], NUMERIC) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.plan_replot_instances(JSONB, INT[], NUMERIC) TO service_role;

-- ── 3 · Re-plot one booking's plan to its agreed total NOW, keeping the old one ─
CREATE OR REPLACE FUNCTION public.plan_replot_for_booking(p_event_vendor_id UUID, p_source TEXT)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
DECLARE
  v_plan RECORD;
  v_head NUMERIC;
  v_changes NUMERIC;
  v_total NUMERIC;
  v_settled INT[];
  v_old_sum NUMERIC;
  v_new JSONB;
BEGIN
  SELECT plan_id, instances_json, cleared_at
    INTO v_plan
    FROM public.event_vendor_payment_plan
   WHERE event_vendor_id = p_event_vendor_id
   FOR UPDATE;
  IF NOT FOUND THEN RETURN 'no_plan'; END IF;
  IF v_plan.cleared_at IS NOT NULL THEN RETURN 'cleared'; END IF;
  IF jsonb_typeof(v_plan.instances_json) <> 'array' OR jsonb_array_length(v_plan.instances_json) = 0 THEN
    RETURN 'empty';
  END IF;

  -- The agreed total NOW — the headline plus the accepted change lines (lib/agreed-total-and-its-changes.ts).
  SELECT total_cost_php INTO v_head FROM public.event_vendors WHERE vendor_id = p_event_vendor_id;
  SELECT COALESCE(SUM(amount_php), 0) INTO v_changes
    FROM public.event_vendor_line_items
   WHERE vendor_id = p_event_vendor_id AND is_change_delta;
  IF v_head IS NULL AND v_changes = 0 THEN RETURN 'unpriced'; END IF;
  v_total := COALESCE(v_head, 0) + v_changes;
  IF v_total <= 0 THEN RETURN 'unpriced'; END IF;

  -- Settled = a payment logged against the instalment that the supplier did not refuse.
  SELECT COALESCE(array_agg(DISTINCT schedule_instance_seq), '{}')
    INTO v_settled
    FROM public.event_vendor_payments
   WHERE vendor_id = p_event_vendor_id
     AND schedule_instance_seq IS NOT NULL
     AND payment_refused_at IS NULL;

  v_new := public.plan_replot_instances(v_plan.instances_json, v_settled, v_total);
  IF v_new IS NOT DISTINCT FROM v_plan.instances_json THEN RETURN 'unchanged'; END IF;

  SELECT COALESCE(SUM(CASE WHEN jsonb_typeof(e->'amount_php') = 'number' THEN (e->>'amount_php')::numeric END), 0)
    INTO v_old_sum
    FROM jsonb_array_elements(v_plan.instances_json) e;

  UPDATE public.event_vendor_payment_plan
     SET instances_json = v_new,
         replot_history = replot_history || jsonb_build_array(jsonb_build_object(
           'at', now(),
           'from_php', trim_scale(v_old_sum),
           'to_php', trim_scale(v_total),
           'source', p_source,
           'instances', v_plan.instances_json
         )),
         updated_at = now()
   WHERE plan_id = v_plan.plan_id;
  RETURN 'replotted';
END;
$function$;

REVOKE ALL ON FUNCTION public.plan_replot_for_booking(UUID, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.plan_replot_for_booking(UUID, TEXT) TO service_role;

-- ── 4 · Where it fires ─────────────────────────────────────────────────────
-- 4a · an accepted change line
CREATE OR REPLACE FUNCTION public.plan_replot_on_change_line()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
BEGIN
  IF NEW.is_change_delta THEN
    BEGIN
      PERFORM public.plan_replot_for_booking(NEW.vendor_id, 'change');
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'plan_replot_for_booking failed for event_vendor % (change line): %', NEW.vendor_id, SQLERRM;
    END;
  END IF;
  RETURN NULL;
END;
$function$;
REVOKE ALL ON FUNCTION public.plan_replot_on_change_line() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS event_vendor_line_items_plan_replot ON public.event_vendor_line_items;
CREATE TRIGGER event_vendor_line_items_plan_replot
  AFTER INSERT ON public.event_vendor_line_items
  FOR EACH ROW EXECUTE FUNCTION public.plan_replot_on_change_line();

-- 4b · a supplier the couple added, re-priced on their record
CREATE OR REPLACE FUNCTION public.plan_replot_on_own_price()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
BEGIN
  IF NEW.marketplace_vendor_id IS NULL
     AND OLD.total_cost_php IS NOT NULL AND OLD.total_cost_php > 0
     AND NEW.total_cost_php IS NOT NULL AND NEW.total_cost_php > 0
     AND NEW.total_cost_php IS DISTINCT FROM OLD.total_cost_php THEN
    BEGIN
      PERFORM public.plan_replot_for_booking(NEW.vendor_id, 'price');
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'plan_replot_for_booking failed for event_vendor % (own price): %', NEW.vendor_id, SQLERRM;
    END;
  END IF;
  RETURN NULL;
END;
$function$;
REVOKE ALL ON FUNCTION public.plan_replot_on_own_price() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS event_vendors_plan_replot_on_own_price ON public.event_vendors;
CREATE TRIGGER event_vendors_plan_replot_on_own_price
  AFTER UPDATE OF total_cost_php ON public.event_vendors
  FOR EACH ROW EXECUTE FUNCTION public.plan_replot_on_own_price();

-- ── 5 · Only the re-plot writes the history ────────────────────────────────
-- The couple's own session can write its plan row (its RLS is host-only), and a JSONB column cannot be hidden from it
-- by RLS. The kept plans are the record of what a price change replaced, so — like `cleared_at` beside them
-- (`guard_payment_plan_clear`) — a browser session may not write them; `plan_replot_for_booking` (SECURITY DEFINER)
-- runs as its owner and may.
CREATE OR REPLACE FUNCTION public.guard_payment_plan_replot_history()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $function$
BEGIN
  IF current_user IN ('authenticated', 'anon') AND NOT public.is_admin() THEN
    IF (TG_OP = 'INSERT' AND NEW.replot_history IS DISTINCT FROM '[]'::jsonb)
       OR (TG_OP = 'UPDATE' AND NEW.replot_history IS DISTINCT FROM OLD.replot_history) THEN
      RAISE EXCEPTION 'event_vendor_payment_plan: the kept plans are written only by a price change''s re-plot'
        USING ERRCODE = '42501';
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;
REVOKE ALL ON FUNCTION public.guard_payment_plan_replot_history() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_guard_payment_plan_replot_history ON public.event_vendor_payment_plan;
CREATE TRIGGER trg_guard_payment_plan_replot_history
  BEFORE INSERT OR UPDATE ON public.event_vendor_payment_plan
  FOR EACH ROW EXECUTE FUNCTION public.guard_payment_plan_replot_history();

COMMIT;
