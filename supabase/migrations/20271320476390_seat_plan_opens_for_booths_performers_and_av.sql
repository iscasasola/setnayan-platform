-- seat_plan_opens_for_booths_performers_and_av
-- Created via `pnpm migration:new`. Idempotent (CREATE OR REPLACE FUNCTION only). No table, no grant, no row changes.
--
-- 🪑 THE SEAT PLAN OPENS FOR GUEST BOOTHS, PERFORMERS AND AV PRODUCTION (owner, 6 Nov 2026).
-- DECISION_LOG 2026-11-06 "SUPPLIER ACCESS MAP (#6407): FOUR OWNER CALLS", call (2), verbatim: "Seat plan — ADD booths
-- (`guest_booth`), performers (`performers`) and AV/lights (`av_production`) to the seat-plan read."
-- The supplier access map (#6407) found that `get_vendor_seat_plan` granted the floor by CATEGORY and refused these
-- three, although their families (Booths, Program) were promised the seat plan. A booth has a spot on the floor; a
-- performer and an AV crew need to know where the stage and the tables are.
--
--   get_vendor_seat_plan — `v_floor_allowed` gains 'guest_booth', 'performers', 'av_production'. Nothing else.
--
-- ── THE BODY BELOW IS THE LATEST DEFINITION, EDITED ONLY AT THE FLOOR LIST ─────────────────────────────────────
-- Copied by script from `20271304542745_suppliers_see_seats_on_the_day.sql`, the latest migration that defines
-- `get_vendor_seat_plan` (`grep -l "FUNCTION public.get_vendor_seat_plan" supabase/migrations/*.sql | sort | tail -1`),
-- with only the line marked 🪑 changed. Every other gate (the fee gate, not_a_vendor, not_booked, not_published, the
-- "not counted for" exclusions) is untouched. The meal-count gate (`v_dietary_allowed`) is NOT widened: the three
-- new categories see tables and seats, never meal counts (owner call (3) keeps meal counts to the food categories).
--
-- Grants: unchanged — CREATE OR REPLACE keeps a function's existing grants.

BEGIN;

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
  v_not_counted         UUID[];
  v_floor_allowed       BOOLEAN;
  v_dietary_allowed     BOOLEAN;
  v_plan                RECORD;
  v_tables              JSONB;
  v_objects             JSONB;
BEGIN
  -- ── ⛔ THE BOOKING FEE UNLOCKS THE EVENT — IN SQL (2026-09-20) ────────────
  -- Mirrors the page gate #5738 put in front of this RPC's ONLY caller. The
  -- switch is `platform_settings.fee_unlocks_event_enforced`; while it is NULL
  -- or FALSE this call returns 'unlocked' and the line below is a no-op, so the
  -- function is byte-identical to today. `TRUE` is the `booked` argument
  -- because `resolveEventFeeGate` is called here with its default (booked),
  -- exactly as the page does.
  IF public.vendor_event_fee_gate_stage(p_event_id, TRUE) <> 'unlocked' THEN
    RAISE EXCEPTION 'fee_unsettled' USING ERRCODE = '42501';
  END IF;

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

  -- 🍽 Guests the couple marked "Not counted for" EVERY one of this supplier's booked services (20271302857885).
  v_not_counted := public.guests_not_counted_for_services(p_event_id, v_my_event_vendor_ids);

  v_floor_allowed := v_booked_categories && ARRAY[
    'venue', 'catering', 'cake_maker', 'mobile_bar', 'photobooth',
    'led_screens', 'lights_and_sound', 'reception_decor', 'florist',
    'photographer', 'videographer', 'host_emcee', 'band_dj',
    'string_quartet', 'choir', 'planner_coordinator',
    'gown_designer', 'suit_designer', 'makeup_artist', 'hair_stylist',
    'security',
    -- 🪑 seat_plan_opens_for_booths_performers_and_av (owner, 6 Nov 2026).
    'guest_booth', 'performers', 'av_production'
  ];
  IF NOT v_floor_allowed THEN
    RAISE EXCEPTION 'category_not_floor' USING ERRCODE = '42501';
  END IF;

  v_dietary_allowed := v_booked_categories
    && ARRAY['catering', 'cake_maker', 'mobile_bar', 'venue', 'planner_coordinator'];

  SELECT * INTO v_plan FROM public.event_floor_plan WHERE event_id = p_event_id;
  -- 🪑 suppliers_see_seats_on_the_day: the ONE seat rule, not the switch alone.
  IF NOT FOUND OR NOT public.guests_may_see_seats(p_event_id) THEN
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
          JOIN public.guests g ON g.guest_id = a.guest_id AND g.deleted_at IS NULL AND g.entry_source <> 'self_added_unlisted' AND NOT g.passed_away AND g.represented_by_guest_id IS NULL AND g.guest_id <> ALL (v_not_counted)
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

COMMIT;
