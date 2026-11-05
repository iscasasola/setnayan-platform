-- suppliers_see_seats_on_the_day
-- Created via `pnpm migration:new`. Idempotent (CREATE OR REPLACE FUNCTION only). No table, no grant, no row changes.
--
-- 🪑 A BOOKED SUPPLIER SEES THE SEAT PLAN ON THE DAY, LIKE THE GUESTS DO (supplier go-live audit E2, 2026-11-02).
-- Owner 2026-09-30, verbatim: "seatplan will show on the date of the event". `20271254054934_seats_show_on_the_day`
-- made ONE rule of it — `public.guests_may_see_seats(event_id)`: from 00:00 Manila on a day-precise event date, or
-- earlier when the couple turned on "Show guests their seats early" — and moved the three GUEST seat readers and
-- the coordinator's scan onto it. The two SUPPLIER readers were left asking the switch alone, so on the event day a
-- booked caterer or venue whose couple never flipped "early" was still told `not_published` — the one day the plan
-- matters most to them — while every guest at the door could already see their table.
--
--   get_vendor_seat_plan   — the gate `v_plan.published_at IS NULL` → `NOT public.guests_may_see_seats(p_event_id)`.
--                            A missing floor-plan row (NOT FOUND) still answers `not_published`: there is nothing to draw.
--   get_vendor_event_brief — the seat-plan card's `'published'` asks the same rule (the "Published" pill and the
--                            "Open the seat plan" door on the client page follow it).
--
-- ── THE BODIES BELOW ARE THE LATEST DEFINITIONS, EDITED ONLY AT THE GATE ────────────────────────────────────────
-- Both are copied by script from `20271302857885_a_guest_not_counted_for_a_service.sql`, the latest migration that
-- defines either (`grep -l "FUNCTION public.get_vendor_seat_plan\|FUNCTION public.get_vendor_event_brief"
-- supabase/migrations/*.sql`), with only the lines marked 🪑 changed. Every other gate (the fee gate, not_a_vendor,
-- not_booked, category_not_floor, the brief's withholding) is untouched.
--
-- Grants: unchanged — CREATE OR REPLACE keeps a function's existing grants. `guests_may_see_seats` stays callable by
-- no client role; both readers are SECURITY DEFINER and reach it as their owner, exactly as the guest functions do.

BEGIN;

CREATE OR REPLACE FUNCTION public.get_vendor_seat_plan(p_event_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
DECLARE
  v_profile_ids         UUID[];
  v_booked_categories   TEXT[];
  v_my_event_vendor_ids UUID[];
  v_not_counted         UUID[];
  v_floor_allowed       BOOLEAN;
  v_dietary_allowed     BOOLEAN;
  v_plan                RECORD;
  v_tables              JSONB;
  v_objects             JSONB;
BEGIN
  -- ── ⛔ THE BOOKING FEE UNLOCKS THE EVENT — IN SQL (2026-09-20) ────────────
  -- Mirrors the page gate #5738 put in front of this RPC's ONLY caller. The
  -- switch is `platform_settings.fee_unlocks_event_enforced`; while it is NULL
  -- or FALSE this call returns 'unlocked' and the line below is a no-op, so the
  -- function is byte-identical to today. `TRUE` is the `booked` argument
  -- because `resolveEventFeeGate` is called here with its default (booked),
  -- exactly as the page does.
  IF public.vendor_event_fee_gate_stage(p_event_id, TRUE) <> 'unlocked' THEN
    RAISE EXCEPTION 'fee_unsettled' USING ERRCODE = '42501';
  END IF;

  SELECT ARRAY(
    SELECT vp.vendor_profile_id FROM public.vendor_profiles vp WHERE vp.user_id = auth.uid()
    UNION
    SELECT tm.vendor_profile_id FROM public.vendor_team_members tm WHERE tm.user_id = auth.uid()
  ) INTO v_profile_ids;
  IF v_profile_ids IS NULL OR COALESCE(array_length(v_profile_ids, 1), 0) = 0 THEN
    RAISE EXCEPTION 'not_a_vendor' USING ERRCODE = '42501';
  END IF;

  SELECT ARRAY_AGG(DISTINCT ev.category::TEXT), ARRAY_AGG(ev.vendor_id)
  INTO v_booked_categories, v_my_event_vendor_ids
  FROM public.event_vendors ev
  WHERE ev.event_id = p_event_id
    AND ev.marketplace_vendor_id = ANY (v_profile_ids)
    AND ev.status IN ('contracted', 'deposit_paid', 'delivered', 'complete');
  IF v_booked_categories IS NULL THEN
    RAISE EXCEPTION 'not_booked' USING ERRCODE = '42501';
  END IF;

  -- 🍽 Guests the couple marked "Not counted for" EVERY one of this supplier's booked services (20271302857885).
  v_not_counted := public.guests_not_counted_for_services(p_event_id, v_my_event_vendor_ids);

  v_floor_allowed := v_booked_categories && ARRAY[
    'venue', 'catering', 'cake_maker', 'mobile_bar', 'photobooth',
    'led_screens', 'lights_and_sound', 'reception_decor', 'florist',
    'photographer', 'videographer', 'host_emcee', 'band_dj',
    'string_quartet', 'choir', 'planner_coordinator',
    'gown_designer', 'suit_designer', 'makeup_artist', 'hair_stylist',
    'security'
  ];
  IF NOT v_floor_allowed THEN
    RAISE EXCEPTION 'category_not_floor' USING ERRCODE = '42501';
  END IF;

  v_dietary_allowed := v_booked_categories
    && ARRAY['catering', 'cake_maker', 'mobile_bar', 'venue', 'planner_coordinator'];

  SELECT * INTO v_plan FROM public.event_floor_plan WHERE event_id = p_event_id;
  -- 🪑 suppliers_see_seats_on_the_day: the ONE seat rule, not the switch alone.
  IF NOT FOUND OR NOT public.guests_may_see_seats(p_event_id) THEN
    RAISE EXCEPTION 'not_published' USING ERRCODE = 'P0002';
  END IF;

  SELECT COALESCE(jsonb_agg(t ORDER BY (t ->> 'sort_order')::INT), '[]'::jsonb)
  INTO v_tables
  FROM (
    SELECT jsonb_build_object(
      'table_id', et.table_id,
      'label', et.table_label,
      'table_type', et.table_type::TEXT,
      'capacity', et.capacity,
      'x', et.x_pos,
      'y', et.y_pos,
      'rotation_deg', et.rotation_deg,
      'sort_order', et.sort_order,
      'seated', (
        SELECT COUNT(*) FROM public.event_seat_assignments a
        WHERE a.table_id = et.table_id
      ),
      'meal_counts', CASE WHEN v_dietary_allowed THEN (
        SELECT COALESCE(jsonb_object_agg(m.pref, m.n), '{}'::jsonb)
        FROM (
          SELECT g.meal_preference::TEXT AS pref, COUNT(*) AS n
          FROM public.event_seat_assignments a
          JOIN public.guests g ON g.guest_id = a.guest_id AND g.deleted_at IS NULL AND g.entry_source <> 'self_added_unlisted' AND NOT g.passed_away AND g.represented_by_guest_id IS NULL AND g.guest_id <> ALL (v_not_counted)
          WHERE a.table_id = et.table_id
          GROUP BY g.meal_preference
        ) m
      ) ELSE NULL END
    ) AS t
    FROM public.event_tables et
    WHERE et.event_id = p_event_id
  ) sub;

  -- Booths across the whole blueprint (reception + cocktail), zone-tagged; the
  -- caller's own booths flagged via their booked event_vendor ids.
  SELECT COALESCE(jsonb_agg(o ORDER BY (o ->> 'label')), '[]'::jsonb)
  INTO v_objects
  FROM (
    SELECT jsonb_build_object(
      'object_id', b.booth_id,
      'zone', b.zone,
      'object_type', b.booth_type,
      'label', b.label,
      'x', b.x_pos,
      'y', b.y_pos,
      'is_mine', b.event_vendor_id = ANY (v_my_event_vendor_ids),
      'vendor_name', (
        SELECT ev2.vendor_name FROM public.event_vendors ev2
        WHERE ev2.vendor_id = b.event_vendor_id
      )
    ) AS o
    FROM public.event_floor_booths b
    WHERE b.event_id = p_event_id
  ) sub;

  RETURN jsonb_build_object(
    'published_at', v_plan.published_at,
    'venue', jsonb_build_object(
      'width_m', v_plan.venue_width_m,
      'length_m', v_plan.venue_length_m
    ),
    'stage', jsonb_build_object(
      'x', v_plan.stage_x, 'y', v_plan.stage_y,
      'w', v_plan.stage_w, 'h', v_plan.stage_h
    ),
    'dance', CASE WHEN v_plan.dance_enabled THEN jsonb_build_object(
      'x', v_plan.dance_x, 'y', v_plan.dance_y,
      'w', v_plan.dance_w, 'h', v_plan.dance_h
    ) ELSE NULL END,
    'entrance', CASE WHEN v_plan.entrance_enabled THEN jsonb_build_object(
      'x', v_plan.entrance_x, 'y', v_plan.entrance_y
    ) ELSE NULL END,
    'service_entrance', CASE WHEN v_plan.service_entrance_enabled THEN jsonb_build_object(
      'x', v_plan.service_entrance_x, 'y', v_plan.service_entrance_y
    ) ELSE NULL END,
    'cocktail', CASE WHEN v_plan.cocktail_enabled THEN jsonb_build_object(
      'label', v_plan.cocktail_label,
      'x', v_plan.cocktail_x, 'y', v_plan.cocktail_y,
      'w', v_plan.cocktail_w, 'h', v_plan.cocktail_h,
      'venue', jsonb_build_object('width_m', v_plan.cocktail_width_m, 'length_m', v_plan.cocktail_length_m),
      'window', (
        SELECT jsonb_build_object('label', sb.label, 'start_at', sb.start_at, 'end_at', sb.end_at)
        FROM public.event_schedule_blocks sb
        WHERE sb.block_id = v_plan.cocktail_schedule_block_id
      )
    ) ELSE NULL END,
    'dietary_included', v_dietary_allowed,
    'tables', v_tables,
    'objects', v_objects
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.get_vendor_event_brief(p_event_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
DECLARE
  v_profile_ids       UUID[];
  v_booked_categories TEXT[];
  v_my_categories     TEXT[];
  v_my_booked_ids     UUID[];
  v_not_counted       UUID[];
  v_lock_request      JSONB;
  v_stage             TEXT;
  v_dietary_allowed   BOOLEAN;
  v_event             RECORD;
  v_pax               JSONB;
  v_dietary           JSONB;
  v_timeline          JSONB;
  v_seat_plan         JSONB;
  v_share_budget      BOOLEAN;
  v_budget_band       JSONB;
  v_finalized         BOOLEAN;
  v_vendor_roster     JSONB;
  v_payload           JSONB;
  v_fee_stage         TEXT;
  v_withheld          TEXT[];
BEGIN
  -- 1 · Resolve the caller's vendor org(s): profile owner or team member.
  SELECT ARRAY(
    SELECT vp.vendor_profile_id
    FROM public.vendor_profiles vp
    WHERE vp.user_id = auth.uid()
    UNION
    SELECT tm.vendor_profile_id
    FROM public.vendor_team_members tm
    WHERE tm.user_id = auth.uid()
  ) INTO v_profile_ids;

  IF v_profile_ids IS NULL OR COALESCE(array_length(v_profile_ids, 1), 0) = 0 THEN
    RAISE EXCEPTION 'not_a_vendor' USING ERRCODE = '42501';
  END IF;

  -- 2 · Stage gate. The LABEL still distinguishes the rungs (callers gate
  -- behaviour on 'booked'); the PAYLOAD no longer does.
  SELECT ARRAY_AGG(DISTINCT ev.category::TEXT), ARRAY_AGG(ev.vendor_id)
  INTO v_booked_categories, v_my_booked_ids
  FROM public.event_vendors ev
  WHERE ev.event_id = p_event_id
    AND ev.marketplace_vendor_id = ANY (v_profile_ids)
    AND ev.status IN ('contracted', 'deposit_paid', 'delivered', 'complete');

  IF v_booked_categories IS NOT NULL THEN
    v_stage := 'booked';
  ELSIF EXISTS (
    -- The couple has ASKED and this supplier has not answered.
    SELECT 1 FROM public.event_vendors ev
    WHERE ev.event_id = p_event_id
      AND ev.marketplace_vendor_id = ANY (v_profile_ids)
      AND ev.lock_request_state = 'pending'
      AND ev.archived_at IS NULL
  ) THEN
    v_stage := 'requested';
  ELSIF EXISTS (
    -- An accepted thread (unchanged from before — archived or not), or a
    -- pending one that is still live.
    SELECT 1 FROM public.chat_threads t
    WHERE t.event_id = p_event_id
      AND t.vendor_profile_id = ANY (v_profile_ids)
      AND (
        t.inquiry_status = 'accepted'
        OR (t.inquiry_status = 'pending' AND t.archived_at IS NULL)
      )
  ) OR EXISTS (
    -- Any live link row for this org on this event: considering, shortlisted,
    -- or an ask that was declined / lapsed. Archived = the couple removed them.
    SELECT 1 FROM public.event_vendors ev
    WHERE ev.event_id = p_event_id
      AND ev.marketplace_vendor_id = ANY (v_profile_ids)
      AND ev.archived_at IS NULL
  ) THEN
    v_stage := 'inquiry';
  ELSE
    RAISE EXCEPTION 'not_booked' USING ERRCODE = '42501';
  END IF;

  -- The categories this org is on the event under. Booked → the locked rows
  -- (unchanged). Before agreement → every link row for this org + event, as
  -- the pre-agreement payload has always derived them.
  IF v_stage = 'booked' THEN
    v_my_categories := v_booked_categories;
  ELSE
    SELECT ARRAY_AGG(DISTINCT ev.category::TEXT) INTO v_my_categories
    FROM public.event_vendors ev
    WHERE ev.event_id = p_event_id
      AND ev.marketplace_vendor_id = ANY (v_profile_ids);
  END IF;

  SELECT e.display_name, e.event_date, e.venue_name, e.venue_address, e.region,
         e.ceremony_type, e.role_palette,
         e.monogram_text, e.monogram_color, e.monogram_font_key,
         e.monogram_frame_key, e.monogram_custom_svg, e.share_budget_band,
         e.guest_count_locked_at, e.guest_list_edit_deadline
  INTO v_event
  FROM public.events e
  WHERE e.event_id = p_event_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'event_not_found' USING ERRCODE = 'P0002';
  END IF;

  v_share_budget := COALESCE(v_event.share_budget_band, FALSE);

  -- 🍽 Guests the couple marked "Not counted for" EVERY one of this supplier's BOOKED services (20271302857885).
  -- Before agreement nothing is booked, so nobody is left out (the guest card lists booked services only).
  v_not_counted := public.guests_not_counted_for_services(p_event_id, v_my_booked_ids);

  -- ==========================================================================
  -- FINALIZED FLAG — mirrors `guestListIsClosed()` in
  -- apps/web/lib/guest-list-closed.ts EXACTLY: finalized means the HOST pressed
  -- Finalize (the stamp is written). No date finalizes anything any more
  -- (owner 2026-09-30, "i must click a finalize to finalize it").
  -- ==========================================================================
  v_finalized := (v_event.guest_count_locked_at IS NOT NULL);

  -- 3 · Pax counts (every rung — quote inputs). Soft-deleted rows excluded.
  -- 'finalized' added alongside the counts — a state flag over data already
  -- exposed, never a new number.
  SELECT jsonb_build_object(
    'invited',   COUNT(*),
    'attending', COUNT(*) FILTER (WHERE g.rsvp_status = 'attending'),
    'maybe',     COUNT(*) FILTER (WHERE g.rsvp_status = 'maybe'),
    'pending',   COUNT(*) FILTER (WHERE g.rsvp_status = 'pending'),
    'declined',  COUNT(*) FILTER (WHERE g.rsvp_status = 'declined'),
    'finalized', v_finalized
  ) INTO v_pax
  FROM public.guests g
  WHERE g.event_id = p_event_id AND g.deleted_at IS NULL AND g.entry_source <> 'self_added_unlisted' AND NOT g.passed_away AND g.represented_by_guest_id IS NULL AND g.guest_id <> ALL (v_not_counted);

  -- ==========================================================================
  -- BUDGET BAND — arithmetic byte-for-byte 20271213732174 (see that migration
  -- and 20270508637171 for the band derivation). Gated on share_budget_band.
  -- ==========================================================================
  IF v_share_budget THEN
    DECLARE
      v_categories TEXT[];
      v_alloc_php  BIGINT;
      v_step       BIGINT;
      v_lo         BIGINT;
      v_hi         BIGINT;
    BEGIN
      v_categories := v_my_categories;

      IF v_categories IS NOT NULL AND array_length(v_categories, 1) > 0 THEN
        -- Sum the couple's LATEST-snapshot allocation across the plan-group
        -- leaf(ies) that the vendor's category(ies) map to. The reverse map
        -- (vendor_category → plan_group leaf id) is the canonical one from
        -- lib/wedding-plan-groups.ts PLAN_GROUP.categories, inlined as a VALUES
        -- lookup so this stays a single, self-contained SECURITY DEFINER fn.
        WITH cat_to_leaf(category, plan_group) AS (
          VALUES
            ('religious_venue',        'ceremony_venue'),
            ('church_fees',            'ceremony_venue'),
            ('venue',                  'reception_venue'),
            ('planner_coordinator',    'coordinator'),
            ('officiant',              'officiant'),
            ('catering',               'catering'),
            ('crew_meals',             'crew_meals'),
            ('photographer',           'photography'),
            ('videographer',           'photography'),
            ('gown_designer',          'attire'),
            ('suit_designer',          'attire'),
            ('makeup_artist',          'hair_makeup'),
            ('hair_stylist',           'hair_makeup'),
            ('florist',                'florals_decor'),
            ('reception_decor',        'florals_decor'),
            ('band_dj',                'music_entertainment'),
            ('string_quartet',         'music_entertainment'),
            ('choir',                  'music_entertainment'),
            ('host_emcee',             'host_mc'),
            ('lights_and_sound',       'lights_sound'),
            ('led_screens',            'led_background'),
            ('mobile_bar',             'cocktail_booths'),
            ('photobooth',             'photobooth'),
            ('cake_maker',             'cake'),
            ('transportation',         'bridal_car'),
            ('transportation',         'logistics'),
            ('rings',                  'rings'),
            ('invitations_stationery', 'invitations_stationery'),
            ('security',               'logistics'),
            ('gifts_and_giveaways',    'logistics'),
            ('misc',                   'logistics')
        ),
        latest AS (
          -- The couple's most recent saved plan snapshot for this event.
          SELECT bad.snapshot_id
          FROM public.budget_allocation_decisions bad
          WHERE bad.event_id = p_event_id
          ORDER BY bad.recorded_at DESC
          LIMIT 1
        ),
        matched_leaves AS (
          -- DISTINCT so a leaf shared by two of the vendor's categories (e.g. a
          -- photo+video vendor both mapping to 'photography') is counted ONCE.
          SELECT DISTINCT c2l.plan_group
          FROM cat_to_leaf c2l
          WHERE c2l.category = ANY (v_categories)
        )
        SELECT COALESCE(SUM(bad.final_amount_php), 0)::BIGINT INTO v_alloc_php
        FROM public.budget_allocation_decisions bad
        JOIN latest l ON bad.snapshot_id = l.snapshot_id
        JOIN matched_leaves ml ON bad.canonical_service = ml.plan_group
        WHERE bad.event_id = p_event_id
          AND bad.final_amount_php IS NOT NULL
          AND bad.final_amount_php > 0;

        IF v_alloc_php IS NOT NULL AND v_alloc_php > 0 THEN
          -- step = 20% of alloc, rounded to nearest ₱5,000, floored at ₱5,000.
          v_step := GREATEST(
            (ROUND((v_alloc_php * 0.20) / 5000.0) * 5000)::BIGINT,
            5000::BIGINT
          );
          -- lo/hi bracket alloc strictly (alloc never lands on a boundary).
          v_lo := ((CEIL(v_alloc_php::NUMERIC / v_step) - 1) * v_step)::BIGINT;
          v_hi := ((FLOOR(v_alloc_php::NUMERIC / v_step) + 1) * v_step)::BIGINT;
          IF v_lo < 0 THEN v_lo := 0; END IF;
          v_budget_band := jsonb_build_object(
            'lo_centavos', v_lo * 100,
            'hi_centavos', v_hi * 100
          );
        END IF;
      END IF;
    END;
  END IF;

  -- The ask envelope: facts about the supplier's own row only. 'requested' only.
  IF v_stage = 'requested' THEN
    SELECT jsonb_build_object(
      'event_vendor_id', ev.vendor_id,
      'category',        ev.category::TEXT,
      'requested_at',    ev.lock_requested_at,
      'expires_at',      ev.lock_request_expires_at
    ) INTO v_lock_request
    FROM public.event_vendors ev
    WHERE ev.event_id = p_event_id
      AND ev.marketplace_vendor_id = ANY (v_profile_ids)
      AND ev.lock_request_state = 'pending'
      AND ev.archived_at IS NULL
    ORDER BY ev.lock_requested_at NULLS LAST
    LIMIT 1;
  END IF;

  -- Dietary counts: food-relevant categories + coordinator only (§ 7 matrix),
  -- on the categories this org is on the event under, at every rung.
  v_dietary_allowed := COALESCE(
    v_my_categories && ARRAY['catering', 'cake_maker', 'mobile_bar', 'venue', 'planner_coordinator'],
    FALSE
  );

  -- 4 · Dietary/meal rollup (attending guests only; counts, never names).
  IF v_dietary_allowed THEN
    SELECT jsonb_build_object(
      'meal_counts', COALESCE(jsonb_object_agg(m.pref, m.n) FILTER (WHERE m.pref IS NOT NULL), '{}'::jsonb),
      'restriction_notes', (
        SELECT COUNT(*) FROM public.guests g2
        WHERE g2.event_id = p_event_id AND g2.deleted_at IS NULL AND g2.entry_source <> 'self_added_unlisted' AND NOT g2.passed_away AND g2.represented_by_guest_id IS NULL AND g2.guest_id <> ALL (v_not_counted)
          AND g2.rsvp_status = 'attending'
          AND NULLIF(TRIM(g2.dietary_restrictions), '') IS NOT NULL
      )
    ) INTO v_dietary
    FROM (
      SELECT g.meal_preference::TEXT AS pref, COUNT(*) AS n
      FROM public.guests g
      WHERE g.event_id = p_event_id AND g.deleted_at IS NULL AND g.entry_source <> 'self_added_unlisted' AND NOT g.passed_away AND g.represented_by_guest_id IS NULL AND g.guest_id <> ALL (v_not_counted)
        AND g.rsvp_status = 'attending'
      GROUP BY g.meal_preference
    ) m;
  END IF;

  -- 5 · Day-of timeline: every rung since 20271235469220;
  -- couple-private `notes` excluded.
  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'label', b.label,
      'block_type', b.block_type,
      'start_at', b.start_at,
      'end_at', b.end_at,
      'location', b.location
    ) ORDER BY b.start_at NULLS LAST, b.sort_order
  ), '[]'::jsonb) INTO v_timeline
  FROM public.event_schedule_blocks b
  WHERE b.event_id = p_event_id
    -- A coordinator's unreleased prep is visible to the coordinator ONLY
    -- (20270901120000: "excluded from couple/public/booked-vendor reads").
    -- This SECURITY DEFINER select never applied that, so booked suppliers
    -- could read staged lines through the brief. Closed here for every rung,
    -- before the door widens to suppliers who have not agreed to anything.
    AND b.visibility <> 'coordinator_only';

  -- 6 · Seat plan: publication status + size, never the layout itself
  -- (the read-only viewer is Phase 4).
  SELECT jsonb_build_object(
    -- 🪑 suppliers_see_seats_on_the_day: the ONE seat rule, not the switch alone.
    'published', public.guests_may_see_seats(p_event_id),
    'published_at', fp.published_at,
    'table_count', (SELECT COUNT(*) FROM public.event_tables t WHERE t.event_id = p_event_id),
    'assigned_guests', (SELECT COUNT(*) FROM public.event_seat_assignments a WHERE a.event_id = p_event_id)
  ) INTO v_seat_plan
  FROM public.event_floor_plan fp
  WHERE fp.event_id = p_event_id;

  IF v_seat_plan IS NULL THEN
    v_seat_plan := jsonb_build_object(
      'published', FALSE,
      'published_at', NULL,
      'table_count', (SELECT COUNT(*) FROM public.event_tables t WHERE t.event_id = p_event_id),
      'assigned_guests', (SELECT COUNT(*) FROM public.event_seat_assignments a WHERE a.event_id = p_event_id)
    );
  END IF;

  -- 7 · Vendor roster — the OTHER vendors locked on this event, name +
  -- category only. Same locked-status vocabulary the stage gate above already
  -- uses. The caller's own row(s) are excluded (they already know their own
  -- booking); non-marketplace vendors (marketplace_vendor_id NULL) are
  -- included, since they are still "another vendor locked on this event".
  SELECT COALESCE(jsonb_agg(
    jsonb_build_object('vendor_name', r.vendor_name, 'category', r.category)
    ORDER BY r.category, r.vendor_name
  ), '[]'::jsonb) INTO v_vendor_roster
  FROM (
    SELECT DISTINCT ev.category::TEXT AS category,
           COALESCE(ev.vendor_name, 'Vendor') AS vendor_name
    FROM public.event_vendors ev
    WHERE ev.event_id = p_event_id
      AND ev.status IN ('contracted', 'deposit_paid', 'delivered', 'complete')
      AND (ev.marketplace_vendor_id IS NULL OR ev.marketplace_vendor_id <> ALL (v_profile_ids))
  ) r;

  v_payload := jsonb_build_object(
    'stage', v_stage,
    'event', jsonb_build_object(
      'display_name', v_event.display_name,
      'event_date', v_event.event_date,
      'venue_name', v_event.venue_name,
      'venue_address', v_event.venue_address,
      'region', v_event.region,
      'ceremony_type', v_event.ceremony_type
    ),
    'booked_categories', COALESCE(to_jsonb(v_my_categories), '[]'::jsonb),
    'pax', v_pax,
    'dietary', v_dietary,  -- NULL when the caller's categories aren't food-relevant
    'budget_band', v_budget_band,
    'palette', COALESCE(v_event.role_palette, '{}'::jsonb),
    -- attire_guide: SHAPE-PRESERVING CONSTANT. See 20271198063551's header.
    'attire_guide', '{}'::jsonb,
    'monogram', jsonb_build_object(
      'text', v_event.monogram_text,
      'color', v_event.monogram_color,
      'font_key', v_event.monogram_font_key,
      'frame_key', v_event.monogram_frame_key,
      'custom_svg', v_event.monogram_custom_svg
    ),
    'timeline', v_timeline,
    'seat_plan', v_seat_plan,
    'vendor_roster', v_vendor_roster
  );

  -- Before agreement: the ask envelope is added (null at 'inquiry'), and the
  -- vendor ROSTER is removed. The roster names OTHER shops; the owner granted
  -- a pre-agreement supplier the locked CATEGORIES (2026-09-08), not who holds
  -- them, and this change carries no other shop's data. Booked payload
  -- unchanged: roster present, no lock_request key.
  IF v_stage <> 'booked' THEN
    v_payload := (v_payload - 'vendor_roster')
      || jsonb_build_object('lock_request', v_lock_request);
  END IF;


  -- ==========================================================================
  -- ⛔ THE BOOKING FEE UNLOCKS THE EVENT — THE FIELD RULE, IN SQL (2026-09-20)
  -- ==========================================================================
  -- `redactBriefForStage` (apps/web/lib/event-access-stage.ts) narrows exactly
  -- these five fields for a supplier whose booking fee is not settled. Until
  -- now it narrowed them ON THE PAGE, and this SECURITY DEFINER function handed
  -- every one of them to anybody who called the RPC from their own browser
  -- session. The rule now lives here too, and the two are driven from ONE table
  -- of cases in `apps/web/tests/db/the-brief-is-sealed-in-sql.db.test.ts`.
  --
  -- 🔑 EVERY REDACTION IS SHAPE-PRESERVING, so a withheld field looks EXACTLY
  -- like a wedding with nothing planned. That is why `withheld` is added to the
  -- payload: the narrowing announces itself, and the screen can say "withheld"
  -- instead of drawing an empty wedding. The key is ABSENT when nothing was
  -- narrowed, so an unenforced payload is byte-identical to yesterday's.
  v_fee_stage := public.vendor_event_fee_gate_stage(p_event_id, v_stage = 'booked');

  IF v_fee_stage <> 'unlocked' THEN
    v_withheld := ARRAY[]::TEXT[];

    -- venue — `VENUE_WHILE_QUOTING = 'area_only'`. `region` and `ceremony_type`
    -- survive: the AREA is a stage-1 pricing input, the exact address is not.
    IF jsonb_typeof(v_payload #> '{event,venue_name}') <> 'null'
       OR jsonb_typeof(v_payload #> '{event,venue_address}') <> 'null' THEN
      v_withheld := v_withheld || 'venue'::TEXT;
    END IF;
    v_payload := jsonb_set(
      jsonb_set(v_payload, '{event,venue_name}', 'null'::jsonb, TRUE),
      '{event,venue_address}', 'null'::jsonb, TRUE);

    -- dietary (meal counts)
    IF jsonb_typeof(v_payload -> 'dietary') <> 'null' THEN
      v_withheld := v_withheld || 'dietary'::TEXT;
    END IF;
    v_payload := jsonb_set(v_payload, '{dietary}', 'null'::jsonb, TRUE);

    -- the day-of timeline
    IF jsonb_typeof(v_payload -> 'timeline') = 'array'
       AND jsonb_array_length(v_payload -> 'timeline') > 0 THEN
      v_withheld := v_withheld || 'timeline'::TEXT;
    END IF;
    v_payload := jsonb_set(v_payload, '{timeline}', '[]'::jsonb, TRUE);

    -- seat-plan status + size
    IF COALESCE((v_payload #>> '{seat_plan,table_count}')::BIGINT, 0) > 0
       OR COALESCE((v_payload #>> '{seat_plan,assigned_guests}')::BIGINT, 0) > 0 THEN
      v_withheld := v_withheld || 'seat_plan'::TEXT;
    END IF;
    v_payload := jsonb_set(v_payload, '{seat_plan}', jsonb_build_object(
      'published', FALSE,
      'published_at', NULL,
      'table_count', 0,
      'assigned_guests', 0
    ), TRUE);

    -- the couple's monogram
    IF EXISTS (
      SELECT 1 FROM jsonb_each_text(v_payload -> 'monogram') AS m(k, v)
      WHERE m.v IS NOT NULL AND m.v <> ''
    ) THEN
      v_withheld := v_withheld || 'monogram'::TEXT;
    END IF;
    v_payload := jsonb_set(v_payload, '{monogram}', jsonb_build_object(
      'text', NULL,
      'color', NULL,
      'font_key', NULL,
      'frame_key', NULL,
      'custom_svg', NULL
    ), TRUE);

    v_payload := v_payload || jsonb_build_object('withheld', to_jsonb(v_withheld));
  END IF;

  RETURN v_payload;
END;
$$;

COMMIT;
