-- ============================================================================
-- 20261222000000_iteration_0008_cocktail_arrival_zone.sql
-- Iteration 0008 — cocktail / waiting-area "arrival zone" additions
-- (owner-directed 2026-06-14):
--   1. The waiting area LINKS to the reception at the entrance door — a
--      couple/coordinator connect⇄separate toggle (default LINKED). When linked
--      the room docks beside the reception at entrance_x/y with a drawn doorway
--      (arrive → register → enter). cocktail_linked is structural: vendors READ
--      it but cannot toggle (no vendor RPC touches it).
--   2. A default "Front Desk" registration booth is auto-seeded into the room.
--      Adds 'registration_desk' to the event_floor_booths booth_type CHECK and
--      widens the vendor booth-upsert whitelist so vendors can arrange it.
--   3. General WAYFINDING SIGNS — a rotatable arrow + editable label the couple
--      places (default 'Restrooms', add as many as they like). New
--      event_floor_signs table; ARRANGE-tier cocktail vendors may CRUD them via
--      SECURITY DEFINER RPCs (booth-tier vendors may NOT).
--
-- ONE migration file (the three design slices were merged to avoid a
-- duplicate-timestamp collision and three competing get_vendor_cocktail_editor
-- rewrites — this ships the single definitive v2).
--
-- ⚠ CONCURRENCY (intentional, owner-flagged): the vendor cocktail/booth/sign
-- write RPCs are deliberately OUTSIDE the couple's exclusive seating-editor lock
-- (20261216000000). Booths + signs are low-stakes spatial pins; blocking a
-- vendor while a couple holds the lock (or vice-versa) is worse UX than
-- last-write-wins on a pin. Guest seating stays lock-guarded and untouched here.
--
-- Additive + idempotent. RLS enabled at CREATE TABLE time. The cocktail-room
-- coordinate clamp is WIDENED to [-80,180] (couple saveFloorPlan + vendor RPC)
-- so a room docked just OUTSIDE a reception wall isn't snapped back on-canvas.
-- ============================================================================

BEGIN;

-- 1 ── room-link toggle ------------------------------------------------------
ALTER TABLE public.event_floor_plan
  ADD COLUMN IF NOT EXISTS cocktail_linked BOOLEAN NOT NULL DEFAULT TRUE;

COMMENT ON COLUMN public.event_floor_plan.cocktail_linked IS
  'Cocktail-room dock mode. TRUE (default) = the room docks beside the reception at its entrance door (entrance_x/y) with a drawn doorway connector. FALSE = free-floats. Structural — couple/coordinator only; vendors read it but no vendor RPC writes it.';

-- 2 ── registration_desk booth type ------------------------------------------
-- The inline CHECK from 20261206000000 is auto-named event_floor_booths_booth_type_check.
ALTER TABLE public.event_floor_booths
  DROP CONSTRAINT IF EXISTS event_floor_booths_booth_type_check;
ALTER TABLE public.event_floor_booths
  ADD CONSTRAINT event_floor_booths_booth_type_check
  CHECK (booth_type IN (
    'photo_booth', 'mobile_bar', 'dessert_station', 'gift_table',
    'souvenir_table', 'registration_desk', 'custom'
  ));

