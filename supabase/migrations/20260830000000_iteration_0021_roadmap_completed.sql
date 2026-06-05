-- Iteration 0021 · Wedding Roadmap — manual "things to complete" check-off
--
-- Owner 2026-06-05: a simple, free "things to complete" list on the couple
-- Home — the ordered wedding tasks, timed by months-to-earliest-date. The
-- couple TAPS each one done themselves (manual check-off, no automation / no
-- auto-detection of completion / no AI — that Today's-Focus automation is
-- explicitly NOT wanted). This column persists which roadmap items the couple
-- has marked done; a done item is removed from the list and stays removed.
--
-- Values are stable roadmap item keys (lock_date, reception_venue, …) defined
-- in apps/web/lib/wedding-roadmap.ts. Default '{}' = nothing done yet (no
-- behavior change for existing events).

ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS roadmap_completed TEXT[] NOT NULL DEFAULT '{}';

COMMENT ON COLUMN public.events.roadmap_completed IS
  'Wedding-roadmap item keys the couple has manually marked done (owner '
  '2026-06-05, iteration 0021). Manual check-off only — no auto-detection.';
