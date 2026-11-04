-- the_crew_changes_the_schedule
-- Created via `pnpm migration:new`. KEEP THIS MIGRATION IDEMPOTENT (it may be re-applied).
--
-- 🗓 CHANGE THE SCHEDULE, ON THE DAY (owner 2026-11-04, SUPPLIER_PLANS_GIFTS_QUOTES_BUILD_NOTES_2026-11-04 · Supplier ›
-- Hub: *"'Change the schedule' (move a part ± minutes, later parts follow; skip a part) replaces Hold 10 min; crew row
-- opens what Member / Helper get"* · Couple: *"Schedule changes by the coordinator's crew (move / skip) reach the
-- couple's timeline and the guests' Event Hub."*; supplier prototype v59 `rosMoveSheet` / `crewSheet`).
--
-- 🔑 EXTEND, DO NOT REBUILD. A MOVE is the shipped running-late shift — `running_late_shift_schedule` (20271303571970)
-- for the coordinator on their own session, and the same pure shift inside the crew's door below. Nothing about what a
-- shift is changes here. What is new:
--
--   1 · `skipped` — a fourth run state. A skipped part did not happen; it is NOT `done` (a ✓ on the couple's timeline
--       would say it did). `advance_schedule_block` already lights only `upcoming` parts, so a skipped part is passed
--       over by "Done · next" without a change to that function.
--   2 · THE CHANGE LOCK HOLDS A SKIP (DECISION_LOG 2026-11-02 "A SUPPLIER'S SCHEDULE BASICS" (7)): skipping, or
--       un-skipping, a moment that names a locked supplier is refused with the lock's own calm line — "<shop> isn't
--       taking changes. Send them a request instead." (HINT supplier_part_locked). A separate trigger, ONLY on
--       `run_state`, so the part-lock function (redefined by 20271307658341 today) is not copied a third time.
--       A MOVE keeps the owner's running-late ruling (DECISION_LOG 2026-11-03 (2)): a pure shift passes a lock and the
--       supplier is told.
--   3 · `crew_change_schedule` — a crew MEMBER's phone moves or skips a part. The crew scanner's own gates
--       (`crew_seat_by_guest_qr`, 20271297483236), asked of the shop and of the person who issued the QR: an allowed,
--       unexpired pass on THIS event, role `member`, the shop booked as the coordinator, and the hosts gave the issuer
--       The Day = Edit (`moderator_area_level_of … 'schedule' = 'edit'`). All or nothing. The gates are ONE function,
--       `crew_schedule_door`, which the crew page asks too — so the button is drawn exactly when the write would open.
--   4 · `tell_guests_the_schedule_changed` — guests holding an account get ONE in-app notice per change (plan
--       SCHEDULE_CHAPTERS_BUILD_PLAN §3 "Time moves": *"notifies those on it in-app; replies are kept and nothing is
--       re-sent"*). Release's pattern (20271302139506): one statement, never a loop, the shipped `schedule_shifted`
--       type (no second notice type). Service role only — the app calls it after the change landed.
--
-- No new table. Held by apps/web/tests/db/the-crew-changes-the-schedule.db.test.ts.

-- ── 1 · the run state ────────────────────────────────────────────────────────────────────────────────────────────────
-- Outside the transaction: a value added to an enum cannot be used inside the transaction that added it.
ALTER TYPE public.schedule_run_state ADD VALUE IF NOT EXISTS 'skipped';

BEGIN;

COMMENT ON COLUMN public.event_schedule_blocks.run_state IS
  'Day-of run-of-show — upcoming | live | done | skipped. Advanced by advance_schedule_block; skipped (or put back) by '
  'the coordinator''s Change the schedule or a crew member''s (crew_change_schedule). A skipped part did not happen. '
  '20270321980372 · skipped 20271308380805.';

-- ── 2 · a skip meets the change lock ────────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.event_schedule_blocks_skip_lock()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_shop RECORD;
BEGIN
  -- Only a skip or an un-skip is this trigger's business; Start and Done · next (live / done) are not a change to
  -- anybody's part.
  IF (OLD.run_state::text = 'skipped') IS NOT DISTINCT FROM (NEW.run_state::text = 'skipped') THEN
    RETURN NEW;
  END IF;
  FOR v_shop IN
    SELECT * FROM public.schedule_locked_shops(OLD.event_id, coalesce(OLD.responsible_vendor_ids, '{}'::uuid[]))
  LOOP
    RAISE EXCEPTION '% isn''t taking changes. Send them a request instead.', v_shop.shop
      USING ERRCODE = 'P0001', HINT = 'supplier_part_locked';
  END LOOP;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.event_schedule_blocks_skip_lock() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS event_schedule_blocks_skip_lock ON public.event_schedule_blocks;
CREATE TRIGGER event_schedule_blocks_skip_lock
  BEFORE UPDATE OF run_state ON public.event_schedule_blocks
  FOR EACH ROW EXECUTE FUNCTION public.event_schedule_blocks_skip_lock();

-- ── 3 · the crew member's door ──────────────────────────────────────────────────────────────────────────────────────
-- ONE answer to "may this phone change the schedule", asked by the crew page (to draw the button or not — a door that
-- never opens is not drawn) and by the write below (to refuse). 'ok', or the word for the first gate that is shut.
CREATE OR REPLACE FUNCTION public.crew_schedule_door(p_event_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_shop   UUID;
  v_issuer UUID;
  v_role   TEXT;
BEGIN
  -- 1 · an allowed, unexpired pass on THIS event — a Member's (a Helper's pass opens no schedule)
  SELECT p.vendor_profile_id, c.created_by, p.crew_role INTO v_shop, v_issuer, v_role
    FROM public.vendor_crew_passes p
    JOIN public.vendor_crew_codes c
      ON c.vendor_profile_id = p.vendor_profile_id AND c.event_id = p.event_id
   WHERE p.event_id = p_event_id
     AND p.crew_user_id = auth.uid()
     AND p.status = 'allowed'
     AND NOW() < c.ends_at
   LIMIT 1;
  IF v_shop IS NULL THEN
    RETURN 'no_crew_pass';
  END IF;
  IF v_role IS DISTINCT FROM 'member' THEN
    RETURN 'not_a_member';
  END IF;

  -- 2 · that shop is booked on THIS event, carrying the coordinator tile (the one shop that runs the programme)
  IF NOT EXISTS (
    SELECT 1 FROM public.event_vendors ev
      JOIN public.vendor_profiles vp ON vp.vendor_profile_id = ev.marketplace_vendor_id
     WHERE ev.event_id = p_event_id
       AND ev.marketplace_vendor_id = v_shop
       AND ev.status IN ('contracted', 'deposit_paid', 'delivered', 'complete')
       AND public.services_make_a_coordinator(vp.services)
  ) THEN
    RETURN 'not_the_coordinator';
  END IF;

  -- 3 · the hosts gave the person who issued the crew QR The Day = Edit — the crew never holds more than they do
  IF v_issuer IS NULL OR public.moderator_area_level_of(p_event_id, v_issuer, 'schedule') IS DISTINCT FROM 'edit' THEN
    RETURN 'schedule_not_shared';
  END IF;
  RETURN 'ok';
END;
$$;
REVOKE ALL ON FUNCTION public.crew_schedule_door(UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.crew_schedule_door(UUID) TO authenticated;

COMMENT ON FUNCTION public.crew_schedule_door(UUID) IS
  'May the calling crew phone change this event''s schedule? ''ok'' or the first shut gate (no_crew_pass · not_a_member · '
  'not_the_coordinator · schedule_not_shared). Asked by /join/crew to draw the button and by crew_change_schedule to '
  'refuse — one answer for both. 20271308380805.';

CREATE OR REPLACE FUNCTION public.crew_change_schedule(
  p_event_id  UUID,
  p_op        TEXT,
  p_block_ids UUID[],
  p_minutes   INTEGER DEFAULT NULL
)
RETURNS INTEGER
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_door   TEXT;
  v_ids    UUID[] := ARRAY(SELECT DISTINCT x FROM unnest(coalesce(p_block_ids, '{}'::uuid[])) x WHERE x IS NOT NULL);
  v_n      INTEGER;
BEGIN
  IF p_op IS NULL OR p_op NOT IN ('move', 'skip', 'unskip') THEN
    RAISE EXCEPTION 'unknown_change' USING ERRCODE = '22023';
  END IF;

  v_door := public.crew_schedule_door(p_event_id);
  IF v_door IS DISTINCT FROM 'ok' THEN
    RAISE EXCEPTION '%', coalesce(v_door, 'no_crew_pass') USING ERRCODE = '42501';
  END IF;

  IF cardinality(v_ids) = 0 THEN
    RAISE EXCEPTION 'nothing_changed' USING ERRCODE = 'P0002';
  END IF;

  IF p_op = 'move' THEN
    IF p_minutes IS NULL OR p_minutes = 0 OR abs(p_minutes) > 720 THEN
      RAISE EXCEPTION 'A move is a whole number of minutes, at most 12 hours either way.' USING ERRCODE = '22023';
    END IF;
    -- The running-late shift, exactly (20271303571970): the marker lets a locked part through only for a pure shift
    -- of these minutes, and it lives one transaction.
    PERFORM set_config('app.running_late_minutes', p_minutes::text, true);
    UPDATE public.event_schedule_blocks b
       SET start_at   = b.start_at + make_interval(mins => p_minutes),
           end_at     = b.end_at   + make_interval(mins => p_minutes),
           updated_at = now()
     WHERE b.event_id = p_event_id
       AND b.block_id = ANY (v_ids)
       AND b.time_tba = false;
    GET DIAGNOSTICS v_n = ROW_COUNT;
    PERFORM set_config('app.running_late_minutes', '', true);
  ELSE
    -- A skip is one part; it never touches a part that has started or finished.
    IF cardinality(v_ids) <> 1 THEN
      RAISE EXCEPTION 'Skip one part at a time.' USING ERRCODE = '22023';
    END IF;
    UPDATE public.event_schedule_blocks b
       SET run_state  = CASE WHEN p_op = 'skip' THEN 'skipped' ELSE 'upcoming' END::public.schedule_run_state,
           updated_at = now()
     WHERE b.event_id = p_event_id
       AND b.block_id = v_ids[1]
       AND b.run_state::text = CASE WHEN p_op = 'skip' THEN 'upcoming' ELSE 'skipped' END;
    GET DIAGNOSTICS v_n = ROW_COUNT;
  END IF;

  -- A part that is gone, belongs to another event, or has already run: nothing moves, never half the day.
  IF v_n <> cardinality(v_ids) THEN
    RAISE EXCEPTION 'nothing_changed' USING ERRCODE = 'P0002';
  END IF;
  RETURN v_n;
END;
$$;
REVOKE ALL ON FUNCTION public.crew_change_schedule(UUID, TEXT, UUID[], INTEGER) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.crew_change_schedule(UUID, TEXT, UUID[], INTEGER) TO authenticated;

COMMENT ON FUNCTION public.crew_change_schedule(UUID, TEXT, UUID[], INTEGER) IS
  'A crew MEMBER''s Change the schedule (owner 2026-11-04): move parts by a pure shift (the running-late rule) or skip / '
  'un-skip one part. Gates = the crew scanner''s: an allowed unexpired member pass on this event, the shop booked as the '
  'coordinator, the QR''s issuer holding The Day = Edit. All or nothing. 20271308380805.';

-- ── 4 · the guests are told, in the app ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.tell_guests_the_schedule_changed(
  p_event_id UUID,
  p_title    TEXT,
  p_body     TEXT,
  p_actor    UUID DEFAULT NULL
)
RETURNS INTEGER
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_slug TEXT;
  v_told INTEGER;
BEGIN
  SELECT e.slug INTO v_slug FROM public.events e WHERE e.event_id = p_event_id;
  IF NOT FOUND THEN
    RETURN 0;
  END IF;
  -- One notice per account holding a guest seat — in-app only; the person who made the change is never told.
  WITH seats AS (
    SELECT DISTINCT m.user_id
      FROM public.event_members m
      JOIN public.guests g ON g.guest_id = m.guest_id AND g.event_id = p_event_id AND g.deleted_at IS NULL
     WHERE m.event_id = p_event_id
       AND m.guest_id IS NOT NULL
       AND m.user_id IS NOT NULL
       AND m.user_id IS DISTINCT FROM p_actor
  ), ins AS (
    INSERT INTO public.notifications (user_id, type, title, body, related_url, event_id)
    SELECT s.user_id,
           'schedule_shifted'::public.notification_type,
           left(coalesce(nullif(btrim(p_title), ''), 'The schedule changed'), 140),
           left(coalesce(p_body, ''), 280),
           CASE WHEN v_slug IS NULL THEN NULL ELSE '/' || v_slug || '?tab=details' END,
           p_event_id
      FROM seats s
    RETURNING 1
  )
  SELECT count(*) INTO v_told FROM ins;
  RETURN v_told;
END;
$$;
REVOKE ALL ON FUNCTION public.tell_guests_the_schedule_changed(UUID, TEXT, TEXT, UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.tell_guests_the_schedule_changed(UUID, TEXT, TEXT, UUID) TO service_role;

COMMENT ON FUNCTION public.tell_guests_the_schedule_changed(UUID, TEXT, TEXT, UUID) IS
  'One in-app schedule_shifted notice per account holding a guest seat on the event (never the actor), opening the '
  'Event Hub''s Details. Called by the app with the service role after a Change the schedule landed. 20271308380805.';

COMMIT;