-- 3 ── wayfinding signs ------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.event_floor_signs (
  id           BIGSERIAL PRIMARY KEY,
  sign_id      UUID NOT NULL UNIQUE DEFAULT gen_random_uuid(),
  event_id     UUID NOT NULL REFERENCES public.events(event_id) ON DELETE CASCADE,
  label        TEXT NOT NULL DEFAULT 'Restrooms'
               CHECK (char_length(btrim(label)) BETWEEN 1 AND 40),
  x_pos        NUMERIC NOT NULL DEFAULT 50 CHECK (x_pos BETWEEN 0 AND 100),
  y_pos        NUMERIC NOT NULL DEFAULT 50 CHECK (y_pos BETWEEN 0 AND 100),
  rotation_deg NUMERIC NOT NULL DEFAULT 0,
  sort_order   INTEGER NOT NULL DEFAULT 0,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS event_floor_signs_event_id_idx
  ON public.event_floor_signs(event_id);

COMMENT ON TABLE public.event_floor_signs IS
  'Directional wayfinding markers on the shared seat-plan blueprint (rotatable arrow + 1-40 char label, e.g. Restrooms / Parking / Exit). Couple/coordinator place freely; ARRANGE-tier cocktail vendors may also CRUD via vendor_*_sign RPCs.';
COMMENT ON COLUMN public.event_floor_signs.rotation_deg IS
  'Arrow heading in degrees (0 = pointing up on the canvas). Normalised to 0-359.';

ALTER TABLE public.event_floor_signs ENABLE ROW LEVEL SECURITY;

-- couple Pattern B (mirror of event_floor_booths_couple_*)
DROP POLICY IF EXISTS event_floor_signs_couple_read ON public.event_floor_signs;
CREATE POLICY event_floor_signs_couple_read
  ON public.event_floor_signs FOR SELECT TO authenticated
  USING (event_id IN (SELECT public.current_couple_event_ids()));

DROP POLICY IF EXISTS event_floor_signs_couple_write ON public.event_floor_signs;
CREATE POLICY event_floor_signs_couple_write
  ON public.event_floor_signs FOR ALL TO authenticated
  USING (event_id IN (SELECT public.current_couple_event_ids()))
  WITH CHECK (event_id IN (SELECT public.current_couple_event_ids()));

-- coordinator delegate seat_plan='edit' (mirror of event_floor_booths_moderator_*)
DROP POLICY IF EXISTS event_floor_signs_moderator_read ON public.event_floor_signs;
CREATE POLICY event_floor_signs_moderator_read
  ON public.event_floor_signs FOR SELECT TO authenticated
  USING (event_id IN (SELECT public.current_moderator_event_ids()));

DROP POLICY IF EXISTS event_floor_signs_moderator_write ON public.event_floor_signs;
CREATE POLICY event_floor_signs_moderator_write
  ON public.event_floor_signs FOR ALL TO authenticated
  USING (public.moderator_area_level(event_id, 'seat_plan') = 'edit')
  WITH CHECK (public.moderator_area_level(event_id, 'seat_plan') = 'edit');

-- 4 ── get_vendor_cocktail_editor v2 — adds linked + entrance + signs --------
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
  v_signs  JSONB;
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

  SELECT COALESCE(jsonb_agg(s ORDER BY (s ->> 'sort_order')::INT), '[]'::jsonb)
  INTO v_signs
  FROM (
    SELECT jsonb_build_object(
      'sign_id', fs.sign_id,
      'label', fs.label,
      'x', fs.x_pos,
      'y', fs.y_pos,
      'rotation_deg', fs.rotation_deg,
      'sort_order', fs.sort_order
    ) AS s
    FROM public.event_floor_signs fs
    WHERE fs.event_id = p_event_id
  ) sub;

  RETURN jsonb_build_object(
    'can_arrange', v_caps.can_arrange,
    'can_booth', v_caps.can_booth,
    'venue', jsonb_build_object('width_m', v_plan.venue_width_m, 'length_m', v_plan.venue_length_m),
    'cocktail', jsonb_build_object(
      'label', v_plan.cocktail_label,
      'x', v_plan.cocktail_x, 'y', v_plan.cocktail_y,
      'w', v_plan.cocktail_w, 'h', v_plan.cocktail_h,
      'linked', v_plan.cocktail_linked
    ),
    'stage', jsonb_build_object('x', v_plan.stage_x, 'y', v_plan.stage_y, 'w', v_plan.stage_w, 'h', v_plan.stage_h),
    'dance', CASE WHEN v_plan.dance_enabled THEN jsonb_build_object(
      'x', v_plan.dance_x, 'y', v_plan.dance_y, 'w', v_plan.dance_w, 'h', v_plan.dance_h
    ) ELSE NULL END,
    'entrance', CASE WHEN v_plan.entrance_enabled THEN jsonb_build_object(
      'x', v_plan.entrance_x, 'y', v_plan.entrance_y
    ) ELSE NULL END,
    'tables', v_tables,
    'booths', v_booths,
    'signs', v_signs
  );
END;
$$;

-- 5 ── vendor_set_cocktail_area — WIDEN the x/y clamp to [-80,180] ------------
-- (so a couple-docked room living just outside a reception wall isn't snapped
--  back on-canvas when an ARRANGE vendor nudges it. w/h unchanged.)
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
    cocktail_x = GREATEST(-80, LEAST(180, p_x)),
    cocktail_y = GREATEST(-80, LEAST(180, p_y)),
    cocktail_w = GREATEST(4, LEAST(96, p_w)),
    cocktail_h = GREATEST(3, LEAST(96, p_h)),
    cocktail_label = CASE
      WHEN p_label IS NULL OR length(btrim(p_label)) = 0 THEN cocktail_label
      ELSE left(btrim(p_label), 80) END,
    updated_at = NOW()
  WHERE event_id = p_event_id;
END;
$$;

-- 6 ── vendor_upsert_cocktail_booth — admit 'registration_desk' --------------
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
  IF p_booth_type NOT IN ('photo_booth','mobile_bar','dessert_station','gift_table','souvenir_table','registration_desk','custom') THEN
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

-- 7 ── vendor sign RPCs — ARRANGE tier only ----------------------------------
CREATE OR REPLACE FUNCTION public.vendor_upsert_sign(
  p_event_id UUID, p_sign_id UUID, p_label TEXT, p_x NUMERIC, p_y NUMERIC, p_rotation NUMERIC
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caps  RECORD;
  v_label TEXT;
  v_rot   NUMERIC;
  v_id    UUID;
BEGIN
  SELECT * INTO v_caps FROM public._cocktail_vendor_caps(p_event_id);
  IF NOT v_caps.can_arrange THEN
    RAISE EXCEPTION 'not_arranger' USING ERRCODE = '42501';
  END IF;
  v_label := COALESCE(NULLIF(left(btrim(p_label), 40), ''), 'Sign');
  v_rot := ((p_rotation % 360) + 360) % 360;

  IF p_sign_id IS NULL THEN
    IF (SELECT COUNT(*) FROM public.event_floor_signs WHERE event_id = p_event_id) >= 24 THEN
      RAISE EXCEPTION 'too_many_signs' USING ERRCODE = '23514';
    END IF;
    INSERT INTO public.event_floor_signs (event_id, label, x_pos, y_pos, rotation_deg, sort_order)
    VALUES (p_event_id, v_label,
            GREATEST(0, LEAST(100, p_x)), GREATEST(0, LEAST(100, p_y)), v_rot, 0)
    RETURNING sign_id INTO v_id;
    RETURN v_id;
  END IF;

  UPDATE public.event_floor_signs
  SET label = v_label,
      x_pos = GREATEST(0, LEAST(100, p_x)),
      y_pos = GREATEST(0, LEAST(100, p_y)),
      rotation_deg = v_rot,
      updated_at = NOW()
  WHERE sign_id = p_sign_id AND event_id = p_event_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'sign_not_found' USING ERRCODE = 'P0002';
  END IF;
  RETURN p_sign_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.vendor_move_sign(
  p_event_id UUID, p_sign_id UUID, p_x NUMERIC, p_y NUMERIC, p_rotation NUMERIC
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
  UPDATE public.event_floor_signs
  SET x_pos = GREATEST(0, LEAST(100, p_x)),
      y_pos = GREATEST(0, LEAST(100, p_y)),
      rotation_deg = ((p_rotation % 360) + 360) % 360,
      updated_at = NOW()
  WHERE sign_id = p_sign_id AND event_id = p_event_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'sign_not_found' USING ERRCODE = 'P0002';
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.vendor_delete_sign(p_event_id UUID, p_sign_id UUID)
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
  DELETE FROM public.event_floor_signs WHERE sign_id = p_sign_id AND event_id = p_event_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'sign_not_found' USING ERRCODE = 'P0002';
  END IF;
END;
$$;

COMMIT;
