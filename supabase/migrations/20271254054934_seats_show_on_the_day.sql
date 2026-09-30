-- seats_show_on_the_day
-- Created via `pnpm migration:new`. Prefix auto-allocated. KEEP IDEMPOTENT
-- (CREATE OR REPLACE FUNCTION).
--
-- ── WHY (owner 2026-09-30, verbatim: "seatplan will show on the date of the event")
-- Guests' seats used to open ONLY when the couple flipped "Guests see this now"
-- (`event_floor_plan.published_at`). Now they open by themselves from 00:00
-- Manila on the event's date (a multi-day event: its first day, which is
-- `events.event_date`), and the couple's switch becomes "Show guests their
-- seats early" — it can open them before the day, and turning it off before
-- the day hides them again; on and after the day it no longer hides them.
--
-- ONE rule, ONE SQL home: `public.guests_may_see_seats(event_id)`. The three
-- guest-facing seat functions that used to read `published_at` themselves now
-- ask it instead — the 3D walk (`public_venue_scene`), the name search
-- (`public_seat_lookup`) and the coordinator's scan
-- (`coordinator_seat_by_guest_qr`). Its TS twin is `guestsMaySeeSeats` in
-- apps/web/lib/guests-may-see-seats.ts; `guests-may-see-seats.test.ts` reads
-- this file and holds the two level.
--
-- The day rule needs a real DAY: `event_date_precision = 'day'`. A date known
-- only to the month or year has no day to open on, so only the switch opens it.
--
-- ── THE BODIES BELOW ARE THE LATEST DEFINITIONS, EDITED ONLY AT THE GATE ─────
-- public_venue_scene  ← 20271208425259_c6_venue_scene_seated_avatars.sql (its
--                        header: copied out of production with pg_get_functiondef)
-- public_seat_lookup  ← 20270920040000_seat_lookup_exact_match.sql
-- coordinator_seat_by_guest_qr ← 20271013200000_coordinator_seat_by_guest_qr.sql
-- Each is that text verbatim except the one gate (and the coordinator's now
-- unused `v_published` declaration). No other migration redefines them since
-- (`grep -il "function[^(]*<name> *(" supabase/migrations/*.sql`).
--
-- Grants: the three keep their grants exactly (re-stated below, unchanged).
-- The new helper is callable by NO client role — it is reached only from
-- inside the SECURITY DEFINER functions above, which run as their owner.
--
-- Idempotent: CREATE OR REPLACE FUNCTION throughout.

BEGIN;

CREATE OR REPLACE FUNCTION public.guests_may_see_seats(p_event_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT
    -- the day has come (Manila), on a day-precise date
    EXISTS (
      SELECT 1 FROM public.events e
      WHERE e.event_id = p_event_id
        AND e.event_date_precision = 'day'
        AND e.event_date IS NOT NULL
        AND e.event_date <= (now() AT TIME ZONE 'Asia/Manila')::date
    )
    -- or the couple turned on "Show guests their seats early"
    OR EXISTS (
      SELECT 1 FROM public.event_floor_plan fp
      WHERE fp.event_id = p_event_id
        AND fp.published_at IS NOT NULL
    );
$$;

COMMENT ON FUNCTION public.guests_may_see_seats(uuid) IS
  'May guests see their seats? TRUE from 00:00 Asia/Manila on events.event_date (day precision only; a multi-day event opens on its first day), or earlier when the couple turned on "Show guests their seats early" (event_floor_plan.published_at). The ONE seat rule; TS twin guestsMaySeeSeats in apps/web/lib/guests-may-see-seats.ts. Internal: no client role may execute it.';

REVOKE ALL ON FUNCTION public.guests_may_see_seats(uuid) FROM PUBLIC, anon, authenticated;

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
  v_avatars   JSONB := '[]'::jsonb;
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

  -- 🪑 seats_show_on_the_day: the ONE seat rule, not the switch alone.
  SELECT public.guests_may_see_seats(v_event_id), COALESCE(fp.venue_photo_visibility, 'table')
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
        -- ─── C5: the viewer's OWN avatar config ──────────────────────
        -- UNGATED BY `venue_photo_visibility` ON PURPOSE. That setting is the
        -- couple's control over showing guests to EACH OTHER; it was never a
        -- control over whether you may see yourself. This value is read from
        -- the row the token already authenticated, is the guest's own authored
        -- data, and reaches nobody else through THIS block — so gating it
        -- behind the host's photo-sharing choice would hide a guest's avatar
        -- from the one person who is unambiguously entitled to it.
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

  -- ─── NEW (C6): seated occupants' avatars — CARTOONS, never photos ─────────
  -- The half C5 deliberately left out until a reader existed: which SEATED
  -- guests made an avatar, so the walk can draw them as their chibi instead of
  -- the neutral mannequin. Same gate as `photos` — `venue_photo_visibility` is
  -- the couple's ONE control over showing guests to each other:
  --   'table' → the token holder's own table only (no token → nobody)
  --   'all'   → every seated guest who made one
  --   'none'  → nobody
  -- A config is a set of whitelisted catalog ids (lib/chibi-config.ts), never
  -- derived from a face; the client re-validates it (resolveChibiConfig) and
  -- draws the mannequin for anything it cannot parse. Only seats with a NON-NULL
  -- config are listed — the server never invents an avatar (the C5 rule).
  IF v_photo_vis = 'table' AND v_table_id IS NOT NULL THEN
    SELECT COALESCE(jsonb_agg(jsonb_build_object(
      'table', (SELECT t.public_id FROM public.event_tables t WHERE t.table_id = v_table_id),
      'seatNumber', a6.seat_number,
      'config', g6.avatar_config
    ) ORDER BY a6.seat_number), '[]'::jsonb) INTO v_avatars
    FROM public.event_seat_assignments a6
    JOIN public.guests g6 ON g6.guest_id = a6.guest_id AND g6.deleted_at IS NULL
    WHERE a6.event_id = v_event_id AND a6.table_id = v_table_id
      AND g6.avatar_config IS NOT NULL;
  ELSIF v_photo_vis = 'all' THEN
    SELECT COALESCE(jsonb_agg(jsonb_build_object(
      'table', t6.public_id,
      'seatNumber', a6.seat_number,
      'config', g6.avatar_config
    ) ORDER BY t6.public_id, a6.seat_number), '[]'::jsonb) INTO v_avatars
    FROM public.event_seat_assignments a6
    JOIN public.event_tables t6 ON t6.table_id = a6.table_id AND t6.event_id = v_event_id
    JOIN public.guests g6 ON g6.guest_id = a6.guest_id AND g6.deleted_at IS NULL
    WHERE a6.event_id = v_event_id
      AND g6.avatar_config IS NOT NULL;
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
    'you', v_you,
    'avatars', v_avatars
  );
