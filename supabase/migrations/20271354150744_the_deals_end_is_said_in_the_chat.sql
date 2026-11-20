-- the_deals_end_is_said_in_the_chat
-- Created via `pnpm migration:new`. KEEP THIS MIGRATION IDEMPOTENT.
-- ════════════════════════════════════════════════════════════════════════════
-- THE DEAL'S END IS SAID IN THE CHAT (Unichat part H2, owner 20 Nov 2026: "buidl it now i am happy with the design";
-- drawing build-sessions/UNICHAT-LIVE-2026-11-19.html — "Supplier ⋯ → Crew for 18 Dec", "Fast-forward to after the
-- event: Handover, then the hosts' review").
--
-- ── WHAT THIS IS ────────────────────────────────────────────────────────────
-- THREE LINES the chat did not record, written the same way every payment, booking and member line already is
-- (20271329937802 "the chat is the overall record": `chat_record_post_line`, sender_role 'system', never raises):
--
--   1 · "Handover · <Album link | Sample / proof | Note | All delivered>[ · <the supplier's label>]"
--         when a supplier posts a delivery (`booking_handovers` INSERT — the shipped `vendorPostHandover`).
--       "Handover received · <kind>"
--         when the hosts confirm it (`acknowledge_handover` flips status → 'acknowledged').
--   2 · "Review asked · how did it go?"
--         ONCE per chat, with the first confirmed handover, and only while no review of this shop exists for the event.
--   3 · "Crew named for the day"
--         ONCE per chat, the first time one of the supplier's schedule tasks names a crew (`event_schedule_tasks.crew`).
--
-- The app draws each line as a card that READS THE ROWS LIVE (apps/web/lib/chat-card-lines.ts · lib/deal-end.ts):
-- the line is only the place in the conversation; no figure, name or time is taken from its words.
--
-- ── WHAT THIS IS NOT ────────────────────────────────────────────────────────
-- No table, no column, no policy, no grant. Nothing new is stored: a handover is still `booking_handovers`, a review
-- still `vendor_reviews`, a crew still the schedule's own tasks. The receipt card needs no line of its own — the
-- payment trigger has written "Payment confirmed · ₱…" since 20271329937802. Terms at Accept need none either: a
-- quote already carries `vendor_proposals.rendered_terms` and its accept already records who and when.
--
-- Every trigger function is a trigger function only (EXECUTE revoked from everybody) and swallows its own errors:
-- a line that cannot be posted never blocks a delivery, a confirmation or a schedule edit.
-- Held by apps/web/tests/db/the-deals-end-is-said-in-the-chat.db.test.ts.
-- ════════════════════════════════════════════════════════════════════════════

BEGIN;
SET LOCAL lock_timeout = '5s';

-- The four shipped kinds, in the words the hosts' Handover inbox already uses (handover-inbox.tsx KIND_META).
CREATE OR REPLACE FUNCTION public.handover_kind_words(p_kind TEXT)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT CASE p_kind WHEN 'gallery_link' THEN 'Album link'
                     WHEN 'file'         THEN 'Sample / proof'
                     WHEN 'note'         THEN 'Note'
                     WHEN 'signoff'      THEN 'All delivered'
                     ELSE NULL END;
$$;
REVOKE ALL ON FUNCTION public.handover_kind_words(TEXT) FROM PUBLIC, anon, authenticated;

-- Has this (event, shop) conversation already been told <p_body> by Setnayan? (the two once-per-chat lines)
CREATE OR REPLACE FUNCTION public.chat_record_line_exists(p_event_id UUID, p_vendor_profile_id UUID, p_body TEXT)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
      FROM public.chat_threads t
      JOIN public.chat_messages m ON m.thread_id = t.thread_id
     WHERE t.event_id = p_event_id
       AND t.vendor_profile_id = p_vendor_profile_id
       AND m.sender_role = 'system'
       AND m.body = p_body
  );
$$;
REVOKE ALL ON FUNCTION public.chat_record_line_exists(UUID, UUID, TEXT) FROM PUBLIC, anon, authenticated;

-- ── 1 + 2 · booking_handovers: delivered · received · then the review ask ────
CREATE OR REPLACE FUNCTION public.tg_booking_handovers_chat_record()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_shop  UUID;
  v_kind  TEXT;
  v_label TEXT;
