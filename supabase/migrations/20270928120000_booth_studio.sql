-- Booth Studio — the STRUCTURED, palette-harmonized booth poster.
-- ============================================================================
-- Owner directive (2026-07-24): a booked vendor should compose a poster for the
-- couple's event from a fixed TEMPLATE (headline / offer / price / logo /
-- accent) that renders AT RUNTIME in the couple's Mood Board palette, so it
-- ENHANCES the 3D venue instead of reading as an ad breaking the fourth wall.
-- This is a distinct render path from the pre-existing RAW-IMAGE poster
-- (event_vendor_booth_posters.poster_ref); a raw upload is exactly the loud
-- house-ad this structured path avoids.
--
-- Ships DARK behind the client flag NEXT_PUBLIC_BOOTH_STUDIO_ENABLED — this
-- migration only carries DATA (a JSONB column + a setter + the RPC key + the
-- catalog SKU). With the flag off nothing renders the content.
--
-- STORAGE (reuse-first): structured content is one artwork per (event, vendor),
-- the SAME cardinality event_vendor_booth_posters already states with its
-- UNIQUE (event_id, vendor_profile_id). So it lives on that table as a new
-- JSONB column rather than a new table. poster_ref is made NULLABLE so a
-- Booth-Studio-only vendor (structured content, no raw image) can have a row;
-- a CHECK keeps a row from being empty.
--
-- PER-EVENT IS THE AESTHETIC GUARD (unchanged): the join stays on
-- (event_id, vendor_profile_id), so a vendor's content can only ever reach
-- THEIR OWN booth at THAT event — never another vendor's booth, never another
-- couple's venue.
--
-- KEEP IDEMPOTENT.
-- ============================================================================

BEGIN;

-- ── 1 · structured content column + relaxed nullability ─────────────────────
ALTER TABLE public.event_vendor_booth_posters
  ADD COLUMN IF NOT EXISTS poster_content JSONB;

-- poster_ref was NOT NULL (raw-image-only era). A Booth-Studio row may carry
-- ONLY structured content, so allow NULL here; the CHECK below keeps rows
-- meaningful. (The existing char_length CHECK passes for NULL — UNKNOWN.)
ALTER TABLE public.event_vendor_booth_posters
  ALTER COLUMN poster_ref DROP NOT NULL;

-- A row must carry at least one of: raw image ref OR structured content.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'event_vendor_booth_posters_has_payload'
      AND conrelid = 'public.event_vendor_booth_posters'::regclass
  ) THEN
    ALTER TABLE public.event_vendor_booth_posters
      ADD CONSTRAINT event_vendor_booth_posters_has_payload
      CHECK (poster_ref IS NOT NULL OR poster_content IS NOT NULL);
  END IF;
END $$;

COMMENT ON COLUMN public.event_vendor_booth_posters.poster_content IS
  'Booth Studio (2026-07-24): the vendor''s STRUCTURED poster content for this '
  'event — { headline, offer, price, accent? } — rendered at runtime in the '
  'couple''s Mood Board palette (lib/booth-studio). Distinct from poster_ref (a '
  'raw uploaded image). Carries NO URL, so it can never leak a presigned link '
  'into a cached scene payload. NULL = no structured poster.';

