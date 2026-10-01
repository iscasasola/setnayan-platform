-- a_clashing_date_goes_to_the_supplier
-- ============================================================================
-- A DATE THAT CLASHES WITH A BOOKED SUPPLIER GOES TO THAT SUPPLIER, WHO DECIDES:
-- MOVE TO THE NEW DATE, OR UNLOCK THEIR SERVICE.
--
-- Owner 2026-10-01 (DECISION_LOG, three rows): *"the vendor in conflict will
-- decide to adjust date or unlock their service first"* — approved with the
-- controller's three safeguards: (1) prevent first, ONE confirm; (2) a 3-day
-- deadline, after which the couple chooses keep waiting · drop that supplier ·
-- cancel the change; (3) money follows the booking's OWN terms — Setnayan never
-- invents a refund. While pending the event keeps its date, guests see nothing,
-- the couple can withdraw anytime, and the new date applies (through Apply)
-- only when every conflicting supplier has moved or unlocked.
-- 2026-10-02 (Q8): a date every booked supplier CAN do applies at Apply with a
-- plain notice — no request at all (that half is app code, not schema).
--
-- ── WHY TWO NEW TABLES (Rule 0, searched first) ─────────────────────────────
-- Looked at every request/approval home: event_day_requests (day-of issues),
-- event_access_requests (coordinator access), vendor_change_orders and
-- proposal_amendments (money deltas, NOT NULL amount), vendor_lock_proposals
-- (a pick to lock), and the deletion handshake on event_vendors
-- (20271151830396 — one yes/no per booking). None holds "ONE request, a
-- proposed date, N suppliers each answering one of two ways, a deadline per
-- supplier". The deletion handshake is the SHAPE copied here — a TEXT state,
-- SECURITY DEFINER functions the browser cannot forge, an inverse for the
-- asker — but it lives in event_vendors columns because its question has no
-- identity of its own; a date change does (its date, who asked, when, and
-- whether it was withdrawn or applied), so it gets a row.
--
-- ── NOT A SECOND BOOKING-STATE MACHINE ──────────────────────────────────────
-- "Unlock my service" does not invent a booking state. It moves the booking
-- the way the couple's own Undo does (`revertVendorToConsidering`: status →
-- 'considering', the pick flags and the lock marker cleared), and the shipped
-- triggers do the rest — `event_vendor_reopen_on_release` reopens a
-- deposit-held date; this file only adds the reopen for a FEE-held date
-- (20271239789106), which that trigger cannot see.
--
-- ── MONEY ───────────────────────────────────────────────────────────────────
-- Setnayan never holds a couple's money (owner lock). The booking's terms are
-- `event_vendor_policy_acknowledgements.policy_snapshot_json` — a free-text
-- `cancellation_terms` plus disclosure flags. Free text is not machine-readable
-- and "who walked away" is not decidable here (the couple asked, the supplier
-- released), so an unlock or drop that has ANY money logged against it opens
-- the existing manual path — a `force_majeure_flags` row an admin settles BY
-- THOSE TERMS — and never computes a refund. Type 'other', never
-- 'vendor_cancellation': that type counts against the supplier's record
-- (`lib/vendor-activity.ts`), and releasing a date the couple asked to change
-- is not a supplier walking out.
--
-- ── THE CALENDAR FOLLOWS THE DATE ───────────────────────────────────────────
-- Until now a booked supplier's date could not move at all (eventDateRefusal
-- 'locked'), so nothing ever had to move a supplier's held day. Now it can, so
-- `events_booked_dates_follow_the_event` moves each held supplier's
-- Setnayan-written block and live pool reservation to the new day — on every
-- writer of `events.event_date`, not just Apply.
--
-- RLS at CREATE TABLE: couple via current_couple_event_ids() (NOT
-- current_event_ids(), which also returns GUESTS — guests see nothing),
-- supplier via current_vendor_ids() / current_vendor_profile_ids(), admin via
-- is_admin(). SELECT only; every write is one of the functions below.
-- ============================================================================

BEGIN;

