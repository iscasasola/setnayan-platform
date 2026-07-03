-- ============================================================================
-- 20270509511134_booth_offerings.sql
-- Booth "offerings" copy — Slice A of the 3D walk-around interaction program
-- (owner decision 2026-07-03): a guest who taps a booth in the 3D venue walk
-- should see WHICH vendor runs it AND WHAT IT SERVES / OFFERS. This slice adds
-- the data column + wires the two existing editing surfaces (the couple's 2D
-- seat-plan editor and the vendor cocktail editor) to write it. The 3D tap card
-- that reads it is a LATER slice — nothing here touches any 3D renderer code or
-- the public_venue_scene RPC.
--
-- Contents:
--   1. ADD COLUMN event_floor_booths.offerings TEXT (nullable, <= 280 chars).
--   2. CREATE OR REPLACE vendor_upsert_cocktail_booth — take + persist a
--      p_offerings param (trimmed / truncated to 280 server-side).
--   3. CREATE OR REPLACE get_vendor_cocktail_editor — return each booth's
--      offerings so the vendor editor can show + edit it.
--
-- Both RPCs are re-declared from their CURRENT origin/main definitions
-- (20261222000000 = the definitive v2) — ADDITIVE ONLY. Every capability gate,
-- clamp, whitelist and RAISE is preserved byte-for-byte; only the offerings
-- read/write is layered in.
--
-- Additive + idempotent.
-- ============================================================================

BEGIN;

-- 1 -- the column -----------------------------------------------------------
ALTER TABLE public.event_floor_booths
  ADD COLUMN IF NOT EXISTS offerings TEXT;

-- Named so a re-run is a no-op (ADD CONSTRAINT has no IF NOT EXISTS).
ALTER TABLE public.event_floor_booths
  DROP CONSTRAINT IF EXISTS event_floor_booths_offerings_len_check;
ALTER TABLE public.event_floor_booths
  ADD CONSTRAINT event_floor_booths_offerings_len_check
  CHECK (offerings IS NULL OR char_length(offerings) <= 280);

COMMENT ON COLUMN public.event_floor_booths.offerings IS
  'Guest-facing "what this booth serves/offers" copy (<= 280 chars) shown on the 3D venue-walk booth card when a guest taps it. Written by the booth''s vendor (vendor cocktail editor) or the couple (2D seat-plan editor). Nullable — a booth with no offerings just shows its label + vendor on the card.';

-- 2 -- vendor_upsert_cocktail_booth — accept + persist p_offerings ----------
-- Re-declared from 20261222000000 (booth_type whitelist admits registration_desk).
-- The new p_offerings tail param: trimmed, NULL/blank -> NULL, else left(...,280).
-- Every existing gate (caps, type whitelist, clamp, cap of 16, own-booth) is
-- preserved verbatim. Existing callers that pass 6 args keep working — the new
-- param defaults to NULL, so an insert/update from an un-updated caller simply
-- leaves offerings untouched on update / NULL on insert.
CREATE OR REPLACE FUNCTION public.vendor_upsert_cocktail_booth(
  p_event_id UUID, p_booth_id UUID, p_booth_type TEXT, p_label TEXT, p_x NUMERIC, p_y NUMERIC,
  p_offerings TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caps      RECORD;
  v_booth     RECORD;
  v_xy        NUMERIC[];
  v_id        UUID;
  v_label     TEXT;
  v_offerings TEXT;
BEGIN
  SELECT * INTO v_caps FROM public._cocktail_vendor_caps(p_event_id);
  IF p_booth_type NOT IN ('photo_booth','mobile_bar','dessert_station','gift_table','souvenir_table','registration_desk','custom') THEN
    RAISE EXCEPTION 'bad_booth_type' USING ERRCODE = '22023';
  END IF;
  v_label := COALESCE(NULLIF(left(btrim(p_label), 60), ''), 'Booth');
  -- Server-side offerings validation: blank/whitespace -> NULL, else cap at 280.
  v_offerings := NULLIF(left(btrim(COALESCE(p_offerings, '')), 280), '');
  v_xy := public._clamp_into_cocktail(p_event_id, p_x, p_y);

  IF p_booth_id IS NULL THEN
    IF (SELECT COUNT(*) FROM public.event_floor_booths
        WHERE event_id = p_event_id AND zone = 'cocktail') >= 16 THEN
      RAISE EXCEPTION 'too_many_booths' USING ERRCODE = '23514';
    END IF;
    INSERT INTO public.event_floor_booths
      (event_id, booth_type, label, x_pos, y_pos, zone, event_vendor_id, sort_order, offerings)
    VALUES (p_event_id, p_booth_type, v_label, v_xy[1], v_xy[2], 'cocktail', v_caps.my_ids[1], 0, v_offerings)
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
  SET booth_type = p_booth_type, label = v_label, x_pos = v_xy[1], y_pos = v_xy[2],
      offerings = v_offerings, updated_at = NOW()
  WHERE booth_id = p_booth_id;
  RETURN p_booth_id;
END;
$$;

-- 3 -- get_vendor_cocktail_editor — return each booth's offerings ------------
-- Re-declared from 20261222000000 v2 (adds linked + entrance + signs). ONLY the
-- booth jsonb gains an 'offerings' key; everything else is byte-for-byte.
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
      'offerings', b.offerings,
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

COMMIT;
