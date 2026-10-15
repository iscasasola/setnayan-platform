-- papic_seats_take_the_six_month_default
--
-- 📸 OWNER 2026-10-13 (DECISION_LOG "📸 OWNER — PAPIC: EASY BUY · GALLERY · MORE
-- CREDITS · ON 6 MONTHS BEFORE"): Papic is on AUTOMATICALLY from 6 months before
-- the day — `resolveStoredWindow` (apps/web/lib/papic-window.ts) has returned
-- that default since the single-day default was fixed. The brief marked one
-- thing UNCONFIRMED: do cameras made BEFORE any window was saved carry it?
--
-- 🔑 THEY DO NOT, BY CONSTRUCTION. A seat's window is stamped once, at the
-- moment it is made (`provisionFreeCamerasAdmin`, `syncGuestCameras`,
-- `papic_ensure_free_one_camera`, the guest's own camera), from whatever the
-- default was THEN. Only saving a window re-stamps seats (`setPapicWindow`).
-- A seat made while the default was the event day alone still says
-- `valid_from = event_date` — so a couple who never opened the dates sheet
-- would be told "On from Saturday, 12 June" while that camera refused every
-- shot until the wedding morning (`captureWindowState` reads `valid_from`).
-- Six of thirteen production seats were measured in exactly that shape on
-- 2026-08-07 (lib/papic-window.ts header).
--
-- ✅ THE FIX: on an event with NO saved window, every live seat whose start is
-- LATER than the automatic start is moved back to it. Nothing else changes:
--   · `valid_until` already holds the day + 12 h close (migration
--     20271238778987 moved every row), and is not touched;
--   · a NULL `valid_from` already fails OPEN, and is not touched;
--   · an event WITH a saved window is the couple's choice, and is not touched;
--   · a seat that already starts on or before the default is not touched.
-- Guests still shoot on the day only unless "Let guests shoot now" — that is
-- `guestCaptureGate`, an event-level switch, not a seat date.
--
-- The SQL default is the TypeScript default, written once more in SQL:
-- `earliestCaptureDate(D)` = D − 6 calendar months, the day clamped to the
-- target month (31 Mar → 30 Sep). Postgres `date - interval '6 months'`
-- clamps the same way. `PAPIC_CAPTURE_MONTHS_BEFORE = 6`.
--
-- Idempotent: after one run no seat matches `valid_from > default`.

UPDATE public.paparazzi_seats AS s
   SET valid_from = (e.event_date - INTERVAL '6 months')::date
  FROM public.events AS e
 WHERE s.event_id = e.event_id
   AND s.revoked_at IS NULL
   AND s.valid_from IS NOT NULL
   AND e.event_date IS NOT NULL
   AND e.papic_window_start IS NULL
   AND s.valid_from > (e.event_date - INTERVAL '6 months')::date;
