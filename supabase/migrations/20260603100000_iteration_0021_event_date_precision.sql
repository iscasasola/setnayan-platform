-- ============================================================================
-- 20260603100000_iteration_0021_event_date_precision.sql
--
-- Iteration 0021 + Task #39 (2026-05-22) — tiered wedding-date precision.
-- Hosts can start planning before committing to a specific date by setting
-- the date at "year" or "month" precision, then narrow to "day" once they
-- find the intersection of confirmed-vendor availability that works.
--
-- WHY:
--   The 2026-05-22 Task #39 owner directive: couples shouldn't be forced
--   to pick a specific Friday months before they know what's possible.
--   They start with a year ("Sometime in 2027"), narrow to a month once
--   season is decided ("August 2027"), and only commit to a day once
--   their booked vendors' calendars intersect on a workable date. The
--   refine-only ratchet prevents widening back to "Sometime in 2027"
--   after vendors have committed to a specific week.
--
--   The new column does NOT replace event_date — event_date stays the
--   canonical anchor (used by daysUntil, day-of-mode windowing, schedule
--   blocks, etc.). Precision is a render-time metadata column that tells
--   the UI whether to display "Sometime in 2027" / "August 2027" /
--   "Friday, August 15, 2027" and tells the server whether widening is
--   allowed under the vendor-lock gate.
--
--   For year/month modes, event_date stores the first-day-of-range
--   placeholder ('2027-01-01' for year, '2027-08-01' for month) so all
--   the downstream consumers that read event_date continue to function
--   without conditional null-checks. Day-of-mode windowing per
--   isInDayOfWindow() will still mathematically fire on those placeholder
--   dates, but in practice no host with year/month precision is hitting
--   that T-1h..T+8h window because they haven't booked vendors yet.
--   The PlanningGroups + EventDayPrepCta surfaces use precision='day' as
--   the readiness gate.
--
-- WHAT:
--   1. ADD COLUMN event_date_precision TEXT NOT NULL DEFAULT 'year'.
--      Default 'year' so new events created via the simplified create-event
--      flow (which leaves event_date NULL) land in the lowest-commitment
--      state. The create-event action does NOT explicitly set this — the
--      column default applies.
--   2. CHECK constraint: precision ∈ ('year', 'month', 'day').
--   3. Backfill: existing rows with event_date IS NOT NULL → 'day' (their
--      current behavior — full date stamps imply day-precision). Existing
--      rows with event_date IS NULL → 'year' (matches the default for new
--      rows, and these are early-planning events that match the
--      lowest-commitment state).
--   4. Idempotent — IF NOT EXISTS pattern.
--   5. No RLS changes — the column piggybacks on the existing event-scope
--      RLS policies that already gate `events` row access.
--
-- Refine-only ratchet enforcement lives in the server action
-- (apps/web/app/dashboard/[eventId]/actions.ts → updateEventDate) — the
-- DB does not encode the rule because legitimate "widen with 0 confirmed
-- vendors" is allowed and the gate is application-level (vendor count
-- query joined against CONFIRMED_VENDOR_STATUSES enum).
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- 1. New column with default
-- ----------------------------------------------------------------------------

ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS event_date_precision TEXT NOT NULL DEFAULT 'year';

-- ----------------------------------------------------------------------------
-- 2. CHECK constraint — three valid values
-- ----------------------------------------------------------------------------

ALTER TABLE public.events
  DROP CONSTRAINT IF EXISTS events_event_date_precision_check;

ALTER TABLE public.events
  ADD CONSTRAINT events_event_date_precision_check
  CHECK (event_date_precision IN ('year', 'month', 'day'));

-- ----------------------------------------------------------------------------
-- 3. Backfill — existing rows
--    Rows with a populated event_date get 'day' precision (their current
--    behavior — they were created under the pre-Task-#39 assumption that
--    every event has a specific day). Rows without event_date get 'year'
--    (matches the column default; lowest-commitment state).
-- ----------------------------------------------------------------------------

UPDATE public.events SET event_date_precision = 'day' WHERE event_date IS NOT NULL;
UPDATE public.events SET event_date_precision = 'year' WHERE event_date IS NULL;

-- ----------------------------------------------------------------------------
-- 4. Column documentation
-- ----------------------------------------------------------------------------

COMMENT ON COLUMN public.events.event_date_precision IS
  'Precision of event_date: year = host knows year only ("Sometime in 2027"), '
  'month = year+month ("August 2027"), day = specific date ("Friday, August 15, 2027"). '
  'For year/month modes event_date stores the first-day-of-range placeholder so '
  'downstream consumers keep working. Refine-only ratchet enforced in '
  'updateEventDate server action when confirmed-vendor count > 0. Per CLAUDE.md '
  'decision log Task #39 (2026-05-22) + iteration 0021 § 10 supersession note.';

COMMIT;
