-- every change keeps its history and the chat is the record
-- Created via `pnpm migration:new`. KEEP THIS MIGRATION IDEMPOTENT.
-- ════════════════════════════════════════════════════════════════════════════
-- SUPPLIER BUILD 3 · LANE B — two owner rulings (8–9 Nov 2026):
--
--   ⚖ "every change keeps its history" — Details shows what is agreed NOW, and
--     each row says "Changed N×", which opens to the earlier values (who, when).
--   ⚖ "THE CHAT IS THE OVERALL RECORD" — a booking ask, its answer, a withdrawn
--     ask, every payment logged / confirmed / refused, a refund, and every
--     schedule or guest-count change posts a line in that client's chat.
--
-- ── 1 · public.booking_changes — ONLY values that are OVERWRITTEN IN PLACE ──
-- Measured against the replayed schema before writing (never guessed):
--   events.event_date (+ event_date_precision)  DATE, overwritten by the host;
--       no history anywhere. → field 'event_date'. Stored at its precision:
--       'YYYY-MM-DD' (day) · 'YYYY-MM' (month) · 'YYYY' (year).
--   events.estimated_pax  the host's planning count — the FLOOR of the live pax
--       (apps/web/lib/pax.ts resolveLivePax = final_pax when finalized, else
--       max(estimated_pax, live headcount)). The live headcount itself is
--       DERIVED from guests rows on read, never stored, so it has no single
--       value to overwrite. → field 'guest_estimate'.
--   events.final_pax  the frozen binding count, written by finalizeGuestList and
--       cleared by reopenGuestList (lib/pax.ts). → field 'guest_count_final'.
--   event_schedule_blocks.start_at  for blocks whose responsible_vendor_ids is
--       non-empty — those ids are event_vendors.vendor_id values (20270825042743)
--       and the supplier's call time is the EARLIEST of them
--       (lib/coordinator-broadcasts.ts earliestTaggedBlock). One row per tagged
--       shop (event_vendors.marketplace_vendor_id); an off-platform supplier
--       (no shop) has no thread and is skipped. A time_tba side is stored NULL
--       (its 00:00 is a placeholder day, never a time). → field 'schedule_time'.
--   event_appointments.scheduled_at  previous_scheduled_at
--       (20271215830712) keeps ONE prior value; this keeps all of them.
--       → field 'meeting_time'. Logged only: the meeting card already posts.
-- NOT logged (measured, not overwritten in place, or already versioned):
--   chat_threads.pax_current — written once at thread creation
--   (unlock-category.ts, inquiry-actions.ts), never re-pushed; quotes
--   (vendor_proposals superseded chain + proposal_amendments); payments
--   (event_vendor_payments rows, lib/payment-history.ts) — rows, not overwrites.
--
-- WRITTEN ONLY BY THE SECURITY DEFINER TRIGGERS BELOW. Clients get SELECT and
-- nothing else. `changed_by` is auth.uid() at the moment of the write; a write
-- through the service role (lib/pax.ts finalize/reopen, the guest-count edit in
-- app/dashboard/[eventId]/actions.ts) has no auth.uid(), so it reads NULL —
-- the admin_audit_log row those paths already write names the actor.
-- `changed_by` is deliberately an un-keyed uuid (the refunds table's
-- recorded_by_user_id shape): an actor stamp, see the erasure note in the
-- lane report.
--
-- ── 2 · THE CHAT'S SYSTEM LINES ─────────────────────────────────────────────
-- chat_messages rows with sender_role = 'system', sender_user_id = NULL, into
-- the ONE chat_threads row for (event_id, vendor_profile_id) — UNIQUE since
-- 0019. No thread → nothing is posted. Measured triggers on chat_messages:
--   • chat_messages_derive_sender / chat_messages_guard_end_user_write run for
--     END-USER sessions. Inside these DEFINER functions current_user is the
--     owner, so derive_sender passes the row through untouched — but the guard
--     reads the `role` SETTING, which a DEFINER call does not change, so a line
--     posted while a host or supplier is signed in IS SCREENED by
--     chat_contact_categories(). A line that carries a person's words or a
--     reference number therefore falls back to its plain form when the screen
--     would refuse it (the words stay on their own row).
--   • reveal_vendor_name_on_first_reply · chat_messages_unlock_vendor_name ·
--     on_vendor_first_reply fire on sender_role = 'vendor' only;
--     stamp_find_lock_on_inquiry on couple/coordinator only — a system row
--     moves none of them.
--   • on_chat_message_inserted bumps chat_threads.updated_at — intended: the
--     thread rises in both inboxes.
--   • chat_messages_notify_webhook posts the row to /api/notify, which pushes
--     non-vendor rows to the shop (route.ts) — the same path the build-3state
--     nudge (sender_role 'system', service role) already takes.
-- Every trigger body is wrapped: a failing side-write RAISEs a WARNING and the
-- parent write goes through. A record must never cost the booking.
-- ════════════════════════════════════════════════════════════════════════════

BEGIN;

-- ── 1 · The change log ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.booking_changes (
  change_id          BIGSERIAL PRIMARY KEY,
  event_id           UUID NOT NULL REFERENCES public.events(event_id) ON DELETE CASCADE,
  -- NULL = an event-wide value (the date, the guest count): every supplier on
  -- the event sees it. Set = that one shop's value (its call time, its meeting).
  vendor_profile_id  UUID REFERENCES public.vendor_profiles(vendor_profile_id) ON DELETE CASCADE,
  field              TEXT NOT NULL,
  -- The row the value lives on when it is not the event itself
  -- (event_schedule_blocks.block_id · event_appointments.appointment_id).
  subject_id         UUID,
  from_value         TEXT,
  to_value           TEXT,
  changed_by         UUID,
  changed_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT booking_changes_field_check CHECK (field IN (
    'event_date', 'guest_estimate', 'guest_count_final', 'schedule_time', 'meeting_time'
  )),
  CONSTRAINT booking_changes_value_moved CHECK (from_value IS DISTINCT FROM to_value)
);

