-- vendor_event_brief_from_first_contact
-- Created via `pnpm migration:new`. Prefix auto-allocated to sort AFTER every
-- existing migration. KEEP THIS MIGRATION IDEMPOTENT (it may be re-applied):
--   • CREATE TABLE IF NOT EXISTS …   (+ ALTER TABLE … ENABLE ROW LEVEL SECURITY in the SAME migration)
--   • ALTER TABLE … ADD COLUMN IF NOT EXISTS …
--   • CREATE INDEX IF NOT EXISTS …
--   • CREATE OR REPLACE FUNCTION …
--   • DROP POLICY IF EXISTS … ; CREATE POLICY …   (policies have no IF NOT EXISTS)

--
-- ============================================================================
-- THE BRIEF FROM FIRST CONTACT — a supplier who is talking to a couple sees the
-- same brief a booked supplier sees.
-- ============================================================================
-- OWNER DECISION (verbatim, 2026-09-20), asked: "Before a supplier agrees, show
-- them the couple's budget range and guest count, or only the name?" Answer:
-- "they already see everything from the starts."  It extends the 2026-09-08
-- ruling ("we do not need to hide anything, since no more tokens") that #5716
-- applied to the supplier's roster. DECISION_LOG.md row 2026-09-20.
--
-- It SUPERSEDES the 2026-07-03 disclosure ladder and PR-H slice B's "payload
-- ceiling" (20271144258091 / 20271213732174), which held the venue name, the
-- venue address, the run-of-show, meal counts and the seat-plan size back
-- until an agreement.
--
-- ── WHAT CHANGED — three things ──────────────────────────────────────────────
-- 1. THE DOOR. Before: booked, OR a pending booking ask, OR an ACCEPTED chat
--    thread. Anything else raised not_booked, so a supplier with an
--    unanswered inquiry or a couple's shortlist row could not open the event.
--    Now the 'inquiry' rung also opens for:
--      • a PENDING chat thread on this event that is not archived, or
--      • ANY event_vendors row for the caller's org on this event that is not
--        archived (considering / shortlisted / a declined or lapsed ask).
--    The accepted-thread condition is kept exactly as it was, so no supplier
--    who could open a brief before is refused now. A DECLINED thread alone
--    still does not open it.
-- 2. THE PAYLOAD. Every rung gets the same brief. Before agreement the
--    supplier also gets venue_name, venue_address, dietary (same food-category
--    gate, on the categories they are linked under), the timeline (couple
--    `notes` still excluded), and seat-plan status + size.
--    `event.region` is now on every rung (it used to be pre-agreement only).
--    `lock_request` stays a pre-agreement-only key (null at 'inquiry').
--    `vendor_roster` stays BOOKED-ONLY: it names OTHER shops, and the owner's
--    2026-09-08 grant to a not-yet-committed supplier was the locked
--    CATEGORIES, not who holds them.
-- 3. ONE NARROWING. The timeline now excludes coordinator_only lines
--    (20270901120000's boundary, never applied inside this SECURITY DEFINER
--    select), at every rung, booked included.
--
-- ── WHAT DID NOT CHANGE ─────────────────────────────────────────────────────
--   • SCOPE. Every read is keyed on p_event_id AND the caller's own vendor
--     profiles (owner via vendor_profiles.user_id, or team member via
--     vendor_team_members — the resolution this function has always used; a
--     superset of current_vendor_ids(), which covers team rows only). Before
--     agreement no other shop's data is returned (the roster is removed).
--   • NO NEW CATEGORY OF DATA. Still no guest names, no per-guest RSVP or
--     dietary text, no seating layout, no contact details, no exact budget
--     (budget_band stays a ₱5,000-quantized range behind share_budget_band).
--     The pre-agreement payload is the booked payload minus the roster, plus
--     the caller's own ask envelope.
--   • The `stage` label ('booked' | 'requested' | 'inquiry') is unchanged, so
--     every caller that gates BEHAVIOUR on stage = 'booked' (booth branding,
--     the supplier desk on the celebration page) is still gated.
--   • SECURITY DEFINER, STABLE, search_path = public, signature and grants
--     (EXECUTE to authenticated only; PUBLIC and anon revoked, re-stated below).
--
-- Idempotent (CREATE OR REPLACE).
-- ============================================================================

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
  WHERE g.event_id = p_event_id AND g.deleted_at IS NULL;

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
        WHERE g2.event_id = p_event_id AND g2.deleted_at IS NULL
          AND g2.rsvp_status = 'attending'
          AND NULLIF(TRIM(g2.dietary_restrictions), '') IS NOT NULL
      )
    ) INTO v_dietary
    FROM (
      SELECT g.meal_preference::TEXT AS pref, COUNT(*) AS n
      FROM public.guests g
      WHERE g.event_id = p_event_id AND g.deleted_at IS NULL
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

  RETURN v_payload;
END;
$$;

REVOKE ALL ON FUNCTION public.get_vendor_event_brief(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_vendor_event_brief(UUID) FROM anon;
GRANT EXECUTE ON FUNCTION public.get_vendor_event_brief(UUID) TO authenticated;

COMMENT ON FUNCTION public.get_vendor_event_brief(UUID) IS
  'The vendor-facing Customer Card brief. Since 20271235469220 (owner, 2026-09-20: "they already see everything from the starts") every rung gets the same brief except the roster. The door: booked = a live post-contract event_vendors row; requested = a pending booking ask; inquiry = an accepted chat thread, a pending non-archived thread, or any non-archived event_vendors row for the caller''s org on this event. Anything else raises not_booked. Every rung gets event (display_name, event_date, venue_name, venue_address, region, ceremony_type), booked_categories (the caller''s own categories on this event), pax + pax.finalized, dietary counts (food categories only), budget_band (opt-in range), palette, monogram, timeline (no couple notes, no coordinator_only lines), and seat_plan status + size. vendor_roster (other locked vendors, name + category) is BOOKED ONLY; lock_request is pre-agreement only. Never: guest names, per-guest RSVP/dietary detail, the seating layout, contact details, cost, or the exact budget. Scoped to the caller''s own vendor profiles (owner or team member). ⚠ attire_guide is a SHAPE-PRESERVING EMPTY CONSTANT since 20271198063551.';
