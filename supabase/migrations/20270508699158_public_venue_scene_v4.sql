-- ============================================================================
-- 20270508699158_public_venue_scene_v4.sql
--
-- Guest 3D venue explorer, v4 — the payload now carries the couple's ROOM
-- STYLING so the guest walk themes the same way the couple lab + homepage demo
-- do (Wave 2b, 2026-07-03). Additive-only over v2
-- (20270505930682_public_venue_scene_v2.sql): two new top-level keys, everything
-- else byte-for-byte the same, so an old cached client keeps working.
--
--   * receptionDesign — events.reception_design (JSONB). The couple's per-part
--     treatment choices (ceiling chandeliers / draped or floral backdrop /
--     centrepieces / entrance arch …). NON-PII room styling. The client
--     sanitizes it against the RECEPTION_PARTS vocabulary before rendering, so
--     an unexpected shape degrades to the default treatments, never a crash.
--   * venueSetting  — events.venue_setting (TEXT, default 'banquet_hall'). The
--     room ARCHETYPE that swaps the 3D shell (garden greenery / chapel windows /
--     barn trusses / beach horizon / rooftop parapet). NON-PII.
--
-- Privacy posture UNCHANGED: SECURITY DEFINER + published-gate; geometry is
-- public; occupancy stays anonymised (seat NUMBERS only); guest NAMES still
-- require a valid per-guest qr_token and only for that token-holder's own table.
-- Both additions are fixed room styling — zero PII in either.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.public_venue_scene(p_slug TEXT, p_token TEXT DEFAULT NULL)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
DECLARE
  v_event_id  UUID;
  v_published BOOLEAN;
  v_guest_id  UUID;
  v_table_id  UUID;
  v_seat      INT;
  v_floor     JSONB;
  v_tables    JSONB;
  v_objects   JSONB;
  v_booths    JSONB;
  v_signs     JSONB;
  v_cocktail  JSONB;
  v_occupancy JSONB;
  v_reception JSONB;
  v_venue_set TEXT;
  v_you       JSONB := NULL;
