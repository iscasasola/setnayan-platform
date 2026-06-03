-- Couple-side "Planning reminders" opt-out toggle (2026-06-03).
--
-- Gates the `recommended_deadline` source in lib/upcoming-items.ts — the free
-- per-service recommended-deadline reminders on the Home "Upcoming" stream.
-- Default TRUE (reminders on by default · the helpful default); couples turn
-- them off in Settings. Per-user (applies across all their events), matching
-- the existing scalar-preference pattern on `public.users` (planner_mode,
-- theme_preference, locale, marketing_opt_in). No RLS change — the existing
-- users-table policies already scope a user to their own row.

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS reminders_enabled BOOLEAN NOT NULL DEFAULT TRUE;

COMMENT ON COLUMN public.users.reminders_enabled IS
  'Couple opt-out for the free recommended-deadline planning reminders on Home (lib/upcoming-items.ts source=recommended_deadline). Default TRUE.';
