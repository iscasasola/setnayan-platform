-- public_venue_scene v9 — carry booth `cardItems` to the public guest walk.
--
-- WHY: v8 lit up booth branding, but the same RPC still omitted cardItems, so
-- GUESTS — the highest-intent viewers — saw the thinnest booth card while the
-- couple's lab and the authenticated scene showed the full "what you get" list.
-- (Council verdict 2026-07-19: "the first fix is a BUG, not a feature.")
--
-- This is a faithful plpgsql port of lib/vendor-services.ts fetchBoothCardItems.
-- Resolution per booth, in precedence order:
--   1. the chosen listing's vendor_service_inclusions (label + worth_php),
--      ordered by sort_order;
--   2. else that listing's legacy package_inclusions JSONB — strings become
--      {label}, objects become {label, worthPhp} where worth_php is a number > 0
--      (parsePackageInclusions, verbatim);
--   3. else the host-authored event_vendors.host_inclusions[] (DIY parity,
--      always empty on marketplace rows).
-- "The chosen listing" = the linked profile's ACTIVE vendor_services rows,
-- oldest first, category match preferred — expressed as
--   ORDER BY (s.category = ev.category::text) DESC, s.created_at ASC LIMIT 1
-- (vendor_services is UNIQUE (vendor_profile_id, category), so the preferred
-- match is unique when it exists).
--
-- FAIL-SOFT is preserved structurally: every rung is a scalar subquery that
-- yields NULL when it has no rows, so COALESCE falls through exactly like the
-- TS `items.length === 0` checks, and all-NULL => 'cardItems': null, matching
-- `boothCardItems.get(booth_id) ?? null`. A booth with no event_vendor_id, a
-- manual/off-platform vendor, or a profile with no active listing all degrade
-- to null rather than erroring the scene.
--
-- NOT PII: inclusions are public "what you get" marketing copy, already served
-- on /v/[slug]. vendor_service_inclusions carries a public-read RLS policy; the
-- SECURITY DEFINER context reads it the same way v6-v8 read vendor_profiles.
--
-- Idempotent CREATE OR REPLACE. IDENTICAL to v8 EXCEPT the added 'cardItems'
-- key and the two LATERAL joins that feed it. Signature unchanged (text, text);
-- STABLE SECURITY DEFINER + search_path + every v6/v7/v8 join preserved.

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
    'entrance', jsonb_build_object('enabled', fp.entrance_enabled, 'xPct', fp.entrance_x, 'yPct', fp.entrance_y, 'kind', fp.entrance_kind, 'depthM', fp.entrance_depth_m),
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

  -- Tables (geometry only — NO guest data). v5: + linkGroupId so linked
  -- serpentines render even-spaced chairs on the guest walk.
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', t.public_id, 'type', t.table_type, 'capacity', t.capacity,
    'xPct', t.x_pos, 'yPct', t.y_pos, 'rotationDeg', t.rotation_deg,
    'removedSeats', COALESCE(to_jsonb(t.removed_seats), '[]'::jsonb),
    'linkGroupId', t.link_group_id
  ) ORDER BY t.sort_order), '[]'::jsonb) INTO v_tables
  FROM public.event_tables t WHERE t.event_id = v_event_id;

  -- Venue objects (geometry only).
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'kind', o.kind, 'xPct', o.x_pct, 'yPct', o.y_pct, 'rotationDeg', o.rotation_deg
  )), '[]'::jsonb) INTO v_objects
  FROM public.event_scene_objects o WHERE o.event_id = v_event_id;

  -- Booths (geometry + PUBLIC booth vendor identity). The offerings copy and the
  -- booked-vendor's business name/logo/category/tier/slug ride here so the booth
  -- card can open on tap AND the booth can brand itself (boothCanBrand reads
  -- tier). Vendor block is BUSINESS IDENTITY ONLY — no PII — and
  -- is NULL for a couple-placed / unlinked booth. Public business info at a
  -- published event — no token gate, matching booth label/location in v2/v3.
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', b.booth_id, 'kind', b.booth_type, 'label', b.label,
    'xPct', b.x_pos, 'yPct', b.y_pos,
    'offerings', b.offerings,
    'cardItems', ci.items,
    'vendor', CASE WHEN ev.vendor_id IS NULL THEN NULL ELSE jsonb_build_object(
      'name', ev.vendor_name,
      'category', ev.category::text,
      'logoUrl', vp.logo_url,
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
  -- The listing this booking's card reads: CATEGORY MATCH BEATS FIRST-ACTIVE,
  -- oldest first (fetchBoothCardItems' `list.find(category) ?? list[0]`, whose
  -- list is vendor_services ordered created_at ASC). is_active is NOT NULL
  -- BOOLEAN, so a plain truth test matches the TS `=== false` skip exactly.
  LEFT JOIN LATERAL (
    SELECT s.vendor_service_id, s.package_inclusions
    FROM public.vendor_services s
    WHERE ev.marketplace_vendor_id IS NOT NULL
      AND s.vendor_profile_id = ev.marketplace_vendor_id
      AND s.is_active
    ORDER BY (s.category = ev.category::text) DESC, s.created_at ASC
    LIMIT 1
  ) svc ON TRUE
  -- Card items, in the TS precedence order: structured inclusions -> legacy
  -- package_inclusions JSONB -> the host-authored host_inclusions[]. Each rung
  -- yields NULL when it has no rows, so COALESCE falls through exactly like the
  -- `items.length === 0` checks. All three NULL => 'cardItems': null, matching
  -- `boothCardItems.get(id) ?? null`.
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
$function$;
