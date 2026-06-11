-- ============================================================================
-- 20261114000000_iteration_0008_floorplan_kit.sql
-- Iteration 0008 — floor-plan kit: resizable stage + dance-floor zone +
-- optional service entrance (owner-directed 2026-06-10: "adding a place for
-- the entrance, service entrance (optional), stage (must be resizable),
-- dance floor").
--
-- The stage was a position-only marker (stage_x/stage_y); it gains a SIZE
-- (percent of the canvas, matching every other floor-plan coordinate) so the
-- couple can drag-resize it to the venue's real platform. The dance floor is
-- a sized no-table zone (the editor blocks table drops inside it). The
-- service entrance mirrors the main entrance (load-in / caterer door).
--
-- Additive + defaulted + idempotent — safe on a live DB; existing rows render
-- exactly as before (the default stage size matches the old marker footprint).
-- RLS on event_floor_plan is unchanged (couple read/write via
-- current_couple_event_ids()).
-- ============================================================================

BEGIN;

ALTER TABLE public.event_floor_plan
  ADD COLUMN IF NOT EXISTS stage_w                  NUMERIC NOT NULL DEFAULT 24,
  ADD COLUMN IF NOT EXISTS stage_h                  NUMERIC NOT NULL DEFAULT 7,
  ADD COLUMN IF NOT EXISTS dance_enabled            BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS dance_x                  NUMERIC NOT NULL DEFAULT 50,
  ADD COLUMN IF NOT EXISTS dance_y                  NUMERIC NOT NULL DEFAULT 55,
  ADD COLUMN IF NOT EXISTS dance_w                  NUMERIC NOT NULL DEFAULT 22,
  ADD COLUMN IF NOT EXISTS dance_h                  NUMERIC NOT NULL DEFAULT 18,
  ADD COLUMN IF NOT EXISTS service_entrance_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS service_entrance_x       NUMERIC NOT NULL DEFAULT 97,
  ADD COLUMN IF NOT EXISTS service_entrance_y       NUMERIC NOT NULL DEFAULT 50;

COMMENT ON COLUMN public.event_floor_plan.stage_w IS
  'Stage width as percent of the canvas (stage_x/stage_y = centre). Drag-resizable in the editor.';
COMMENT ON COLUMN public.event_floor_plan.stage_h IS
  'Stage height as percent of the canvas.';
COMMENT ON COLUMN public.event_floor_plan.dance_enabled IS
  'Dance-floor zone on/off. When on, the editor blocks table drops inside the zone.';
COMMENT ON COLUMN public.event_floor_plan.service_entrance_enabled IS
  'Optional second door (load-in / caterer). Mirrors the main entrance marker.';

COMMIT;
