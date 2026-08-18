-- lock_handshake_slice_b
-- ============================================================================
-- PR-H slice B · ONE object, one job: the supplier who has been ASKED can see
-- enough to answer, and NOT ONE FIELD MORE.
--
-- 🔒 THIS IS A PRIVACY BOUNDARY, NOT A LAYOUT CHANGE. Slice A made a couple's
-- Lock an ASK: the row stays 'considering' and carries lock_request_state =
-- 'pending'. get_vendor_event_brief's stage gate had exactly two rungs — BOOKED
-- (`status IN ('contracted','deposit_paid','delivered','complete')`) and INQUIRY
-- (an accepted chat thread) — so an asked supplier with no thread hit
-- `RAISE EXCEPTION 'not_booked'` and could not open the event at all. They were
-- being asked to hold a date with nothing in front of them but a name.
--
-- The obvious repair is the wrong one. Adding 'pending' to the BOOKED predicate
-- is a two-word edit that hands the venue NAME, the venue ADDRESS and the whole
-- RUN-OF-SHOW — every block's label, time and location — to a supplier who has
-- agreed to nothing and may decline tomorrow. Only an agreement earns those.
--
-- ✅ WHAT THIS DOES INSTEAD — the ceiling is STRUCTURAL, not a promise.
-- 'requested' does not get a payload of its own. It shares the ONE
-- pre-agreement `jsonb_build_object` that 'inquiry' already returns and that was
-- reviewed as a disclosure ladder (owner-approved 2026-07-03): display name ·
-- date · REGION ONLY (venue_name and venue_address hard-NULL) · pax totals ·
-- style · the opt-in budget band · `timeline '[]'` · seat plan zeroed · dietary
-- NULL. There is no second place for a field to be added to, so a future edit
-- cannot widen 'requested' without widening 'inquiry' in the same line — where
-- it would be seen.
-- 🔑 A TEST THAT ONLY CHECKS THE HAPPY STAGE PASSES WHILE LEAKING. The db suite
-- asserts what this payload does NOT contain, field by field, and the ceiling is
-- mutation-proved by widening the predicate and watching it go red.
--
-- The only ADDED key is `lock_request` — event_vendor_id · category ·
-- requested_at · expires_at. Every one of those is a fact about the SUPPLIER'S
-- OWN ROW; none is a fact about the wedding. NULL at the inquiry stage.
--
-- 'requested' is checked ABOVE 'inquiry' because it is the more specific fact
-- about the same relationship — an asked supplier usually also holds an accepted
-- thread — and since both rungs share one payload, promoting it discloses
-- nothing that the lower rung would not already have shown.
--
-- Re-emitted from the shipped 20270522618307 by EXTRACTION, never retyped; the
-- diff against it is the four edits above and nothing else. Idempotent
-- (CREATE OR REPLACE). No grant change: EXECUTE already sits where it sat.
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
  v_inquiry_categories TEXT[];
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

  -- 2 · Stage gate. BOOKED wins: access keys on a live post-contract
  -- event_vendors relationship (doc § 1 hard rule #1).
  SELECT ARRAY_AGG(DISTINCT ev.category::TEXT) INTO v_booked_categories
  FROM public.event_vendors ev
  WHERE ev.event_id = p_event_id
    AND ev.marketplace_vendor_id = ANY (v_profile_ids)
    AND ev.status IN ('contracted', 'deposit_paid', 'delivered', 'complete');

  IF v_booked_categories IS NOT NULL THEN
    v_stage := 'booked';
  ELSE
    -- ── PR-H slice B · the THIRD RUNG: 'requested'. ────────────────────────
    -- A supplier who has been ASKED but has not answered. Before this rung
    -- existed the ask left the row 'considering', so this function raised
    -- not_booked and the supplier could not open the event AT ALL — they were
    -- asked to commit a date with nothing to decide on but the couple's name.
    -- Checked ABOVE inquiry because it is the more specific fact about the same
    -- relationship (an asked supplier usually also holds an accepted thread),
    -- and the two share ONE payload, so promoting it discloses nothing extra.
    IF EXISTS (
      SELECT 1 FROM public.event_vendors ev
      WHERE ev.event_id = p_event_id
        AND ev.marketplace_vendor_id = ANY (v_profile_ids)
        AND ev.lock_request_state = 'pending'
        AND ev.archived_at IS NULL
    ) THEN
      v_stage := 'requested';
    -- Not booked → INQUIRY stage if the org has an ACCEPTED chat thread for
    -- this event. chat_threads is UNIQUE(event_id, vendor_profile_id); an
    -- accepted thread is the vendor→couple handshake (lib/chat.ts § inquiry).
    ELSIF EXISTS (
      SELECT 1 FROM public.chat_threads t
      WHERE t.event_id = p_event_id
        AND t.vendor_profile_id = ANY (v_profile_ids)
        AND t.inquiry_status = 'accepted'
    ) THEN
      v_stage := 'inquiry';
    ELSE
      RAISE EXCEPTION 'not_booked' USING ERRCODE = '42501';
    END IF;
  END IF;

  -- Event row (both stages need the safe style/date fields).
  -- share_budget_band added for the budget-band gate (PR-5).
  SELECT e.display_name, e.event_date, e.venue_name, e.venue_address, e.region,
         e.ceremony_type, e.role_palette, e.attire_guide_palette,
         e.monogram_text, e.monogram_color, e.monogram_font_key,
         e.monogram_frame_key, e.monogram_custom_svg, e.share_budget_band
  INTO v_event
  FROM public.events e
  WHERE e.event_id = p_event_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'event_not_found' USING ERRCODE = 'P0002';
  END IF;

  v_share_budget := COALESCE(v_event.share_budget_band, FALSE);

  -- 3 · Pax counts (both stages — quote inputs). Soft-deleted rows excluded.
  SELECT jsonb_build_object(
    'invited',   COUNT(*),
    'attending', COUNT(*) FILTER (WHERE g.rsvp_status = 'attending'),
    'maybe',     COUNT(*) FILTER (WHERE g.rsvp_status = 'maybe'),
    'pending',   COUNT(*) FILTER (WHERE g.rsvp_status = 'pending'),
    'declined',  COUNT(*) FILTER (WHERE g.rsvp_status = 'declined')
  ) INTO v_pax
  FROM public.guests g
  WHERE g.event_id = p_event_id AND g.deleted_at IS NULL;

  -- ==========================================================================
  -- BUDGET BAND (both stages — a quote INPUT, most valuable at inquiry).
  --
  -- Gate: NULL unless the host opted in (share_budget_band = TRUE) AND the
  -- couple has a budget allocation for the calling vendor's category(ies).
  --
  -- Category mapping (CONSERVATIVE — exact enum match only, no fuzzy matching):
  --   The couple's Budget Planner stores per-LEAF allocations keyed by
  --   canonical_service (the 26 wedding PLAN_GROUP ids from
  --   lib/wedding-plan-groups.ts) in budget_allocation_decisions.final_amount_php
  --   (PHP PESOS). The vendor brief keys on the vendor_category enum
  --   (event_vendors.category). The two are NOT the same namespace, so we map
  --   vendor_category → plan_group leaf id(s) from wedding-plan-groups.ts's
  --   PLAN_GROUP.categories arrays (the canonical, in-app mapping). A vendor
  --   category with no matching allocated leaf → band stays NULL.
  --
  --   The vendor's relevant categories are:
  --     booked stage  → v_booked_categories
  --     inquiry stage → the event_vendors link categories for this org+event
  --   We take the SUM of final_amount_php across every matching leaf from the
  --   couple's LATEST saved snapshot (grouped by snapshot_id, newest first).
  --
  -- Band derivation (the exact figure is NEVER recoverable):
  --   Let alloc = the couple's allocation total (pesos) for the matched leaves.
  --   step  = 20% of alloc, rounded to the NEAREST ₱5,000, minimum ₱5,000.
  --   lo    = (ceil(alloc/step) - 1) * step
  --   hi    = (floor(alloc/step) + 1) * step
  --   This guarantees lo < alloc < hi STRICTLY (alloc is never a band boundary,
  --   even when it is an exact multiple of step) and both bounds are clean
  --   ₱5,000-quantized steps, so a vendor can never back out the exact number.
  --   Output is in CENTAVOS (× 100) to match the card's centavos convention.
  -- ==========================================================================
  IF v_share_budget THEN
    DECLARE
      v_categories TEXT[];
      v_alloc_php  BIGINT;
      v_step       BIGINT;
      v_lo         BIGINT;
      v_hi         BIGINT;
    BEGIN
      IF v_stage = 'booked' THEN
        v_categories := v_booked_categories;
      ELSE
        SELECT ARRAY_AGG(DISTINCT ev.category::TEXT) INTO v_categories
        FROM public.event_vendors ev
        WHERE ev.event_id = p_event_id
          AND ev.marketplace_vendor_id = ANY (v_profile_ids);
      END IF;

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

  -- ==========================================================================
  -- INQUIRY STAGE — LIMITED payload (disclosure ladder, owner-approved 2026-07-03)
  --   * event display_name + event_date + ceremony_type
  --   * CITY-GRAIN location only: region exposed; venue_name/venue_address NULL
  --   * pax TOTALS (quote inputs)
  --   * palette + monogram + attire_guide (style is quote-relevant + safe)
  --   * budget_band (NULL unless opted-in + allocation exists) — a quote input
  --   * booked_categories = the inquiring categories if cheaply derivable, else []
  --   * timeline = [] · seat_plan zeroed · dietary NULL
  -- ==========================================================================
  IF v_stage IN ('inquiry', 'requested') THEN
    -- Cheaply-derivable inquiring categories: the event_vendors link rows for
    -- this org+event that are NOT yet booked (still shortlisted/inquiring).
    -- If none is derivable, fall back to [] per the brief.
    SELECT ARRAY_AGG(DISTINCT ev.category::TEXT) INTO v_inquiry_categories
    FROM public.event_vendors ev
    WHERE ev.event_id = p_event_id
      AND ev.marketplace_vendor_id = ANY (v_profile_ids);

    -- The ask envelope — WHAT was asked and HOW LONG IS LEFT, and nothing else.
    -- Every field here is already the supplier's own row; none of it is a fact
    -- about the wedding. NULL at the inquiry stage.
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

    RETURN jsonb_build_object(
      'stage', v_stage,
      'lock_request', v_lock_request,
      'event', jsonb_build_object(
        'display_name', v_event.display_name,
        'event_date', v_event.event_date,
        'venue_name', NULL,           -- city-grain only before an agreement
        'venue_address', NULL,        -- city-grain only before an agreement
        'region', v_event.region,     -- city / province grain
        'ceremony_type', v_event.ceremony_type
      ),
      'booked_categories', COALESCE(to_jsonb(v_inquiry_categories), '[]'::jsonb),
      'pax', v_pax,
      'dietary', NULL,
      'budget_band', v_budget_band,
      'palette', COALESCE(v_event.role_palette, '{}'::jsonb),
      'attire_guide', COALESCE(v_event.attire_guide_palette, '{}'::jsonb),
      'monogram', jsonb_build_object(
        'text', v_event.monogram_text,
        'color', v_event.monogram_color,
        'font_key', v_event.monogram_font_key,
        'frame_key', v_event.monogram_frame_key,
        'custom_svg', v_event.monogram_custom_svg
      ),
      'timeline', '[]'::jsonb,
      'seat_plan', jsonb_build_object(
        'published', FALSE,
        'published_at', NULL,
        'table_count', 0,
        'assigned_guests', 0
      )
    );
  END IF;

  -- ==========================================================================
  -- BOOKED STAGE — full payload, UNCHANGED from 20270507380212 (plus "budget_band").
  -- ==========================================================================

  -- Dietary counts: food-relevant categories + coordinator only (§ 7 matrix).
  v_dietary_allowed := v_booked_categories
    && ARRAY['catering', 'cake_maker', 'mobile_bar', 'venue', 'planner_coordinator'];

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

  -- 5 · Day-of timeline: FULL visibility for booked vendors (locked D2);
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
  WHERE b.event_id = p_event_id;

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

  RETURN jsonb_build_object(
    'stage', 'booked',
    'event', jsonb_build_object(
      'display_name', v_event.display_name,
      'event_date', v_event.event_date,
      'venue_name', v_event.venue_name,
      'venue_address', v_event.venue_address,
      'ceremony_type', v_event.ceremony_type
    ),
    'booked_categories', to_jsonb(v_booked_categories),
    'pax', v_pax,
    'dietary', v_dietary,  -- NULL when the caller's categories aren't food-relevant
    'budget_band', v_budget_band,
    'palette', COALESCE(v_event.role_palette, '{}'::jsonb),
    'attire_guide', COALESCE(v_event.attire_guide_palette, '{}'::jsonb),
    'monogram', jsonb_build_object(
      'text', v_event.monogram_text,
      'color', v_event.monogram_color,
      'font_key', v_event.monogram_font_key,
      'frame_key', v_event.monogram_frame_key,
      'custom_svg', v_event.monogram_custom_svg
    ),
    'timeline', v_timeline,
    'seat_plan', v_seat_plan
  );
END;
$$;

COMMENT ON FUNCTION public.get_vendor_event_brief(UUID) IS
  'The vendor-facing Customer Card brief, on a THREE-rung disclosure ladder (PR-H slice B). booked = a live post-contract event_vendors row; requested = the couple has ASKED and this supplier has not answered (lock_request_state = ''pending''); inquiry = an accepted chat thread. Anything else raises not_booked. 🔒 requested and inquiry SHARE ONE PAYLOAD BY CONSTRUCTION — venue_name and venue_address are hard-NULL, timeline is [], seat_plan is zeroed and dietary is NULL for both — so the venue address and the run-of-show are earned by an AGREEMENT and never by an ask. Do not give ''requested'' a payload of its own: the single build object IS the ceiling, and it is what stops a later field from reaching a supplier who can still decline. The only key ''requested'' adds is lock_request, every field of which is a fact about the supplier''s own row rather than about the wedding.';

-- ----------------------------------------------------------------------------
-- 2 · vendor_agree_to_lock — RE-EMITTED so one yes books a whole PACKAGE.
--
-- Extracted verbatim from 20271143289546 and patched in three places: one more
-- local, the package back-link read off the already-authorized row, and the
-- promotion block before the ok envelope. Nothing else changed — the ownership
-- gate, the resolve-others-first refusal, the slot-capacity count, the monotone
-- status CASE and both exception arms are byte-for-byte the shipped ones.
--
-- ⚠ The promotion is deliberately INSIDE this function and not a trigger. It is
-- part of the same answer, it must share the row lock the flip already holds,
-- and a trigger on event_vendors would fire on every write to the table for the
-- benefit of the fraction that are package anchors.
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.vendor_agree_to_lock(
  p_event_vendor_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_state       TEXT;
  v_expires_at  TIMESTAMPTZ;
  v_agreed_at   TIMESTAMPTZ;
  v_event_id    UUID;
  v_group       TEXT;
  v_status      TEXT;
  v_mvid        UUID;
  v_slot        UUID;
  v_rows        INTEGER;
  v_msg         TEXT;
  v_date        DATE;
  v_prec        TEXT;
  v_event_ids   UUID[];
  v_capacity    INT;
  v_used        INT;
  v_competing   INT;
  v_pkg_id      UUID;
  v_covered     INT;
BEGIN
  -- ── OWNERSHIP ──────────────────────────────────────────────────────────────
  -- NARROWED from the shipped gate, deliberately. current_vendor_event_vendor_ids()
  -- has a second arm matching on event_vendors.service_id via
  -- agent_assigned_service_ids() — and service_id is a column the COUPLE can
  -- write (authenticated holds UPDATE on it; no constraint ties it to
  -- marketplace_vendor_id). That was harmless while this RPC wrote an inert
  -- marker nobody read. It is NOT harmless now that this RPC is the only thing
  -- that creates a booking.
  -- 🔑 RULE: when an RPC becomes the sole authority for a booking, its ownership
  -- predicate may not key on a column the counterparty controls.
  -- The agent arm is kept — staff seats legitimately answer for their org — but
  -- re-anchored so the service must belong to the org that was actually ASKED.
  IF NOT EXISTS (
    SELECT 1
      FROM public.event_vendors ev
     WHERE ev.vendor_id = p_event_vendor_id
       AND (
         ev.marketplace_vendor_id IN (SELECT public.current_vendor_profile_ids())
         OR EXISTS (
           SELECT 1
             FROM public.vendor_services vs
            WHERE vs.vendor_service_id = ev.service_id
              AND vs.vendor_profile_id = ev.marketplace_vendor_id
              AND vs.vendor_service_id IN (SELECT public.agent_assigned_service_ids())
         )
       )
  ) AND NOT public.is_admin() THEN
    RAISE EXCEPTION 'not_your_booking' USING ERRCODE = '42501';
  END IF;

  SELECT lock_request_state, lock_request_expires_at, lock_agreed_at,
         event_id, hard_single_group, status::TEXT, marketplace_vendor_id,
         service_time_slot_id, event_vendor_package_id
    INTO v_state, v_expires_at, v_agreed_at,
         v_event_id, v_group, v_status, v_mvid, v_slot, v_pkg_id
    FROM public.event_vendors
   WHERE vendor_id = p_event_vendor_id
   FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'booking_not_found' USING ERRCODE = 'P0002';
  END IF;

  IF v_state IS NULL THEN
    RETURN jsonb_build_object('status', 'not_requested', 'event_id', v_event_id);
  END IF;

  IF v_state = 'agreed' THEN
    RETURN jsonb_build_object(
      'status', 'already', 'agreed_at', v_agreed_at, 'event_id', v_event_id);
  END IF;

  IF v_state IN ('declined', 'cancelled', 'expired') THEN
    RETURN jsonb_build_object(
      'status', 'not_pending', 'current', v_state, 'event_id', v_event_id);
  END IF;

  -- LAZY EXPIRY. Kept even though a sweep now exists: the sweep fires on request
  -- traffic, so a vendor can still open a lapsed request between two passes.
  -- Flipping (rather than merely refusing) releases both pending indexes so the
  -- couple can ask again.
  IF v_expires_at IS NOT NULL AND v_expires_at <= NOW() THEN
    UPDATE public.event_vendors
       SET lock_request_state = 'expired',
           updated_at         = NOW()
     WHERE vendor_id = p_event_vendor_id
       AND lock_request_state = 'pending';
    RETURN jsonb_build_object(
      'status', 'expired', 'expired_at', v_expires_at, 'event_id', v_event_id);
  END IF;

  -- ── A CONFIRMED RIVAL IN THE COUPLE'S OWN CATEGORY ─────────────────────────
  -- The couple booked someone else for this hard-single category while the ask
  -- was outstanding. Close the request rather than leaving it to rot in the
  -- pending index. 'cancelled' is the honest value — every path that can confirm
  -- a hard-single sibling is couple-initiated, so the couple did withdraw it, by
  -- booking elsewhere — but the ACTOR IS STAMPED so the record does not lose the
  -- fact that the vendor was here and answered.
  IF v_group IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.event_vendors ev
     WHERE ev.event_id = v_event_id
       AND ev.hard_single_group = v_group
       AND ev.vendor_id <> p_event_vendor_id
       AND ev.archived_at IS NULL
       AND ev.package_role IS DISTINCT FROM 'covered'
       AND ev.status IN ('contracted', 'deposit_paid', 'delivered', 'complete')
  ) THEN
    UPDATE public.event_vendors
       SET lock_request_state        = 'cancelled',
           lock_request_cancelled_at = NOW(),
           lock_answered_by_user_id  = auth.uid(),
           updated_at                = NOW()
     WHERE vendor_id = p_event_vendor_id
       AND lock_request_state = 'pending';
    RETURN jsonb_build_object(
      'status', 'group_taken', 'event_id', v_event_id);
  END IF;

  -- ── OWNER DECISION 3 · DECLINE THE OTHERS FIRST ───────────────────────────
  -- Service_Schedule_and_Quotation_Flow_2026-06-02.md §T1.4. A vendor may not
  -- take one couple while other couples are still waiting on them for the same
  -- date: they must answer the others first, so nobody loses silently.
  -- Capacity is the owner's documented default of 1 (daily_booking_capacity was
  -- never built — see the header). A vendor with no date on the event has no
  -- date to compete on, so the rule does not apply.
  SELECT e.event_date, e.event_date_precision
    INTO v_date, v_prec
    FROM public.events e
   WHERE e.event_id = v_event_id;

  IF v_mvid IS NOT NULL AND v_date IS NOT NULL AND v_prec = 'day' THEN
    SELECT count(*) INTO v_competing
      FROM public.event_vendors ev
      JOIN public.events e2 ON e2.event_id = ev.event_id
     WHERE ev.marketplace_vendor_id = v_mvid
       AND ev.lock_request_state = 'pending'
       AND ev.archived_at IS NULL
       AND ev.vendor_id <> p_event_vendor_id
       AND e2.event_date = v_date
       AND e2.event_date_precision = 'day';

    IF COALESCE(v_competing, 0) > 0 THEN
      RETURN jsonb_build_object(
        'status', 'resolve_others_first',
        'competing', v_competing,
        'event_date', v_date,
        'event_id', v_event_id);
    END IF;
  END IF;

  -- ── TIME-SLOT CAPACITY ────────────────────────────────────────────────────
  -- Capacity is consumed HERE, not at the couple's ask, because the ask no
  -- longer books anything. The predicate mirrors acquire_service_time_slot's
  -- occupancy count (read from the live function, not retyped from memory).
  IF v_slot IS NOT NULL AND v_date IS NOT NULL AND v_prec = 'day' THEN
    SELECT slot_capacity INTO v_capacity
      FROM public.vendor_service_time_slots
     WHERE slot_id = v_slot
       AND is_active
     FOR UPDATE;

    IF v_capacity IS NOT NULL THEN
      SELECT array_agg(event_id) INTO v_event_ids
        FROM public.events
       WHERE event_date = v_date
         AND event_date_precision = 'day';

      SELECT count(*) INTO v_used
        FROM public.event_vendors
       WHERE service_time_slot_id = v_slot
         AND status IN ('contracted', 'deposit_paid', 'delivered', 'complete')
         AND archived_at IS NULL
         AND event_id = ANY (v_event_ids)
         AND vendor_id <> p_event_vendor_id;

      IF v_used >= v_capacity THEN
        RETURN jsonb_build_object(
          'status', 'slot_full', 'event_id', v_event_id);
      END IF;
    END IF;
  END IF;

  -- ── THE FLIP ──────────────────────────────────────────────────────────────
  -- One statement. state='agreed' AND status='contracted' land together or not
  -- at all. The status half is MONOTONE (see the header): a row that is already
  -- further up the ladder keeps its status, so agreeing can never demote a paid
  -- booking or release the vendor's held date.
  BEGIN
    UPDATE public.event_vendors
       SET lock_request_state       = 'agreed',
           lock_agreed_at           = NOW(),
           lock_answered_by_user_id = auth.uid(),
           lock_declined_at         = NULL,
           lock_decline_reason      = NULL,
           status = CASE
                      WHEN status IN ('contracted', 'deposit_paid',
                                      'delivered', 'complete')
                        THEN status
                      ELSE 'contracted'::public.vendor_status
                    END,
           updated_at               = NOW()
     WHERE vendor_id = p_event_vendor_id
       AND lock_request_state = 'pending';
    GET DIAGNOSTICS v_rows = ROW_COUNT;
  EXCEPTION
    -- ⚠ TWO TRIGGERS RAISE check_violation ON THIS TABLE AND THE FLIP MAKES BOTH
    -- NEWLY REACHABLE — they used to fire on the couple's write, where
    -- finalizeVendor handled them. The shipped RPC had NO exception block at
    -- all, so a vendor pressing Agree would have met a raw Postgres string.
    -- Discriminate on the message; a blanket handler would tell a fully verified
    -- vendor to finish their verification, which is how a real defect gets
    -- triaged as a user error and never investigated.
    WHEN check_violation THEN
      GET STACKED DIAGNOSTICS v_msg = MESSAGE_TEXT;
      IF v_msg LIKE 'vendor_not_verified%' THEN
        RETURN jsonb_build_object('status', 'not_verified', 'event_id', v_event_id);
      ELSIF v_msg LIKE 'free_tier_booking_cap%' THEN
        RETURN jsonb_build_object('status', 'fully_booked', 'event_id', v_event_id);
      END IF;
      RAISE;  -- anything else is a real defect and must fail loudly.
    WHEN unique_violation THEN
      -- Raced a rival into the confirmed hard-single index between the
      -- pre-check above and this statement. Defence in depth, not the design.
      RETURN jsonb_build_object('status', 'group_taken', 'event_id', v_event_id);
  END;

  IF v_rows = 0 THEN
    SELECT lock_request_state, lock_agreed_at INTO v_state, v_agreed_at
      FROM public.event_vendors WHERE vendor_id = p_event_vendor_id;
    RETURN jsonb_build_object(
      'status', 'already', 'current', v_state,
      'agreed_at', v_agreed_at, 'event_id', v_event_id);
  END IF;

  -- ── A PACKAGE IS ONE ANSWER, N ROWS (PR-H slice B) ──────────────────────
  -- The package lock path cascades one ANCHOR row plus a COVERED row per kept
  -- line, all pointing at one event_vendor_packages booking. Only the anchor
  -- carries the request — the pending index's own predicate says so
  -- (package_role IS DISTINCT FROM 'covered'), and a covered line is not a
  -- separate question anybody could answer.
  --
  -- 🔑 SO AGREEING TO THE ANCHOR MUST BOOK THE WHOLE PACKAGE. Without this the
  -- supplier's yes would confirm ONE line and leave every other line of the
  -- package they just agreed to sitting at 'considering' — a half-booked
  -- package, which is not a state the product has copy for, a price for, or a
  -- way out of.
  --
  -- Same MONOTONE shape as the anchor's own flip: a covered row already further
  -- up the ladder keeps its status, so this can never demote a paid line. The
  -- booking row moves 'considering' → 'locked' and takes its locked_at receipt
  -- at the moment the receipt becomes true, not seven days earlier.
  IF v_pkg_id IS NOT NULL THEN
    UPDATE public.event_vendors
       SET status = CASE
                      WHEN status IN ('contracted', 'deposit_paid',
                                      'delivered', 'complete')
                        THEN status
                      ELSE 'contracted'::public.vendor_status
                    END,
           updated_at = NOW()
     WHERE event_vendor_package_id = v_pkg_id
       AND package_role = 'covered'
       AND archived_at IS NULL;
    GET DIAGNOSTICS v_covered = ROW_COUNT;

    UPDATE public.event_vendor_packages
       SET status    = 'locked',
           locked_at = COALESCE(locked_at, NOW())
     WHERE booking_id = v_pkg_id
       AND status = 'considering';
  END IF;

  RETURN jsonb_build_object(
    'status', 'ok', 'agreed_at', NOW(), 'event_id', v_event_id,
    'package_lines_booked', COALESCE(v_covered, 0));
