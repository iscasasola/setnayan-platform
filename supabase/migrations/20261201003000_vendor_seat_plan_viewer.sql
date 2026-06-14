-- ============================================================================
-- VENDOR SEAT-PLAN VIEWER — Phase 4 of the feature-access program
-- (corpus: 03_Strategy/Feature_Access_By_Vendor_Category_2026-06-12.md § 6,
--  owner-locked 2026-06-12).
--
-- One SECURITY DEFINER read model, same pattern as the Phase 1 Brief: a
-- booked FLOOR-TOUCHING vendor gets the PUBLISHED floor plan — stage, dance
-- floor, entrances (incl. service entrance), venue dimensions, every table's
-- position/shape/rotation + per-table seated COUNTS. Food-relevant
-- categories additionally get per-table meal counts (the caterer's covers
-- sheet — kills the "couple re-types dietary into chat" workflow).
--
-- Hard rules carried over:
--   · publication gate — drafts stay couple+delegate-only (published_at)
--   · § 7 matrix — Prints/Transport/etc. don't get the floor (floor set)
--   · guest PII never crosses — counts per table, never names
--   · no new vendor RLS on seating tables; the gate lives in the function
-- ============================================================================

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
  v_floor_allowed     BOOLEAN;
  v_dietary_allowed   BOOLEAN;
  v_plan              RECORD;
  v_tables            JSONB;
BEGIN
  SELECT ARRAY(
    SELECT vp.vendor_profile_id FROM public.vendor_profiles vp WHERE vp.user_id = auth.uid()
    UNION
    SELECT tm.vendor_profile_id FROM public.vendor_team_members tm WHERE tm.user_id = auth.uid()
  ) INTO v_profile_ids;
  IF v_profile_ids IS NULL OR COALESCE(array_length(v_profile_ids, 1), 0) = 0 THEN
    RAISE EXCEPTION 'not_a_vendor' USING ERRCODE = '42501';
  END IF;

  SELECT ARRAY_AGG(DISTINCT ev.category::TEXT) INTO v_booked_categories
  FROM public.event_vendors ev
  WHERE ev.event_id = p_event_id
    AND ev.marketplace_vendor_id = ANY (v_profile_ids)
    AND ev.status IN ('contracted', 'deposit_paid', 'delivered', 'complete');
  IF v_booked_categories IS NULL THEN
    RAISE EXCEPTION 'not_booked' USING ERRCODE = '42501';
  END IF;

  -- § 7 matrix: floor-touching categories only (Feast · Venue · Design ·
  -- Booths · Program · Documentary · coordinator). Prints/Transport/etc. = no.
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
    'tables', v_tables
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_vendor_seat_plan(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_vendor_seat_plan(UUID) FROM anon;
GRANT EXECUTE ON FUNCTION public.get_vendor_seat_plan(UUID) TO authenticated;

COMMENT ON FUNCTION public.get_vendor_seat_plan(UUID) IS
  'Vendor seat-plan viewer (feature-access program Phase 4): published floor plan + per-table seated counts for booked floor-touching vendors; per-table meal counts for food-relevant categories. Counts only — guest names never cross.';
