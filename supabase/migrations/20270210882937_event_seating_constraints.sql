-- Smart seat-plan · Phase 3 — keep-apart seating constraints.
-- Per-event "these two guests must never share a table" rules (HARD, expanded to
-- both guests' custom groups at solve time by lib/seating.ts solveSeatPlan).
-- COUPLE-PRIVATE (RA 10173): socially sensitive, never shown to guests/vendors —
-- couple read+write only, mirroring the iteration-0008 event_floor_plan RLS.
-- Idempotent; RLS enabled at CREATE TABLE time.
BEGIN;

CREATE TABLE IF NOT EXISTS public.event_seating_constraints (
  id            BIGSERIAL PRIMARY KEY,
  constraint_id UUID NOT NULL UNIQUE DEFAULT gen_random_uuid(),
  event_id      UUID NOT NULL REFERENCES public.events(event_id) ON DELETE CASCADE,
  kind          TEXT NOT NULL DEFAULT 'keep_apart' CHECK (kind IN ('keep_apart')),
  guest_a_id    UUID NOT NULL REFERENCES public.guests(guest_id) ON DELETE CASCADE,
  guest_b_id    UUID NOT NULL REFERENCES public.guests(guest_id) ON DELETE CASCADE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT event_seating_constraints_not_self CHECK (guest_a_id <> guest_b_id)
);

COMMENT ON TABLE public.event_seating_constraints IS
  'Smart seat-plan Phase 3: per-event keep-apart rules — two guests who must never share a table (HARD; group-aware at solve time). Couple-private (RA 10173).';

-- One rule per unordered guest pair per event. Expression-unique → must be a
-- UNIQUE INDEX (a table-level UNIQUE(...) clause cannot use LEAST/GREATEST).
CREATE UNIQUE INDEX IF NOT EXISTS event_seating_constraints_unique_pair
  ON public.event_seating_constraints (event_id, LEAST(guest_a_id, guest_b_id), GREATEST(guest_a_id, guest_b_id));
CREATE INDEX IF NOT EXISTS event_seating_constraints_event_kind_idx
  ON public.event_seating_constraints (event_id, kind);
CREATE INDEX IF NOT EXISTS event_seating_constraints_guest_a_idx
  ON public.event_seating_constraints (event_id, guest_a_id);
CREATE INDEX IF NOT EXISTS event_seating_constraints_guest_b_idx
  ON public.event_seating_constraints (event_id, guest_b_id);

ALTER TABLE public.event_seating_constraints ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS event_seating_constraints_couple_read ON public.event_seating_constraints;
CREATE POLICY event_seating_constraints_couple_read
  ON public.event_seating_constraints FOR SELECT
  TO authenticated
  USING (event_id IN (SELECT public.current_couple_event_ids()));

DROP POLICY IF EXISTS event_seating_constraints_couple_write ON public.event_seating_constraints;
CREATE POLICY event_seating_constraints_couple_write
  ON public.event_seating_constraints FOR ALL
  TO authenticated
  USING (event_id IN (SELECT public.current_couple_event_ids()))
  WITH CHECK (event_id IN (SELECT public.current_couple_event_ids()));

COMMIT;
