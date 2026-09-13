-- ONE DOOR, ONE ANSWER — fold the wayfinding entrance into the canonical store.
--
-- There were TWO independent answers to "where is the door", each with its own
-- editor and neither writing the other:
--
--   · events.venue_entrance_x/y      — written by the Indoor Blueprint studio,
--                                      read ONLY by /[slug]/find-my-table and
--                                      the seating tour.
--   · event_floor_plan.entrance_x/y  — written by the seating lab's floor
--                                      markers, read by the lab, the PUBLIC
--                                      venue walk, plan3d-scene and
--                                      venue-decor.
--
-- Both are guest-facing, so a couple who moved the door in one editor left the
-- other pointing at the old one. They agreed only because both defaulted to
-- bottom-centre. event_floor_plan is canonical: it also carries
-- entrance_enabled, a service entrance, and door-vs-walk-through geometry.
--
-- This backfill carries every blueprint-placed door across.
--
-- ⚠ IT NEVER MOVES A DOOR SOMEBODY CAN ALREADY SEE. The DO UPDATE is guarded on
-- entrance_enabled = FALSE, so an event whose lab door is ENABLED keeps it:
-- that is the door currently drawn in the 3D room and walked through on the
-- public page. Only events with no enabled doorway inherit the blueprint
-- position. Where the two disagreed, the visible one wins.
--
-- Idempotent: re-running changes nothing once every row is enabled.
--
-- ⚠ events.venue_entrance_x/y are deliberately NOT dropped here. fetchEntrance
-- still reads them as a transitional fallback so nothing is lost if this
-- migration and the application deploy land out of order. Retire them in a
-- follow-up once prod is verified — a column drop is not worth racing a deploy.

DO $$
BEGIN
  -- Pre-migration safety: both column sets must exist before we can move data.
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'events'
      AND column_name = 'venue_entrance_x'
  ) THEN
    RAISE NOTICE 'events.venue_entrance_x absent — nothing to backfill';
    RETURN;
  END IF;

  INSERT INTO public.event_floor_plan (event_id, entrance_x, entrance_y, entrance_enabled)
  SELECT e.event_id,
         GREATEST(0, LEAST(100, e.venue_entrance_x)),
         GREATEST(0, LEAST(100, e.venue_entrance_y)),
         TRUE
  FROM public.events e
  WHERE e.venue_entrance_x IS NOT NULL
    AND e.venue_entrance_y IS NOT NULL
  ON CONFLICT (event_id) DO UPDATE
    SET entrance_x       = EXCLUDED.entrance_x,
        entrance_y       = EXCLUDED.entrance_y,
        entrance_enabled = TRUE,
        updated_at       = NOW()
    WHERE public.event_floor_plan.entrance_enabled = FALSE;
END $$;

COMMENT ON COLUMN public.events.venue_entrance_x IS
  'DEPRECATED 2026-09-03 — superseded by event_floor_plan.entrance_x. Read only as a transitional fallback in fetchEntrance(); no writer remains. Safe to drop once prod is verified.';
COMMENT ON COLUMN public.events.venue_entrance_y IS
  'DEPRECATED 2026-09-03 — superseded by event_floor_plan.entrance_y. Read only as a transitional fallback in fetchEntrance(); no writer remains. Safe to drop once prod is verified.';
