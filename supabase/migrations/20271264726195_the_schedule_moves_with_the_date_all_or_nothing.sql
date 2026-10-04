-- the_schedule_moves_with_the_date_all_or_nothing
-- Created via `pnpm migration:new`. Prefix auto-allocated to sort AFTER every
-- existing migration. KEEP THIS MIGRATION IDEMPOTENT (it may be re-applied).
--
-- 📅 THE WHOLE SCHEDULE MOVES WITH THE DATE — ALL OR NOTHING, AND ONCE
-- (2026-10-04, the independent audit of train g / #6348, on #6337's
-- `moveScheduleWithDate`, lib/ceremony-time.server.ts).
--
-- What it fixes. Apply moved the Schedule one block at a time, one UPDATE per
-- block, from the couple's session:
--   1. a failure part-way (the 4th of 9 UPDATEs refused) left the first three
--      on the NEW day and the rest on the OLD one — a half-moved day, with the
--      date already live, so pressing Apply again could not finish it;
--   2. two Applies racing (a double tap, two tabs) each read the OLD date,
--      each wrote the new one, and EACH moved every block — the whole day
--      shifted twice;
--   3. the couple's read policy hides `visibility = 'coordinator_only'` blocks
--      (20270901120000), so the coordinator's own prep never moved at all.
--
-- 🔑 THE RULE NOW: one SECURITY DEFINER function shifts EVERY block of the
-- event in ONE statement, inside one transaction, and only once per move:
--   · the caller must be the event's couple, or a delegate holding EDIT on the
--     Schedule — the SAME predicate as the table's two write policies
--     (`current_couple_event_ids()`, `moderator_area_level(…, 'schedule')`);
--     anyone else is refused (42501), never answered with a quiet zero;
--   · the event row is locked (FOR UPDATE), so two Applies run one after the
--     other, never side by side;
--   · it moves only when the event's LIVE date already IS the new day, as one
--     exact day — a stale or duplicate call after another move finds a
--     different date and moves nothing;
--   · the shift is measured from the day the Schedule STANDS ON, never from a
--     caller-chosen day: `event_schedule_day_anchor.anchor_day` (below), so
--     the size of the move cannot be chosen by whoever calls it, and the same
--     move asked twice finds the Schedule already there and moves nothing;
--   · the shift is whole 24-hour steps on a UTC column holding the venue's wall
--     clock — `make_interval(hours => …)`, never `interval 'N days'`, which
--     would follow the session's time zone across a clock change. The same
--     arithmetic as lib/schedule-datetime-local.ts `shiftWallClockDays`.
-- Any error anywhere aborts the whole call: no block moves and the anchor is
-- not touched.
--
-- 🧭 WHY AN ANCHOR, NOT "THE LAST MOVE" (2026-10-04, the train-g review). The
-- first cut remembered the last move (from → to) and skipped a repeat of it.
-- If the date then went back by a path that does not move the Schedule (the
-- dashboard's own date field, `updateEventDate`, or an admin edit), a later
-- real move matching that pair was skipped — "ok", and nothing moved. The
-- anchor instead records WHERE THE SCHEDULE IS: the event day its blocks were
-- last aligned with.
--   · The FIRST time an event's exact day changes (by any path), a trigger
--     stores the day it changed FROM — the day the Schedule stood on.
--   · Later changes by any other path leave the anchor alone: those paths do
--     not move the Schedule, so it still stands where the anchor says.
--   · A month or a year on either side breaks the chain (there is no day to
--     measure from): the anchor is dropped, and the next exact change starts
--     it again from its own previous day.
--   · The move shifts by (new day − anchor) and sets the anchor to the new day.
-- So: A→B moves the day to B; the date sent back to A elsewhere leaves the
-- Schedule on B; a later A→B finds it already on B ("aligned", nothing to
-- move — and true); a later C→D moves it from B to D. A real move is never
-- skipped, and a move is never applied twice. Held by apps/web/tests/db/venues-and-ceremony-time-wait-for-apply.db.test.ts (9–14).

BEGIN;

-- ── 1 · THE ANCHOR: the event day each Schedule stands on ────────────────────
CREATE TABLE IF NOT EXISTS public.event_schedule_day_anchor (
  event_id      UUID        PRIMARY KEY REFERENCES public.events(event_id) ON DELETE CASCADE,
  anchor_day    DATE        NOT NULL,
  moved_blocks  INTEGER     NOT NULL DEFAULT 0,
  moved_at      TIMESTAMPTZ,
  moved_by      UUID,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.event_schedule_day_anchor ENABLE ROW LEVEL SECURITY;
-- Service-only: no browser role reads or writes it; only the trigger and the
-- move below (both SECURITY DEFINER) touch it.
REVOKE ALL ON TABLE public.event_schedule_day_anchor FROM PUBLIC, anon, authenticated;

COMMENT ON TABLE public.event_schedule_day_anchor IS
  'The event day each Schedule''s blocks stand on (anchor_day). Seeded by '
  'event_schedule_anchor_follow_date with the day an exact date changed FROM; '
  'moved and re-set only by move_event_schedule_with_date, which shifts every '
  'block by (new day - anchor_day). Service-only (2026-10-04).';

-- ── 2 · THE TRIGGER: seed the anchor the first time an exact day changes ─────
CREATE OR REPLACE FUNCTION public.event_schedule_anchor_follow_date()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NEW.event_date IS NOT DISTINCT FROM OLD.event_date
     AND NEW.event_date_precision IS NOT DISTINCT FROM OLD.event_date_precision THEN
    RETURN NEW;
  END IF;
  -- A month or a year on either side: no day to measure from — the chain restarts.
  IF OLD.event_date IS NULL OR NEW.event_date IS NULL
     OR OLD.event_date_precision IS DISTINCT FROM 'day'
     OR NEW.event_date_precision IS DISTINCT FROM 'day' THEN
    DELETE FROM public.event_schedule_day_anchor WHERE event_id = NEW.event_id;
    RETURN NEW;
  END IF;
  -- The first exact change: the Schedule stood on the day it changed FROM.
  -- An anchor already there is the truth about the Schedule — kept.
  INSERT INTO public.event_schedule_day_anchor (event_id, anchor_day)
  VALUES (NEW.event_id, OLD.event_date)
  ON CONFLICT (event_id) DO NOTHING;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.event_schedule_anchor_follow_date() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS events_schedule_anchor_follow_date ON public.events;
CREATE TRIGGER events_schedule_anchor_follow_date
  AFTER UPDATE OF event_date, event_date_precision ON public.events
  FOR EACH ROW EXECUTE FUNCTION public.event_schedule_anchor_follow_date();

-- ── 3 · THE ONE WRITER ───────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.move_event_schedule_with_date(
  p_event_id  UUID,
  p_to_day    DATE
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid        UUID := auth.uid();
  v_date       DATE;
  v_precision  TEXT;
  v_anchor     DATE;
  v_days       INTEGER;
  v_moved      INTEGER := 0;
BEGIN
  IF p_event_id IS NULL OR p_to_day IS NULL THEN
    RAISE EXCEPTION 'schedulemove:bad_input' USING ERRCODE = '22023';
  END IF;
  -- Fail closed: no session, or a session that may not write this Schedule
  -- (the couple, or a delegate with EDIT on the Schedule — the table's own
  -- write policies).
  IF v_uid IS NULL OR NOT coalesce(
       p_event_id IN (SELECT public.current_couple_event_ids())
       OR public.moderator_area_level(p_event_id, 'schedule') = 'edit',
       false) THEN
    RAISE EXCEPTION 'schedulemove:not_allowed' USING ERRCODE = '42501';
  END IF;

  -- One Apply at a time per event.
  SELECT e.event_date, e.event_date_precision
    INTO v_date, v_precision
    FROM public.events e
   WHERE e.event_id = p_event_id
   FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'schedulemove:no_event' USING ERRCODE = 'P0002';
  END IF;

  -- Only once the new day is LIVE, as one exact day.
  IF v_date IS DISTINCT FROM p_to_day OR v_precision IS DISTINCT FROM 'day' THEN
    RETURN jsonb_build_object('status', 'stale', 'moved', 0, 'days', 0);
  END IF;

  SELECT a.anchor_day INTO v_anchor
    FROM public.event_schedule_day_anchor a
   WHERE a.event_id = p_event_id
   FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('status', 'no-anchor', 'moved', 0, 'days', 0);
  END IF;

  v_days := p_to_day - v_anchor;
  IF v_days = 0 THEN
    -- The Schedule already stands on this day (the second of two Applies).
    RETURN jsonb_build_object('status', 'aligned', 'moved', 0, 'days', 0);
  END IF;

  -- Every block, every visibility, parents and parts alike — ONE statement.
  UPDATE public.event_schedule_blocks b
     SET start_at   = b.start_at + make_interval(hours => 24 * v_days),
         end_at     = b.end_at   + make_interval(hours => 24 * v_days),
         updated_at = now()
   WHERE b.event_id = p_event_id
     AND (b.start_at IS NOT NULL OR b.end_at IS NOT NULL);
  GET DIAGNOSTICS v_moved = ROW_COUNT;

  UPDATE public.event_schedule_day_anchor
     SET anchor_day   = p_to_day,
         moved_blocks = v_moved,
         moved_at     = now(),
         moved_by     = v_uid
   WHERE event_id = p_event_id;

  RETURN jsonb_build_object('status', 'moved', 'moved', v_moved, 'days', v_days);
END;
$$;

-- `authenticated` only: it runs as the caller's own session (auth.uid()), so a
-- service-role call would have no uid and be refused — no grant for it.
REVOKE ALL ON FUNCTION public.move_event_schedule_with_date(UUID, DATE) FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.move_event_schedule_with_date(UUID, DATE) TO authenticated;

COMMENT ON FUNCTION public.move_event_schedule_with_date(UUID, DATE) IS
  'Moves EVERY block of the event''s Schedule from the day it stands on '
  '(event_schedule_day_anchor) to p_to_day, keeping each wall clock, in one '
  'statement — all or nothing. Only the couple or a Schedule edit delegate '
  '(else 42501); only once the live date IS p_to_day at day precision (else '
  'status stale); the event row is locked. Returns {status: moved|aligned|'
  'stale|no-anchor, moved, days}. Called by Apply '
  '(lib/ceremony-time.server.ts moveScheduleWithDate). 2026-10-04.';

-- ── 4 · SELF-CHECK ───────────────────────────────────────────────────────────
DO $$
BEGIN
  IF has_table_privilege('authenticated', 'public.event_schedule_day_anchor', 'SELECT')
     OR has_table_privilege('anon', 'public.event_schedule_day_anchor', 'SELECT') THEN
    RAISE EXCEPTION 'event_schedule_day_anchor is readable by a browser role';
  END IF;
  IF has_function_privilege('anon', 'public.move_event_schedule_with_date(uuid, date)', 'EXECUTE') THEN
    RAISE EXCEPTION 'move_event_schedule_with_date is callable by anon';
  END IF;
  IF has_function_privilege('authenticated', 'public.event_schedule_anchor_follow_date()', 'EXECUTE') THEN
    RAISE EXCEPTION 'the anchor trigger function is callable by a browser role';
  END IF;
END $$;

COMMIT;
