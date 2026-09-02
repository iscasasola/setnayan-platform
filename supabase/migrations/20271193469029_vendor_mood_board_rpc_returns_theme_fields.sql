-- get_vendor_mood_board(uuid) — add the couple's Overall Theme name/description
-- to the returned jsonb so a booked vendor's read-only mood-board view (Mood
-- Board redesign, 2026-09-02) can show the theme at the top, same as the
-- couple's own page.
--
-- CREATE OR REPLACE only ADDS two keys to the returned object
-- (theme_name / theme_description) — every existing key stays, so this is
-- additive for the one live caller
-- (apps/web/app/vendor-dashboard/clients/[eventId]/mood-board/page.tsx).
-- Body otherwise copied verbatim from the definition backfilled in
-- 20271115531329_backfill_prod_only_functions_and_triggers.sql.

CREATE OR REPLACE FUNCTION public.get_vendor_mood_board(p_event_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $function$
DECLARE
  v_vendor_profile_id uuid;
  v_event record;
  v_inspirations jsonb;
BEGIN
  SELECT vp.vendor_profile_id INTO v_vendor_profile_id
  FROM vendor_profiles vp
  WHERE vp.user_id = auth.uid()
  LIMIT 1;

  IF v_vendor_profile_id IS NULL THEN
    RAISE EXCEPTION 'not_a_vendor';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM event_vendors ev
    WHERE ev.event_id = p_event_id
      AND ev.marketplace_vendor_id = v_vendor_profile_id
  ) THEN
    RAISE EXCEPTION 'not_booked';
  END IF;

  SELECT
    e.display_name,
    e.role_palette,
    e.reception_design,
    e.mood_board_updated_at,
    e.moodboard_theme_name,
    e.moodboard_theme_description
  INTO v_event
  FROM events e
  WHERE e.event_id = p_event_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'event_not_found';
  END IF;

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
    'display_name',              v_event.display_name,
    'role_palette',              COALESCE(v_event.role_palette,     '{}'::jsonb),
    'reception_design',          COALESCE(v_event.reception_design, '{}'::jsonb),
    'mood_board_updated_at',     v_event.mood_board_updated_at,
    'theme_name',                v_event.moodboard_theme_name,
    'theme_description',         v_event.moodboard_theme_description,
    'inspirations',              COALESCE(v_inspirations,           '[]'::jsonb)
  );
END;
$function$;