-- ── 1 · THE REQUEST ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.event_date_change_requests (
  request_id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id            UUID NOT NULL REFERENCES public.events(event_id) ON DELETE CASCADE,
  proposed_date       DATE NOT NULL,
  proposed_precision  TEXT NOT NULL CHECK (proposed_precision IN ('day', 'month', 'year')),
  -- What was live when the couple asked — the "from" in every notice.
  from_date           DATE,
  from_precision      TEXT CHECK (from_precision IS NULL OR from_precision IN ('day', 'month', 'year')),
  -- open = asked, still in play (ready once no supplier is still 'asked');
  -- withdrawn = the couple took it back; applied = the date went live.
  state               TEXT NOT NULL DEFAULT 'open' CHECK (state IN ('open', 'withdrawn', 'applied')),
  asked_by_user_id    UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  asked_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  closed_at           TIMESTAMPTZ,
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ONE open request per event: a second clashing pick is told about the first.
CREATE UNIQUE INDEX IF NOT EXISTS event_date_change_requests_one_open
  ON public.event_date_change_requests (event_id) WHERE state = 'open';

-- ── 2 · EACH CONFLICTING SUPPLIER'S ANSWER ──────────────────────────────────
CREATE TABLE IF NOT EXISTS public.event_date_change_answers (
  request_id          UUID NOT NULL REFERENCES public.event_date_change_requests(request_id) ON DELETE CASCADE,
  -- Denormalized for the couple's RLS (no join in the policy).
  event_id            UUID NOT NULL REFERENCES public.events(event_id) ON DELETE CASCADE,
  -- The booked row (event_vendors' PK is vendor_id). A package's anchor and
  -- its cascade rows are one supplier: they are answered together.
  event_vendor_id     UUID NOT NULL REFERENCES public.event_vendors(vendor_id) ON DELETE CASCADE,
  -- The supplier, stamped at ask time from the booking — the supplier's RLS.
  vendor_profile_id   UUID NOT NULL REFERENCES public.vendor_profiles(vendor_profile_id) ON DELETE CASCADE,
  -- asked → moved (they can do the new date) · unlocked (they released the
  -- booking) · dropped (the couple released it after the deadline).
  answer              TEXT NOT NULL DEFAULT 'asked' CHECK (answer IN ('asked', 'moved', 'unlocked', 'dropped')),
  -- 3 days to answer; "keep waiting" gives them 3 more.
  due_at              TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '3 days'),
  answered_at         TIMESTAMPTZ,
  answered_by_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  -- The admin case an unlock with money logged opened (null = nothing to settle).
  money_flag_id       UUID REFERENCES public.force_majeure_flags(flag_id) ON DELETE SET NULL,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (request_id, event_vendor_id)
);

CREATE INDEX IF NOT EXISTS event_date_change_answers_supplier_idx
  ON public.event_date_change_answers (vendor_profile_id, answer);
CREATE INDEX IF NOT EXISTS event_date_change_answers_event_idx
  ON public.event_date_change_answers (event_id);
CREATE INDEX IF NOT EXISTS event_date_change_answers_booking_idx
  ON public.event_date_change_answers (event_vendor_id);

ALTER TABLE public.event_date_change_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_date_change_answers ENABLE ROW LEVEL SECURITY;

-- Read-only to sessions. Every write is a function below.
REVOKE ALL ON TABLE public.event_date_change_requests FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.event_date_change_answers FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.event_date_change_requests TO authenticated;
GRANT SELECT ON TABLE public.event_date_change_answers TO authenticated;

DROP POLICY IF EXISTS event_date_change_answers_read ON public.event_date_change_answers;
CREATE POLICY event_date_change_answers_read
  ON public.event_date_change_answers FOR SELECT TO authenticated
  USING (
    event_id IN (SELECT public.current_couple_event_ids())
    OR vendor_profile_id IN (SELECT public.current_vendor_ids())
    OR vendor_profile_id IN (SELECT public.current_vendor_profile_ids())
    OR public.is_admin()
  );

-- A supplier reads the request it was asked in (its date) — through its own
-- answer row, whose policy never reads this table back (no recursion).
DROP POLICY IF EXISTS event_date_change_requests_read ON public.event_date_change_requests;
CREATE POLICY event_date_change_requests_read
  ON public.event_date_change_requests FOR SELECT TO authenticated
  USING (
    event_id IN (SELECT public.current_couple_event_ids())
    OR request_id IN (SELECT a.request_id FROM public.event_date_change_answers a)
    OR public.is_admin()
  );

-- ── 3 · RELEASE ONE SUPPLIER'S BOOKING (internal — no session may call it) ──
-- Shared by "Unlock my service" (the supplier) and "Drop that supplier" (the
-- couple, after the deadline) so the two can never release differently.
CREATE OR REPLACE FUNCTION public.date_change_release_booking(
  p_request_id      UUID,
  p_event_vendor_id UUID,
  p_dropped         BOOLEAN
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ev       public.event_vendors%ROWTYPE;
  v_req      public.event_date_change_requests%ROWTYPE;
  v_date     DATE;
  v_money    BOOLEAN;
  v_terms    JSONB;
  v_terms_tx TEXT := '';
  v_flag     UUID;
BEGIN
  SELECT * INTO v_ev FROM public.event_vendors WHERE vendor_id = p_event_vendor_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN NULL;
  END IF;
  SELECT * INTO v_req FROM public.event_date_change_requests WHERE request_id = p_request_id;
  SELECT event_date INTO v_date FROM public.events WHERE event_id = v_ev.event_id;

  -- Money logged against this booking, by any of the signals the couple's own
  -- cancel reads (`bookingMoneyMoved` + the payment log) or a settled fee.
  v_money :=
    v_ev.status IN ('deposit_paid', 'delivered', 'complete')
    OR coalesce(v_ev.deposit_paid_php, 0) > 0
    OR v_ev.deposit_recorded_at IS NOT NULL
    OR EXISTS (SELECT 1 FROM public.event_vendor_payments p WHERE p.vendor_id = v_ev.vendor_id);

  -- The release — the couple's Undo, done for them (never a DELETE: the row
  -- keeps its payment log, and the admin case below points at it).
  UPDATE public.event_vendors
     SET status                    = 'considering',
         selection_match_rank      = NULL,
         linked_vendor_profile_id  = NULL,
         lock_request_state        = CASE WHEN lock_request_state IS NULL THEN NULL ELSE 'cancelled' END,
         lock_request_cancelled_at = CASE WHEN lock_request_state IS NULL THEN lock_request_cancelled_at ELSE now() END,
         updated_at                = now()
   WHERE vendor_id = p_event_vendor_id;

  -- Pool reservations: released, never deleted (owner lock 2026-06-12).
  UPDATE public.vendor_schedule_pool_bookings
     SET released_at = now(),
         release_reason = CASE WHEN p_dropped THEN 'host_cancelled' ELSE 'vendor_cancelled' END
   WHERE event_vendor_id = p_event_vendor_id
     AND released_at IS NULL;

  -- A FEE-held day (20271239789106) is not seen by the status trigger; give it
  -- back too. The function itself refuses when another booking still holds it.
  IF v_ev.marketplace_vendor_id IS NOT NULL AND v_date IS NOT NULL THEN
    BEGIN
      PERFORM public.vendor_unblock_booked_date(v_ev.marketplace_vendor_id, v_date, v_ev.vendor_id);
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'date_change_release_booking: reopen failed for % on %: %',
        v_ev.marketplace_vendor_id, v_date, SQLERRM;
    END;
  END IF;

  IF NOT v_money THEN
    RETURN NULL;
  END IF;

  -- 💸 THE MONEY GOES TO THE MANUAL PATH, WITH THE BOOKING'S OWN TERMS ON IT.
  SELECT policy_snapshot_json INTO v_terms
    FROM public.event_vendor_policy_acknowledgements
   WHERE event_id = v_ev.event_id AND event_vendor_id = v_ev.vendor_id
   LIMIT 1;
  IF v_terms IS NOT NULL THEN
    IF coalesce((v_terms ->> 'downpayment_non_refundable')::boolean, false) THEN
      v_terms_tx := v_terms_tx || ' Downpayment marked non-refundable.';
    END IF;
    IF (v_terms ->> 'refund_window_days') IS NOT NULL THEN
      v_terms_tx := v_terms_tx || ' Refundable within ' || (v_terms ->> 'refund_window_days') || ' days of booking.';
    END IF;
    IF nullif(btrim(coalesce(v_terms ->> 'cancellation_terms', '')), '') IS NOT NULL THEN
      v_terms_tx := v_terms_tx || ' Their terms: "' || left(btrim(v_terms ->> 'cancellation_terms'), 2000) || '"';
    END IF;
  END IF;
  IF v_terms_tx = '' THEN
    v_terms_tx := ' No cancellation terms were acknowledged on this booking.';
  END IF;

  INSERT INTO public.force_majeure_flags (event_id, event_vendor_id, couple_user_id, flag_type, description)
  VALUES (
    v_ev.event_id,
    v_ev.vendor_id,
    v_req.asked_by_user_id,
    'other',
    left(
      'Date change: ' || coalesce(nullif(btrim(v_ev.vendor_name), ''), 'A booked supplier') ||
      CASE WHEN p_dropped
        THEN ' was released by the couple after 3 days without an answer'
        ELSE ' unlocked their service' END ||
      ' when the couple asked to move from ' || coalesce(v_req.from_date::text, 'no date') ||
      ' to ' || v_req.proposed_date::text ||
      '. Money is logged against this booking, so the deposit is settled by the cancellation terms on the booking —' ||
      ' Setnayan does not decide a refund.' || v_terms_tx,
      4000
    )
  )
  RETURNING flag_id INTO v_flag;

  RETURN v_flag;
END $$;

REVOKE ALL ON FUNCTION public.date_change_release_booking(UUID, UUID, BOOLEAN) FROM PUBLIC, anon, authenticated;

-- ── 4 · THE ASK (couple) ────────────────────────────────────────────────────
-- The app names WHICH suppliers clash (the availability read lives in the app,
-- `lib/date-clash.server.ts`); this refuses any that is not a booked,
-- on-platform supplier of THIS event, so a forged list asks nobody extra.
CREATE OR REPLACE FUNCTION public.ask_event_date_change(
  p_event_id         UUID,
  p_date             DATE,
  p_precision        TEXT,
  p_event_vendor_ids UUID[]
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_request UUID;
  v_open    UUID;
  v_ids     UUID[];
  v_valid   INTEGER;
  v_from    DATE;
  v_fromp   TEXT;
BEGIN
  -- Only the COUPLE may ask — it can cost a supplier their booking (the same
  -- narrow gate as the deletion ask).
  IF NOT EXISTS (
    SELECT 1 FROM public.event_members m
     WHERE m.event_id = p_event_id AND m.user_id = auth.uid() AND m.member_type = 'couple'
  ) AND NOT public.is_admin() THEN
    RAISE EXCEPTION 'not_your_event' USING ERRCODE = '42501';
  END IF;

  IF p_precision IS NULL OR p_precision NOT IN ('day', 'month', 'year') OR p_date IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'bad_date');
  END IF;

  SELECT request_id INTO v_open FROM public.event_date_change_requests
   WHERE event_id = p_event_id AND state = 'open';
  IF v_open IS NOT NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'already_open', 'request_id', v_open);
  END IF;

  SELECT array_agg(DISTINCT x) INTO v_ids FROM unnest(coalesce(p_event_vendor_ids, '{}'::uuid[])) AS x WHERE x IS NOT NULL;
  IF v_ids IS NULL OR cardinality(v_ids) = 0 THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'nobody_to_ask');
  END IF;

  SELECT count(*) INTO v_valid FROM public.event_vendors ev
   WHERE ev.vendor_id = ANY (v_ids)
     AND ev.event_id = p_event_id
     AND ev.marketplace_vendor_id IS NOT NULL
     AND ev.status IN ('contracted', 'deposit_paid', 'delivered', 'complete');
  IF v_valid <> cardinality(v_ids) THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_booked');
  END IF;

  SELECT event_date, event_date_precision::text INTO v_from, v_fromp FROM public.events WHERE event_id = p_event_id;

  INSERT INTO public.event_date_change_requests
    (event_id, proposed_date, proposed_precision, from_date, from_precision, asked_by_user_id)
  VALUES
    (p_event_id, p_date, p_precision, v_from,
     CASE WHEN v_fromp IN ('day', 'month', 'year') THEN v_fromp END, auth.uid())
  RETURNING request_id INTO v_request;

  INSERT INTO public.event_date_change_answers (request_id, event_id, event_vendor_id, vendor_profile_id)
  SELECT v_request, p_event_id, ev.vendor_id, ev.marketplace_vendor_id
    FROM public.event_vendors ev
   WHERE ev.vendor_id = ANY (v_ids);

  RETURN jsonb_build_object('ok', true, 'request_id', v_request,
    'suppliers', (SELECT count(DISTINCT vendor_profile_id) FROM public.event_date_change_answers WHERE request_id = v_request));
