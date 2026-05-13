-- ============================================================================
-- 20260513180000_iteration_0030_guided_tour.sql
-- Iteration 0030 Guided Tour MVP.
--
-- Adds users.tour_completed_at: nullable timestamp. NULL means the first-run
-- welcome tour hasn't been dismissed yet. The layout reads this on every
-- dashboard request and conditionally mounts the tour modal.
--
-- Deferred:
--   • Per-feature mini-tours (e.g. Mood Board walkthrough on first visit)
--   • Tour analytics (which slide did users drop on?)
--   • Multi-step element-highlighting tour (V1 ships a slide carousel)
--
-- Idempotent.
-- ============================================================================

BEGIN;

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS tour_completed_at TIMESTAMPTZ;

COMMIT;