-- ── 2 · setter RPC — the only write path for structured content ─────────────
-- Gate is IDENTICAL to vendor_set_booth_poster (caller owns/belongs to a vendor
-- profile AND that profile is BOOKED on the event). p_content NULL / non-object
-- CLEARS the structured content; the row is deleted only when it would then be
-- empty (no poster_ref either).
CREATE OR REPLACE FUNCTION public.vendor_set_booth_studio_content(
  p_event_id UUID,
  p_content  JSONB
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_profile_ids UUID[];
  v_profile_id  UUID;
  v_content     JSONB;
BEGIN
  SELECT ARRAY(
    SELECT vp.vendor_profile_id FROM public.vendor_profiles vp WHERE vp.user_id = auth.uid()
    UNION
    SELECT tm.vendor_profile_id FROM public.vendor_team_members tm WHERE tm.user_id = auth.uid()
  ) INTO v_profile_ids;
  IF v_profile_ids IS NULL OR COALESCE(array_length(v_profile_ids, 1), 0) = 0 THEN
    RAISE EXCEPTION 'not_a_vendor' USING ERRCODE = '42501';
  END IF;

  SELECT ev.marketplace_vendor_id INTO v_profile_id
  FROM public.event_vendors ev
  WHERE ev.event_id = p_event_id
    AND ev.marketplace_vendor_id = ANY (v_profile_ids)
    AND ev.status IN ('contracted', 'deposit_paid', 'delivered', 'complete')
  LIMIT 1;
  IF v_profile_id IS NULL THEN
    RAISE EXCEPTION 'not_booked' USING ERRCODE = '42501';
  END IF;

  -- Only a JSON OBJECT is meaningful content; anything else clears it.
  v_content := CASE WHEN jsonb_typeof(p_content) = 'object' AND p_content <> '{}'::jsonb
                    THEN p_content ELSE NULL END;

  -- Guard against oversized blobs (the client fields are short; the readers cap
  -- them again). 2 KB is generous for headline/offer/price/accent.
  IF v_content IS NOT NULL AND char_length(v_content::text) > 2000 THEN
    RAISE EXCEPTION 'poster_content_too_large' USING ERRCODE = '22001';
  END IF;

  IF v_content IS NULL THEN
    -- Clearing content: null it, then drop the row if nothing else remains.
    UPDATE public.event_vendor_booth_posters
      SET poster_content = NULL, updated_by = auth.uid(), updated_at = NOW()
      WHERE event_id = p_event_id AND vendor_profile_id = v_profile_id;
    DELETE FROM public.event_vendor_booth_posters
      WHERE event_id = p_event_id AND vendor_profile_id = v_profile_id
        AND poster_ref IS NULL AND poster_content IS NULL;
    RETURN;
  END IF;

  INSERT INTO public.event_vendor_booth_posters
    (event_id, vendor_profile_id, poster_content, updated_by)
  VALUES (p_event_id, v_profile_id, v_content, auth.uid())
  ON CONFLICT (event_id, vendor_profile_id) DO UPDATE
    SET poster_content = EXCLUDED.poster_content,
        updated_by     = EXCLUDED.updated_by,
        updated_at     = NOW();
END;
$$;

REVOKE ALL ON FUNCTION public.vendor_set_booth_studio_content(UUID, JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.vendor_set_booth_studio_content(UUID, JSONB) TO authenticated;

COMMENT ON FUNCTION public.vendor_set_booth_studio_content(UUID, JSONB) IS
  'Set (or clear, with NULL / non-object) the calling vendor''s per-event Booth '
  'Studio structured poster content. SECURITY DEFINER; gate = caller owns a '
  'vendor_profile BOOKED on the event. Deletes the row only if no raw poster '
  'remains. Mirrors vendor_set_booth_poster.';

-- ── 3 · public_venue_scene v11 — carry poster_content ───────────────────────
-- IDENTICAL to v10 EXCEPT the added 'posterContent' key on the booth vendor
-- object (fed by the SAME bp join v10 already uses for posterUrl). No presign
-- in the RPC; the reader resolves the vendor LOGO to a PUBLIC url and attaches
-- it to the structured content client-bound. Signature + every join preserved.
CREATE OR REPLACE FUNCTION public.public_venue_scene(p_slug text, p_token text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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

  SELECT COALESCE(e.reception_design, '{}'::jsonb),
         COALESCE(NULLIF(btrim(e.venue_setting), ''), 'banquet_hall')
  INTO v_reception, v_venue_set
  FROM public.events e WHERE e.event_id = v_event_id;

  SELECT jsonb_build_object(
    'venueWidthM', fp.venue_width_m, 'venueLengthM', fp.venue_length_m,
    'stage', jsonb_build_object('xPct', fp.stage_x, 'yPct', fp.stage_y, 'wPct', fp.stage_w, 'hPct', fp.stage_h),
    'entrance', jsonb_build_object('enabled', fp.entrance_enabled, 'xPct', fp.entrance_x, 'yPct', fp.entrance_y, 'kind', fp.entrance_kind, 'depthM', fp.entrance_depth_m),
    'dance', jsonb_build_object('enabled', fp.dance_enabled, 'xPct', fp.dance_x, 'yPct', fp.dance_y, 'wPct', fp.dance_w, 'hPct', fp.dance_h)
  ) INTO v_floor
  FROM public.event_floor_plan fp WHERE fp.event_id = v_event_id;

  SELECT CASE WHEN fp.cocktail_enabled THEN jsonb_build_object(
    'xPct', fp.cocktail_x, 'yPct', fp.cocktail_y,
    'wPct', fp.cocktail_w, 'hPct', fp.cocktail_h,
    'label', fp.cocktail_label
  ) ELSE NULL END INTO v_cocktail
  FROM public.event_floor_plan fp WHERE fp.event_id = v_event_id;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', t.public_id, 'type', t.table_type, 'capacity', t.capacity,
    'xPct', t.x_pos, 'yPct', t.y_pos, 'rotationDeg', t.rotation_deg,
    'removedSeats', COALESCE(to_jsonb(t.removed_seats), '[]'::jsonb),
    'linkGroupId', t.link_group_id
  ) ORDER BY t.sort_order), '[]'::jsonb) INTO v_tables
  FROM public.event_tables t WHERE t.event_id = v_event_id;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'kind', o.kind, 'xPct', o.x_pct, 'yPct', o.y_pct, 'rotationDeg', o.rotation_deg
  )), '[]'::jsonb) INTO v_objects
  FROM public.event_scene_objects o WHERE o.event_id = v_event_id;

  -- Booths (geometry + PUBLIC booth vendor identity). v11: + 'posterContent'
  -- (Booth Studio structured content) on the SAME bp join that feeds posterUrl.
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', b.booth_id, 'kind', b.booth_type, 'label', b.label,
    'xPct', b.x_pos, 'yPct', b.y_pos,
    'offerings', b.offerings,
    'cardItems', ci.items,
    'vendor', CASE WHEN ev.vendor_id IS NULL THEN NULL ELSE jsonb_build_object(
      'name', ev.vendor_name,
      'category', ev.category::text,
      'logoUrl', vp.logo_url,
      'posterUrl', bp.poster_ref,
      'posterContent', bp.poster_content,
      'tier', vp.tier_state,
      'slug', CASE
                WHEN COALESCE(vp.public_visibility::text, 'coming_soon') IN ('coming_soon', 'verified')
                  THEN vp.business_slug
                ELSE NULL
              END,
      'bookable', (COALESCE(vp.public_visibility::text, 'coming_soon') = 'verified')
    ) END
  ) ORDER BY b.sort_order), '[]'::jsonb) INTO v_booths
  FROM public.event_floor_booths b
  LEFT JOIN public.event_vendors ev ON ev.vendor_id = b.event_vendor_id AND ev.event_id = v_event_id
  LEFT JOIN public.vendor_profiles vp ON vp.vendor_profile_id = ev.marketplace_vendor_id
  LEFT JOIN public.event_vendor_booth_posters bp
    ON bp.event_id = v_event_id AND bp.vendor_profile_id = ev.marketplace_vendor_id
  LEFT JOIN LATERAL (
    SELECT s.vendor_service_id, s.package_inclusions
    FROM public.vendor_services s
    WHERE ev.marketplace_vendor_id IS NOT NULL
      AND s.vendor_profile_id = ev.marketplace_vendor_id
      AND s.is_active
    ORDER BY (s.category = ev.category::text) DESC, s.created_at ASC
    LIMIT 1
  ) svc ON TRUE
  LEFT JOIN LATERAL (
    SELECT COALESCE(
      (SELECT jsonb_agg(jsonb_build_object('label', i.label, 'worthPhp', i.worth_php)
                        ORDER BY i.sort_order, i.id)
         FROM public.vendor_service_inclusions i
        WHERE i.vendor_service_id = svc.vendor_service_id),
      (SELECT jsonb_agg(q.elem ORDER BY q.ord)
         FROM (
           SELECT t.ord,
                  CASE
                    WHEN jsonb_typeof(t.e) = 'string' AND btrim(t.e #>> '{}') <> ''
                      THEN jsonb_build_object('label', btrim(t.e #>> '{}'))
                    WHEN jsonb_typeof(t.e) = 'object'
                     AND btrim(COALESCE(t.e ->> 'label', '')) <> ''
                      THEN jsonb_build_object(
                             'label', btrim(t.e ->> 'label'),
                             'worthPhp', CASE
                                           WHEN jsonb_typeof(t.e -> 'worth_php') = 'number'
                                            AND (t.e ->> 'worth_php')::numeric > 0
                                             THEN (t.e ->> 'worth_php')::numeric
                                           ELSE NULL
                                         END)
                    ELSE NULL
                  END AS elem
             FROM jsonb_array_elements(
                    CASE WHEN jsonb_typeof(svc.package_inclusions) = 'array'
                         THEN svc.package_inclusions
                         ELSE '[]'::jsonb END
                  ) WITH ORDINALITY AS t(e, ord)
         ) q
        WHERE q.elem IS NOT NULL),
      (SELECT jsonb_agg(jsonb_build_object('label', btrim(u.h)) ORDER BY u.ord)
         FROM unnest(COALESCE(ev.host_inclusions, ARRAY[]::text[]))
              WITH ORDINALITY AS u(h, ord)
        WHERE btrim(COALESCE(u.h, '')) <> '')
    ) AS items
  ) ci ON TRUE
  WHERE b.event_id = v_event_id;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', s.sign_id, 'label', s.label,
    'xPct', s.x_pos, 'yPct', s.y_pos, 'rotationDeg', s.rotation_deg
  ) ORDER BY s.sort_order), '[]'::jsonb) INTO v_signs
  FROM public.event_floor_signs s WHERE s.event_id = v_event_id;

  SELECT COALESCE(jsonb_agg(occ), '[]'::jsonb) INTO v_occupancy
  FROM (
    SELECT jsonb_build_object('table', t.public_id, 'seats', jsonb_agg(a.seat_number ORDER BY a.seat_number)) AS occ
    FROM public.event_seat_assignments a
    JOIN public.event_tables t ON t.table_id = a.table_id AND t.event_id = v_event_id
    JOIN public.guests g ON g.guest_id = a.guest_id AND g.deleted_at IS NULL
    WHERE a.event_id = v_event_id
    GROUP BY t.public_id
  ) s;

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
$function$;

