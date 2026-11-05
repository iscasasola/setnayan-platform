-- 20271302002155_guest_seat_view.sql
--
-- 🪑 HOW GUESTS SEE THEIR SEAT (owner 2026-11-01, DECISION_LOG "SEATS: WHAT EACH VIEW DOES", item 3): a Seats ⚙
-- setting, next to "Show guests their seats early", picks how a guest sees their seat — the 2D map, the 3D walk, or
-- Both. Default 'both' = 2D first with the 3D walk beside it, which is what every guest sees today, so no event changes.
--
-- ONE statement, ALTER only — no UPDATE / INSERT in this file (the default fills every existing row). Prod refused an
-- ALTER that followed a write on the same table in one transaction (SQLSTATE 55006, 2026-11-01); there is no write here.
-- RLS: event_floor_plan's existing policies already cover a new column. Idempotent.

ALTER TABLE public.event_floor_plan
  ADD COLUMN IF NOT EXISTS guest_seat_view TEXT NOT NULL DEFAULT 'both'
    CHECK (guest_seat_view IN ('2d', '3d', 'both'));

COMMENT ON COLUMN public.event_floor_plan.guest_seat_view IS
  'How a guest sees their seat (owner 2026-11-01): ''2d'' = the 2D map only · ''3d'' = the 3D walk to the seat · '
  '''both'' (default) = the 2D map first, the 3D walk beside it. Written by the Seats ⚙ (setGuestSeatView).';
