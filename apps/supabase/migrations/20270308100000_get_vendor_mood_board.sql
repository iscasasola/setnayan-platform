-- get_vendor_mood_board: read-only mood board RPC for booked vendors.
-- Returns the couple's role_palette + reception_design + inspiration assets.
-- Booked-gate mirrors get_vendor_event_brief: raises if the calling vendor is
-- not in event_vendors for the requested event.

CREATE OR REPLACE FUNCTION get_vendor_mood_board(p_event_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_vendor_profile_id uuid;
  v_event record;
  v_inspirations jsonb;
BEGIN
  -- Resolve calling vendor's profile
  SELECT vp.vendor_profile_id INTO v_vendor_profile_id
  FROM vendor_profiles vp
  WHERE vp.user_id = auth.uid()
  LIMIT 1;

  IF v_vendor_profile_id IS NULL THEN
    RAISE EXCEPTION 'not_a_vendor';
  END IF;

  -- Booked gate: vendor must be registered on this event
  IF NOT EXISTS (
    SELECT 1 FROM event_vendors ev
    WHERE ev.event_id = p_event_id
      AND ev.marketplace_vendor_id = v_vendor_profile_id
  ) THEN
    RAISE EXCEPTION 'not_booked';
  END IF;

  -- Fetch only the mood-board fields (no guest data, no PII)
  SELECT
    e.display_name,
    e.role_palette,
    e.reception_design,
    e.mood_board_updated_at
  INTO v_event
  FROM events e
  WHERE e.event_id = p_event_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'event_not_found';
  END IF;

  -- Inspiration assets (no names, no PII — just uploaded reference images)
  SELECT jsonb_agg(
    jsonb_build_object(
      'slot_key',      ia.slot_key,
      'slot_position', ia.slot_position,
      'image_url',     ia.image_url
    ) ORDER BY ia.slot_position
  ) INTO v_inspirations
  FROM event_inspiration_assets ia
  WHERE ia.event_id = p_event_id
    AND ia.removed_at IS NULL;

  RETURN jsonb_build_object(
    'display_name',        v_event.display_name,
    'role_palette',        COALESCE(v_event.role_palette,        '{}'::jsonb),
    'reception_design',    COALESCE(v_event.reception_design,    '{}'::jsonb),
    'mood_board_updated_at', v_event.mood_board_updated_at,
    'inspirations',        COALESCE(v_inspirations,              '[]'::jsonb)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION get_vendor_mood_board(uuid) TO authenticated;