-- ── 4 · seed the Booth Studio SKU · ₱1,500 / 28-day ─────────────────────────
-- Mirrors the vendor_3d_booth add-on seed (20270908863003): vendor_addon_recurring
-- offering_type ALREADY exists in the CHECKs, so this is an INSERT only. Price is
-- admin-managed (NOT overwritten on conflict). display_order 86 sits right after
-- the 3D Booth add-on (85). Booth Studio ALSO bundles the favoritable listing
-- (VENDOR_FAVORITES_SUBSCRIPTION_GATE) — NOT wired here; that gate must stay OFF
-- during launch (see lib/... favorites gate). Surfaced for owner sign-off: this
-- overlaps the existing vendor_3d_booth (logo-branding) add-on — owner to confirm
-- whether Booth Studio is a SEPARATE SKU or folds into vendor_3d_booth.
INSERT INTO public.vendor_billing_catalog
  (sku_code, title, price_php, offering_type, token_grant_count, max_categories, max_sub_seats, display_order)
VALUES
  ('booth_studio', 'Booth Studio — Poster & Banner on your 3D Booth (28-day)', 1500.00, 'vendor_addon_recurring', NULL, NULL, NULL, 86)
ON CONFLICT (sku_code) DO UPDATE SET
  title             = EXCLUDED.title,
  offering_type     = EXCLUDED.offering_type,
  token_grant_count = EXCLUDED.token_grant_count,
  max_categories    = EXCLUDED.max_categories,
  max_sub_seats     = EXCLUDED.max_sub_seats,
  display_order     = EXCLUDED.display_order,
  updated_at        = NOW();
  -- price_php intentionally NOT overwritten on conflict (admin-managed).

COMMIT;

-- ============================================================================
-- VERIFICATION:
--   SELECT column_name FROM information_schema.columns
--    WHERE table_name = 'event_vendor_booth_posters' AND column_name = 'poster_content';
--   SELECT sku_code, price_php, offering_type, display_order
--     FROM vendor_billing_catalog WHERE sku_code = 'booth_studio';
--   -- Expected: booth_studio · 1500.00 · vendor_addon_recurring · 86
-- ============================================================================