END;
$function$;

COMMENT ON FUNCTION public.public_venue_scene(TEXT, TEXT) IS
  'Guest 3D venue explorer data path. Public/anon-callable, seat-gated (public.guests_may_see_seats: the event day, or the couple''s show-early switch). Returns room geometry + ANONYMISED occupancy always; guest NAMES only for a valid per-guest qr_token and only that token-holder''s own table; photos AND seated avatars (cartoon configs, never photos) under venue_photo_visibility (table = own table with a token, all = everyone, none = nobody); the viewer''s OWN avatar on `you` ungated. Public ids only.';

CREATE OR REPLACE FUNCTION public.public_seat_lookup(p_slug TEXT, p_query TEXT)
RETURNS TABLE(
  display_name    TEXT,
  table_label     TEXT,
  walk_zone_label TEXT,
  walk_video_key  TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
DECLARE
  v_event_id UUID;
  v_nquery   TEXT;   -- normalized query: trimmed, whitespace-collapsed, lower-cased
BEGIN
  -- Anti-enumeration: refuse to answer a 0/1-char probe.
  IF char_length(btrim(COALESCE(p_query, ''))) < 2 THEN
    RETURN;
  END IF;

  -- Normalize the query the same way we normalize each candidate name below,
  -- so "Maria  Santos" and "maria santos" both exact-match "Maria Santos".
  v_nquery := lower(regexp_replace(btrim(p_query), '\s+', ' ', 'g'));

  -- Resolve the wedding by slug (case-insensitive, like every other slug read).
  SELECT e.event_id INTO v_event_id
  FROM public.events e
  WHERE e.slug ILIKE p_slug
    AND e.event_type = 'wedding'
  LIMIT 1;
  IF v_event_id IS NULL THEN
    RETURN;
  END IF;

  -- 🪑 Seat gate (seats_show_on_the_day) — the ONE rule: searchable from the
  -- event's day, or earlier only by the couple's show-early switch.
  IF NOT public.guests_may_see_seats(v_event_id) THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT
    COALESCE(NULLIF(btrim(g.display_name), ''),
             btrim(g.first_name || ' ' || g.last_name))  AS display_name,
    t.table_label                                        AS table_label,
    z.label                                              AS walk_zone_label,
    z.video_r2_key                                       AS walk_video_key
  FROM public.guests g
  JOIN public.event_seat_assignments a
    ON a.guest_id = g.guest_id AND a.event_id = v_event_id
  JOIN public.event_tables t
    ON t.table_id = a.table_id AND t.event_id = v_event_id
  LEFT JOIN public.event_walkthrough_zones z
    ON z.zone_id = t.walkthrough_zone_id
    AND z.event_id = v_event_id
    AND z.published_at IS NOT NULL
    AND z.video_r2_key IS NOT NULL
  WHERE g.event_id = v_event_id
    AND g.deleted_at IS NULL
    -- EXACT full-name match only (own seat) — no substring, no enumeration.
    AND lower(regexp_replace(
          btrim(COALESCE(NULLIF(btrim(g.display_name), ''),
                         g.first_name || ' ' || g.last_name)),
          '\s+', ' ', 'g')) = v_nquery
  ORDER BY 1
  LIMIT 5;
END;
$$;

REVOKE ALL ON FUNCTION public.public_seat_lookup(TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.public_seat_lookup(TEXT, TEXT) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.coordinator_seat_by_guest_qr(
  p_event_id UUID,
  p_token    TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
DECLARE
  v_profile_ids UUID[];
  v_is_coordinator BOOLEAN;
  v_guest_id UUID;
  v_table_label TEXT;
BEGIN
  -- A token is 32 lowercase hex chars (encode(gen_random_bytes(16),'hex')).
  -- Reject anything else before touching a table.
  IF p_token IS NULL OR p_token !~ '^[0-9a-f]{32}$' THEN
    RETURN jsonb_build_object('found', FALSE);
  END IF;

  -- 1 · a vendor identity
  SELECT ARRAY(
    SELECT vp.vendor_profile_id FROM public.vendor_profiles vp WHERE vp.user_id = auth.uid()
    UNION
    SELECT tm.vendor_profile_id FROM public.vendor_team_members tm WHERE tm.user_id = auth.uid()
  ) INTO v_profile_ids;
  IF v_profile_ids IS NULL OR COALESCE(array_length(v_profile_ids, 1), 0) = 0 THEN
    RAISE EXCEPTION 'not_a_vendor' USING ERRCODE = '42501';
  END IF;

  -- 2 + 3 · booked on THIS event, carrying the coordinator tile
  SELECT EXISTS (
    SELECT 1
    FROM public.event_vendors ev
    JOIN public.vendor_profiles vp ON vp.vendor_profile_id = ev.marketplace_vendor_id
    WHERE ev.event_id = p_event_id
      AND ev.marketplace_vendor_id = ANY (v_profile_ids)
      AND ev.status IN ('contracted', 'deposit_paid', 'delivered', 'complete')
      AND 'coordinator' = ANY (vp.services)
  ) INTO v_is_coordinator;
  IF NOT v_is_coordinator THEN
    RAISE EXCEPTION 'not_the_coordinator' USING ERRCODE = '42501';
  END IF;

  -- 4 · THE HOST MUST HAVE SHARED THE SEAT PLAN. This is the owner's rule
  --     (2026-07-27) that booking alone grants nothing: the host picks which
  --     areas a coordinator gets, and revoking the area closes this function
  --     immediately. 'view' suffices — this call never writes.
  IF public.moderator_area_level(p_event_id, 'seat_plan') IS NULL THEN
    RAISE EXCEPTION 'seat_plan_not_shared' USING ERRCODE = '42501';
  END IF;

  -- 5 · guests may see their seats (seats_show_on_the_day): the event's day,
  --     or earlier by the couple's show-early switch — the ONE seat rule.
  IF NOT public.guests_may_see_seats(p_event_id) THEN
    RAISE EXCEPTION 'not_published' USING ERRCODE = 'P0002';
  END IF;

  -- The guest must belong to THIS event. A card from another wedding resolves
  -- to nothing here, which is what makes 'not_this_event' honest.
  SELECT g.guest_id INTO v_guest_id
  FROM public.guests g
  WHERE g.qr_token = p_token
    AND g.event_id = p_event_id
    AND g.deleted_at IS NULL;

  IF v_guest_id IS NULL THEN
    RETURN jsonb_build_object('found', FALSE);
  END IF;

  SELECT et.table_label INTO v_table_label
  FROM public.event_seat_assignments a
  JOIN public.event_tables et ON et.table_id = a.table_id
  WHERE a.event_id = p_event_id AND a.guest_id = v_guest_id;

  -- found=TRUE with a NULL label = on the list, no seat on the published plan.
  RETURN jsonb_build_object('found', TRUE, 'table_label', v_table_label);
END $$;

COMMENT ON FUNCTION public.coordinator_seat_by_guest_qr(UUID, TEXT) IS
  'Find-my-seat for the floor coordinator: given a guest QR token they are physically holding, return that ONE guest''s table label and nothing else — no name, no guest id, no neighbours. Gated on booked + coordinator tile + the seat rule (public.guests_may_see_seats: the event day, or the couple''s show-early switch). Adds no table, column or policy: a booked vendor still cannot read guests, seat assignments or tables directly (get_vendor_seat_plan gives them counts, never people).';

REVOKE ALL ON FUNCTION public.coordinator_seat_by_guest_qr(UUID, TEXT)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.coordinator_seat_by_guest_qr(UUID, TEXT) TO authenticated;

COMMIT;
