-- papic capture runs past lunch
-- Created via `pnpm migration:new`. Prefix auto-allocated to sort AFTER every
-- existing migration. KEEP THIS MIGRATION IDEMPOTENT (it may be re-applied).
--
-- ════════════════════════════════════════════════════════════════════════════
-- CAPTURE RUNS TWELVE HOURS PAST THE END OF THE EVENT DAY (owner 2026-09-22).
-- ════════════════════════════════════════════════════════════════════════════
-- Owner, two messages in one sitting: *"okay, we give them until lunch the next
-- day."* then *"just do 12 hours after the event ends."* Those are ONE rule:
-- `events` holds no clock time for an event anywhere (event_date and
-- event_end_date are DATE columns; the only `time` columns on the table are the
-- partners' birth times), so "when their event ends" can only mean the end of
-- the event's calendar day, 23:59:59 Asia/Manila. Twelve hours past that is
-- 11:59:59 the next morning — which is lunch the next day. No new column, and
-- no new question asked of a couple.
--
-- 🛑 WHY THIS IS A MIGRATION AND NOT A ONE-LINE CHANGE IN TYPESCRIPT.
-- `paparazzi_seats.valid_until` was a **DATE**, and `captureWindowState()`
-- reads a bare date as a whole Manila day — deliberately, because six of
-- thirteen production seats once carried `valid_from = valid_until`, the window
-- collapsed to a single millisecond, and every shutter tap both claimed
-- photographers ever made was refused. That is why `papic_photos` had zero
-- rows. So the two shortcuts both fail:
--   • stamping `last day + 1` into the DATE column grants the WHOLE next day,
--     not until lunch — a date column cannot say 11:59am;
--   • reading a bare date 12 hours longer changes the meaning of every legacy
--     row silently, under a rule nobody applied to it.
-- The column is widened instead, and every existing row is rewritten by the
-- same rule the application now applies. The seat keeps meaning what it says.
--
-- ⚠ `valid_from` IS LEFT A DATE ON PURPOSE. Widening it would suddenly honour
-- the couple's picked start TIME, which Postgres has always truncated to
-- midnight — a camera that opens at 2 PM instead of 00:00 REFUSES shots that
-- work today. This ruling is about the END. Touching the start here would be a
-- refusal nobody asked for, in the one file that must not produce them.

BEGIN;

-- ── 1 · the seat's closing bound becomes an INSTANT ─────────────────────────
-- Guarded on the current type so a re-apply is a no-op rather than an error.
-- The USING clause is the owner's rule written once in SQL:
--   (D + 1) midnight Manila − 1s  =  D 23:59:59 Manila   (what the row meant)
--                            + 12h =  D+1 11:59:59 Manila (what it means now)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema = 'public'
       AND table_name   = 'paparazzi_seats'
       AND column_name  = 'valid_until'
       AND data_type    = 'date'
  ) THEN
    ALTER TABLE public.paparazzi_seats
      ALTER COLUMN valid_until TYPE TIMESTAMPTZ
      USING (
        (((valid_until + 1)::timestamp AT TIME ZONE 'Asia/Manila')
          - INTERVAL '1 second')
          + INTERVAL '12 hours'
      );
  END IF;
END $$;

COMMENT ON COLUMN public.paparazzi_seats.valid_until IS
  'The INSTANT this camera stops shooting — the last day of the event''s Papic '
  'capture window at 23:59:59 Asia/Manila plus the owner''s twelve-hour tail '
  '(2026-09-22), i.e. 11:59:59 the next morning. Written only by '
  'manilaCaptureCloseIso() in apps/web/lib/papic-window.ts; read by '
  'captureWindowState(), which honours the instant verbatim. Was a DATE until '
  'this migration — a DATE cannot express 11:59am, and the gate reads a bare '
  'date as a WHOLE day, so "last day + 1" would have granted the whole next day.';

-- ── 2 · the stored window end moves with it ─────────────────────────────────
-- `events.papic_window_end` was already timestamptz and already held
-- `end-of-day Manila`. Every row written before today closes twelve hours too
-- early, and the guest camera gate + every screen read it — so a couple would
-- have been told one instant while their seats honoured another.
--
-- Idempotent by construction: only rows still sitting exactly on 23:59:59
-- Manila are moved, and after the move they sit on 11:59:59, which this
-- predicate never matches again.
UPDATE public.events
   SET papic_window_end = papic_window_end + INTERVAL '12 hours'
 WHERE papic_window_end IS NOT NULL
   AND ((papic_window_end AT TIME ZONE 'Asia/Manila')::time) = TIME '23:59:59';