CREATE INDEX IF NOT EXISTS booking_changes_event_idx
  ON public.booking_changes (event_id, changed_at DESC);
CREATE INDEX IF NOT EXISTS booking_changes_vendor_idx
  ON public.booking_changes (vendor_profile_id, event_id, changed_at DESC)
  WHERE vendor_profile_id IS NOT NULL;

ALTER TABLE public.booking_changes ENABLE ROW LEVEL SECURITY;

-- Reads only. Every write is a trigger below.
REVOKE ALL ON public.booking_changes FROM anon;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.booking_changes FROM authenticated;
GRANT SELECT ON public.booking_changes TO authenticated;
REVOKE ALL ON SEQUENCE public.booking_changes_change_id_seq FROM anon, authenticated;

-- Pattern B (hosts) — the couple-side helper, as event_vendor_payments_couple_read.
DROP POLICY IF EXISTS booking_changes_couple_read ON public.booking_changes;
CREATE POLICY booking_changes_couple_read
  ON public.booking_changes FOR SELECT
  TO authenticated
  USING (event_id IN (SELECT public.current_couple_event_ids()));

-- The supplier: its own rows, and the event-wide rows of an event it holds a
-- conversation on. The three branches are chat_messages_member_read's vendor
-- branches (owner/admin · agent on an assigned service) — the log sits beside
-- the chat and reaches exactly who the chat reaches.
DROP POLICY IF EXISTS booking_changes_vendor_read ON public.booking_changes;
CREATE POLICY booking_changes_vendor_read
  ON public.booking_changes FOR SELECT
  TO authenticated
  USING (
    vendor_profile_id IN (SELECT public.current_vendor_profile_ids())
    OR (
      vendor_profile_id IN (SELECT public.current_vendor_ids('viewer'))
      AND event_id IN (SELECT public.agent_customer_event_ids())
    )
    OR (
      vendor_profile_id IS NULL
      AND (
        event_id IN (
          SELECT t.event_id FROM public.chat_threads t
           WHERE t.vendor_profile_id IN (SELECT public.current_vendor_profile_ids())
        )
        OR event_id IN (SELECT public.agent_customer_event_ids())
      )
    )
  );

-- Pattern F.
DROP POLICY IF EXISTS booking_changes_admin_read ON public.booking_changes;
CREATE POLICY booking_changes_admin_read
  ON public.booking_changes FOR SELECT
  TO authenticated
  USING ((SELECT public.is_admin()));

COMMENT ON TABLE public.booking_changes IS
  'Every earlier value of a booking fact that is otherwise OVERWRITTEN IN PLACE (owner 2026-11-09, "every change keeps its history"): events.event_date, events.estimated_pax (guest_estimate), events.final_pax (guest_count_final), a tagged event_schedule_blocks.start_at per tagged shop (schedule_time, subject = block_id), event_appointments.scheduled_at (meeting_time, subject = appointment_id). vendor_profile_id NULL = event-wide. Values are machine text: dates YYYY-MM-DD / YYYY-MM / YYYY by precision, timestamps ISO-8601 UTC, counts as integers, NULL = none / time TBA. Written ONLY by SECURITY DEFINER triggers (migration 20271329937802); read by hosts, the event''s suppliers (own + event-wide rows) and admins. Read in the app through apps/web/lib/booking-changes.server.ts.';

-- ── 2 · Shared pieces (internal: no client can execute them) ─────────────────

