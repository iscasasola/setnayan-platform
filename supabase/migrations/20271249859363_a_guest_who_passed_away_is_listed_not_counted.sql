-- a_guest_who_passed_away_is_listed_not_counted
-- Created via `pnpm migration:new`. Idempotent (ADD COLUMN IF NOT EXISTS +
-- CREATE OR REPLACE only). NO EXISTING ROW CHANGES MEANING — every row reads
-- `passed_away = false`, which is what every row already was.
--
-- 🕯 LISTED, NEVER COUNTED (owner, 2026-09-25, DECISION_LOG "PRINT CONTENT
-- COMES FROM WHERE IT ALREADY LIVES", verbatim: *"Parent's names should be on
-- the guest list and a button of passed can be placed there … If passed away
-- already, then not counted on the guestlist. but listed."*). The couple marks
-- a guest "Passed away" on the guest card. That person:
--   · stays on the guest list (the roster draws them) and on the entourage;
--   · prints as "the late <name>" in the parents' lines of the invitation;
--   · is never counted — headcount, final pax, RSVP totals, the caterer's
--     numbers, the supplier brief, the seat plan, the Papic pool's divisor;
--   · is never seated and never sent an invitation or a Save the Date.
--
-- 🔑 WHY A NEW COLUMN (RULE 0.3 — a flag flip beats new schema; searched first):
--   · `people.in_memoriam` (20270523457332) is the Life Story ✦ flag on the
--     PERSON SPINE — a user's own opt-in about someone in THEIR graph, reached
--     from a guest only through `guests.person_id`, which is auto-resolved for
--     EMAIL guests only. A parent on a guest list almost never has an email, so
--     that flag is unreachable for exactly the rows this is for; and a couple
--     marking a parent here must not write into anyone's Life Story.
--   · `entry_source` is WHY a row is on the list (the couple's own vs a
--     request). Overloading it would move the person into Requests and out of
--     the roster — hidden, which is the opposite of "listed".
--   · `rsvp_status` is the guest's own ANSWER, and a declined guest is still
--     a living person the couple may seat, send to and count as declined.
--   · `lib/print-guest-registry.ts` already reserved this exact name
--     (`passed_away`, "🪝 THE PASSED AWAY HOOK … No such column exists yet").
--
-- NOT NULL DEFAULT FALSE is honest here: "not marked" IS false, and there is no
-- BEFORE INSERT trigger on guests that tests this column (see memory: a NOT
-- NULL DEFAULT is a write nobody made — it only bites a trigger that tests
-- `IS NOT NULL`).
--
-- GRANTS: `public.guests` carries TABLE-level grants (verified 2026-09-20 in
-- 20271236109974 — every column × 4 privileges for anon, authenticated,
-- postgres, service_role), so the column inherits exactly what `rsvp_status`
-- has; a column-level GRANT would be a no-op that reads like a decision. Who
-- may WRITE it is the table's existing RLS: `couple_writes_guest` and the
-- granted-moderator `guests_moderator_write` — a guest only ever READS their
-- own row (`guest_reads_own_row`), so nobody can mark themselves.
--
-- ── THE SQL READERS ─────────────────────────────────────────────────────────
-- The four functions below are their LATEST definitions — copied VERBATIM from
-- 20271249183421 (the request rule, itself copied from their latest), with ONE
-- change: every read of `public.guests` that says
--     <alias>.entry_source <> 'self_added_unlisted'
-- now also says
--     AND NOT <alias>.passed_away
-- Nothing else in any body moved (the copy was made by a script, not by hand).
--   · get_vendor_seat_plan        — the seated meal mix per table
--   · get_vendor_catering_metrics — invited / confirmed / meal / per-block pax
--   · get_vendor_event_brief      — the supplier's pax + dietary
--   · papic_event_guest_headcount — the Papic pool's per-guest divisor
-- The TS readers apply the same rule — `countsTowardEvent` and the default
-- read of `fetchGuestsByEventMeasured` in apps/web/lib/guests.ts.

ALTER TABLE public.guests
  ADD COLUMN IF NOT EXISTS passed_away BOOLEAN NOT NULL DEFAULT FALSE;

COMMENT ON COLUMN public.guests.passed_away IS
  'The couple marked this guest "Passed away" on the guest card. LISTED (roster, entourage; printed as "the late <name>" in the parents'' lines) but NEVER COUNTED (headcount, pax, RSVP totals, caterer, supplier brief, seat plan, Papic pool), never seated, never sent an invitation. Written only by the guest card (updateGuest); a guest cannot write their own row. Not people.in_memoriam (the Life Story flag on the person spine).';

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
  IF NOT FOUND OR v_plan.published_at IS NULL THEN
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
          JOIN public.guests g ON g.guest_id = a.guest_id AND g.deleted_at IS NULL AND g.entry_source <> 'self_added_unlisted' AND NOT g.passed_away
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

CREATE OR REPLACE FUNCTION public.get_vendor_catering_metrics(p_event_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
DECLARE
  v_profile_ids       UUID[];
  v_booked_categories TEXT[];
  v_event_date        DATE;
  v_confirmed         INTEGER;
  v_maybe             INTEGER;
  v_pending           INTEGER;
  v_declined          INTEGER;
  v_invited           INTEGER;
  v_meal_counts       JSONB;
  v_per_block         JSONB;
  v_as_of             TIMESTAMPTZ;
  v_restrictions      INTEGER;
  v_is_final          BOOLEAN;
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

  -- Caller's vendor org(s): profile owner or team member (same resolution
  -- as get_vendor_event_brief).
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

  -- Booked gate (access keys on BOOKED status).
  SELECT ARRAY_AGG(DISTINCT ev.category::TEXT) INTO v_booked_categories
  FROM public.event_vendors ev
  WHERE ev.event_id = p_event_id
    AND ev.marketplace_vendor_id = ANY (v_profile_ids)
    AND ev.status IN ('contracted', 'deposit_paid', 'delivered', 'complete');

  IF v_booked_categories IS NULL THEN
    RAISE EXCEPTION 'not_booked' USING ERRCODE = '42501';
  END IF;

  -- Food-category gate — same matrix as the Brief's dietary section.
  IF NOT (v_booked_categories
          && ARRAY['catering', 'cake_maker', 'mobile_bar', 'venue', 'planner_coordinator']) THEN
    RAISE EXCEPTION 'not_food_relevant' USING ERRCODE = '42501';
  END IF;

  SELECT e.event_date INTO v_event_date
  FROM public.events e WHERE e.event_id = p_event_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'event_not_found' USING ERRCODE = 'P0002';
  END IF;

  -- One pass over guests: counts only, soft-deleted rows excluded.
  SELECT
    COUNT(*),
    COUNT(*) FILTER (WHERE g.rsvp_status = 'attending'),
    COUNT(*) FILTER (WHERE g.rsvp_status = 'maybe'),
    COUNT(*) FILTER (WHERE g.rsvp_status = 'pending'),
    COUNT(*) FILTER (WHERE g.rsvp_status = 'declined'),
    MAX(g.rsvp_responded_at)
  INTO v_invited, v_confirmed, v_maybe, v_pending, v_declined, v_as_of
  FROM public.guests g
  WHERE g.event_id = p_event_id AND g.deleted_at IS NULL AND g.entry_source <> 'self_added_unlisted' AND NOT g.passed_away;

  -- Meal mix of attending guests (NULL preference surfaces as 'unspecified'
  -- so the caterer sees the gap instead of a silently short total).
  SELECT COALESCE(jsonb_object_agg(m.pref, m.n), '{}'::jsonb) INTO v_meal_counts
  FROM (
    SELECT COALESCE(g.meal_preference::TEXT, 'unspecified') AS pref, COUNT(*) AS n
    FROM public.guests g
    WHERE g.event_id = p_event_id AND g.deleted_at IS NULL AND g.entry_source <> 'self_added_unlisted' AND NOT g.passed_away
      AND g.rsvp_status = 'attending'
    GROUP BY COALESCE(g.meal_preference::TEXT, 'unspecified')
  ) m;

  -- Per-block pax: cocktail pax ≠ dinner pax. invited_to_blocks is a TEXT[]
  -- on guests; all three scenarios per block so portion rules can apply
  -- their headcount basis consistently.
  SELECT COALESCE(jsonb_object_agg(b.block, jsonb_build_object(
           'confirmed', b.confirmed,
           'expected',  b.confirmed + b.maybe,
           'ceiling',   b.confirmed + b.maybe + b.pending
         )), '{}'::jsonb) INTO v_per_block
  FROM (
    SELECT u.block,
           COUNT(*) FILTER (WHERE g.rsvp_status = 'attending') AS confirmed,
           COUNT(*) FILTER (WHERE g.rsvp_status = 'maybe')     AS maybe,
           COUNT(*) FILTER (WHERE g.rsvp_status = 'pending')   AS pending
    FROM public.guests g, UNNEST(g.invited_to_blocks) AS u(block)
    WHERE g.event_id = p_event_id AND g.deleted_at IS NULL AND g.entry_source <> 'self_added_unlisted' AND NOT g.passed_away
    GROUP BY u.block
  ) b;

  SELECT COUNT(*) INTO v_restrictions
  FROM public.guests g
  WHERE g.event_id = p_event_id AND g.deleted_at IS NULL AND g.entry_source <> 'self_added_unlisted' AND NOT g.passed_away
    AND g.rsvp_status = 'attending'
    AND NULLIF(TRIM(g.dietary_restrictions), '') IS NOT NULL;

  -- FINAL when nobody is pending/maybe, or the event is ≤ 7 days out (the
  -- working assumption every PH caterer already uses for final pax).
  v_is_final := (v_pending + v_maybe = 0)
                OR (v_event_date IS NOT NULL AND v_event_date - CURRENT_DATE <= 7);

  RETURN jsonb_build_object(
    'as_of', v_as_of,
    'event_date', v_event_date,
    'finality', jsonb_build_object(
      'is_provisional', NOT v_is_final,
      'responded_pct', CASE WHEN v_invited = 0 THEN 0
                            ELSE ROUND((v_invited - v_pending)::NUMERIC / v_invited, 2) END,
      'pending', v_pending,
      'maybe', v_maybe
    ),
    'headcount_scenarios', jsonb_build_object(
      'confirmed', v_confirmed,
      'expected',  v_confirmed + v_maybe,
      'ceiling',   v_confirmed + v_maybe + v_pending
    ),
    'invited', v_invited,
    'declined', v_declined,
    'meal_counts', v_meal_counts,
    'per_block_headcount', v_per_block,
    'dietary_restriction_count', v_restrictions
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
  v_deadline_date     DATE;
  v_deadline_end      TIMESTAMPTZ;
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
  SELECT ARRAY_AGG(DISTINCT ev.category::TEXT) INTO v_booked_categories
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

  -- ==========================================================================
  -- FINALIZED FLAG — mirrors `guestListIsClosed()` in
  -- apps/web/lib/guest-list-closed.ts EXACTLY (pure, no write — see this
  -- 20271213732174's header for why this function may not call `ensureFinalized`).
  -- Stamped → always finalized. Else: deadline = the couple's explicit
  -- guest_list_edit_deadline, or event_date - 14 days (FINALIZE_LEAD_DAYS,
  -- owner-locked) when no explicit deadline was set; end-of-day UTC; no event
  -- date and no explicit deadline → never auto-finalizes.
  -- ==========================================================================
  v_deadline_date := COALESCE(v_event.guest_list_edit_deadline, v_event.event_date - 14);
  v_deadline_end := CASE
    WHEN v_deadline_date IS NULL THEN NULL
    ELSE (v_deadline_date::text || ' 23:59:59+00')::timestamptz
  END;
  v_finalized := (v_event.guest_count_locked_at IS NOT NULL)
    OR (v_deadline_end IS NOT NULL AND now() > v_deadline_end);

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
  WHERE g.event_id = p_event_id AND g.deleted_at IS NULL AND g.entry_source <> 'self_added_unlisted' AND NOT g.passed_away;

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
        WHERE g2.event_id = p_event_id AND g2.deleted_at IS NULL AND g2.entry_source <> 'self_added_unlisted' AND NOT g2.passed_away
          AND g2.rsvp_status = 'attending'
          AND NULLIF(TRIM(g2.dietary_restrictions), '') IS NOT NULL
      )
    ) INTO v_dietary
    FROM (
      SELECT g.meal_preference::TEXT AS pref, COUNT(*) AS n
      FROM public.guests g
      WHERE g.event_id = p_event_id AND g.deleted_at IS NULL AND g.entry_source <> 'self_added_unlisted' AND NOT g.passed_away
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
    'published', fp.published_at IS NOT NULL,
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

CREATE OR REPLACE FUNCTION public.papic_event_guest_headcount(
  p_event_id UUID
) RETURNS INTEGER
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT GREATEST(
           COALESCE(e.final_pax, 0),
           COALESCE(e.estimated_pax, 0),
           COALESCE((
             SELECT COUNT(*) FROM public.guests g
              WHERE g.event_id = p_event_id
                AND g.deleted_at IS NULL AND g.entry_source <> 'self_added_unlisted' AND NOT g.passed_away
                AND g.rsvp_status::text <> 'declined'
           ), 0)
         )::INTEGER
    FROM public.events e
   WHERE e.event_id = p_event_id;
$$;