COMMENT ON COLUMN public.events.papic_window_end IS
  'Papic capture window CLOSE (owner 2026-06-26, extended 2026-09-22) — the '
  'instant the cameras stop: the last chosen day at 23:59:59 Asia/Manila plus '
  'twelve hours, i.e. 11:59:59 the next morning. For non-travel events the last '
  'DAY is still pinned to event_date; the tail does not add a day, and `days` '
  'on every price label still counts the days the couple picked. NULL = legacy '
  '(no window set) — callers fall back to the same rule anchored on event_date.';

-- ── 3 · the last challenge closes when the cameras do ───────────────────────
-- `papic_challenge_ends_at` already takes `events.papic_window_end` as its
-- third term, so a celebration WITH a window follows this ruling for free. Its
-- NULL fallback does not: it says "the end of the event day" in SQL, and the
-- TypeScript fallback (`resolveStoredWindow`) now says "the end of the event
-- day plus twelve hours". Two fallbacks for one fact, disagreeing — so the SQL
-- one moves with it.
--
-- 🔑 REPLACED IN FULL RATHER THAN PATCHED, because there is no way to patch a
-- plpgsql body; the rest of this function is byte-identical to migration
-- 20271188710305 and the same db-tests cover it
-- (a-challenge-stops-being-asked, the-sequence-is-the-clock).
--
-- 🔴 EXPIRY CLOSES THE PROMPT, NEVER THE SHUTTER. Nothing here is consulted on
-- a capture path — a guest is never refused a photograph for lateness.
CREATE OR REPLACE FUNCTION public.papic_challenge_ends_at(
  p_mission_id UUID
) RETURNS TIMESTAMPTZ
LANGUAGE plpgsql
STABLE
SET search_path = public
AS $$
DECLARE
  v_armed      TIMESTAMPTZ;
  v_closed     TIMESTAMPTZ;
  v_minutes    SMALLINT;
  v_window_end TIMESTAMPTZ;
  v_event_date DATE;
  v_tz         TEXT;
  v_ends       TIMESTAMPTZ;
BEGIN
  IF p_mission_id IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT m.armed_at, m.closed_at, m.armed_duration_minutes,
         e.papic_window_end, e.event_date, e.timezone
    INTO v_armed, v_closed, v_minutes,
         v_window_end, v_event_date, v_tz
    FROM public.papic_missions m
    JOIN public.events e ON e.event_id = m.event_id
   WHERE m.mission_id = p_mission_id;

  -- Never armed: no beginning, so no end. NULL is "this has no clock", which is
  -- a different fact from "its clock has run out" and callers must not confuse
  -- them — `papic_challenge_is_open` refuses an un-armed challenge on the
  -- armed_at test, before it ever asks this.
  IF NOT FOUND OR v_armed IS NULL THEN
    RETURN NULL;
  END IF;

  -- 1 · its own timer.
  v_ends := v_armed + make_interval(mins => COALESCE(v_minutes, 30)::int);

  -- 2 · superseded by the next arming.
  IF v_closed IS NOT NULL THEN
    v_ends := LEAST(v_ends, v_closed);
  END IF;

  -- 3 · the celebration's capture window — and its twelve-hour tail.
  DECLARE
    v_window TIMESTAMPTZ := COALESCE(
      v_window_end,
      CASE WHEN v_event_date IS NOT NULL
        -- ⚠ THE `- 1 second` IS NOT DECORATION. `(event_date + 1)` is MIDNIGHT
        -- on the morning after, not the last instant of the event day — so
        -- adding twelve hours to it lands on 12:00:00, one second past where
        -- manilaCaptureCloseIso() and the column rewrite above both put the
        -- close. A one-second disagreement between two fallbacks for one fact
        -- is still a disagreement, and it is the shape that grows. Caught by
        -- tests/db/capture-runs-past-lunch.db.test.ts, which compares the two.
        THEN (((v_event_date + 1)::timestamp AT TIME ZONE COALESCE(v_tz, 'Asia/Manila'))
               - INTERVAL '1 second')
               + INTERVAL '12 hours'
      END
    );
  BEGIN
    IF v_window IS NOT NULL THEN
      v_ends := LEAST(v_ends, v_window);
    END IF;
  END;

  RETURN v_ends;
END;
$$;

COMMENT ON FUNCTION public.papic_challenge_ends_at(UUID) IS
  'When this timed challenge stops being the one being asked — the EARLIEST of '
  'its own timer (armed_at + armed_duration_minutes), the next arming '
  '(closed_at), and the celebration''s capture window (events.papic_window_end, '
  'falling back to the end of the event day PLUS the owner''s twelve-hour '
  'capture tail, 2026-09-22). NULL means NEVER ARMED — no clock at all — which '
  'is NOT the same as "expired". The single place this instant is computed: '
  'papic_challenge_is_open() and papic_armed_challenge() both read it rather '
  'than each doing their own LEAST().';

COMMIT;