END $$;

-- ── 5 · THE ANSWER (supplier): Move to the new date · Unlock my service ────
CREATE OR REPLACE FUNCTION public.answer_event_date_change(
  p_event_vendor_id UUID,
  p_answer          TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_vp      UUID;
  v_request UUID;
  v_event   UUID;
  v_n       INTEGER := 0;
  v_flag    UUID;
  v_flags   UUID[] := '{}';
  r         RECORD;
BEGIN
  IF p_answer IS NULL OR p_answer NOT IN ('moved', 'unlocked') THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'bad_answer');
  END IF;

  -- 🔑 Ownership on the supplier stamped AT ASK TIME, matched to the caller's
  -- own profiles — never on a column the couple can write today.
  SELECT a.vendor_profile_id, a.request_id, a.event_id
    INTO v_vp, v_request, v_event
    FROM public.event_date_change_answers a
    JOIN public.event_date_change_requests q ON q.request_id = a.request_id
   WHERE a.event_vendor_id = p_event_vendor_id
     AND q.state = 'open'
   ORDER BY q.asked_at DESC
   LIMIT 1;

  IF v_vp IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'no_pending_request');
  END IF;
  IF v_vp NOT IN (SELECT public.current_vendor_profile_ids()) AND NOT public.is_admin() THEN
    RAISE EXCEPTION 'not_your_booking' USING ERRCODE = '42501';
  END IF;

  -- Every row of THIS supplier in the request answers together (a package's
  -- anchor + cascade rows are one supplier). Only a still-'asked' row moves:
  -- a stale screen cannot overwrite an answer, or the couple's drop.
  FOR r IN
    SELECT event_vendor_id FROM public.event_date_change_answers
     WHERE request_id = v_request AND vendor_profile_id = v_vp AND answer = 'asked'
     FOR UPDATE
  LOOP
    UPDATE public.event_date_change_answers
       SET answer = p_answer, answered_at = now(), answered_by_user_id = auth.uid()
     WHERE request_id = v_request AND event_vendor_id = r.event_vendor_id;
    v_n := v_n + 1;
    IF p_answer = 'unlocked' THEN
      v_flag := public.date_change_release_booking(v_request, r.event_vendor_id, false);
      IF v_flag IS NOT NULL THEN
        UPDATE public.event_date_change_answers SET money_flag_id = v_flag
         WHERE request_id = v_request AND event_vendor_id = r.event_vendor_id;
        v_flags := v_flags || v_flag;
      END IF;
    END IF;
  END LOOP;

  -- Already answered (or dropped by the couple): nothing moved, nobody is told twice.
  IF v_n = 0 THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'no_pending_request');
  END IF;

  UPDATE public.event_date_change_requests SET updated_at = now() WHERE request_id = v_request;

  RETURN jsonb_build_object(
    'ok', true,
    'answer', p_answer,
    'request_id', v_request,
    'event_id', v_event,
    'ready', NOT EXISTS (SELECT 1 FROM public.event_date_change_answers WHERE request_id = v_request AND answer = 'asked'),
    'money_flag_ids', to_jsonb(v_flags)
  );