END;
$$;

COMMENT ON FUNCTION public.vendor_agree_to_lock(UUID) IS
  'PR-H step 2: the VENDOR agrees, AND THAT IS WHAT MAKES THE BOOKING — the same single UPDATE writes lock_request_state=''agreed'' and status=''contracted'', so the two can never disagree. The status half is MONOTONE (a CASE): agreeing can only move a row UP the ladder, never demote an already deposit_paid/delivered/complete booking, which would fire the release trigger and free the vendor''s held date. Refuses with ''resolve_others_first'' while other couples have pending requests on the same date (owner 2026-06-02 §T1.4 — no customer loses a lock silently; capacity is the owner''s documented default of 1 because daily_booking_capacity was never built). Consumes time-slot capacity here, since the couple''s ask no longer books anything. Ownership is NARROWER than the shipped gate: the agent arm is re-anchored so the service must belong to the org that was asked, because event_vendors.service_id is couple-writable and this RPC is now the sole authority for a booking. Money still moves at step 5 — this bills nothing and reserves no schedule pool. SLICE B: when the agreed row is a PACKAGE ANCHOR, this also promotes every covered line of that booking and flips event_vendor_packages to locked, because a package is ONE answer spread over N rows and only the anchor ever carried the request — agreeing to the anchor alone would leave the rest of the package the supplier just accepted sitting unbooked.';
