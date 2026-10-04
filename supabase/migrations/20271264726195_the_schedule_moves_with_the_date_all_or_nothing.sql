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
--   · `event_schedule_date_moves` remembers the last move (from → to); the
--     same move asked twice is answered the second time with 0;
--   · the shift is whole 24-hour steps on a UTC column holding the venue's wall
--     clock — `make_interval(hours => …)`, never `interval 'N days'`, which
--     would follow the session's time zone across a clock change. The same
--     arithmetic as lib/schedule-datetime-local.ts `shiftWallClockDays`.
-- Any error anywhere aborts the whole call: no block moves and no marker is
-- written. Held by apps/web/tests/db/venues-and-ceremony-time-wait-for-apply.db.test.ts.

BEGIN;

-- ── 1 · THE MARKER: the last move of each event's Schedule ──────────────────
CREATE TABLE IF NOT EXISTS public.event_schedule_date_moves (
  event_id      UUID        PRIMARY KEY REFERENCES public.events(event_id) ON DELETE CASCADE,
  from_day      DATE        NOT NULL,
  to_day        DATE        NOT NULL,
  moved_blocks  INTEGER     NOT NULL DEFAULT 0,
  moved_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  moved_by      UUID,
  CONSTRAINT event_schedule_date_moves_days_chk CHECK (from_day <> to_day)
);

ALTER TABLE public.event_schedule_date_moves ENABLE ROW LEVEL SECURITY;
-- Service-only: no browser role reads or writes it; only the function below
-- (SECURITY DEFINER) touches it.
REVOKE ALL ON TABLE public.event_schedule_date_moves FROM PUBLIC, anon, authenticated;

COMMENT ON TABLE public.event_schedule_date_moves IS
  'The last whole-Schedule move per event (from_day -> to_day), written only by '
  'move_event_schedule_with_date in the same transaction as the move, so the '
  'same move asked twice (a double Apply) shifts nothing the second time. '
  'Service-only (2026-10-04).';

-- ── 2 · THE ONE WRITER ───────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.move_event_schedule_with_date(
  p_event_id  UUID,
  p_from_day  DATE,
  p_to_day    DATE
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid        UUID := auth.uid();
  v_days       INTEGER;
  v_date       DATE;
  v_precision  TEXT;
  v_moved      INTEGER := 0;
BEGIN
  IF p_event_id IS NULL OR p_from_day IS NULL OR p_to_day IS NULL THEN
    RAISE EXCEPTION 'schedulemove:bad_input' USING ERRCODE = '22023';
  END IF;
  -- Fail closed: no session, or a session that may not write this Schedule.
  IF v_uid IS NULL OR NOT coalesce(
       p_event_id IN (SELECT public.current_couple_event_ids())
       OR public.moderator_area_level(p_event_id, 'schedule') = 'edit',
       false) THEN
    RAISE EXCEPTION 'schedulemove:not_allowed' USING ERRCODE = '42501';
  END IF;

  v_days := p_to_day - p_from_day;
  IF v_days = 0 THEN
    RETURN 0;
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
  IF v_date IS DISTINCT FROM p_to_day OR coalesce(v_precision, 'day') <> 'day' THEN
    RETURN 0;
  END IF;

  -- This exact move already ran (the second of two Applies).
  IF EXISTS (
    SELECT 1 FROM public.event_schedule_date_moves m
     WHERE m.event_id = p_event_id
       AND m.from_day = p_from_day
       AND m.to_day   = p_to_day
  ) THEN
    RETURN 0;
  END IF;

  -- Every block, every visibility, parents and parts alike — ONE statement.
  UPDATE public.event_schedule_blocks b
     SET start_at   = b.start_at + make_interval(hours => 24 * v_days),
         end_at     = b.end_at   + make_interval(hours => 24 * v_days),
         updated_at = now()
   WHERE b.event_id = p_event_id
     AND (b.start_at IS NOT NULL OR b.end_at IS NOT NULL);
  GET DIAGNOSTICS v_moved = ROW_COUNT;

  INSERT INTO public.event_schedule_date_moves (event_id, from_day, to_day, moved_blocks, moved_at, moved_by)
  VALUES (p_event_id, p_from_day, p_to_day, v_moved, now(), v_uid)
  ON CONFLICT (event_id) DO UPDATE
     SET from_day     = EXCLUDED.from_day,
         to_day       = EXCLUDED.to_day,
         moved_blocks = EXCLUDED.moved_blocks,
         moved_at     = EXCLUDED.moved_at,
         moved_by     = EXCLUDED.moved_by;

  RETURN v_moved;
END;
$$;

REVOKE ALL ON FUNCTION public.move_event_schedule_with_date(UUID, DATE, DATE) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.move_event_schedule_with_date(UUID, DATE, DATE) TO authenticated, service_role;

COMMENT ON FUNCTION public.move_event_schedule_with_date(UUID, DATE, DATE) IS
  'Moves EVERY block of the event''s Schedule by (p_to_day - p_from_day) whole '
  'days, keeping each wall clock, in one statement — all or nothing. Only the '
  'couple or a Schedule edit delegate (else 42501); only once the live date IS '
  'p_to_day at day precision; the event row is locked and the same move asked '
  'twice moves nothing (event_schedule_date_moves). Returns the blocks moved. '
  'Called by Apply (lib/ceremony-time.server.ts moveScheduleWithDate). 2026-10-04.';

-- ── 3 · SELF-CHECK ───────────────────────────────────────────────────────────
DO $$
BEGIN
  IF has_table_privilege('authenticated', 'public.event_schedule_date_moves', 'SELECT')
     OR has_table_privilege('anon', 'public.event_schedule_date_moves', 'SELECT') THEN
    RAISE EXCEPTION 'event_schedule_date_moves is readable by a browser role';
  END IF;
  IF has_function_privilege('anon', 'public.move_event_schedule_with_date(uuid, date, date)', 'EXECUTE') THEN
    RAISE EXCEPTION 'move_event_schedule_with_date is callable by anon';
  END IF;
END $$;

COMMIT;