END $$;

-- ── 6 · THE COUPLE'S SIDE: withdraw · keep waiting · drop · applied ────────
CREATE OR REPLACE FUNCTION public.settle_event_date_change(
  p_request_id      UUID,
  p_action          TEXT,
  p_event_vendor_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_req   public.event_date_change_requests%ROWTYPE;
  v_vp    UUID;
  v_live  DATE;
  v_flag  UUID;
  v_flags UUID[] := '{}';
  r       RECORD;
BEGIN
  SELECT * INTO v_req FROM public.event_date_change_requests WHERE request_id = p_request_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_found');
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.event_members m
     WHERE m.event_id = v_req.event_id AND m.user_id = auth.uid() AND m.member_type = 'couple'
  ) AND NOT public.is_admin() THEN
    RAISE EXCEPTION 'not_your_event' USING ERRCODE = '42501';
  END IF;
  IF v_req.state <> 'open' THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_open', 'state', v_req.state);
  END IF;

  -- Withdraw = "cancel the change": anytime while open. The date never moved,
  -- so there is nothing to put back on the event; an answer already given
  -- stays as the record of what was asked and said (an unlock is the
  -- supplier's own act and is not undone by the couple changing their mind).
  IF p_action = 'withdraw' THEN
    UPDATE public.event_date_change_requests
       SET state = 'withdrawn', closed_at = now(), updated_at = now()
     WHERE request_id = p_request_id;
    RETURN jsonb_build_object('ok', true, 'action', 'withdraw', 'event_id', v_req.event_id);
  END IF;

  -- The date went live through Apply — only if it really did.
  IF p_action = 'applied' THEN
    SELECT event_date INTO v_live FROM public.events WHERE event_id = v_req.event_id;
    IF v_live IS DISTINCT FROM v_req.proposed_date
       OR EXISTS (SELECT 1 FROM public.event_date_change_answers WHERE request_id = p_request_id AND answer = 'asked') THEN
      RETURN jsonb_build_object('ok', false, 'reason', 'not_live');
    END IF;
    UPDATE public.event_date_change_requests
       SET state = 'applied', closed_at = now(), updated_at = now()
     WHERE request_id = p_request_id;
    RETURN jsonb_build_object('ok', true, 'action', 'applied', 'event_id', v_req.event_id);
  END IF;

  IF p_action NOT IN ('wait', 'drop') OR p_event_vendor_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'bad_action');
  END IF;

  SELECT vendor_profile_id INTO v_vp FROM public.event_date_change_answers
   WHERE request_id = p_request_id AND event_vendor_id = p_event_vendor_id;
  IF v_vp IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_asked');
  END IF;
  -- Only after the 3 days, and only while they have not answered.
  IF NOT EXISTS (
    SELECT 1 FROM public.event_date_change_answers
     WHERE request_id = p_request_id AND vendor_profile_id = v_vp AND answer = 'asked' AND due_at <= now()
  ) THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_due');
  END IF;

  IF p_action = 'wait' THEN
    UPDATE public.event_date_change_answers
       SET due_at = now() + interval '3 days'
     WHERE request_id = p_request_id AND vendor_profile_id = v_vp AND answer = 'asked';
    RETURN jsonb_build_object('ok', true, 'action', 'wait', 'event_id', v_req.event_id);
  END IF;

  -- Drop that supplier: the SAME release the supplier's Unlock runs.
  FOR r IN
    SELECT event_vendor_id FROM public.event_date_change_answers
     WHERE request_id = p_request_id AND vendor_profile_id = v_vp AND answer = 'asked'
     FOR UPDATE
  LOOP
    UPDATE public.event_date_change_answers
       SET answer = 'dropped', answered_at = now(), answered_by_user_id = auth.uid()
     WHERE request_id = p_request_id AND event_vendor_id = r.event_vendor_id;
    v_flag := public.date_change_release_booking(p_request_id, r.event_vendor_id, true);
    IF v_flag IS NOT NULL THEN
      UPDATE public.event_date_change_answers SET money_flag_id = v_flag
       WHERE request_id = p_request_id AND event_vendor_id = r.event_vendor_id;
      v_flags := v_flags || v_flag;
    END IF;
  END LOOP;
  UPDATE public.event_date_change_requests SET updated_at = now() WHERE request_id = p_request_id;

  RETURN jsonb_build_object(
    'ok', true, 'action', 'drop', 'event_id', v_req.event_id, 'vendor_profile_id', v_vp,
    'ready', NOT EXISTS (SELECT 1 FROM public.event_date_change_answers WHERE request_id = p_request_id AND answer = 'asked'),
    'money_flag_ids', to_jsonb(v_flags)
  );
