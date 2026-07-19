-- Smart seat-plan · Phase 4 — lock-and-fill.
-- A locked seat assignment is hand-placed and PINNED: the solver treats it as
-- fixed and fills everyone else around it ("lock the head table, fill the rest").
-- Additive + idempotent; inherits event_seat_assignments' existing RLS.
BEGIN;

ALTER TABLE public.event_seat_assignments
  ADD COLUMN IF NOT EXISTS locked BOOLEAN NOT NULL DEFAULT FALSE;

COMMENT ON COLUMN public.event_seat_assignments.locked IS
  'Smart seat-plan Phase 4 lock-and-fill: TRUE = hand-placed seat pinned; Auto Arrange / lock-and-fill keeps it fixed and seats everyone else around it.';

COMMIT;
