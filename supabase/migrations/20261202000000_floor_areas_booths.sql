-- ============================================================================
-- MULTI-AREA BLUEPRINTS + BOOTH PLACEMENT — feature-access program § 6
-- follow-up (owner-approved 2026-06-13: "booth placement means we can extend
-- a blueprint for the cocktail place while waiting for the reception venue").
--
-- The reception room stays the existing event_floor_plan singleton (tables,
-- stage, dance floor — untouched). This adds:
--
--   event_floor_areas   — ADDITIONAL spaces: the cocktail garden, ceremony
--                         foyer, etc. Each can tie to a schedule block so
--                         the area carries its time window ("active 5–7 PM
--                         while the reception flips").
--   event_floor_objects — placeable pins: booths/stations/bars, free-placed
--                         on an area (or on the reception canvas when
--                         area_id IS NULL), each optionally linked to a
--                         BOOKED vendor (event_vendor_id) so the vendor's
--                         Brief can say "your booth is here".
--
-- RLS mirrors the seat-plan family: couple writes + delegate writes via the
-- Phase 2 seat_plan grant; booked floor-touching vendors read through the
-- get_vendor_seat_plan RPC (extended below) — publication-gated, counts-only.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.event_floor_areas (
  area_id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id          UUID NOT NULL REFERENCES public.events(event_id) ON DELETE CASCADE,
  area_type         TEXT NOT NULL DEFAULT 'cocktail'
                    CHECK (area_type IN ('cocktail', 'ceremony', 'foyer', 'garden', 'custom')),
  label             TEXT NOT NULL CHECK (char_length(label) BETWEEN 1 AND 80),
  -- Optional tie to the day-of timeline: the window this area is "live"
  -- (e.g. the cocktails block while the reception is being flipped).
  schedule_block_id UUID REFERENCES public.event_schedule_blocks(block_id) ON DELETE SET NULL,
  venue_width_m     NUMERIC,
  venue_length_m    NUMERIC,
  sort_order        INTEGER NOT NULL DEFAULT 0,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS event_floor_areas_event_idx
  ON public.event_floor_areas(event_id, sort_order);

CREATE TABLE IF NOT EXISTS public.event_floor_objects (
  object_id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id         UUID NOT NULL REFERENCES public.events(event_id) ON DELETE CASCADE,
  -- NULL = the pin sits on the reception canvas (event_floor_plan room);
  -- otherwise it belongs to one of the additional areas above.
  area_id          UUID REFERENCES public.event_floor_areas(area_id) ON DELETE CASCADE,
  object_type      TEXT NOT NULL DEFAULT 'booth'
                   CHECK (object_type IN ('booth', 'station', 'bar', 'photo_wall', 'dessert', 'custom')),
  label            TEXT NOT NULL CHECK (char_length(label) BETWEEN 1 AND 80),
  -- The booked vendor running this pin (their Brief deep-links here).
  event_vendor_id  UUID REFERENCES public.event_vendors(vendor_id) ON DELETE SET NULL,
  x_pos            NUMERIC NOT NULL DEFAULT 50 CHECK (x_pos BETWEEN 0 AND 100),
  y_pos            NUMERIC NOT NULL DEFAULT 50 CHECK (y_pos BETWEEN 0 AND 100),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS event_floor_objects_event_idx
  ON public.event_floor_objects(event_id);
CREATE INDEX IF NOT EXISTS event_floor_objects_area_idx
  ON public.event_floor_objects(area_id);
CREATE INDEX IF NOT EXISTS event_floor_objects_vendor_idx
  ON public.event_floor_objects(event_vendor_id);

ALTER TABLE public.event_floor_areas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_floor_objects ENABLE ROW LEVEL SECURITY;

-- Couple (Pattern B) + Phase 2 delegate (seat_plan grant) — same actor pair
-- as the rest of the seat-plan family.
DROP POLICY IF EXISTS event_floor_areas_couple_all ON public.event_floor_areas;
CREATE POLICY event_floor_areas_couple_all
  ON public.event_floor_areas FOR ALL TO authenticated
  USING (event_id IN (SELECT public.current_couple_event_ids()))
  WITH CHECK (event_id IN (SELECT public.current_couple_event_ids()));

DROP POLICY IF EXISTS event_floor_areas_moderator_read ON public.event_floor_areas;
CREATE POLICY event_floor_areas_moderator_read
  ON public.event_floor_areas FOR SELECT TO authenticated
  USING (event_id IN (SELECT public.current_moderator_event_ids()));

DROP POLICY IF EXISTS event_floor_areas_moderator_write ON public.event_floor_areas;
CREATE POLICY event_floor_areas_moderator_write
  ON public.event_floor_areas FOR ALL TO authenticated
  USING (public.moderator_area_level(event_id, 'seat_plan') = 'edit')
  WITH CHECK (public.moderator_area_level(event_id, 'seat_plan') = 'edit');

DROP POLICY IF EXISTS event_floor_objects_couple_all ON public.event_floor_objects;
CREATE POLICY event_floor_objects_couple_all
  ON public.event_floor_objects FOR ALL TO authenticated
  USING (event_id IN (SELECT public.current_couple_event_ids()))
  WITH CHECK (event_id IN (SELECT public.current_couple_event_ids()));

DROP POLICY IF EXISTS event_floor_objects_moderator_read ON public.event_floor_objects;
CREATE POLICY event_floor_objects_moderator_read
  ON public.event_floor_objects FOR SELECT TO authenticated
  USING (event_id IN (SELECT public.current_moderator_event_ids()));

DROP POLICY IF EXISTS event_floor_objects_moderator_write ON public.event_floor_objects;
CREATE POLICY event_floor_objects_moderator_write
  ON public.event_floor_objects FOR ALL TO authenticated
  USING (public.moderator_area_level(event_id, 'seat_plan') = 'edit')
  WITH CHECK (public.moderator_area_level(event_id, 'seat_plan') = 'edit');

-- ---------------------------------------------------------------------------
-- get_vendor_seat_plan v2 — adds areas + objects + the caller's OWN pins.
-- Same gates as v1 (booked · floor-touching category · published plan).
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.get_vendor_seat_plan(p_event_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
DECLARE
  v_profile_ids       UUID[];
  v_booked_categories TEXT[];
  v_my_event_vendor_ids UUID[];
  v_floor_allowed     BOOLEAN;
  v_dietary_allowed   BOOLEAN;
  v_plan              RECORD;
  v_tables            JSONB;
  v_areas             JSONB;
  v_objects           JSONB;
BEGIN
  SELECT ARRAY(
    SELECT vp.vendor_profile_id FROM public.vendor_profiles vp WHERE vp.user_id = auth.uid()
    UNION
    SELECT tm.vendor_profile_id FROM public.vendor_team_members tm WHERE tm.user_id = auth.uid()
  ) INTO v_profile_ids;
  IF v_profile_ids IS NULL OR COALESCE(array_length(v_profile_ids, 1), 0) = 0 THEN
    RAISE EXCEPTION 'not_a_vendor' USING ERRCODE = '42501';
  END IF;

  SELECT ARRAY_AGG(DISTINCT ev.category::TEXT), ARRAY_AGG(ev.vendor_id)
  INTO v_booked_categories, v_my_event_vendor_ids
  FROM public.event_vendors ev
  WHERE ev.event_id = p_event_id
    AND ev.marketplace_vendor_id = ANY (v_profile_ids)
    AND ev.status IN ('contracted', 'deposit_paid', 'delivered', 'complete');
  IF v_booked_categories IS NULL THEN
    RAISE EXCEPTION 'not_booked' USING ERRCODE = '42501';
  END IF;

  v_floor_allowed := v_booked_categories && ARRAY[
    'venue', 'catering', 'cake_maker', 'mobile_bar', 'photobooth',
    'led_screens', 'lights_and_sound', 'reception_decor', 'florist',
    'photographer', 'videographer', 'host_emcee', 'band_dj',
    'string_quartet', 'choir', 'planner_coordinator',
    'gown_designer', 'suit_designer', 'makeup_artist', 'hair_stylist',
    'security'
  ];
  IF NOT v_floor_allowed THEN
    RAISE EXCEPTION 'category_not_floor' USING ERRCODE = '42501';
  END IF;

  v_dietary_allowed := v_booked_categories
    && ARRAY['catering', 'cake_maker', 'mobile_bar', 'venue', 'planner_coordinator'];

  SELECT * INTO v_plan FROM public.event_floor_plan WHERE event_id = p_event_id;
  IF NOT FOUND OR v_plan.published_at IS NULL THEN
    RAISE EXCEPTION 'not_published' USING ERRCODE = 'P0002';
  END IF;

  SELECT COALESCE(jsonb_agg(t ORDER BY (t ->> 'sort_order')::INT), '[]'::jsonb)
  INTO v_tables
  FROM (
    SELECT jsonb_build_object(
      'table_id', et.table_id,
      'label', et.table_label,
      'table_type', et.table_type::TEXT,
      'capacity', et.capacity,
      'x', et.x_pos,
      'y', et.y_pos,
      'rotation_deg', et.rotation_deg,
      'sort_order', et.sort_order,
      'seated', (
        SELECT COUNT(*) FROM public.event_seat_assignments a
        WHERE a.table_id = et.table_id
      ),
      'meal_counts', CASE WHEN v_dietary_allowed THEN (
        SELECT COALESCE(jsonb_object_agg(m.pref, m.n), '{}'::jsonb)
        FROM (
          SELECT g.meal_preference::TEXT AS pref, COUNT(*) AS n
          FROM public.event_seat_assignments a
          JOIN public.guests g ON g.guest_id = a.guest_id AND g.deleted_at IS NULL
          WHERE a.table_id = et.table_id
          GROUP BY g.meal_preference
        ) m
      ) ELSE NULL END
    ) AS t
    FROM public.event_tables et
    WHERE et.event_id = p_event_id
  ) sub;

  -- Objects (booth/station pins) across the whole event, area-tagged;
  -- the caller's own pins flagged via their booked event_vendor ids.
  SELECT COALESCE(jsonb_agg(o ORDER BY (o ->> 'label')), '[]'::jsonb)
  INTO v_objects
  FROM (
    SELECT jsonb_build_object(
      'object_id', fo.object_id,
      'area_id', fo.area_id,
      'object_type', fo.object_type,
      'label', fo.label,
      'x', fo.x_pos,
      'y', fo.y_pos,
      'is_mine', fo.event_vendor_id = ANY (v_my_event_vendor_ids),
      'vendor_name', (
        SELECT ev2.vendor_name FROM public.event_vendors ev2
        WHERE ev2.vendor_id = fo.event_vendor_id
      )
    ) AS o
    FROM public.event_floor_objects fo
    WHERE fo.event_id = p_event_id
  ) sub;

  -- Additional areas + their schedule window (label + times only).
  SELECT COALESCE(jsonb_agg(a ORDER BY (a ->> 'sort_order')::INT), '[]'::jsonb)
  INTO v_areas
  FROM (
    SELECT jsonb_build_object(
      'area_id', fa.area_id,
      'area_type', fa.area_type,
      'label', fa.label,
      'sort_order', fa.sort_order,
      'venue', jsonb_build_object('width_m', fa.venue_width_m, 'length_m', fa.venue_length_m),
      'window', (
        SELECT jsonb_build_object('label', b.label, 'start_at', b.start_at, 'end_at', b.end_at)
        FROM public.event_schedule_blocks b
        WHERE b.block_id = fa.schedule_block_id
      )
    ) AS a
    FROM public.event_floor_areas fa
    WHERE fa.event_id = p_event_id
  ) sub;

  RETURN jsonb_build_object(
    'published_at', v_plan.published_at,
    'venue', jsonb_build_object(
      'width_m', v_plan.venue_width_m,
      'length_m', v_plan.venue_length_m
    ),
    'stage', jsonb_build_object(
      'x', v_plan.stage_x, 'y', v_plan.stage_y,
      'w', v_plan.stage_w, 'h', v_plan.stage_h
    ),
    'dance', CASE WHEN v_plan.dance_enabled THEN jsonb_build_object(
      'x', v_plan.dance_x, 'y', v_plan.dance_y,
      'w', v_plan.dance_w, 'h', v_plan.dance_h
    ) ELSE NULL END,
    'entrance', CASE WHEN v_plan.entrance_enabled THEN jsonb_build_object(
      'x', v_plan.entrance_x, 'y', v_plan.entrance_y
    ) ELSE NULL END,
    'service_entrance', CASE WHEN v_plan.service_entrance_enabled THEN jsonb_build_object(
      'x', v_plan.service_entrance_x, 'y', v_plan.service_entrance_y
    ) ELSE NULL END,
    'dietary_included', v_dietary_allowed,
    'tables', v_tables,
    'areas', v_areas,
    'objects', v_objects
  );
END;
$$;

COMMENT ON TABLE public.event_floor_areas IS
  'Additional event spaces beyond the reception room (cocktail garden, foyer) — feature-access program booth-placement slice, owner-approved 2026-06-13. Optionally tied to a schedule block for the area''s live window.';
COMMENT ON TABLE public.event_floor_objects IS
  'Free-placed booth/station pins on the reception canvas (area_id NULL) or an additional area; optionally linked to the booked vendor running the booth.';