END $$;

REVOKE ALL ON FUNCTION public.ask_event_date_change(UUID, DATE, TEXT, UUID[]) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.answer_event_date_change(UUID, TEXT) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.settle_event_date_change(UUID, TEXT, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ask_event_date_change(UUID, DATE, TEXT, UUID[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.answer_event_date_change(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.settle_event_date_change(UUID, TEXT, UUID) TO authenticated;

-- ── 7 · THE CALENDAR FOLLOWS THE DATE ──────────────────────────────────────
-- A held day (deposit-held or fee-held) moves with the event; a live pool
-- reservation moves with it. Exception-safe: a calendar hiccup must never roll
-- back the date the couple applied.
CREATE OR REPLACE FUNCTION public.events_booked_dates_follow_the_event()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r RECORD;
BEGIN
  IF OLD.event_date IS NULL OR NEW.event_date IS NULL OR OLD.event_date = NEW.event_date THEN
    RETURN NULL;
  END IF;

  FOR r IN
    SELECT ev.vendor_id, ev.marketplace_vendor_id
      FROM public.event_vendors ev
     WHERE ev.event_id = NEW.event_id
       AND ev.marketplace_vendor_id IS NOT NULL
       AND (
         ev.status IN ('deposit_paid', 'delivered', 'complete')
         OR EXISTS (
           SELECT 1 FROM public.booking_fee_charges c
            WHERE c.event_vendor_id = ev.vendor_id
              AND c.status IN ('paid', 'waived_free5', 'waived_import')
         )
       )
  LOOP
    BEGIN
      PERFORM public.vendor_unblock_booked_date(r.marketplace_vendor_id, OLD.event_date, r.vendor_id);
      PERFORM public.vendor_block_booked_date(r.marketplace_vendor_id, NEW.event_date, 'Booked');
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'events_booked_dates_follow_the_event: % from % to %: %',
        r.marketplace_vendor_id, OLD.event_date, NEW.event_date, SQLERRM;
    END;
  END LOOP;

  BEGIN
    UPDATE public.vendor_schedule_pool_bookings
       SET booked_date = NEW.event_date
     WHERE event_id = NEW.event_id
       AND released_at IS NULL;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'events_booked_dates_follow_the_event: pools for %: %', NEW.event_id, SQLERRM;
  END;

  RETURN NULL;
END $$;

REVOKE ALL ON FUNCTION public.events_booked_dates_follow_the_event() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS events_booked_dates_follow_the_event ON public.events;
CREATE TRIGGER events_booked_dates_follow_the_event
  AFTER UPDATE OF event_date ON public.events
  FOR EACH ROW
  EXECUTE FUNCTION public.events_booked_dates_follow_the_event();

COMMENT ON TABLE public.event_date_change_requests IS
  'A couple''s ask to move their date when it clashes with booked suppliers (owner 2026-10-01). One open per event. Written only by ask_/settle_event_date_change. The date applies through the Maker''s Apply once no supplier is still asked.';
COMMENT ON TABLE public.event_date_change_answers IS
  'Each conflicting booked supplier''s answer to a date change: asked → moved | unlocked (supplier) | dropped (couple, after due_at). Written only by answer_/settle_event_date_change.';

COMMIT;
