-- a_claimed_per_guest_price_follows_the_guest_list
-- Created via `pnpm migration:new`. KEEP THIS MIGRATION IDEMPOTENT (it may be re-applied). Never applied by hand — the
-- pipeline's `supabase db push --include-all` applies it.
--
-- 👥🧾 AFTER THE CLAIM, A PER-GUEST PRICE FOLLOWS THE GUEST LIST — the follow-up #7565 named ("guest-list follow after
-- claim (own PR)"). DECISION_LOG 2026-11-13 "AFTER THE CLAIM, THE SUPPLIER'S PRICE FOLLOWS THE GUEST LIST" (owner:
-- "Yes, follow it" — billed = max(count, minimum)) · 2026-11-12 "WHEN A GUEST IS REMOVED, THE PRICE FALLS BACK — UNLESS
-- THE SUPPLIER LOCKED IT" ("if the price is paid, then it stays… it really depends if the supplier already locked the
-- price") · 2026-11-12 "A LOCKED QUOTATION STILL FOLLOWS THE GUEST LIST" (a locked price rises, never falls).
--
-- ── THE GAP ───────────────────────────────────────────────────────────────────────────────────────────────────────────
-- `quote_follow_guest_count` (20271339826198 → 20271341557835) moves only a STANDING QUOTE whose lines carry their own
-- per-head rate. A supplier the couple added and priced per guest (20271342032145: `pricing_basis = 'per_pax'`, the
-- total agreed in `total_cost_php`, the guests agreed in `pax_quote_base`) has no quote, so after the claim bonds it to
-- the shop (`marketplace_vendor_id`, 20271280900282) nothing moved its price, whatever the guest list did.
--
-- ── THE RULE (extends the shipped repricer — it is called from inside `quote_follow_guest_count`, so every caller of
--    the guest list's follow reaches it: the guests, "Not counted for ▾", the count rules, the estimate) ─────────────
--   WHICH BOOKINGS: `pricing_basis = 'per_pax'` · claimed (`marketplace_vendor_id` set) · not archived · not a package
--     member · a total and guests agreed · not delivered / complete · and NO standing quote of that shop on the event
--     that follows the list (that quote is the price, and the shipped pass above already moves it).
--   EVERY FIGURE IS THE BOOKING'S OWN: the total agreed (T) for the guests agreed (G) — both typed by the couple and
--     kept on the record. The rate is T ÷ G, never read from a service card and never typed here. G is the minimum
--     (the claim door pre-fills the supplier's "Minimum guests" with it).
--   billed = max(the per-service count `quote_guest_count`, G) — unlocked: up AND down, floored at G.
--   LOCKED (booked: contracted · deposit_paid, or the supplier agreed to the lock, `lock_agreed_at`): it rises, it never
--     falls — billed = max(count, G, what it already bills). The shipped quote rule, word for word.
--   new total = round(T × billed ÷ G, 2) — the column's own centavos; at billed = G it is exactly T again.
--   PAID STAYS: the agreed total NOW (the headline + accepted change lines) never falls below what has been paid; a
--     drop that would goes only as far as whole guests fit, or not at all. The plan is re-plotted by the shipped
--     `plan_replot_for_booking`, which never touches a paid instalment.
--   ONE LINE IN THE CONVERSATION: the shipped words ("Quote rose to N pax · +₱X" / "Quote fell to …"), the same system
--     line the quote follow posts — the supplier's existing in-app notice. No email.
--
-- ── WHY A SIDE TABLE AND NOT A COLUMN ─────────────────────────────────────────────────────────────────────────────────
--   Once the total moves, T is gone from `total_cost_php`, and rounding forbids getting it back from the moved total.
--   It is kept in `event_vendor_guest_follow`, NOT as a sixth money column on `event_vendors`: 20271342818285 is
--   closing the five money columns there to a Suppliers-only delegate, and a new one would reopen that route.
--   The table holds the anchor (T, G), what the follow billed last, and the total it wrote last. If the total was
--   changed by anyone else since (the couple re-priced it on the bench), the anchor is re-taken from the booking as it
--   now stands — the total as the price for the guests agreed — rather than overwriting their number.
--   RLS at CREATE: the hosts read its COUNTS (`current_couple_event_ids()`, the event_vendor_payments couple-read
--   pattern; a column grant keeps both amounts off every browser role); nobody writes it but this SECURITY DEFINER
--   function.
--
-- TS mirror: apps/web/lib/claimed-per-guest-follow.ts. Held by
-- apps/web/tests/db/a-claimed-per-guest-price-follows-the-guest-list.db.test.ts and
-- apps/web/lib/claimed-per-guest-follow.test.ts.

BEGIN;

-- ── 1 · What the follow anchors to ────────────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.event_vendor_guest_follow (
  event_vendor_id   UUID PRIMARY KEY REFERENCES public.event_vendors(vendor_id) ON DELETE CASCADE,
  event_id          UUID NOT NULL REFERENCES public.events(event_id) ON DELETE CASCADE,
  agreed_total_php  NUMERIC(12,2) NOT NULL CHECK (agreed_total_php > 0),
  agreed_guests     INTEGER NOT NULL CHECK (agreed_guests > 0),
  billed_guests     INTEGER NOT NULL CHECK (billed_guests > 0),
  followed_total_php NUMERIC(12,2) NOT NULL CHECK (followed_total_php > 0),
  followed_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.event_vendor_guest_follow ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS event_vendor_guest_follow_event_idx ON public.event_vendor_guest_follow (event_id);

REVOKE ALL ON public.event_vendor_guest_follow FROM PUBLIC, anon, authenticated;
-- The browser reads COUNTS only (the line under the price). The two amounts stay with the server: a column grant,
-- because RLS is row-level and can never hide a column.
GRANT SELECT (event_vendor_id, event_id, agreed_guests, billed_guests) ON public.event_vendor_guest_follow TO authenticated;
GRANT ALL ON public.event_vendor_guest_follow TO service_role;

DROP POLICY IF EXISTS event_vendor_guest_follow_couple_read ON public.event_vendor_guest_follow;
CREATE POLICY event_vendor_guest_follow_couple_read
  ON public.event_vendor_guest_follow FOR SELECT
  TO authenticated
  USING (event_id IN (SELECT public.current_couple_event_ids()));

COMMENT ON TABLE public.event_vendor_guest_follow IS
  'A claimed per-guest booking that followed the guest list (20271343652941): the total and guests the couple agreed '
  '(the anchor — the rate is their quotient), the guests it bills now and the total it last wrote. Written only by '
  'quote_follow_claimed_per_guest (SECURITY DEFINER); the hosts read it.';

-- ── 2 · The pass ──────────────────────────────────────────────────────────────────────────────────────────────────────
-- Returns how many bookings moved.
CREATE OR REPLACE FUNCTION public.quote_follow_claimed_per_guest(p_event_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  r         RECORD;
  f         RECORD;
  v_t       NUMERIC;   -- the total agreed (the anchor)
  v_g       INTEGER;   -- the guests agreed (the anchor and the minimum)
  v_prior   INTEGER;   -- what it bills now
  v_locked  BOOLEAN;
  v_count   INTEGER;
  v_billed  INTEGER;
  v_new     NUMERIC;
  v_paid    NUMERIC;
  v_changes NUMERIC;
  v_delta_c BIGINT;
  v_moved   INTEGER := 0;
BEGIN
  IF p_event_id IS NULL THEN
    RETURN 0;
  END IF;
  FOR r IN
    SELECT ev.vendor_id, ev.marketplace_vendor_id, ev.total_cost_php, ev.pax_quote_base,
           (ev.status IN ('contracted', 'deposit_paid') OR ev.lock_agreed_at IS NOT NULL) AS locked
      FROM public.event_vendors ev
     WHERE ev.event_id = p_event_id
       AND ev.pricing_basis = 'per_pax'
       AND ev.marketplace_vendor_id IS NOT NULL
       AND ev.archived_at IS NULL
       AND ev.package_role IS NULL
       AND ev.status NOT IN ('delivered', 'complete')
       AND ev.pax_quote_base > 0
       AND ev.total_cost_php > 0
       -- A standing quote that follows the list IS the price; the shipped pass moves it.
       AND NOT EXISTS (
         SELECT 1
           FROM public.vendor_proposals vp
          WHERE vp.event_id = p_event_id
            AND vp.vendor_profile_id = ev.marketplace_vendor_id
            AND vp.status IN ('sent', 'viewed', 'accepted')
            AND public.quote_follows_guest_list(vp.line_items)
       )
     ORDER BY ev.created_at
       FOR UPDATE OF ev
  LOOP
    SELECT * INTO f FROM public.event_vendor_guest_follow WHERE event_vendor_id = r.vendor_id FOR UPDATE;
    IF FOUND AND f.followed_total_php = r.total_cost_php AND f.agreed_guests = r.pax_quote_base THEN
      v_t := f.agreed_total_php;
      v_g := f.agreed_guests;
      v_prior := f.billed_guests;
    ELSE
      -- Never followed, or the price was set by someone else since: the booking as it stands is the agreement.
      v_t := r.total_cost_php;
      v_g := r.pax_quote_base;
      v_prior := r.pax_quote_base;
    END IF;

    v_locked := r.locked;
    v_count  := public.quote_guest_count(p_event_id, r.vendor_id);
    v_billed := GREATEST(v_count, v_g, CASE WHEN v_locked THEN v_prior ELSE 0 END);
    v_new    := round(v_t * v_billed / v_g, 2);

    IF v_new < r.total_cost_php THEN
      -- PAID STAYS: the agreed total now (headline + accepted change lines) never goes under what is paid.
      SELECT COALESCE(SUM(p.amount_php), 0) INTO v_paid
        FROM public.event_vendor_payments p
       WHERE p.vendor_id = r.vendor_id AND p.payment_refused_at IS NULL;
      SELECT COALESCE(SUM(li.amount_php), 0) INTO v_changes
        FROM public.event_vendor_line_items li
       WHERE li.vendor_id = r.vendor_id AND li.is_change_delta;
      WHILE v_new + v_changes < v_paid AND v_billed < v_prior LOOP
        v_billed := v_billed + 1;
        v_new    := round(v_t * v_billed / v_g, 2);
      END LOOP;
      IF v_new + v_changes < v_paid THEN
        CONTINUE; -- nothing unsettled to take it from: the price stays
      END IF;
    END IF;

    IF v_new = r.total_cost_php THEN
      CONTINUE; -- never sideways
    END IF;

    UPDATE public.event_vendors
       SET total_cost_php = v_new,
           updated_at     = now()
     WHERE vendor_id = r.vendor_id;

    INSERT INTO public.event_vendor_guest_follow
      (event_vendor_id, event_id, agreed_total_php, agreed_guests, billed_guests, followed_total_php, followed_at)
    VALUES (r.vendor_id, p_event_id, v_t, v_g, v_billed, v_new, now())
    ON CONFLICT (event_vendor_id) DO UPDATE
       SET agreed_total_php   = EXCLUDED.agreed_total_php,
           agreed_guests      = EXCLUDED.agreed_guests,
           billed_guests      = EXCLUDED.billed_guests,
           followed_total_php = EXCLUDED.followed_total_php,
           followed_at        = EXCLUDED.followed_at;

    -- The plan adds up to the new total; a paid instalment never changes (the shipped re-plot, its own fence).
    BEGIN
      PERFORM public.plan_replot_for_booking(r.vendor_id, 'price');
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'plan_replot_for_booking failed for event_vendor % (guest follow): %', r.vendor_id, SQLERRM;
    END;

    -- The supplier's existing in-app notice: one system line in the conversation, the quote follow's own words.
    v_delta_c := round((v_new - r.total_cost_php) * 100)::BIGINT;
    IF v_delta_c > 0 THEN
      PERFORM public.chat_record_post_line(
        p_event_id, r.marketplace_vendor_id,
        public.quote_rise_words(v_billed, v_delta_c),
        'Quote rose to ' || to_char(v_billed, 'FM999,999,990') || ' pax');
    ELSE
      PERFORM public.chat_record_post_line(
        p_event_id, r.marketplace_vendor_id,
        public.quote_fall_words(v_billed, -v_delta_c),
        'Quote fell to ' || to_char(v_billed, 'FM999,999,990') || ' pax');
    END IF;
    v_moved := v_moved + 1;
  END LOOP;
  RETURN v_moved;
END;
$$;
REVOKE ALL ON FUNCTION public.quote_follow_claimed_per_guest(UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.quote_follow_claimed_per_guest(UUID) TO service_role;
COMMENT ON FUNCTION public.quote_follow_claimed_per_guest(UUID) IS
  'Called from quote_follow_guest_count (20271343652941). A claimed booking the couple priced per guest (pricing_basis per_pax, no standing quote that follows the list) follows the per-service count: billed = max(count, guests agreed[, what it bills when locked]); total = round(total agreed × billed ÷ guests agreed, 2). Locked (contracted · deposit_paid · lock_agreed_at) rises only. Never under what is paid. Re-plots the plan; one chat line. TS mirror lib/claimed-per-guest-follow.ts.';

-- ── 3 · The repricer calls it — 20271341557835's body, unchanged but for the block marked ⟵ CLAIMED PER GUEST ───────
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

  -- ⟵ CLAIMED PER GUEST (20271343652941): a supplier the couple added and priced per guest, now a claimed shop with
  -- no standing quote of its own, follows the same per-service count. Its own fault fence: a fault there never
  -- undoes the quotes moved above, and never refuses the couple's guest-list write.
  BEGIN
    v_moved := v_moved + public.quote_follow_claimed_per_guest(p_event_id);
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'quote_follow_claimed_per_guest event %: % %', p_event_id, SQLSTATE, SQLERRM;
  END;
  RETURN v_moved;
END;
$$;
REVOKE ALL ON FUNCTION public.quote_follow_guest_count(UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.quote_follow_guest_count(UUID) TO service_role;

COMMIT;
