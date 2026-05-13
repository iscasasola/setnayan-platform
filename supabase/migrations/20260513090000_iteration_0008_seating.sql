-- ============================================================================
-- 20260513090000_iteration_0008_seating.sql
-- Iteration 0008 Seating Chart MVP — tables + assignments only.
--
-- This V1 slice ships:
--   • `table_type` enum (13 catalog entries from the spec)
--   • `event_tables` — per-event tables with type + capacity + label + sort_order
--   • `event_seat_assignments` — guest → table (event-unique guest_id)
--   • Pattern B RLS: couples on the event read + write; nobody else
--
-- Deferred:
--   • Free-placed editor (x_pos/y_pos columns are reserved nullable for now)
--   • Role-tier auto-fill ring algorithm
--   • QR-on-publish + print pack
--
-- Idempotent.
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- 1. Table type enum (13 catalog entries from spec)
-- ----------------------------------------------------------------------------

DO $$ BEGIN
  CREATE TYPE public.table_type AS ENUM (
    'round_8',
    'round_10',
    'round_12',
    'rectangle_6',
    'rectangle_8',
    'rectangle_10',
    'long_12',
    'long_16',
    'sweetheart_2',
    'head_table',
    'crescent_8',
    'crescent_10',
    'custom'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ----------------------------------------------------------------------------
-- 2. event_tables
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.event_tables (
  table_id      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  public_id     TEXT UNIQUE NOT NULL DEFAULT public.generate_public_id('T'),
  event_id      UUID NOT NULL REFERENCES public.events(event_id) ON DELETE CASCADE,
  table_label   TEXT NOT NULL,
  table_type    public.table_type NOT NULL,
  capacity      INTEGER NOT NULL CHECK (capacity > 0 AND capacity <= 32),
  x_pos         NUMERIC,
  y_pos         NUMERIC,
  sort_order    INTEGER NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS event_tables_event_id_idx ON public.event_tables(event_id);

ALTER TABLE public.event_tables ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS event_tables_couple_read ON public.event_tables;
CREATE POLICY event_tables_couple_read
  ON public.event_tables FOR SELECT
  TO authenticated
  USING (event_id IN (SELECT public.current_couple_event_ids()));

DROP POLICY IF EXISTS event_tables_couple_write ON public.event_tables;
CREATE POLICY event_tables_couple_write
  ON public.event_tables FOR ALL
  TO authenticated
  USING (event_id IN (SELECT public.current_couple_event_ids()))
  WITH CHECK (event_id IN (SELECT public.current_couple_event_ids()));

-- ----------------------------------------------------------------------------
-- 3. event_seat_assignments
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.event_seat_assignments (
  assignment_id  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id       UUID NOT NULL REFERENCES public.events(event_id) ON DELETE CASCADE,
  table_id       UUID NOT NULL REFERENCES public.event_tables(table_id) ON DELETE CASCADE,
  guest_id       UUID NOT NULL REFERENCES public.guests(guest_id) ON DELETE CASCADE,
  seat_number    INTEGER,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (event_id, guest_id)
);

CREATE INDEX IF NOT EXISTS event_seat_assignments_event_id_idx
  ON public.event_seat_assignments(event_id);
CREATE INDEX IF NOT EXISTS event_seat_assignments_table_id_idx
  ON public.event_seat_assignments(table_id);

ALTER TABLE public.event_seat_assignments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS event_seat_assignments_couple_read ON public.event_seat_assignments;
CREATE POLICY event_seat_assignments_couple_read
  ON public.event_seat_assignments FOR SELECT
  TO authenticated
  USING (event_id IN (SELECT public.current_couple_event_ids()));

DROP POLICY IF EXISTS event_seat_assignments_couple_write ON public.event_seat_assignments;
CREATE POLICY event_seat_assignments_couple_write
  ON public.event_seat_assignments FOR ALL
  TO authenticated
  USING (event_id IN (SELECT public.current_couple_event_ids()))
  WITH CHECK (event_id IN (SELECT public.current_couple_event_ids()));

COMMIT;
