-- seats_early_stamp_reset_for_upcoming_events
-- Created via `pnpm migration:new`. Prefix auto-allocated. ONE-TIME DATA RESET,
-- idempotent (re-running clears nothing new that the owner did not ask for).
--
-- ── WHY (owner 2026-09-30, verbatim) ─────────────────────────────────────────
-- "reset all upcoming events to 'seats only on the day part of the website'
--  they do not need to know their seat yet"
--
-- 20271254054934_seats_show_on_the_day made seats open by themselves on the
-- event's day and turned `event_floor_plan.published_at` into the couple's
-- "Show guests their seats early" switch. Every stamp written BEFORE that — by
-- the old "Guests see this now" switch or by "Publish & print" — would now read
-- as "shown early" and keep seat links up before the day. This clears those
-- stamps for every event whose day has NOT yet arrived.
--
-- "Not yet arrived" is exactly the negation of the day half of
-- `public.guests_may_see_seats()`: NOT (event_date_precision = 'day' AND
-- event_date <= today in Asia/Manila). So an event with no date, or a date known
-- only to the month/year, counts as upcoming and is reset; an event whose day is
-- today or past is left untouched (its seats are open by the day rule anyway).
--
-- Touches ONLY `event_floor_plan.published_at` (+ updated_at). NOT the table
-- signs' `event_tables.qr_published_at`, NOT seat assignments, NOT tables.
-- Applied by the pipeline (`supabase db push --include-all`), never directly.

BEGIN;

UPDATE public.event_floor_plan fp
SET published_at = NULL,
    updated_at = now()
FROM public.events e
WHERE e.event_id = fp.event_id
  AND fp.published_at IS NOT NULL
  AND NOT (
    e.event_date_precision = 'day'
    AND e.event_date IS NOT NULL
    AND e.event_date <= (now() AT TIME ZONE 'Asia/Manila')::date
  );

COMMIT;
