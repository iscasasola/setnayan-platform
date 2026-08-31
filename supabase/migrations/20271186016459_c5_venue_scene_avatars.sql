-- c5_venue_scene_avatars — the READ path for `guests.avatar_config`.
--
-- WHY: `guests.avatar_config` has existed since 20270918210897 and, measured on
-- origin/main d1db86d4f, had ZERO readers and ZERO writers — the column's own
-- docblock was the only thing that mentioned it. The guest 3D walk therefore
-- rendered every seated guest as an anonymous mannequin no matter what they
-- had chosen. This adds the ONE missing payload block.
--
-- ⚠ THIS IS A `CREATE OR REPLACE` OF A LIVE, SECURITY DEFINER FUNCTION. The
-- body below is the PRODUCTION definition read out of the live catalog with
-- `pg_get_functiondef` (not from a migration file, which would only tell us
-- what somebody once intended), with exactly ONE addition: the `avatarConfig`
-- key inside the existing `you` object. Nothing else — not a whitespace-only
-- reflow, not a "while we're here" fix — is changed, so a diff of this against
-- prod shows only the feature.
--
-- 🛡 SCOPE: THE VIEWER'S OWN AVATAR, AND NOTHING ELSE.
--   `avatarConfig` rides the `you` block, which already exists and is already
--   the strictest thing in this function: it is populated ONLY inside
--   `IF v_guest_id IS NOT NULL`, i.e. only when a personal token matched a
--   live seated guest of THIS event. No token, or a token that matches
--   nobody → `you` is NULL and this key does not exist.
--
--   It is deliberately NOT gated on `venue_photo_visibility`. That setting is
--   the couple's control over showing guests to EACH OTHER; it was never a
--   control over whether you may see yourself, and a guest hidden from their
--   own avatar by the host's photo-sharing choice would be a nonsense.
--
--   OTHER guests' avatars are NOT carried by this migration. The guest walk
--   renders seated occupants through a chibi rig that has no seated geometry
--   (legs and shoes are merged, jointless buffers — see lib/chibi-geometry.ts),
--   so there is nothing that could draw them yet. Shipping the payload ahead of
--   a reader would just recreate the inert-column problem this change exists to
--   fix. When the seated rig lands, that block belongs here, on the same
--   `venue_photo_visibility` gate the `photos` block directly above uses.
--
--   An avatar config is NOT biometric and NOT a photo — it is a set of
--   whitelisted catalog ids (lib/chibi-config.ts), never derived from a face.
--
-- 🚩 The CLIENT still gates on NEXT_PUBLIC_FIGURE_CHIBI (default OFF), so this
--   payload key is inert until that flag flips — a room reading a payload that
--   carries `avatarConfig` while unflagged renders exactly as it does today
--   (pinned by apps/web/lib/venue-avatars.test.ts).
--
-- Idempotent: CREATE OR REPLACE FUNCTION.

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
  WHERE e.slug ILIKE p_slug
    AND NOT EXISTS (
      SELECT 1 FROM public.event_type_profiles p
      WHERE p.event_type = e.event_type
        AND NOT ('seating' = ANY(p.enabled_surfaces))
    )
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
        -- ─── NEW (C5): the viewer's OWN avatar config ────────────────
        -- UNGATED BY `venue_photo_visibility` ON PURPOSE. That setting is the
        -- couple's control over showing guests to EACH OTHER; it was never a
        -- control over whether you may see yourself. This value is read from
        -- the row the token already authenticated, is the guest's own authored
        -- data, and reaches nobody else — so gating it behind the host's
        -- photo-sharing choice would hide a guest's avatar from the one person
        -- who is unambiguously entitled to it.
        'avatarConfig', (SELECT g5.avatar_config FROM public.guests g5
                          WHERE g5.guest_id = v_guest_id),
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
