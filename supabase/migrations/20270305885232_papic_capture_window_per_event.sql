-- papic capture window per event
-- Created via `pnpm migration:new`. Prefix auto-allocated to sort AFTER every
-- existing migration. KEEP THIS MIGRATION IDEMPOTENT (it may be re-applied):
--   • ALTER TABLE … ADD COLUMN IF NOT EXISTS …

-- Papic capture window per event (owner 2026-06-26).
--
-- The couple now chooses a capture WINDOW for their event's Papic — a start
-- (day + time) and an end (day; time auto-set to end-of-day Asia/Manila). The
-- window does two things at once:
--   1) sets the bill — every Papic camera (Limited guest cameras + Unlimited
--      extras) is priced `cameras × rate/day × DAYS`, where DAYS is the
--      calendar-inclusive span of the window (≥ 1).
--   2) sets how long the cameras can shoot — paparazzi_seats.valid_from /
--      valid_until are stamped to the window, and capture is gated to it
--      (recordSeatCapture + the /api/upload presign probe).
--
-- Event-type rules (enforced in lib/papic-window.ts, NOT in SQL):
--   • travel  — free range, start day-1 → end date of the trip.
--   • else    — anchored to events.event_date: the window must COVER the event
--               day and may extend BEFORE it but never AFTER (end pinned to the
--               event date). Weddings are the canonical single-day case.
--
-- Window close ends CAPTURE only — never the DATA. Galleries, Drive copies and
-- reels persist forever (the 2026-06-26 "window close ends capture, never the
-- data" lock), and the guest tagging QR stays event-scoped-forever (the
-- 2026-05-22 unified-QR lock) so guests can still view + tag after the shoot.
--
-- Nullable: a NULL window is the backward-compatible "single day anchored to
-- event_date" behaviour every existing event keeps until the couple sets one.

alter table public.events
  add column if not exists papic_window_start timestamptz,
  add column if not exists papic_window_end   timestamptz;

comment on column public.events.papic_window_start is
  'Papic capture window START (owner 2026-06-26) — day + time the cameras open. NULL = legacy single-day (anchored to event_date). Drives DAYS pricing + paparazzi_seats.valid_from.';
comment on column public.events.papic_window_end is
  'Papic capture window END (owner 2026-06-26) — auto-set to end-of-day Asia/Manila of the chosen end date. For non-travel events this is pinned to event_date. Drives DAYS pricing + paparazzi_seats.valid_until.';
