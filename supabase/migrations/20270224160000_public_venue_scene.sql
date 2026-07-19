-- ============================================================================
-- 20270224160000_public_venue_scene.sql
--
-- Guest-facing 3D experience (owner 2026-06-26: "guests enjoy this too", Sims-
-- style). Read-only public data path for the guest 3D venue explorer. Mirrors
-- public_seat_lookup's safety model and tightens it for a richer payload:
--
--   * SECURITY DEFINER + published-gate (event_floor_plan.published_at) — a draft
--     plan returns {published:false}; nothing else.
--   * Geometry (floor / tables / venue objects) is NON-PII room layout — public.
--   * Occupancy is ANONYMISED — filled seat NUMBERS per table, NEVER names — so
--     the 3D can show filled chairs without exposing who sits where.
--   * NAMES are returned ONLY for a caller holding a valid per-guest qr_token
--     (their own invite link), and ONLY for THAT guest's own table (tablemates).
--     No token → `you` is null and the payload contains zero guest names.
--     Privacy LOCKED by the owner 2026-06-26: "their table named, rest anonymous"
--     (RA 10173). Token match is exact equality (secret, unguessable) — no LIKE,
--     no enumeration. Public ids only; internal table_id/guest_id never leak.
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
  v_occupancy JSONB;
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

  -- Floor geometry (non-PII).
  SELECT jsonb_build_object(
    'venueWidthM', fp.venue_width_m, 'venueLengthM', fp.venue_length_m,
    'stage', jsonb_build_object('xPct', fp.stage_x, 'yPct', fp.stage_y, 'wPct', fp.stage_w, 'hPct', fp.stage_h),
    'entrance', jsonb_build_object('enabled', fp.entrance_enabled, 'xPct', fp.entrance_x, 'yPct', fp.entrance_y),
    'dance', jsonb_build_object('enabled', fp.dance_enabled, 'xPct', fp.dance_x, 'yPct', fp.dance_y, 'wPct', fp.dance_w, 'hPct', fp.dance_h)
  ) INTO v_floor
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
    'occupancy', v_occupancy,
    'you', v_you
  );
END;
$$;

REVOKE ALL ON FUNCTION public.public_venue_scene(TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.public_venue_scene(TEXT, TEXT) TO anon, authenticated;

COMMENT ON FUNCTION public.public_venue_scene(TEXT, TEXT) IS
  'Guest 3D venue explorer data path. Public/anon-callable, published-gated. Returns room geometry + ANONYMISED occupancy always; guest NAMES only for a valid per-guest qr_token and only that token-holder''s own table (their tablemates). No token → zero names. Public ids only.';
