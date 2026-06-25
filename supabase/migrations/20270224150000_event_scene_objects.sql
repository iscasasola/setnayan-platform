-- ============================================================================
-- 20270224150000_event_scene_objects.sql
--
-- "Whole-venue designer" foundation (owner 2026-06-26: "make full use of this so
-- our edit is not just a seat plan"). The 3D lab gains placeable NON-seating
-- venue objects — arch, buffet, bar, cake/gift/registration tables, photo booth,
-- lounge, LED wall, greenery — so the couple lays out the ENTIRE space, with
-- seating as one layer. Positioned on the same percent canvas as tables; the
-- crowd/walk-in already avoids them via floorObstacles (sceneObjectObstacles).
--
-- Couple-scoped exactly like event_tables / event_vendor_booth_placements
-- (current_couple_event_ids); admin ops via service-role. RLS at create time.
-- Idempotent. The `kind` CHECK mirrors lib VENUE_OBJECT_CATALOG (the canonical
-- list — extend both together).
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.event_scene_objects (
  object_id    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id     uuid NOT NULL REFERENCES public.events(event_id) ON DELETE CASCADE,
  kind         text NOT NULL CONSTRAINT event_scene_objects_kind_check
                 CHECK (kind IN (
                   'arch','buffet','bar','cake_table','gift_table','registration',
                   'photo_booth','lounge','led_wall','plant'
                 )),
  label        text,
  x_pct        numeric NOT NULL DEFAULT 50,
  y_pct        numeric NOT NULL DEFAULT 50,
  rotation_deg numeric NOT NULL DEFAULT 0,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS event_scene_objects_event_id_idx
  ON public.event_scene_objects(event_id);

ALTER TABLE public.event_scene_objects ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS event_scene_objects_couple_read ON public.event_scene_objects;
CREATE POLICY event_scene_objects_couple_read
  ON public.event_scene_objects
  FOR SELECT
  USING (event_id IN (SELECT public.current_couple_event_ids()));

DROP POLICY IF EXISTS event_scene_objects_couple_write ON public.event_scene_objects;
CREATE POLICY event_scene_objects_couple_write
  ON public.event_scene_objects
  FOR ALL
  USING (event_id IN (SELECT public.current_couple_event_ids()))
  WITH CHECK (event_id IN (SELECT public.current_couple_event_ids()));
