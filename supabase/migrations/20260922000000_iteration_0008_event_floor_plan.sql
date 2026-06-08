-- ============================================================================
-- 20260922000000_iteration_0008_event_floor_plan.sql
-- Iteration 0008 — floor-plan markers: per-event Stage position + a single
-- Entrance door for the seating editor.
--
-- The seating MVP rendered the stage as a fixed banner and hard-coded the
-- auto-seat anchor at top-centre. This singleton-per-event table lets the
-- couple drag the stage where it actually is, and place one entrance door
-- (owner-locked "just 1" — single entrance, not the spec's multi-door JSONB).
-- Auto-seat now anchors its role-tier rings to stage_x/stage_y.
--
-- Coordinates are percent (0–100) of the editor canvas, matching event_tables
-- x_pos/y_pos. Pattern B RLS: couples on the event read + write; nobody else.
-- Idempotent.
-- ============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS public.event_floor_plan (
  event_id          UUID PRIMARY KEY REFERENCES public.events(event_id) ON DELETE CASCADE,
  stage_x           NUMERIC NOT NULL DEFAULT 50,
  stage_y           NUMERIC NOT NULL DEFAULT 6,
  entrance_enabled  BOOLEAN NOT NULL DEFAULT FALSE,
  entrance_x        NUMERIC NOT NULL DEFAULT 50,
  entrance_y        NUMERIC NOT NULL DEFAULT 94,
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.event_floor_plan ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS event_floor_plan_couple_read ON public.event_floor_plan;
CREATE POLICY event_floor_plan_couple_read
  ON public.event_floor_plan FOR SELECT
  TO authenticated
  USING (event_id IN (SELECT public.current_couple_event_ids()));

DROP POLICY IF EXISTS event_floor_plan_couple_write ON public.event_floor_plan;
CREATE POLICY event_floor_plan_couple_write
  ON public.event_floor_plan FOR ALL
  TO authenticated
  USING (event_id IN (SELECT public.current_couple_event_ids()))
  WITH CHECK (event_id IN (SELECT public.current_couple_event_ids()));

COMMIT;
