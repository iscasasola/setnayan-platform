-- ============================================================================
-- 20260923000000_iteration_0008_venue_dimensions.sql
-- Iteration 0008 — venue dimensions for the seating editor.
--
-- Lets the couple enter the reception room's width × length (metres) so the
-- floor plan renders TO SCALE: each table draws at its true real-world
-- footprint relative to the room, making it obvious whether everything fits
-- with aisles. NULL on both = no dimensions set (free-form abstract canvas).
--
-- Additive + idempotent.
-- ============================================================================

BEGIN;

ALTER TABLE public.event_floor_plan
  ADD COLUMN IF NOT EXISTS venue_width_m  NUMERIC,
  ADD COLUMN IF NOT EXISTS venue_length_m NUMERIC;

COMMIT;