BEGIN
  BEGIN
    v_shop := NEW.vendor_profile_id;
    IF v_shop IS NULL THEN
      SELECT ev.marketplace_vendor_id INTO v_shop
        FROM public.event_vendors ev
       WHERE ev.vendor_id = NEW.event_vendor_id;
    END IF;
    v_kind := public.handover_kind_words(NEW.kind);
    IF v_shop IS NULL OR NEW.event_id IS NULL OR v_kind IS NULL THEN
      RETURN NULL;
    END IF;

    IF TG_OP = 'INSERT' THEN
      -- The label is the supplier's own words: when the end-user screen would refuse them, the kind alone is said.
      v_label := NULLIF(btrim(regexp_replace(COALESCE(NEW.label, ''), '\s+', ' ', 'g')), '');
      PERFORM public.chat_record_post_line(NEW.event_id, v_shop,
        'Handover · ' || v_kind || COALESCE(' · ' || left(v_label, 120), ''),
        'Handover · ' || v_kind);
      RETURN NULL;
    END IF;

    -- UPDATE: the hosts confirmed they received it.
    IF NEW.status = 'acknowledged' AND OLD.status IS DISTINCT FROM 'acknowledged' THEN
      PERFORM public.chat_record_post_line(NEW.event_id, v_shop, 'Handover received · ' || v_kind);
      -- The review ask: once per chat, and never beside a review that is already posted.
      IF NOT public.chat_record_line_exists(NEW.event_id, v_shop, 'Review asked · how did it go?')
         AND NOT EXISTS (SELECT 1 FROM public.vendor_reviews r
                          WHERE r.vendor_profile_id = v_shop AND r.event_id = NEW.event_id) THEN
        PERFORM public.chat_record_post_line(NEW.event_id, v_shop, 'Review asked · how did it go?');
      END IF;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'tg_booking_handovers_chat_record handover %: % %', NEW.handover_id, SQLSTATE, SQLERRM;
  END;
  RETURN NULL;
END;
$$;
REVOKE ALL ON FUNCTION public.tg_booking_handovers_chat_record() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS booking_handovers_chat_record ON public.booking_handovers;
CREATE TRIGGER booking_handovers_chat_record
  AFTER INSERT OR UPDATE OF status
  ON public.booking_handovers
  FOR EACH ROW EXECUTE FUNCTION public.tg_booking_handovers_chat_record();

-- ── 3 · event_schedule_tasks: the first time the supplier's crew is named ────
CREATE OR REPLACE FUNCTION public.tg_schedule_tasks_day_crew_chat_record()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_shop  UUID;
  v_event UUID;
BEGIN
  BEGIN
    IF NEW.vendor_id IS NULL OR NULLIF(btrim(COALESCE(NEW.crew, '')), '') IS NULL THEN
      RETURN NULL;
    END IF;
    IF TG_OP = 'UPDATE' AND NULLIF(btrim(COALESCE(OLD.crew, '')), '') IS NOT NULL THEN
      RETURN NULL;  -- a crew renamed is not a crew first named
    END IF;
    SELECT ev.marketplace_vendor_id, ev.event_id INTO v_shop, v_event
      FROM public.event_vendors ev
     WHERE ev.vendor_id = NEW.vendor_id;
    IF v_shop IS NULL OR v_event IS NULL THEN
      RETURN NULL;  -- a supplier the hosts added by hand has no shop, so no conversation
    END IF;
    IF NOT public.chat_record_line_exists(v_event, v_shop, 'Crew named for the day') THEN
      PERFORM public.chat_record_post_line(v_event, v_shop, 'Crew named for the day');
    END IF;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'tg_schedule_tasks_day_crew_chat_record task %: % %', NEW.task_id, SQLSTATE, SQLERRM;
  END;
  RETURN NULL;
END;
$$;
REVOKE ALL ON FUNCTION public.tg_schedule_tasks_day_crew_chat_record() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS event_schedule_tasks_day_crew_chat_record ON public.event_schedule_tasks;
CREATE TRIGGER event_schedule_tasks_day_crew_chat_record
  AFTER INSERT OR UPDATE OF crew
  ON public.event_schedule_tasks
  FOR EACH ROW EXECUTE FUNCTION public.tg_schedule_tasks_day_crew_chat_record();

COMMENT ON FUNCTION public.tg_booking_handovers_chat_record() IS
  'Trigger only: posts "Handover · <kind>[ · label]" when a supplier delivers, "Handover received · <kind>" when the hosts confirm, and once per chat "Review asked · how did it go?" (skipped when a review already exists). Never raises. Unichat part H2, 20 Nov 2026.';
COMMENT ON FUNCTION public.tg_schedule_tasks_day_crew_chat_record() IS
  'Trigger only: posts "Crew named for the day" once per (event, shop) chat, the first time one of the supplier''s schedule tasks names a crew. The card reads the tasks live. Never raises. Unichat part H2, 20 Nov 2026.';

COMMIT;
