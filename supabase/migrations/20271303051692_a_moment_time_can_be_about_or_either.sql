-- a_moment_time_can_be_about_or_either
-- Created via `pnpm migration:new`. Prefix auto-allocated to sort AFTER every
-- existing migration. KEEP THIS MIGRATION IDEMPOTENT (it may be re-applied).
--
-- 📖 A TIME AS THE COORDINATOR WROTE IT: "ABOUT 3:15", OR "2:15/2:30" (owner 2026-11-02, DECISION_LOG "SCHEDULE FITS
-- THE COORDINATOR'S TIMELINE AS WRITTEN: 4 ADDITIONS" (2)). A real timeline writes "Bridal car leaves 2:15/2:30" (one of
-- two times, decided on the day) and "Church entourage 3:15/3:20" (about then). The schedule could only hold one exact
-- clock, so it either lied ("2:15 PM") or lost the second time.
--
--   time_shape       — how the clock is meant: 'at' (exactly, today's meaning, the default for every row) ·
--                      'about' (approximately — shown "About 3:15 PM") · 'or' (either of two — shown "2:15/2:30 PM").
--   time_or_minutes  — on 'or' only: the SECOND time, as minutes after `start_at` (1–240). Minutes from the start,
--                      never a second clock — the same rule as ingress/egress (20271300072429): every writer that moves
--                      a block moves `start_at` only (Running late, the date move, a chapter move, the coordinator's
--                      advance, a "right after" anchor), and the second time must move with it.
--
-- 🔑 `start_at` stays the EARLIEST time written. Every reader that does not know the shape keeps drawing a true clock
-- (the first of the two, or the approximate one) — never a wrong one. The run of show, "Your schedule" and the
-- supplier's Schedule view draw it as written.
--
-- Refused: a shape on a row with no clock (`time_tba` — "Time TBA" / "right after" has nothing to be about), a second
-- time on anything but 'or', and an 'or' without one.
--
-- Held by apps/web/tests/db/a-moment-time-can-be-about-or-either.db.test.ts.

BEGIN;

ALTER TABLE public.event_schedule_blocks
  ADD COLUMN IF NOT EXISTS time_shape TEXT NOT NULL DEFAULT 'at',
  ADD COLUMN IF NOT EXISTS time_or_minutes SMALLINT;

ALTER TABLE public.event_schedule_blocks
  DROP CONSTRAINT IF EXISTS event_schedule_blocks_time_shape_check;
ALTER TABLE public.event_schedule_blocks
  ADD CONSTRAINT event_schedule_blocks_time_shape_check
    CHECK (
      time_shape IN ('at', 'about', 'or')
      AND (time_shape = 'at' OR NOT time_tba)
      -- COALESCE: a NULL second time on an 'or' must be FALSE here, not NULL (a CHECK lets NULL through).
      AND (
        (time_shape = 'or' AND COALESCE(time_or_minutes BETWEEN 1 AND 240, FALSE))
        OR (time_shape <> 'or' AND time_or_minutes IS NULL)
      )
    );

COMMENT ON COLUMN public.event_schedule_blocks.time_shape IS
  'How the clock is meant: at (exactly) · about ("About 3:15 PM") · or ("2:15/2:30 PM", the second time in time_or_minutes). start_at is the earliest time written. 20271303051692.';
COMMENT ON COLUMN public.event_schedule_blocks.time_or_minutes IS
  'time_shape = or only: the second time, minutes after start_at (1-240). Moves with start_at. 20271303051692.';

COMMIT;
