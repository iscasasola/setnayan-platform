-- papic free event pool seed
--
-- Papic Free = "the Pool product capped at 50 points" (owner 2026-07-22 ·
-- Papic_One_Pool_Model_Spec §0: "Free is Papic pool with just 50 points"). ONE
-- shared 50-pt event pool per event, seeded via a free_grant at event creation.
-- NO per-seat reserve — "just 50 points" is a plain shared budget, first-come.
-- The existing free seats draw the SAME pool: the 20270901123354 config
-- migration flips papic_tier_config.free.points_per_day → NULL, so a free seat's
-- per-camera reserve passes through and the event pool is its sole gate (once
-- the pool binding migration makes grant-driven events apply).
--
-- Additive + idempotent + inert-on-apply. No is_active / status flip. No new
-- surface. Depends on migration 20270901123354 having already legalized the
-- 'free_grant' source value.
--
-- NEW events only — no backfill of existing events (they keep zero grants →
-- pool does not apply → unmetered exactly as today). Confines the new 50-pt cap
-- to events created after this ships.

BEGIN;

-- ---- 2a. Admin-tunable free grant amount ---------------------------------
ALTER TABLE public.papic_event_pool_config
  ADD COLUMN IF NOT EXISTS free_grant_points INTEGER NOT NULL DEFAULT 50
    CHECK (free_grant_points >= 0);

-- ---- 2b. Seed the 50-pt pool at event creation (AFTER INSERT trigger) -----
-- A DB trigger (not app code) so EVERY event-insertion path seeds the pool
-- uniformly and cannot be bypassed by a new insertion site. Single shared
-- budget per event; no per-seat reserve. Idempotent: one free_grant per event,
-- ever.
CREATE OR REPLACE FUNCTION public.papic_seed_free_grant()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_pts INTEGER;
BEGIN
  SELECT free_grant_points INTO v_pts
    FROM public.papic_event_pool_config WHERE config_key = 'default';
  v_pts := COALESCE(v_pts, 50);
  IF v_pts <= 0 THEN
    RETURN NEW;
  END IF;

  -- Idempotent: one free_grant per event, ever.
  IF EXISTS (
    SELECT 1 FROM public.papic_event_point_grants
     WHERE event_id = NEW.event_id AND source = 'free_grant'
  ) THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.papic_event_point_grants (event_id, points, source, note)
  VALUES (NEW.event_id, v_pts, 'free_grant', 'Papic Free · shared 50-pt event pool');
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS papic_seed_free_grant_trg ON public.events;
CREATE TRIGGER papic_seed_free_grant_trg
  AFTER INSERT ON public.events
  FOR EACH ROW EXECUTE FUNCTION public.papic_seed_free_grant();

COMMIT;
