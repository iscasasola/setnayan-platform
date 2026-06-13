-- ============================================================================
-- 20261218000000_iteration_0008_cocktail_area.sql
-- Iteration 0008 — "Cocktail / Waiting Area" in the SAME blueprint
-- (owner-directed 2026-06-13: "instead of areas & booths, use our seatplan
-- maker for another smaller room — the cocktail / waiting area just outside
-- the reception; booths only, NO tables/chairs; just 1 place; make the room in
-- the same blueprint as the seat plan; the cocktail area can be accessed by
-- the booth vendors + the stylist, who can also customize its size").
--
-- This SUPERSEDES the multi-area pin-overlay shipped the SAME day
-- (event_floor_areas + event_floor_objects, the /seating/areas route). That
-- model is collapsed into ONE cocktail room drawn on the existing
-- event_floor_plan canvas, with booths stored on the existing
-- event_floor_booths table — one blueprint, one booth table.
--
-- Changes:
--   (a) event_floor_plan  — cocktail_* room columns: a resizable, labelled
--       rectangle on the same canvas (sits outside the reception walls), an
--       optional schedule-block tie, optional metric size, and a
--       couple-controlled vendor-edit toggle (the revoke switch).
--   (b) event_floor_booths — zone ('reception' | 'cocktail') + event_vendor_id
--       (the booked vendor running this booth, for vendor-edit ownership
--       scoping in the follow-up vendor-editor PR) + coordinator-delegate RLS
--       (matching the rest of the seat-plan family).
--   (c) data fold — event_floor_objects rows fold into event_floor_booths
--       (cocktail-tagged when they sat on an additional area), then
--       event_floor_objects + event_floor_areas are DROPPED.
--   (d) get_vendor_seat_plan v3 — drops `areas`, sources booths from
--       event_floor_booths (zone + is_mine + vendor_name), adds the cocktail
--       room to the payload.
--
-- Vendor WRITE access (stylist + booth vendors arranging the cocktail area)
-- lands in a follow-up migration alongside the vendor editor UI via
-- SECURITY DEFINER RPCs — NOT direct table RLS — so writes stay column- and
-- ownership-scoped and never touch reception seating. This migration only adds
-- the couple-controlled `cocktail_vendor_edit` gate those RPCs will read.
--
-- The DROPs are safe: the superseded tables shipped the same day with no
-- production data (the marketplace is founder-only). Idempotent throughout;
-- RLS preserved/extended at change time.
-- ============================================================================

BEGIN;

-- (a) cocktail room on the existing blueprint --------------------------------
ALTER TABLE public.event_floor_plan
  ADD COLUMN IF NOT EXISTS cocktail_enabled           BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS cocktail_x                 NUMERIC NOT NULL DEFAULT 50,
  ADD COLUMN IF NOT EXISTS cocktail_y                 NUMERIC NOT NULL DEFAULT 50,
  ADD COLUMN IF NOT EXISTS cocktail_w                 NUMERIC NOT NULL DEFAULT 30,
  ADD COLUMN IF NOT EXISTS cocktail_h                 NUMERIC NOT NULL DEFAULT 22,
  ADD COLUMN IF NOT EXISTS cocktail_label             TEXT NOT NULL DEFAULT 'Cocktail Area'
                                                      CHECK (char_length(cocktail_label) BETWEEN 1 AND 80),
  ADD COLUMN IF NOT EXISTS cocktail_width_m           NUMERIC,
  ADD COLUMN IF NOT EXISTS cocktail_length_m          NUMERIC,
  ADD COLUMN IF NOT EXISTS cocktail_schedule_block_id UUID
                                                      REFERENCES public.event_schedule_blocks(block_id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS cocktail_vendor_edit       BOOLEAN NOT NULL DEFAULT TRUE;

COMMENT ON COLUMN public.event_floor_plan.cocktail_enabled IS
  'Cocktail / waiting-area room on/off. When on, the editor renders a second labelled room on the same canvas (typically outside the reception walls) where booths place but tables/chairs are blocked.';
COMMENT ON COLUMN public.event_floor_plan.cocktail_vendor_edit IS
  'Couple revoke switch. TRUE (default) = booked stylist + booth vendors may arrange the cocktail area + their booths via the vendor RPCs. FALSE = couple / coordinator only.';
COMMENT ON COLUMN public.event_floor_plan.cocktail_schedule_block_id IS
  'Optional tie to the day-of timeline (e.g. the cocktail-hour block) so the area carries its live window.';

-- (b) booth zone + vendor link + coordinator delegate ------------------------
ALTER TABLE public.event_floor_booths
  ADD COLUMN IF NOT EXISTS zone            TEXT NOT NULL DEFAULT 'reception'
                                           CHECK (zone IN ('reception', 'cocktail')),
  ADD COLUMN IF NOT EXISTS event_vendor_id UUID
                                           REFERENCES public.event_vendors(vendor_id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS event_floor_booths_vendor_idx
  ON public.event_floor_booths(event_vendor_id);

COMMENT ON COLUMN public.event_floor_booths.zone IS
  'Which room on the blueprint this booth sits in: reception (couple-managed perimeter booths) or cocktail (the waiting-area room; vendor-editable).';
COMMENT ON COLUMN public.event_floor_booths.event_vendor_id IS
  'The booked event_vendors row running this booth. Set for vendor-placed cocktail booths so a booth vendor may only move/delete their own; NULL for couple-placed booths.';

-- coordinator delegate (seat_plan='edit') joins the couple on booths, matching
-- the rest of the seat-plan family (event_tables / event_floor_plan / the
-- now-retired areas tables).
DROP POLICY IF EXISTS event_floor_booths_moderator_read ON public.event_floor_booths;
CREATE POLICY event_floor_booths_moderator_read
  ON public.event_floor_booths FOR SELECT TO authenticated
  USING (event_id IN (SELECT public.current_moderator_event_ids()));

DROP POLICY IF EXISTS event_floor_booths_moderator_write ON public.event_floor_booths;
CREATE POLICY event_floor_booths_moderator_write
  ON public.event_floor_booths FOR ALL TO authenticated
  USING (public.moderator_area_level(event_id, 'seat_plan') = 'edit')
  WITH CHECK (public.moderator_area_level(event_id, 'seat_plan') = 'edit');

-- (c) fold the superseded multi-area pins into event_floor_booths -------------
-- Map object_type → booth_type; a pin that sat on an additional area becomes a
-- cocktail-zone booth, a reception-canvas pin (area_id NULL) stays reception.
-- Guarded so the migration stays idempotent after the DROPs below.
DO $fold$
BEGIN
  IF to_regclass('public.event_floor_objects') IS NOT NULL THEN
    INSERT INTO public.event_floor_booths
      (event_id, booth_type, label, x_pos, y_pos, zone, event_vendor_id, sort_order)
    SELECT
      fo.event_id,
      CASE fo.object_type
        WHEN 'bar'     THEN 'mobile_bar'
        WHEN 'dessert' THEN 'dessert_station'
        ELSE 'custom'
      END,
      fo.label,
      fo.x_pos,
      fo.y_pos,
      CASE WHEN fo.area_id IS NULL THEN 'reception' ELSE 'cocktail' END,
      fo.event_vendor_id,
      0
    FROM public.event_floor_objects fo;

    DROP TABLE public.event_floor_objects;
  END IF;
  DROP TABLE IF EXISTS public.event_floor_areas;
END
$fold$;

-- (d) get_vendor_seat_plan v3 — no more `areas`; booths from event_floor_booths;
--     adds the cocktail room. Same gates as v2 (booked · floor-touching
--     category · published plan). Counts only; guest names never cross.
CREATE OR REPLACE FUNCTION public.get_vendor_seat_plan(p_event_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
DECLARE
  v_profile_ids         UUID[];
  v_booked_categories   TEXT[];
  v_my_event_vendor_ids UUID[];
  v_floor_allowed       BOOLEAN;
  v_dietary_allowed     BOOLEAN;
  v_plan                RECORD;
  v_tables              JSONB;
  v_objects             JSONB;
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

  -- Booths across the whole blueprint (reception + cocktail), zone-tagged; the
  -- caller's own booths flagged via their booked event_vendor ids.
  SELECT COALESCE(jsonb_agg(o ORDER BY (o ->> 'label')), '[]'::jsonb)
  INTO v_objects
  FROM (
    SELECT jsonb_build_object(
      'object_id', b.booth_id,
      'zone', b.zone,
      'object_type', b.booth_type,
      'label', b.label,
      'x', b.x_pos,
      'y', b.y_pos,
      'is_mine', b.event_vendor_id = ANY (v_my_event_vendor_ids),
      'vendor_name', (
        SELECT ev2.vendor_name FROM public.event_vendors ev2
        WHERE ev2.vendor_id = b.event_vendor_id
      )
    ) AS o
    FROM public.event_floor_booths b
    WHERE b.event_id = p_event_id
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
    'cocktail', CASE WHEN v_plan.cocktail_enabled THEN jsonb_build_object(
      'label', v_plan.cocktail_label,
      'x', v_plan.cocktail_x, 'y', v_plan.cocktail_y,
      'w', v_plan.cocktail_w, 'h', v_plan.cocktail_h,
      'venue', jsonb_build_object('width_m', v_plan.cocktail_width_m, 'length_m', v_plan.cocktail_length_m),
      'window', (
        SELECT jsonb_build_object('label', sb.label, 'start_at', sb.start_at, 'end_at', sb.end_at)
        FROM public.event_schedule_blocks sb
        WHERE sb.block_id = v_plan.cocktail_schedule_block_id
      )
    ) ELSE NULL END,
    'dietary_included', v_dietary_allowed,
    'tables', v_tables,
    'objects', v_objects
  );
END;
$$;

COMMENT ON COLUMN public.event_floor_plan.cocktail_w IS
  'Cocktail-room width as percent of the canvas (cocktail_x/cocktail_y = centre). Drag-resizable in the editor; booth + stylist vendors may also resize when cocktail_vendor_edit is on.';

COMMIT;
