-- ============================================================================
-- 20261221120000_iteration_0008_cocktail_vendor_rpcs.sql
-- Iteration 0008 — VENDOR write access to the cocktail / waiting-area room
-- (owner-directed 2026-06-13: "the cocktail area can be accessed by the booth
-- vendors + the stylist … add them all: stylist/decor, florist, booth,
-- coordinator, lights, performers").
--
-- This is the FIRST time a vendor gets WRITE access to a couple's planning
-- surface. The rails (all enforced here, in SECURITY DEFINER RPCs — NOT direct
-- table RLS, so writes stay column- and ownership-scoped):
--   • Scope: ONLY the cocktail room + cocktail-zone booths. Reception seating,
--     guest assignments and guest PII are never touched or returned.
--   • Gate: caller must be a BOOKED vendor on the event (contracted / deposit /
--     delivered / complete) in an eligible category, AND the couple must have
--     enabled the room (cocktail_enabled) and left vendor editing on
--     (cocktail_vendor_edit — the couple's revoke switch).
--   • Two capability tiers:
--       ARRANGE (size the room + edit ANY cocktail booth) — the space leads:
--         reception_decor, florist, planner_coordinator, lights_and_sound,
--         led_screens.
--       BOOTH  (place / move / delete ONLY their own booth) — booth + performer
--         vendors: photobooth, mobile_bar, cake_maker, band_dj, string_quartet,
--         choir, host_emcee.
--     (Category sets are owner-tunable — edit the arrays below.)
--
-- Additive + idempotent. No new tables — these write the cocktail_* columns on
-- event_floor_plan and cocktail-zone rows on event_floor_booths added by
-- 20261218000000.
-- ============================================================================

BEGIN;

-- Shared gate: resolve the caller's booked event_vendor ids + capability tiers
-- for this event, or RAISE. Reused by every cocktail vendor RPC below.
CREATE OR REPLACE FUNCTION public._cocktail_vendor_caps(p_event_id UUID)
RETURNS TABLE(my_ids UUID[], can_arrange BOOLEAN, can_booth BOOLEAN)
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
DECLARE
  v_profile_ids UUID[];
  v_cats        TEXT[];
  v_my          UUID[];
  v_plan        RECORD;
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
  INTO v_cats, v_my
  FROM public.event_vendors ev
  WHERE ev.event_id = p_event_id
    AND ev.marketplace_vendor_id = ANY (v_profile_ids)
    AND ev.status IN ('contracted', 'deposit_paid', 'delivered', 'complete');
  IF v_cats IS NULL THEN
    RAISE EXCEPTION 'not_booked' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_plan FROM public.event_floor_plan WHERE event_id = p_event_id;
  IF NOT FOUND OR NOT v_plan.cocktail_enabled OR NOT v_plan.cocktail_vendor_edit THEN
    RAISE EXCEPTION 'vendor_edit_off' USING ERRCODE = '42501';
  END IF;

  my_ids := v_my;
  can_arrange := v_cats && ARRAY[
    'reception_decor', 'florist', 'planner_coordinator', 'lights_and_sound', 'led_screens'
  ];
  can_booth := v_cats && ARRAY[
    'photobooth', 'mobile_bar', 'cake_maker', 'band_dj', 'string_quartet', 'choir', 'host_emcee'
  ];
  IF NOT can_arrange AND NOT can_booth THEN
    RAISE EXCEPTION 'category_not_cocktail' USING ERRCODE = '42501';
  END IF;
  RETURN NEXT;
END;
$$;

-- ---------------------------------------------------------------------------
-- get_vendor_cocktail_editor — the editor's data source. Returns the caller's
-- capabilities + the cocktail room + its booths + PII-free reception context
-- (table positions/counts only, so the vendor can place relative to the room).
-- Does NOT require the plan to be published (vendors collaborate pre-publish).
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_vendor_cocktail_editor(p_event_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
DECLARE
  v_caps  RECORD;
  v_plan  RECORD;
  v_tables JSONB;
  v_booths JSONB;
BEGIN
  SELECT * INTO v_caps FROM public._cocktail_vendor_caps(p_event_id);
  SELECT * INTO v_plan FROM public.event_floor_plan WHERE event_id = p_event_id;

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
      'seated', (SELECT COUNT(*) FROM public.event_seat_assignments a WHERE a.table_id = et.table_id)
    ) AS t
    FROM public.event_tables et
    WHERE et.event_id = p_event_id
  ) sub;

  SELECT COALESCE(jsonb_agg(o ORDER BY (o ->> 'label')), '[]'::jsonb)
  INTO v_booths
  FROM (
    SELECT jsonb_build_object(
      'booth_id', b.booth_id,
      'booth_type', b.booth_type,
      'label', b.label,
      'x', b.x_pos,
      'y', b.y_pos,
      'is_mine', b.event_vendor_id = ANY (v_caps.my_ids),
      'vendor_name', (
        SELECT ev2.vendor_name FROM public.event_vendors ev2 WHERE ev2.vendor_id = b.event_vendor_id
      )
    ) AS o
    FROM public.event_floor_booths b
    WHERE b.event_id = p_event_id AND b.zone = 'cocktail'
  ) sub;

  RETURN jsonb_build_object(
    'can_arrange', v_caps.can_arrange,
    'can_booth', v_caps.can_booth,
    'venue', jsonb_build_object('width_m', v_plan.venue_width_m, 'length_m', v_plan.venue_length_m),
    'cocktail', jsonb_build_object(
      'label', v_plan.cocktail_label,
      'x', v_plan.cocktail_x, 'y', v_plan.cocktail_y,
      'w', v_plan.cocktail_w, 'h', v_plan.cocktail_h
    ),
    'stage', jsonb_build_object('x', v_plan.stage_x, 'y', v_plan.stage_y, 'w', v_plan.stage_w, 'h', v_plan.stage_h),
    'dance', CASE WHEN v_plan.dance_enabled THEN jsonb_build_object(
      'x', v_plan.dance_x, 'y', v_plan.dance_y, 'w', v_plan.dance_w, 'h', v_plan.dance_h
    ) ELSE NULL END,
    'tables', v_tables,
    'booths', v_booths
  );
END;
$$;

-- ---------------------------------------------------------------------------
-- vendor_set_cocktail_area — ARRANGE tier only: move / resize / rename the room.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.vendor_set_cocktail_area(
  p_event_id UUID, p_x NUMERIC, p_y NUMERIC, p_w NUMERIC, p_h NUMERIC, p_label TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caps RECORD;
BEGIN
  SELECT * INTO v_caps FROM public._cocktail_vendor_caps(p_event_id);
  IF NOT v_caps.can_arrange THEN
    RAISE EXCEPTION 'not_arranger' USING ERRCODE = '42501';
  END IF;
  UPDATE public.event_floor_plan SET
    cocktail_x = GREATEST(0, LEAST(100, p_x)),
    cocktail_y = GREATEST(0, LEAST(100, p_y)),
    cocktail_w = GREATEST(4, LEAST(96, p_w)),
    cocktail_h = GREATEST(3, LEAST(96, p_h)),
    cocktail_label = CASE
      WHEN p_label IS NULL OR length(btrim(p_label)) = 0 THEN cocktail_label
      ELSE left(btrim(p_label), 80) END,
    updated_at = NOW()
  WHERE event_id = p_event_id;
END;
$$;

-- Clamp a point into the current cocktail room rect (so a vendor can't drop a
-- booth out in the reception). Helper used by the booth writers below.
CREATE OR REPLACE FUNCTION public._clamp_into_cocktail(p_event_id UUID, p_x NUMERIC, p_y NUMERIC)
RETURNS NUMERIC[]
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT ARRAY[
    GREATEST(fp.cocktail_x - fp.cocktail_w / 2, LEAST(fp.cocktail_x + fp.cocktail_w / 2, p_x)),
    GREATEST(fp.cocktail_y - fp.cocktail_h / 2, LEAST(fp.cocktail_y + fp.cocktail_h / 2, p_y))
  ]
  FROM public.event_floor_plan fp WHERE fp.event_id = p_event_id;
$$;

-- ---------------------------------------------------------------------------
-- vendor_upsert_cocktail_booth — insert (p_booth_id NULL) or update a cocktail
-- booth. ARRANGE may touch any; BOOTH may only touch their own. Inserts are
-- attributed to the caller's first booked event_vendor id + capped at 16.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.vendor_upsert_cocktail_booth(
  p_event_id UUID, p_booth_id UUID, p_booth_type TEXT, p_label TEXT, p_x NUMERIC, p_y NUMERIC
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caps  RECORD;
  v_booth RECORD;
  v_xy    NUMERIC[];
  v_id    UUID;
  v_label TEXT;
BEGIN
  SELECT * INTO v_caps FROM public._cocktail_vendor_caps(p_event_id);
  IF p_booth_type NOT IN ('photo_booth','mobile_bar','dessert_station','gift_table','souvenir_table','custom') THEN
    RAISE EXCEPTION 'bad_booth_type' USING ERRCODE = '22023';
  END IF;
  v_label := COALESCE(NULLIF(left(btrim(p_label), 60), ''), 'Booth');
  v_xy := public._clamp_into_cocktail(p_event_id, p_x, p_y);

  IF p_booth_id IS NULL THEN
    IF (SELECT COUNT(*) FROM public.event_floor_booths
        WHERE event_id = p_event_id AND zone = 'cocktail') >= 16 THEN
      RAISE EXCEPTION 'too_many_booths' USING ERRCODE = '23514';
    END IF;
    INSERT INTO public.event_floor_booths
      (event_id, booth_type, label, x_pos, y_pos, zone, event_vendor_id, sort_order)
    VALUES (p_event_id, p_booth_type, v_label, v_xy[1], v_xy[2], 'cocktail', v_caps.my_ids[1], 0)
    RETURNING booth_id INTO v_id;
    RETURN v_id;
  END IF;

  SELECT * INTO v_booth FROM public.event_floor_booths
  WHERE booth_id = p_booth_id AND event_id = p_event_id AND zone = 'cocktail';
  IF NOT FOUND THEN
    RAISE EXCEPTION 'booth_not_found' USING ERRCODE = 'P0002';
  END IF;
  IF NOT v_caps.can_arrange
     AND (v_booth.event_vendor_id IS NULL OR NOT (v_booth.event_vendor_id = ANY (v_caps.my_ids))) THEN
    RAISE EXCEPTION 'not_your_booth' USING ERRCODE = '42501';
  END IF;
  UPDATE public.event_floor_booths
  SET booth_type = p_booth_type, label = v_label, x_pos = v_xy[1], y_pos = v_xy[2], updated_at = NOW()
  WHERE booth_id = p_booth_id;
  RETURN p_booth_id;
END;
$$;

-- Position-only move (the hot path during a drag).
CREATE OR REPLACE FUNCTION public.vendor_move_cocktail_booth(
  p_event_id UUID, p_booth_id UUID, p_x NUMERIC, p_y NUMERIC
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caps  RECORD;
  v_booth RECORD;
  v_xy    NUMERIC[];
BEGIN
  SELECT * INTO v_caps FROM public._cocktail_vendor_caps(p_event_id);
  SELECT * INTO v_booth FROM public.event_floor_booths
  WHERE booth_id = p_booth_id AND event_id = p_event_id AND zone = 'cocktail';
  IF NOT FOUND THEN
    RAISE EXCEPTION 'booth_not_found' USING ERRCODE = 'P0002';
  END IF;
  IF NOT v_caps.can_arrange
     AND (v_booth.event_vendor_id IS NULL OR NOT (v_booth.event_vendor_id = ANY (v_caps.my_ids))) THEN
    RAISE EXCEPTION 'not_your_booth' USING ERRCODE = '42501';
  END IF;
  v_xy := public._clamp_into_cocktail(p_event_id, p_x, p_y);
  UPDATE public.event_floor_booths
  SET x_pos = v_xy[1], y_pos = v_xy[2], updated_at = NOW()
  WHERE booth_id = p_booth_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.vendor_delete_cocktail_booth(p_event_id UUID, p_booth_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caps  RECORD;
  v_booth RECORD;
BEGIN
  SELECT * INTO v_caps FROM public._cocktail_vendor_caps(p_event_id);
  SELECT * INTO v_booth FROM public.event_floor_booths
  WHERE booth_id = p_booth_id AND event_id = p_event_id AND zone = 'cocktail';
  IF NOT FOUND THEN
    RAISE EXCEPTION 'booth_not_found' USING ERRCODE = 'P0002';
  END IF;
  IF NOT v_caps.can_arrange
     AND (v_booth.event_vendor_id IS NULL OR NOT (v_booth.event_vendor_id = ANY (v_caps.my_ids))) THEN
    RAISE EXCEPTION 'not_your_booth' USING ERRCODE = '42501';
  END IF;
  DELETE FROM public.event_floor_booths WHERE booth_id = p_booth_id;
END;
$$;

COMMENT ON FUNCTION public.get_vendor_cocktail_editor(UUID) IS
  'Vendor cocktail-editor data source: caller capabilities + the cocktail room + its booths + PII-free reception context. Booked + eligible-category + cocktail_vendor_edit gated; no published gate (pre-publish collaboration).';

COMMIT;