-- Machine text for a timestamp: ISO-8601, UTC, seconds.
CREATE OR REPLACE FUNCTION public.booking_change_ts_text(p_at TIMESTAMPTZ)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT CASE WHEN p_at IS NULL THEN NULL
              ELSE to_char(p_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') END;
$$;
REVOKE ALL ON FUNCTION public.booking_change_ts_text(TIMESTAMPTZ) FROM PUBLIC, anon, authenticated;

-- An event date at the precision it was given.
CREATE OR REPLACE FUNCTION public.booking_change_date_text(p_date DATE, p_precision TEXT)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT CASE WHEN p_date IS NULL THEN NULL
              WHEN p_precision = 'year'  THEN to_char(p_date, 'YYYY')
              WHEN p_precision = 'month' THEN to_char(p_date, 'YYYY-MM')
              ELSE to_char(p_date, 'YYYY-MM-DD') END;
$$;
REVOKE ALL ON FUNCTION public.booking_change_date_text(DATE, TEXT) FROM PUBLIC, anon, authenticated;

-- The same date in words, for a chat line ("Dec 12, 2026" · "December 2026" · "2026").
CREATE OR REPLACE FUNCTION public.booking_change_date_words(p_date DATE, p_precision TEXT)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT CASE WHEN p_date IS NULL THEN 'no date'
              WHEN p_precision = 'year'  THEN to_char(p_date, 'YYYY')
              WHEN p_precision = 'month' THEN to_char(p_date, 'FMMonth YYYY')
              ELSE to_char(p_date, 'FMMon FMDD, YYYY') END;
$$;
REVOKE ALL ON FUNCTION public.booking_change_date_words(DATE, TEXT) FROM PUBLIC, anon, authenticated;

-- Pesos for a chat line: "₱10,000" · "₱10,000.50".
CREATE OR REPLACE FUNCTION public.booking_change_php_words(p_amount NUMERIC)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT '₱' || CASE WHEN p_amount = trunc(p_amount)
                     THEN to_char(p_amount, 'FM999,999,999,990')
                     ELSE to_char(p_amount, 'FM999,999,999,990.00') END;
$$;
REVOKE ALL ON FUNCTION public.booking_change_php_words(NUMERIC) FROM PUBLIC, anon, authenticated;

-- One line into the (event, shop) conversation. No thread → nothing. When the
-- end-user screen would refuse `p_body` (it carries a person's words or a
-- reference), `p_plain` is posted instead. Never raises.
CREATE OR REPLACE FUNCTION public.chat_record_post_line(
  p_event_id          UUID,
  p_vendor_profile_id UUID,
  p_body              TEXT,
  p_plain             TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_thread UUID;
  v_body   TEXT;
BEGIN
  IF p_event_id IS NULL OR p_vendor_profile_id IS NULL OR NULLIF(btrim(p_body), '') IS NULL THEN
    RETURN;
  END IF;
  SELECT t.thread_id INTO v_thread
    FROM public.chat_threads t
   WHERE t.event_id = p_event_id AND t.vendor_profile_id = p_vendor_profile_id;
  IF v_thread IS NULL THEN
    RETURN;
  END IF;

  v_body := left(btrim(p_body), 4000);
  IF p_plain IS NOT NULL
     AND cardinality(public.chat_contact_categories(v_body, 'chat')) > 0 THEN
    v_body := left(btrim(p_plain), 4000);
  END IF;

  BEGIN
    INSERT INTO public.chat_messages
      (thread_id, event_id, vendor_profile_id, sender_user_id, sender_role, body)
    VALUES
      (v_thread, p_event_id, p_vendor_profile_id, NULL, 'system', v_body);
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'chat_record_post_line: no line posted for event % shop % (%): %',
      p_event_id, p_vendor_profile_id, SQLSTATE, SQLERRM;
  END;
END;
$$;
REVOKE ALL ON FUNCTION public.chat_record_post_line(UUID, UUID, TEXT, TEXT) FROM PUBLIC, anon, authenticated;

COMMENT ON FUNCTION public.chat_record_post_line(UUID, UUID, TEXT, TEXT) IS
  'Internal (no client grant): posts one sender_role=system line into the chat_threads row for (event, shop), or nothing when there is no thread. Falls back to p_plain when chat_contact_categories() would refuse p_body. Never raises. Migration 20271329937802 — "the chat is the overall record".';

-- An event-wide line: every live conversation on the event (not archived, not
-- a declined inquiry).
CREATE OR REPLACE FUNCTION public.chat_record_post_event_line(p_event_id UUID, p_body TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT t.vendor_profile_id
      FROM public.chat_threads t
     WHERE t.event_id = p_event_id
       AND t.archived_at IS NULL
       AND t.inquiry_status <> 'declined'
  LOOP
    PERFORM public.chat_record_post_line(p_event_id, r.vendor_profile_id, p_body);
  END LOOP;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'chat_record_post_event_line: event % (%): %', p_event_id, SQLSTATE, SQLERRM;
END;
$$;
REVOKE ALL ON FUNCTION public.chat_record_post_event_line(UUID, TEXT) FROM PUBLIC, anon, authenticated;

-- ── 3 · events: date + guest count ──────────────────────────────────────────
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

  RETURN NULL;
END;
$$;
REVOKE ALL ON FUNCTION public.tg_events_keep_booking_history() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS events_keep_booking_history ON public.events;
CREATE TRIGGER events_keep_booking_history
  AFTER UPDATE OF event_date, event_date_precision, estimated_pax, final_pax ON public.events
  FOR EACH ROW EXECUTE FUNCTION public.tg_events_keep_booking_history();

-- ── 4 · event_schedule_blocks: a tagged supplier's time ─────────────────────
CREATE OR REPLACE FUNCTION public.tg_schedule_blocks_keep_booking_history()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid   UUID := auth.uid();
  v_from  TEXT;
  v_to    TEXT;
  v_shift INTERVAL;
  v_line  TEXT;
  v_label TEXT;
  r       RECORD;
BEGIN
  BEGIN
    IF COALESCE(cardinality(NEW.responsible_vendor_ids), 0) = 0 THEN
      RETURN NULL;
    END IF;
    v_from := CASE WHEN OLD.time_tba THEN NULL ELSE public.booking_change_ts_text(OLD.start_at) END;
    v_to   := CASE WHEN NEW.time_tba THEN NULL ELSE public.booking_change_ts_text(NEW.start_at) END;
    IF v_from IS NOT DISTINCT FROM v_to THEN
      RETURN NULL;
    END IF;

    -- The chat line. A WHOLE-DAY shift with the clock unchanged is the
    -- Schedule following the event's date (the default chapters' trigger and
    -- move_event_schedule_with_date) — the date line already says it. A
    -- change INTO "time TBA" is not a time.
    v_shift := NEW.start_at - OLD.start_at;
    v_label := left(btrim(NEW.label), 80);
    IF NEW.time_tba THEN
      v_line := NULL;
    ELSIF v_from IS NOT NULL
          AND extract(epoch FROM v_shift)::BIGINT % 86400 = 0 THEN
      v_line := NULL;
    ELSIF v_from IS NULL THEN
      v_line := 'Schedule change · ' || v_label || ' · now at '
             || to_char(NEW.start_at AT TIME ZONE 'Asia/Manila', 'FMMon FMDD, FMHH12:MI AM');
    ELSIF (OLD.start_at AT TIME ZONE 'Asia/Manila')::DATE = (NEW.start_at AT TIME ZONE 'Asia/Manila')::DATE THEN
      v_line := 'Schedule change · ' || v_label || ' · '
             || to_char(OLD.start_at AT TIME ZONE 'Asia/Manila', 'FMHH12:MI AM') || ' → '
             || to_char(NEW.start_at AT TIME ZONE 'Asia/Manila', 'FMHH12:MI AM');
    ELSE
      v_line := 'Schedule change · ' || v_label || ' · '
             || to_char(OLD.start_at AT TIME ZONE 'Asia/Manila', 'FMMon FMDD, FMHH12:MI AM') || ' → '
             || to_char(NEW.start_at AT TIME ZONE 'Asia/Manila', 'FMMon FMDD, FMHH12:MI AM');
    END IF;

    FOR r IN
      SELECT DISTINCT ev.marketplace_vendor_id AS shop
        FROM public.event_vendors ev
       WHERE ev.event_id = NEW.event_id
         AND ev.vendor_id = ANY (NEW.responsible_vendor_ids)
         AND ev.marketplace_vendor_id IS NOT NULL
    LOOP
      INSERT INTO public.booking_changes
        (event_id, vendor_profile_id, field, subject_id, from_value, to_value, changed_by)
      VALUES
        (NEW.event_id, r.shop, 'schedule_time', NEW.block_id, v_from, v_to, v_uid);
      IF v_line IS NOT NULL THEN
        PERFORM public.chat_record_post_line(NEW.event_id, r.shop, v_line);
      END IF;
    END LOOP;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'tg_schedule_blocks_keep_booking_history block %: % %', NEW.block_id, SQLSTATE, SQLERRM;
  END;
  RETURN NULL;
END;
$$;
REVOKE ALL ON FUNCTION public.tg_schedule_blocks_keep_booking_history() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS event_schedule_blocks_keep_booking_history ON public.event_schedule_blocks;
CREATE TRIGGER event_schedule_blocks_keep_booking_history
  AFTER UPDATE OF start_at, time_tba ON public.event_schedule_blocks
  FOR EACH ROW EXECUTE FUNCTION public.tg_schedule_blocks_keep_booking_history();

-- ── 5 · event_appointments: a meeting's time (logged; the card already posts) ─
CREATE OR REPLACE FUNCTION public.tg_appointments_keep_booking_history()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  BEGIN
    IF public.booking_change_ts_text(NEW.scheduled_at)
       IS DISTINCT FROM public.booking_change_ts_text(OLD.scheduled_at) THEN
      INSERT INTO public.booking_changes
        (event_id, vendor_profile_id, field, subject_id, from_value, to_value, changed_by)
      VALUES
        (NEW.event_id, NEW.vendor_profile_id, 'meeting_time', NEW.appointment_id,
         public.booking_change_ts_text(OLD.scheduled_at),
         public.booking_change_ts_text(NEW.scheduled_at), auth.uid());
    END IF;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'tg_appointments_keep_booking_history appointment %: % %', NEW.appointment_id, SQLSTATE, SQLERRM;
  END;
  RETURN NULL;
END;
$$;
REVOKE ALL ON FUNCTION public.tg_appointments_keep_booking_history() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS event_appointments_keep_booking_history ON public.event_appointments;
CREATE TRIGGER event_appointments_keep_booking_history
  AFTER UPDATE OF scheduled_at ON public.event_appointments
  FOR EACH ROW EXECUTE FUNCTION public.tg_appointments_keep_booking_history();

-- ── 6 · event_vendors: the booking ask, its answer, a withdrawn ask ──────────
-- lock_request_state (20271107090000): NULL never asked · pending · agreed ·
-- declined · cancelled · expired. 'cancelled' is written by the couple
-- (cancel_vendor_lock_request) AND by vendor_agree_to_lock's group_taken
-- branch — so "withdrawn by the hosts" is said only when a host made it.
-- The deposit's own refusal / ruling live on this row too (the ledger CHECK
-- event_vendor_payments_deposit_refuses_on_the_booking keeps them off the
-- payment row), so they are said here.
CREATE OR REPLACE FUNCTION public.tg_event_vendors_chat_record()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_reason TEXT;
  v_amount NUMERIC;
  v_amt    TEXT;
BEGIN
  IF NEW.marketplace_vendor_id IS NULL OR NEW.event_id IS NULL THEN
    RETURN NULL;
  END IF;

  -- ── the ask ──
  BEGIN
    IF (TG_OP = 'INSERT' AND NEW.lock_request_state IS NOT NULL)
       OR (TG_OP = 'UPDATE' AND NEW.lock_request_state IS DISTINCT FROM OLD.lock_request_state) THEN
      v_reason := NULLIF(btrim(COALESCE(NEW.lock_decline_reason, '')), '');
      CASE NEW.lock_request_state
        WHEN 'pending' THEN
          PERFORM public.chat_record_post_line(NEW.event_id, NEW.marketplace_vendor_id,
            'Booking ask sent by the hosts · waiting for the supplier''s answer');
        WHEN 'agreed' THEN
          PERFORM public.chat_record_post_line(NEW.event_id, NEW.marketplace_vendor_id, 'Booked ✓');
        WHEN 'declined' THEN
          PERFORM public.chat_record_post_line(NEW.event_id, NEW.marketplace_vendor_id,
            CASE WHEN v_reason IS NULL THEN 'Not available' ELSE 'Not available · ' || v_reason END,
            'Not available');
        WHEN 'cancelled' THEN
          PERFORM public.chat_record_post_line(NEW.event_id, NEW.marketplace_vendor_id,
            CASE WHEN auth.uid() IS NOT NULL AND EXISTS (
                        SELECT 1 FROM public.event_members em
                         WHERE em.event_id = NEW.event_id
                           AND em.user_id = auth.uid()
                           AND em.member_type = 'couple')
                 THEN 'Booking ask withdrawn by the hosts'
                 ELSE 'Booking ask closed' END);
        WHEN 'expired' THEN
          PERFORM public.chat_record_post_line(NEW.event_id, NEW.marketplace_vendor_id,
            'Booking ask expired without an answer');
        ELSE
          NULL;
      END CASE;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'tg_event_vendors_chat_record (ask) booking %: % %', NEW.vendor_id, SQLSTATE, SQLERRM;
  END;

  -- ── the first payment: refused, or ruled on ──
  BEGIN
    IF TG_OP = 'UPDATE'
       AND (   (NEW.deposit_declined_at IS NOT NULL AND OLD.deposit_declined_at IS NULL)
            OR (NEW.deposit_dispute_settled_at IS NOT NULL AND OLD.deposit_dispute_settled_at IS NULL)) THEN
      SELECT p.amount_php INTO v_amount
        FROM public.event_vendor_payments p
       WHERE p.vendor_id = NEW.vendor_id AND p.is_deposit_record
       LIMIT 1;
      v_amt := CASE WHEN v_amount IS NULL THEN '' ELSE ' · ' || public.booking_change_php_words(v_amount) END;

      IF NEW.deposit_declined_at IS NOT NULL AND OLD.deposit_declined_at IS NULL THEN
        v_reason := NULLIF(btrim(COALESCE(NEW.deposit_decline_reason, '')), '');
        PERFORM public.chat_record_post_line(NEW.event_id, NEW.marketplace_vendor_id,
          'First payment not received' || v_amt || COALESCE(' · ' || v_reason, ''),
          'First payment not received' || v_amt);
      END IF;
      IF NEW.deposit_dispute_settled_at IS NOT NULL AND OLD.deposit_dispute_settled_at IS NULL THEN
        PERFORM public.chat_record_post_line(NEW.event_id, NEW.marketplace_vendor_id,
          'Setnayan reviewed the first payment' || v_amt || ' · '
          || CASE NEW.deposit_dispute_outcome WHEN 'payment_stands' THEN 'it stands'
                                              WHEN 'not_received' THEN 'not received'
                                              ELSE 'settled' END);
      END IF;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'tg_event_vendors_chat_record (deposit) booking %: % %', NEW.vendor_id, SQLSTATE, SQLERRM;
  END;

  RETURN NULL;
END;
$$;
REVOKE ALL ON FUNCTION public.tg_event_vendors_chat_record() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS event_vendors_chat_record ON public.event_vendors;
CREATE TRIGGER event_vendors_chat_record
  AFTER INSERT OR UPDATE OF lock_request_state, deposit_declined_at, deposit_dispute_settled_at
  ON public.event_vendors
  FOR EACH ROW EXECUTE FUNCTION public.tg_event_vendors_chat_record();

-- ── 7 · event_vendor_payments: logged · confirmed · refused · ruled · resent ─
-- The deposit IS a ledger row (is_deposit_record, 20271222394035), and its
-- confirmation is mirrored onto this row by trg_confirm_deposit_record_on_
-- acknowledgement — so "confirmed" is said once, here, for both paths.
CREATE OR REPLACE FUNCTION public.tg_vendor_payments_chat_record()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_shop   UUID;
  v_event  UUID;
  v_amt    TEXT;
  v_method TEXT;
  v_ref    TEXT;
  v_reason TEXT;
  v_kind   TEXT;
BEGIN
  BEGIN
    SELECT ev.marketplace_vendor_id, COALESCE(NEW.event_id, ev.event_id)
      INTO v_shop, v_event
      FROM public.event_vendors ev
     WHERE ev.vendor_id = NEW.vendor_id;
    IF v_shop IS NULL OR v_event IS NULL THEN
      RETURN NULL;
    END IF;

    v_amt    := public.booking_change_php_words(NEW.amount_php);
    v_method := left(NULLIF(btrim(COALESCE(NEW.method, '')), ''), 40);
    v_ref    := left(NULLIF(btrim(COALESCE(NEW.reference, '')), ''), 60);
    v_kind   := CASE WHEN NEW.is_deposit_record THEN 'First payment' ELSE 'Payment' END;

    IF TG_OP = 'INSERT' THEN
      IF NEW.vendor_confirmed_at IS NOT NULL THEN
        PERFORM public.chat_record_post_line(v_event, v_shop,
          v_kind || ' recorded · ' || v_amt || COALESCE(' · ' || v_method, '') || ' · confirmed');
      ELSE
        PERFORM public.chat_record_post_line(v_event, v_shop,
          v_kind || ' logged · ' || v_amt || COALESCE(' · ' || v_method, '') || COALESCE(' · ref ' || v_ref, '')
            || CASE WHEN NEW.proof_r2_key IS NOT NULL THEN ' · proof attached' ELSE '' END
            || ' · waiting for the supplier to confirm',
          v_kind || ' logged · ' || v_amt || COALESCE(' · ' || v_method, '')
            || CASE WHEN NEW.proof_r2_key IS NOT NULL THEN ' · proof attached' ELSE '' END
            || ' · waiting for the supplier to confirm');
      END IF;
      RETURN NULL;
    END IF;

    -- UPDATE
    IF NEW.vendor_confirmed_at IS NOT NULL AND OLD.vendor_confirmed_at IS NULL THEN
      PERFORM public.chat_record_post_line(v_event, v_shop, v_kind || ' confirmed · ' || v_amt);
    END IF;
    IF NEW.payment_refused_at IS NOT NULL AND OLD.payment_refused_at IS NULL THEN
      v_reason := NULLIF(btrim(COALESCE(NEW.payment_refusal_reason, '')), '');
      PERFORM public.chat_record_post_line(v_event, v_shop,
        v_kind || ' not received · ' || v_amt || COALESCE(' · ' || v_reason, ''),
        v_kind || ' not received · ' || v_amt);
    END IF;
    IF NEW.payment_refused_at IS NULL AND OLD.payment_refused_at IS NOT NULL
       AND NEW.payment_dispute_settled_at IS NULL THEN
      PERFORM public.chat_record_post_line(v_event, v_shop,
        v_kind || ' sent again · ' || v_amt || ' · waiting for the supplier to confirm');
    END IF;
    IF NEW.payment_dispute_settled_at IS NOT NULL AND OLD.payment_dispute_settled_at IS NULL THEN
      PERFORM public.chat_record_post_line(v_event, v_shop,
        'Setnayan reviewed the ' || lower(v_kind) || ' · ' || v_amt || ' · '
        || CASE NEW.payment_dispute_outcome WHEN 'payment_stands' THEN 'it stands'
                                            WHEN 'not_received' THEN 'not received'
                                            ELSE 'settled' END);
    END IF;
    IF NEW.proof_r2_key IS NOT NULL AND OLD.proof_r2_key IS NULL THEN
      PERFORM public.chat_record_post_line(v_event, v_shop, v_kind || ' proof added · ' || v_amt);
    END IF;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'tg_vendor_payments_chat_record payment %: % %', NEW.payment_id, SQLSTATE, SQLERRM;
  END;
  RETURN NULL;
END;
$$;
REVOKE ALL ON FUNCTION public.tg_vendor_payments_chat_record() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS event_vendor_payments_chat_record ON public.event_vendor_payments;
CREATE TRIGGER event_vendor_payments_chat_record
  AFTER INSERT OR UPDATE OF vendor_confirmed_at, payment_refused_at, payment_dispute_settled_at, proof_r2_key
  ON public.event_vendor_payments
  FOR EACH ROW EXECUTE FUNCTION public.tg_vendor_payments_chat_record();

-- ── 8 · event_vendor_refunds (20271328327292): recorded · removed ───────────
CREATE OR REPLACE FUNCTION public.tg_vendor_refunds_chat_record()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_event UUID;
  v_amt   TEXT;
BEGIN
  BEGIN
    v_event := COALESCE(NEW.event_id,
                        (SELECT ev.event_id FROM public.event_vendors ev WHERE ev.vendor_id = NEW.event_vendor_id));
    v_amt := public.booking_change_php_words(NEW.amount_php);
    IF TG_OP = 'INSERT' THEN
      PERFORM public.chat_record_post_line(v_event, NEW.vendor_profile_id,
        'Refund recorded · ' || v_amt || ' · ' || btrim(NEW.reason),
        'Refund recorded · ' || v_amt);
    ELSIF NEW.removed_at IS NOT NULL AND OLD.removed_at IS NULL THEN
      PERFORM public.chat_record_post_line(v_event, NEW.vendor_profile_id, 'Refund removed · ' || v_amt);
    END IF;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'tg_vendor_refunds_chat_record refund %: % %', NEW.refund_id, SQLSTATE, SQLERRM;
  END;
  RETURN NULL;
END;
$$;
REVOKE ALL ON FUNCTION public.tg_vendor_refunds_chat_record() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS event_vendor_refunds_chat_record ON public.event_vendor_refunds;
CREATE TRIGGER event_vendor_refunds_chat_record
  AFTER INSERT OR UPDATE OF removed_at ON public.event_vendor_refunds
  FOR EACH ROW EXECUTE FUNCTION public.tg_vendor_refunds_chat_record();

-- ── 9 · three supplier locks (owner 2026-11-09, FINAL RULINGS fe5de540) ────
-- "Only the supplier edits the quotation, its payment plan and their forms …
-- Three separate supplier locks, each switchable any time … Each flip posts a
-- chat line. A locked quote still expires."
--   Quotation      vendor_proposals.changes_locked
--   Payment plan   vendor_proposals.plan_locked
--   A sent form    event_form_sends.locked          (a library form sent into an event)
--                  event_question_requests.locked   (the shipped "Questions for the
--                    couple" set sent into an event — 20271325118550 calls it
--                    "ALREADY a form"; both are the per-event instance, never
--                    the shop's reusable set)
--
-- WHO MAY FLIP (measured, no new UPDATE policy on any of the three):
--   • vendor_proposals has ONE UPDATE policy, vendor_proposals_org_update_draft
--     (20261208006000): current_vendor_profile_ids() (owner ∪
--     current_vendor_ids('admin')) and ONLY while status = 'draft'. The hosts
--     have NO UPDATE policy (accept / decline / view are DEFINER RPCs). So on a
--     draft the shop flips both locks by a plain UPDATE; "any time" after the
--     send goes through vendor_set_proposal_lock() below — the same editor set,
--     and ONLY the two lock columns, so a sent quote's price still cannot shift
--     under the couple.
--   • event_form_sends / event_question_requests: their shipped
--     *_vendor_update policies are current_vendor_ids() (the shop's team); the
--     hosts have no UPDATE policy. `locked` joins each column-level UPDATE grant.
-- NOT here: "the server refuses requests" on a locked item — the Ask-for-a-
-- change card has no table yet (Lane C); its writer must read these columns.
ALTER TABLE public.vendor_proposals
  ADD COLUMN IF NOT EXISTS changes_locked BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS plan_locked    BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE public.event_form_sends
  ADD COLUMN IF NOT EXISTS locked BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE public.event_question_requests
  ADD COLUMN IF NOT EXISTS locked BOOLEAN NOT NULL DEFAULT FALSE;

GRANT UPDATE (locked) ON public.event_form_sends TO authenticated;
GRANT UPDATE (locked) ON public.event_question_requests TO authenticated;

COMMENT ON COLUMN public.vendor_proposals.changes_locked IS
  'The supplier''s "Final price · no changes" lock on this quotation (owner 2026-11-09). Hides Ask for a change. Flipped by the shop (owner/admin): a plain UPDATE on a draft, vendor_set_proposal_lock() any time after. Never by the hosts. A locked quote still expires. Migration 20271329937802.';
COMMENT ON COLUMN public.vendor_proposals.plan_locked IS
  'The supplier''s lock on this quotation''s PAYMENT PLAN (owner 2026-11-09) — separate from changes_locked. Same writers. Migration 20271329937802.';
COMMENT ON COLUMN public.event_form_sends.locked IS
  'The supplier locked this sent form (owner 2026-11-09): no Ask for a change on it. Flipped by the shop''s team (event_form_sends_vendor_update). Migration 20271329937802.';
COMMENT ON COLUMN public.event_question_requests.locked IS
  'The supplier locked this sent "Questions for the couple" set (owner 2026-11-09). Flipped by the shop''s team (event_question_requests_vendor_update). Migration 20271329937802.';

-- After the send: only the two lock columns, only the quote's own shop.
-- Returns: ok · not_allowed · not_found · unknown_lock · unauthenticated.
CREATE OR REPLACE FUNCTION public.vendor_set_proposal_lock(
  p_proposal_id UUID, p_lock TEXT, p_locked BOOLEAN)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_shop UUID;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN 'unauthenticated';
  END IF;
  IF p_lock NOT IN ('changes', 'plan') OR p_locked IS NULL THEN
    RETURN 'unknown_lock';
  END IF;
  SELECT vendor_profile_id INTO v_shop
    FROM public.vendor_proposals WHERE proposal_id = p_proposal_id
    FOR UPDATE;
  IF v_shop IS NULL THEN
    RETURN 'not_found';
  END IF;
  IF v_shop NOT IN (SELECT public.current_vendor_profile_ids()) THEN
    RETURN 'not_allowed';
  END IF;
  IF p_lock = 'changes' THEN
    UPDATE public.vendor_proposals SET changes_locked = p_locked, updated_at = NOW()
     WHERE proposal_id = p_proposal_id AND changes_locked IS DISTINCT FROM p_locked;
  ELSE
    UPDATE public.vendor_proposals SET plan_locked = p_locked, updated_at = NOW()
     WHERE proposal_id = p_proposal_id AND plan_locked IS DISTINCT FROM p_locked;
  END IF;
  RETURN 'ok';
END;
$$;
REVOKE ALL ON FUNCTION public.vendor_set_proposal_lock(UUID, TEXT, BOOLEAN) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.vendor_set_proposal_lock(UUID, TEXT, BOOLEAN) TO authenticated;

COMMENT ON FUNCTION public.vendor_set_proposal_lock(UUID, TEXT, BOOLEAN) IS
  'The quote''s own shop (current_vendor_profile_ids()) switches its quotation lock (p_lock = changes) or payment-plan lock (plan) at any status — the ONLY write it can make to a sent quote. Migration 20271329937802.';

-- Each flip posts a line. A draft's flip says nothing: the hosts cannot see a
-- draft, and a line would announce a quote that was never sent.
CREATE OR REPLACE FUNCTION public.tg_vendor_proposals_lock_chat_record()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_title TEXT;
BEGIN
  BEGIN
    IF NEW.status = 'draft' THEN
      RETURN NULL;
    END IF;
    v_title := left(btrim(NEW.title), 80);
    IF NEW.changes_locked IS DISTINCT FROM OLD.changes_locked THEN
      PERFORM public.chat_record_post_line(NEW.event_id, NEW.vendor_profile_id,
        CASE WHEN NEW.changes_locked
             THEN 'Quotation locked · ' || v_title || ' · the price is final'
             ELSE 'Quotation unlocked · ' || v_title || ' · changes can be asked for again' END,
        CASE WHEN NEW.changes_locked
             THEN 'Quotation locked · the price is final'
             ELSE 'Quotation unlocked · changes can be asked for again' END);
    END IF;
    IF NEW.plan_locked IS DISTINCT FROM OLD.plan_locked THEN
      PERFORM public.chat_record_post_line(NEW.event_id, NEW.vendor_profile_id,
        CASE WHEN NEW.plan_locked
             THEN 'Payment plan locked · ' || v_title || ' · the plan is final'
             ELSE 'Payment plan unlocked · ' || v_title || ' · changes can be asked for again' END,
        CASE WHEN NEW.plan_locked
             THEN 'Payment plan locked · the plan is final'
             ELSE 'Payment plan unlocked · changes can be asked for again' END);
    END IF;
  EXCEPTION WHEN others THEN
    RAISE WARNING 'vendor_proposals lock chat line skipped: % (%)', SQLERRM, SQLSTATE;
  END;
  RETURN NULL;
END;
$$;
REVOKE ALL ON FUNCTION public.tg_vendor_proposals_lock_chat_record() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS vendor_proposals_lock_chat_record ON public.vendor_proposals;
CREATE TRIGGER vendor_proposals_lock_chat_record
  AFTER UPDATE OF changes_locked, plan_locked ON public.vendor_proposals
  FOR EACH ROW EXECUTE FUNCTION public.tg_vendor_proposals_lock_chat_record();

CREATE OR REPLACE FUNCTION public.tg_sent_form_lock_chat_record()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_title TEXT;
BEGIN
  BEGIN
    IF NEW.locked IS NOT DISTINCT FROM OLD.locked THEN
      RETURN NULL;
    END IF;
    IF TG_TABLE_NAME = 'event_form_sends' THEN
      SELECT left(btrim(f.title), 80) INTO v_title
        FROM public.vendor_forms f WHERE f.form_id = NEW.form_id;
    END IF;
    v_title := COALESCE(v_title, 'Questions for the couple');
    PERFORM public.chat_record_post_line(NEW.event_id, NEW.vendor_profile_id,
      CASE WHEN NEW.locked THEN 'Form locked · ' || v_title || ' · no more changes'
           ELSE 'Form unlocked · ' || v_title || ' · changes can be asked for again' END,
      CASE WHEN NEW.locked THEN 'Form locked · no more changes'
           ELSE 'Form unlocked · changes can be asked for again' END);
  EXCEPTION WHEN others THEN
    RAISE WARNING 'sent form lock chat line skipped: % (%)', SQLERRM, SQLSTATE;
  END;
  RETURN NULL;
END;
$$;
REVOKE ALL ON FUNCTION public.tg_sent_form_lock_chat_record() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS event_form_sends_lock_chat_record ON public.event_form_sends;
CREATE TRIGGER event_form_sends_lock_chat_record
  AFTER UPDATE OF locked ON public.event_form_sends
  FOR EACH ROW EXECUTE FUNCTION public.tg_sent_form_lock_chat_record();
DROP TRIGGER IF EXISTS event_question_requests_lock_chat_record ON public.event_question_requests;
CREATE TRIGGER event_question_requests_lock_chat_record
  AFTER UPDATE OF locked ON public.event_question_requests
  FOR EACH ROW EXECUTE FUNCTION public.tg_sent_form_lock_chat_record();

-- ── 10 · every quotation has a Valid until ──────────────────────────────────
-- FINAL RULINGS: "required to send, must be after today and on or before the
-- event date, and is enforced by a DB CHECK (sent/viewed ⇒ not null)".
--   • The CHECK is the not-null half. "After today" and "the event date" are
--     not immutable / not on this row, so they are a trigger on the SEND (the
--     move into 'sent', or a date change while sent) — never re-checked on
--     view, accept or expiry, which happen after time has passed.
--   • ⚠ Quotes already sent without a date: the CHECK would refuse the deploy
--     (and every later sent → viewed on them). They are marked
--     valid_until_legacy = TRUE here, measured, not given an invented date.
--     The flag is set only by this backfill: a trigger pins it.
ALTER TABLE public.vendor_proposals
  ADD COLUMN IF NOT EXISTS valid_until_legacy BOOLEAN NOT NULL DEFAULT FALSE;

UPDATE public.vendor_proposals
   SET valid_until_legacy = TRUE
 WHERE status IN ('sent', 'viewed') AND valid_until IS NULL AND NOT valid_until_legacy;

COMMENT ON COLUMN public.vendor_proposals.valid_until_legacy IS
  'TRUE only for quotes that were already sent/viewed WITHOUT a Valid until when migration 20271329937802 made it required — exempt from vendor_proposals_sent_has_valid_until rather than given an invented date. No writer can set it (tg_vendor_proposals_valid_until pins it).';

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint
                  WHERE conname = 'vendor_proposals_sent_has_valid_until'
                    AND conrelid = 'public.vendor_proposals'::regclass) THEN
    ALTER TABLE public.vendor_proposals
      ADD CONSTRAINT vendor_proposals_sent_has_valid_until
      CHECK (status NOT IN ('sent', 'viewed') OR valid_until IS NOT NULL OR valid_until_legacy);
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.tg_vendor_proposals_valid_until()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_date      DATE;
  v_precision TEXT;
BEGIN
  -- Nobody sets the legacy exemption after the backfill.
  IF TG_OP = 'INSERT' THEN
    NEW.valid_until_legacy := FALSE;
  ELSE
    NEW.valid_until_legacy := OLD.valid_until_legacy;
  END IF;

  IF NEW.status = 'sent' AND NEW.valid_until IS NOT NULL AND (
       TG_OP = 'INSERT'
       OR OLD.status IS DISTINCT FROM 'sent'
       OR NEW.valid_until IS DISTINCT FROM OLD.valid_until) THEN
    IF NEW.valid_until <= (NOW() AT TIME ZONE 'Asia/Manila')::DATE THEN
      RAISE EXCEPTION 'vendor_proposals: VALID_UNTIL_NOT_AFTER_TODAY — a quotation is valid until a day after today'
        USING ERRCODE = '23514';
    END IF;
    SELECT e.event_date, e.event_date_precision INTO v_date, v_precision
      FROM public.events e WHERE e.event_id = NEW.event_id;
    -- Only a known DAY bounds it; a month/year-precision date is not a day.
    IF v_date IS NOT NULL AND COALESCE(v_precision, 'day') = 'day' AND NEW.valid_until > v_date THEN
      RAISE EXCEPTION 'vendor_proposals: VALID_UNTIL_AFTER_THE_EVENT — a quotation is valid until the event date at the latest'
        USING ERRCODE = '23514';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS vendor_proposals_valid_until ON public.vendor_proposals;
CREATE TRIGGER vendor_proposals_valid_until
  BEFORE INSERT OR UPDATE ON public.vendor_proposals
  FOR EACH ROW EXECUTE FUNCTION public.tg_vendor_proposals_valid_until();

COMMIT;
