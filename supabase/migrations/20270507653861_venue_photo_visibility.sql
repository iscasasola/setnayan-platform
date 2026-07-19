-- ============================================================================
-- 20270507653861_venue_photo_visibility.sql
--
-- Host-controlled guest-photo visibility in the PUBLIC 3D venue walk.
--
-- Owner decision (2026-07-03, DECISION_LOG): whether guest PHOTOS ride on the
-- avatars in the public venue explorer is the HOST'S CHOICE, defaulting to
-- OWN-TABLEMATES-ONLY. Some couples want every guest to recognise every seated
-- face while roaming; most want the softer default where a guest only sees the
-- faces at their OWN table. And a host can turn photos off entirely.
--
-- Two parts, one migration:
--
--   1. event_floor_plan.venue_photo_visibility — the per-event setting:
--        'table' (DEFAULT) → photos of the token-holder's OWN tablemates only.
--        'all'             → photos of ALL seated guests (recognition mode).
--        'none'            → no photos anywhere in the walk.
--
--   2. public_venue_scene v3 — CREATE OR REPLACE over v2
--      (20270505930682_public_venue_scene_v2.sql). Additive-only: the whole v2
--      body (floor + tables + venue objects + booths + signs + cocktail +
--      anonymised occupancy + own-table names) is preserved byte-for-byte; the
--      only new behaviour is photo refs, gated as below.
--
-- HARD PRIVACY FLOOR (unchanged posture, extended to photos):
--   * The TOKENLESS public view NEVER receives photo data, for ANY setting —
--     photos require a valid per-guest qr_token exactly as guest NAMES do today.
--   * 'none'  → no photo fields at all.
--   * 'table' → own-tablemate photo refs only (the SAME rows that already carry
--               names — no new identity surface beyond what the token already
--               unlocks).
--   * 'all'   → per-seat photo refs for every SEATED guest, keyed by table
--               public_id + seat_number. Still NO names beyond the own table:
--               'all' widens FACES, never names. A stranger's face at a far
--               table has no name attached — matching the couple's intent
--               ("let guests recognise faces") without leaking a directory.
--   * Refs are RAW stored refs (r2:// or a bare URL). The CLIENT cannot resolve
--     an r2:// ref — the server page resolves each via displayUrlForStoredAsset
--     before handing the scene to WebGL. No signed URL is minted in SQL.
--
-- The effective setting is echoed in the payload ('photoVisibility') so the
-- client knows what to render.
-- ============================================================================

ALTER TABLE public.event_floor_plan
  ADD COLUMN IF NOT EXISTS venue_photo_visibility TEXT NOT NULL DEFAULT 'table'
    CHECK (venue_photo_visibility IN ('table', 'all', 'none'));

COMMENT ON COLUMN public.event_floor_plan.venue_photo_visibility IS
  'Host choice for guest PHOTOS in the public 3D venue walk (owner 2026-07-03). '
  '''table'' (default) = own-tablemate photos only · ''all'' = all seated guests'' '
  'photos (faces, still no extra names) · ''none'' = no photos. Photos are ALWAYS '
  'gated behind a valid per-guest qr_token — the tokenless public view never gets '
  'photos regardless of this setting.';

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
  v_photo_vis TEXT;
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
  v_photos    JSONB := NULL;
  v_you       JSONB := NULL;
BEGIN
  SELECT e.event_id INTO v_event_id
  FROM public.events e
  WHERE e.slug ILIKE p_slug AND e.event_type = 'wedding'
  LIMIT 1;
  IF v_event_id IS NULL THEN
    RETURN jsonb_build_object('published', false);
  END IF;

  SELECT (fp.published_at IS NOT NULL), COALESCE(fp.venue_photo_visibility, 'table')
  INTO v_published, v_photo_vis
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

      -- ── Guest PHOTOS — the ONLY code path that can emit photo refs. Reached
      -- exclusively inside the valid-token block (v_guest_id IS NOT NULL), so a
      -- tokenless public view NEVER gets photos regardless of the setting.
      --
      -- 'none'  → v_photos stays NULL (no photo fields at all).
      -- 'table' → own-tablemate photo refs only — the same rows that just got
      --           names above; no new identity surface beyond the token's reach.
      -- 'all'   → per-seat photo refs for EVERY seated guest (faces widen, names
      --           do NOT — v_you still carries own-table names only).
      -- Each entry: { table: <table public_id>, seatNumber, photoUrl: <raw ref> }.
      -- Rows with no photo_url are dropped, so the payload only lists faces that
      -- actually exist. Refs are resolved to display URLs server-side.
      IF v_photo_vis = 'table' THEN
        SELECT COALESCE(jsonb_agg(jsonb_build_object(
          'table', (SELECT t.public_id FROM public.event_tables t WHERE t.table_id = v_table_id),
          'seatNumber', a3.seat_number,
          'photoUrl', g3.photo_url
        ) ORDER BY a3.seat_number), '[]'::jsonb) INTO v_photos
        FROM public.event_seat_assignments a3
        JOIN public.guests g3 ON g3.guest_id = a3.guest_id AND g3.deleted_at IS NULL
        WHERE a3.event_id = v_event_id AND a3.table_id = v_table_id
          AND NULLIF(btrim(g3.photo_url), '') IS NOT NULL;
      ELSIF v_photo_vis = 'all' THEN
        SELECT COALESCE(jsonb_agg(jsonb_build_object(
          'table', t3.public_id,
          'seatNumber', a3.seat_number,
          'photoUrl', g3.photo_url
        ) ORDER BY t3.public_id, a3.seat_number), '[]'::jsonb) INTO v_photos
        FROM public.event_seat_assignments a3
        JOIN public.event_tables t3 ON t3.table_id = a3.table_id AND t3.event_id = v_event_id
        JOIN public.guests g3 ON g3.guest_id = a3.guest_id AND g3.deleted_at IS NULL
        WHERE a3.event_id = v_event_id
          AND NULLIF(btrim(g3.photo_url), '') IS NOT NULL;
      END IF;
      -- 'none' leaves v_photos NULL by construction.
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
    'photoVisibility', v_photo_vis,
    'photos', v_photos,
    'you', v_you
  );
END;
$$;

REVOKE ALL ON FUNCTION public.public_venue_scene(TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.public_venue_scene(TEXT, TEXT) TO anon, authenticated;

COMMENT ON FUNCTION public.public_venue_scene(TEXT, TEXT) IS
  'Guest 3D venue explorer data path (v3). Public/anon-callable, published-gated. Returns room geometry (floor + tables + venue objects + booths + signs + cocktail room) + ANONYMISED occupancy always; guest NAMES only for a valid per-guest qr_token and only that token-holder''s own table (their tablemates). Guest PHOTOS (raw stored refs, resolved server-side) ALSO require a valid token and follow the host''s venue_photo_visibility setting: none = no photos · table = own tablemates only · all = every seated face (still no extra names). No token → zero names AND zero photos. photoVisibility echoes the effective setting. Public ids only; all fixtures are non-PII room layout.';
