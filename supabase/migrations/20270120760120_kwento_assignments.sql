-- kwento_assignments
-- Created via `pnpm migration:new`. Prefix auto-allocated to sort AFTER every
-- existing migration. KEEP THIS MIGRATION IDEMPOTENT (it may be re-applied):
--   • CREATE TABLE IF NOT EXISTS …   (+ ALTER TABLE … ENABLE ROW LEVEL SECURITY in the SAME migration)
--   • ALTER TABLE … ADD COLUMN IF NOT EXISTS …
--   • CREATE INDEX IF NOT EXISTS …
--   • CREATE OR REPLACE FUNCTION …
--   • DROP POLICY IF EXISTS … ; CREATE POLICY …   (policies have no IF NOT EXISTS)

-- kwento_assignments: editorial moment-slot assignments.
--
-- Couple + Best Man/MoH delegates assign a guest to one of the 10 locked
-- editorial moments. The assigned guest receives an email nudge and is
-- expected to write a Kwento Story against the moment's photo.
--
-- fulfilled_column_id (FK to kwento_columns) is intentionally absent here.
-- Phase 4 adds it via ALTER TABLE once kwento_columns exists.

CREATE TABLE IF NOT EXISTS public.kwento_assignments (
  id                  BIGSERIAL     PRIMARY KEY,
  assignment_id       UUID          NOT NULL UNIQUE DEFAULT gen_random_uuid(),
  event_id            UUID          NOT NULL REFERENCES public.events(event_id) ON DELETE CASCADE,
  moment_key          TEXT          NOT NULL,
  assigned_guest_id   UUID          NOT NULL REFERENCES public.guests(guest_id) ON DELETE CASCADE,
  assigned_by_user_id UUID          NOT NULL REFERENCES auth.users(id),
  nudge_count         INTEGER       NOT NULL DEFAULT 0,
  last_nudged_at      TIMESTAMPTZ,
  created_at          TIMESTAMPTZ   NOT NULL DEFAULT NOW(),

  CONSTRAINT kwento_assignments_unique UNIQUE (event_id, moment_key, assigned_guest_id)
);

CREATE INDEX IF NOT EXISTS kwento_assignments_event_idx
  ON public.kwento_assignments (event_id);
CREATE INDEX IF NOT EXISTS kwento_assignments_guest_idx
  ON public.kwento_assignments (assigned_guest_id);

ALTER TABLE public.kwento_assignments ENABLE ROW LEVEL SECURITY;

-- Read: admin + any event member
DROP POLICY IF EXISTS kwento_assignments_read ON public.kwento_assignments;
CREATE POLICY kwento_assignments_read ON public.kwento_assignments FOR SELECT
  TO authenticated
  USING (
    public.is_admin()
    OR event_id IN (SELECT public.current_event_ids())
  );

-- Insert: admin + event member (app enforces best_man/moh delegate check)
DROP POLICY IF EXISTS kwento_assignments_insert ON public.kwento_assignments;
CREATE POLICY kwento_assignments_insert ON public.kwento_assignments FOR INSERT
  TO authenticated
  WITH CHECK (
    public.is_admin()
    OR event_id IN (SELECT public.current_event_ids())
  );

-- Update: admin + event member (nudge count / timestamp updates)
DROP POLICY IF EXISTS kwento_assignments_update ON public.kwento_assignments;
CREATE POLICY kwento_assignments_update ON public.kwento_assignments FOR UPDATE
  TO authenticated
  USING (
    public.is_admin()
    OR event_id IN (SELECT public.current_event_ids())
  );

-- Delete: admin + event member
DROP POLICY IF EXISTS kwento_assignments_delete ON public.kwento_assignments;
CREATE POLICY kwento_assignments_delete ON public.kwento_assignments FOR DELETE
  TO authenticated
  USING (
    public.is_admin()
    OR event_id IN (SELECT public.current_event_ids())
  );
