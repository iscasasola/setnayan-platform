-- ============================================================================
-- 20270510377963_venue_walk_interactions.sql
--
-- Slice B: 3D walk-around interactions — booth vendor cards data plumbing
-- (owner interaction model, 2026-07-03 DECISION_LOG).
--
-- Two parts, one migration:
--
--   1. event_floor_booths.offerings — a short "what they're serving" line the
--      booth vendor card shows ("Espresso martinis & mocktails"). Added DEFENSIVELY
--      with IF NOT EXISTS and NO CHECK constraint: Slice A's
--      20270509511134_booth_offerings.sql (merged PR #2757) owns the CANONICAL
--      add + its length CHECK. This IF-NOT-EXISTS add is a no-op after it — kept
--      so this migration stands alone on any environment regardless of order.
--      No duplicate CHECK here; Slice A's constraint is the single source of truth.
--
--   2. public_venue_scene — CREATE OR REPLACE, now v5: the UNION of every
--      shipped revision. Three parents fold here:
--        · v3 (20270507653861_venue_photo_visibility.sql) — host-gated guest
--          PHOTOS (photoVisibility / photos). ⚠ The theming branch's v4 was
--          written over v2 and unknowingly DROPPED these; this migration
--          RESTORES them verbatim.
--        · v4 (20270508699158_public_venue_scene_v4.sql, PR #2759) — room
--          styling: receptionDesign (events.reception_design) + venueSetting
--          (events.venue_setting). Preserved verbatim.
--        · Slice B (this migration) — the booth objects now also carry:
--        · offerings — the booth's "what they're serving" copy (null when unset).
--        · vendor    — { name, logoUrl, category } | null. Joined through
--                      event_floor_booths.event_vendor_id → event_vendors, and
--                      event_vendors.marketplace_vendor_id → vendor_profiles for
--                      the logo. BUSINESS IDENTITY ONLY (vendor_name, category,
--                      logo_url) — zero personal PII (no contact_email/phone/notes).
--
-- PRIVACY POSTURE — unchanged:
--   * Booth vendor info sits OUTSIDE the token block: it is PUBLIC business info
--     at a PUBLISHED event (a booked business's name/logo/category is not private,
--     the same way a booth's label + location already were in v2/v3). Only the
--     GUEST surface (names + photos) stays token-gated, byte-for-byte identical.
--   * logoUrl is a RAW stored ref (r2:// or a bare URL); the CLIENT cannot resolve
--     an r2:// ref, so the server page resolves it via displayUrlForStoredAsset —
--     exactly as it already does for guest photos. No signed URL is minted in SQL.
-- ============================================================================

-- (1) Defensive offerings column (canonical add + CHECK belong to Slice A). ---
ALTER TABLE public.event_floor_booths
  ADD COLUMN IF NOT EXISTS offerings TEXT;

-- (2) public_venue_scene v4 — additive booth vendor + offerings. --------------
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
  v_reception JSONB;
  v_venue_set TEXT;
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

  -- Room styling (non-PII) — the couple's reception treatments + venue archetype
  -- (v4, preserved verbatim).
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

  -- Booths (geometry + PUBLIC booth vendor identity). The offerings copy and the
  -- booked-vendor's business name/logo/category ride here so the booth card can
  -- open on tap. Vendor block is BUSINESS IDENTITY ONLY (name/logo/category) and
  -- is NULL for a couple-placed / unlinked booth. Public business info at a
  -- published event — no token gate, matching booth label/location in v2/v3.
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', b.booth_id, 'kind', b.booth_type, 'label', b.label,
    'xPct', b.x_pos, 'yPct', b.y_pos,
    'offerings', b.offerings,
    'vendor', CASE WHEN ev.vendor_id IS NULL THEN NULL ELSE jsonb_build_object(
      'name', ev.vendor_name,
      'category', ev.category::text,
      'logoUrl', vp.logo_url
    ) END
  ) ORDER BY b.sort_order), '[]'::jsonb) INTO v_booths
  FROM public.event_floor_booths b
  LEFT JOIN public.event_vendors ev ON ev.vendor_id = b.event_vendor_id
  LEFT JOIN public.vendor_profiles vp ON vp.vendor_profile_id = ev.marketplace_vendor_id
  WHERE b.event_id = v_event_id;

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
    'receptionDesign', v_reception,
    'venueSetting', v_venue_set,
    'photoVisibility', v_photo_vis,
    'photos', v_photos,
    'you', v_you
  );
END;
$$;

REVOKE ALL ON FUNCTION public.public_venue_scene(TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.public_venue_scene(TEXT, TEXT) TO anon, authenticated;

COMMENT ON FUNCTION public.public_venue_scene(TEXT, TEXT) IS
  'Guest 3D venue explorer data path (v5 — union of v3 photos + v4 room styling + Slice B booth vendor cards). Public/anon-callable, published-gated. Returns room geometry (floor + tables + venue objects + booths + signs + cocktail room) + ANONYMISED occupancy always; guest NAMES only for a valid per-guest qr_token and only that token-holder''s own table (their tablemates). Also returns receptionDesign + venueSetting (non-PII room styling, v4) and RESTORES the v3 photo machinery the theming v4 dropped. Booths now carry offerings + a PUBLIC booth-vendor block { name, logoUrl, category } | null (joined via event_vendor_id -> event_vendors -> vendor_profiles; business identity only, no PII, no token gate). Guest PHOTOS (raw stored refs, resolved server-side) require a valid token and follow venue_photo_visibility (none/table/all). No token -> zero names AND zero photos. photoVisibility echoes the effective setting.';

-- (No COMMENT ON COLUMN offerings here — 20270509511134_booth_offerings.sql
-- owns the canonical column comment; re-commenting would clobber it.)
