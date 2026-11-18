-- one_pick_events_get_their_date
-- Created via `pnpm migration:new`. Prefix auto-allocated to sort AFTER every
-- existing migration. KEEP THIS MIGRATION IDEMPOTENT (it may be re-applied):
--   • CREATE TABLE IF NOT EXISTS …   (+ ALTER TABLE … ENABLE ROW LEVEL SECURITY in the SAME migration)
--   • ALTER TABLE … ADD COLUMN IF NOT EXISTS …
--   • CREATE INDEX IF NOT EXISTS …
--   • CREATE OR REPLACE FUNCTION …
--   • DROP POLICY IF EXISTS … ; CREATE POLICY …   (policies have no IF NOT EXISTS)

--
-- ════════════════════════════════════════════════════════════════════════════
-- OLD ONE-PICK EVENTS GET THEIR DATE SAVED (owner 16 Nov 2026, "a" —
-- DECISION_LOG "OLD ONE-PICK EVENTS GET THEIR DATE SAVED").
-- ════════════════════════════════════════════════════════════════════════════
-- Since 14 Nov (PR #7615, 16f7e76a) a couple who picks ONE day at sign-up gets
-- that day as THE date: `event_date = <the day>`, `event_date_precision = 'day'`,
-- `date_candidates = NULL`. Events made before that kept the one day as a lone
-- "option" with no date — so Papic, the schedule and every supplier read the
-- event as undated. Prod, measured 16 Nov: 5 such events, 3 with Papic on.
--
-- This is a ONE-TIME fill that ends each of those rows in the state a NEW
-- one-pick event is born in. Exactly these rows and nothing else:
--     event_date IS NULL
--     AND date_mode IS DISTINCT FROM 'window'
--     AND cardinality(date_candidates) = 1
-- A row with 2+ options, a window, or a date already set is never touched.
--
-- WHAT EACH TRIGGER ON `events` DOES TO THIS UPDATE (read, not assumed):
--   • sync_event_date_status_trg (BEFORE) — a day-precise date moves
--     date_status 'undecided' → 'locked'. Same as the new-event INSERT. KEPT.
--   • events_default_chapters_follow_date (AFTER) — the four default chapters
--     made on the placeholder day move onto the real day and the pending marker
--     is cleared. A new dated event's chapters already sit on its day. KEPT.
--   • events_booked_dates_follow_the_event · events_schedule_anchor_follow_date
--     — both return at once when OLD.event_date IS NULL. No effect.
--   • booking_fee_top_up_follows_the_event — re-dates still-owing top-ups to the
--     event day. The right answer for any that exist. KEPT.
--   • events_keep_booking_history (AFTER) — would write a booking_changes row
--     AND post "Event date set · …" into every supplier chat on the event. A new
--     event has neither, and nobody changed anything: the couple picked this day
--     at sign-up. SWITCHED OFF FOR THIS ONE STATEMENT ONLY and back on before
--     COMMIT (all inside one transaction — a failure rolls the switch back too).
--
-- PAPIC. No trigger derives a camera's window from the event date: a seat's
-- window is stamped ONCE, when the seat is made (`resolveStoredWindow` in
-- apps/web/lib/papic-window.ts), and a seat made on an undated event was
-- stamped NULL/NULL (fails open — it shoots any day). A seat made on a new
-- dated event gets the default window, so this fill stamps the same thing onto
-- every live seat of a filled event that still has NO window at all:
--     valid_from  = event_date − 6 months            (earliestCaptureDate)
--     valid_until = event_date 23:59:59 Manila + 12h (manilaCaptureCloseIso)
-- `events.papic_window_start/end` stay NULL — a new event has no SAVED window
-- either; the default is computed. A seat with any window already is left alone.
--
-- IDEMPOTENT: after one run no row matches the event filter, and the seat fill
-- only follows events this run filled — a second run changes 0 rows.
-- NEVER APPLIED BY HAND: it reaches prod only through merge → deploy db push.

BEGIN;

ALTER TABLE public.events DISABLE TRIGGER events_keep_booking_history;

WITH filled AS (
  UPDATE public.events
     SET event_date           = date_candidates[1],
         event_date_precision = 'day',
         date_candidates      = NULL
   WHERE event_date IS NULL
     AND date_mode IS DISTINCT FROM 'window'
     AND cardinality(date_candidates) = 1
     AND date_candidates[1] IS NOT NULL
  RETURNING event_id, event_date
)
UPDATE public.paparazzi_seats AS s
   SET valid_from  = (f.event_date - INTERVAL '6 months')::date,
       valid_until = (((f.event_date + 1)::timestamp AT TIME ZONE 'Asia/Manila')
                       - INTERVAL '1 second') + INTERVAL '12 hours'
  FROM filled AS f
 WHERE s.event_id   = f.event_id
   AND s.revoked_at IS NULL
   AND s.valid_from  IS NULL
   AND s.valid_until IS NULL;

-- The fill queues deferred constraint checks on the rows it changed; Postgres
-- refuses an ALTER TABLE while any are pending (55006). Run them now — the same
-- checks COMMIT would run — so the trigger can be switched back on.
SET CONSTRAINTS ALL IMMEDIATE;

ALTER TABLE public.events ENABLE TRIGGER events_keep_booking_history;

COMMIT;