BEGIN
  SELECT e.event_id INTO v_event_id
  FROM public.events e
  WHERE e.slug ILIKE p_slug AND e.event_type = 'wedding'
  LIMIT 1;
  IF v_event_id IS NULL THEN
    RETURN jsonb_build_object('published', false);
  END IF;

  SELECT (fp.published_at IS NOT NULL) INTO v_published
  FROM public.event_floor_plan fp WHERE fp.event_id = v_event_id;
  IF NOT COALESCE(v_published, false) THEN
    RETURN jsonb_build_object('published', false);
  END IF;

  -- Room styling (non-PII) — the couple's reception treatments + venue archetype.
  SELECT COALESCE(e.reception_design, '{}'::jsonb),
         COALESCE(NULLIF(btrim(e.venue_setting), ''), 'banquet_hall')
  INTO v_reception, v_venue_set
  FROM public.events e WHERE e.event_id = v_event_id;

  -- Floor geometry (non-PII).
  SELECT jsonb_build_object(
    'venueWidthM', fp.venue_width_m, 'venueLengthM', fp.venue_length_m,
    'stage', jsonb_build_object('xPct', fp.stage_x, 'yPct', fp.stage_y, 'wPct', fp.stage_w, 'hPct', fp.stage_h),
    'entrance', jsonb_build_object('enabled', fp.entrance_enabled, 'xPct', fp.entrance_x, 'yPct', fp.entrance_y),
    'dance', jsonb_build_object('enabled', fp.dance_enabled, 'xPct', fp.dance_x, 'yPct', fp.dance_y, 'wPct', fp.dance_w, 'hPct', fp.dance_h)
  ) INTO v_floor
  FROM public.event_floor_plan fp WHERE fp.event_id = v_event_id;

  -- Cocktail / waiting room (non-PII room shell). Null when not enabled.
  SELECT CASE WHEN fp.cocktail_enabled THEN jsonb_build_object(
    'xPct', fp.cocktail_x, 'yPct', fp.cocktail_y,
    'wPct', fp.cocktail_w, 'hPct', fp.cocktail_h,
    'label', fp.cocktail_label
  ) ELSE NULL END INTO v_cocktail
  FROM public.event_floor_plan fp WHERE fp.event_id = v_event_id;

  -- Tables (geometry only — NO guest data).
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', t.public_id, 'type', t.table_type, 'capacity', t.capacity,
    'xPct', t.x_pos, 'yPct', t.y_pos, 'rotationDeg', t.rotation_deg,
    'removedSeats', COALESCE(to_jsonb(t.removed_seats), '[]'::jsonb)
  ) ORDER BY t.sort_order), '[]'::jsonb) INTO v_tables
  FROM public.event_tables t WHERE t.event_id = v_event_id;

  -- Venue objects (geometry only).
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'kind', o.kind, 'xPct', o.x_pct, 'yPct', o.y_pct, 'rotationDeg', o.rotation_deg
  )), '[]'::jsonb) INTO v_objects
  FROM public.event_scene_objects o WHERE o.event_id = v_event_id;

  -- Booths (geometry only — the couple's placed vendor stations).
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', b.booth_id, 'kind', b.booth_type, 'label', b.label,
    'xPct', b.x_pos, 'yPct', b.y_pos
  ) ORDER BY b.sort_order), '[]'::jsonb) INTO v_booths
  FROM public.event_floor_booths b WHERE b.event_id = v_event_id;

  -- Wayfinding signs (geometry only).
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', s.sign_id, 'label', s.label,
    'xPct', s.x_pos, 'yPct', s.y_pos, 'rotationDeg', s.rotation_deg
  ) ORDER BY s.sort_order), '[]'::jsonb) INTO v_signs
  FROM public.event_floor_signs s WHERE s.event_id = v_event_id;

  -- Occupancy — ANONYMISED filled seat numbers per table (no names).
  SELECT COALESCE(jsonb_agg(occ), '[]'::jsonb) INTO v_occupancy
  FROM (
    SELECT jsonb_build_object('table', t.public_id, 'seats', jsonb_agg(a.seat_number ORDER BY a.seat_number)) AS occ
    FROM public.event_seat_assignments a
    JOIN public.event_tables t ON t.table_id = a.table_id AND t.event_id = v_event_id
    JOIN public.guests g ON g.guest_id = a.guest_id AND g.deleted_at IS NULL
    WHERE a.event_id = v_event_id
    GROUP BY t.public_id
  ) s;

  -- "You" — names ONLY via a valid personal token, ONLY for the token-holder's
  -- own table. Exact-match (secret token), no enumeration. No token → no names.
  IF p_token IS NOT NULL AND btrim(p_token) <> '' THEN
    SELECT a.table_id, a.seat_number, g.guest_id
    INTO v_table_id, v_seat, v_guest_id
    FROM public.guests g
    JOIN public.event_seat_assignments a ON a.guest_id = g.guest_id AND a.event_id = v_event_id
    WHERE g.event_id = v_event_id AND g.deleted_at IS NULL AND g.qr_token = btrim(p_token)
    LIMIT 1;

    IF v_guest_id IS NOT NULL THEN
      SELECT jsonb_build_object(
        'table', (SELECT t.public_id FROM public.event_tables t WHERE t.table_id = v_table_id),
        'seatNumber', v_seat,
        'tablemates', COALESCE((
          SELECT jsonb_agg(jsonb_build_object(
            'name', COALESCE(NULLIF(btrim(g2.display_name), ''), btrim(g2.first_name || ' ' || g2.last_name)),
            'seatNumber', a2.seat_number
          ) ORDER BY a2.seat_number)
          FROM public.event_seat_assignments a2
          JOIN public.guests g2 ON g2.guest_id = a2.guest_id AND g2.deleted_at IS NULL
          WHERE a2.event_id = v_event_id AND a2.table_id = v_table_id
        ), '[]'::jsonb)
      ) INTO v_you;
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'published', true,
    'floor', v_floor,
    'tables', v_tables,
    'objects', v_objects,
    'booths', v_booths,
    'signs', v_signs,
    'cocktail', v_cocktail,
    'occupancy', v_occupancy,
    'receptionDesign', v_reception,
    'venueSetting', v_venue_set,
    'you', v_you
  );
END;
$$;

REVOKE ALL ON FUNCTION public.public_venue_scene(TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.public_venue_scene(TEXT, TEXT) TO anon, authenticated;

COMMENT ON FUNCTION public.public_venue_scene(TEXT, TEXT) IS
  'Guest 3D venue explorer data path (v4). Public/anon-callable, published-gated. Returns room geometry (floor + tables + venue objects + booths + signs + cocktail room) + room STYLING (reception_design treatments + venue_setting archetype) + ANONYMISED occupancy always; guest NAMES only for a valid per-guest qr_token and only that token-holder''s own table (their tablemates). No token → zero names. Public ids only; all fixtures + styling are non-PII.';
