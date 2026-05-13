-- ============================================================================
-- 20260513070000_iteration_0021_planner.sql
-- Guided Planner foundation for iteration 0021.
--
-- Adds:
--   1. users.planner_mode (enum: guided | diy). Default 'guided'.
--      Couples can flip to DIY in Profile to hide the checklist on Home.
--   2. event_journey_steps — per-event ledger of step completions. Some steps
--      are auto-derivable from existing event/guest state (date set, slug set,
--      etc.), but the table records explicit check-offs for steps without an
--      auto-signal (book vendors, send invites, thank-yous).
--
-- Idempotent (IF NOT EXISTS + duplicate_object guards) so re-applies are safe.
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- 1. users.planner_mode
-- ----------------------------------------------------------------------------

DO $$ BEGIN
  CREATE TYPE public.planner_mode AS ENUM ('guided', 'diy');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS planner_mode public.planner_mode NOT NULL DEFAULT 'guided';

-- ----------------------------------------------------------------------------
-- 2. event_journey_steps
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.event_journey_steps (
  event_id      UUID NOT NULL REFERENCES public.events(event_id) ON DELETE CASCADE,
  step_key      TEXT NOT NULL,
  completed_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_by  UUID REFERENCES public.users(user_id) ON DELETE SET NULL,
  PRIMARY KEY (event_id, step_key)
);

CREATE INDEX IF NOT EXISTS event_journey_steps_event_id_idx
  ON public.event_journey_steps(event_id);

ALTER TABLE public.event_journey_steps ENABLE ROW LEVEL SECURITY;

-- Pattern B: couples on the event can read and write; nobody else. Members
-- (vendors, guests) don't see the planner state.
DROP POLICY IF EXISTS event_journey_steps_couple_read ON public.event_journey_steps;
CREATE POLICY event_journey_steps_couple_read
  ON public.event_journey_steps FOR SELECT
  TO authenticated
  USING (event_id IN (SELECT public.current_couple_event_ids()));

DROP POLICY IF EXISTS event_journey_steps_couple_write ON public.event_journey_steps;
CREATE POLICY event_journey_steps_couple_write
  ON public.event_journey_steps FOR ALL
  TO authenticated
  USING (event_id IN (SELECT public.current_couple_event_ids()))
  WITH CHECK (event_id IN (SELECT public.current_couple_event_ids()));

COMMIT;
