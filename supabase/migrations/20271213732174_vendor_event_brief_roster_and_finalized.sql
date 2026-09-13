-- WIDEN get_vendor_event_brief: OTHER-vendor roster + a finalized flag on pax.
-- ============================================================================
-- Product ask: the booked-supplier "Supplier's Desk" (`apps/web/app/[slug]/
-- _lib/supplier-desk.server.ts` + `_components/supplier-desk.tsx`) should also
-- show (1) which OTHER vendors are locked on this event and for what
-- category, and (2) whether the guest count is still moving or is finalized,
-- next to the pax counts it already shows. Nothing else about the brief's
-- disclosure ladder changes — no guest names, no per-guest RSVP/dietary
-- detail, no seating chart, no exact budget. This is additive-only, the same
-- posture 20271193469029 documents for this RPC's contract.
--
-- ── WHY THESE TWO SOURCES, AND NOT NEW STATE ────────────────────────────────
-- RULE 0 (repo CLAUDE.md): before adding schema, find what already encodes the
-- fact.
--
-- 1. VENDOR ROSTER. `event_vendors` already carries every vendor booked on an
--    event, with `category` and `vendor_name` columns
--    (`20260513100000_iteration_0006_vendors.sql`), and this SAME function
--    already has a "locked" status vocabulary for exactly this purpose (the
--    `v_booked_categories` gate a few lines above): `contracted`,
--    `deposit_paid`, `delivered`, `complete`. That set is also
--    `LOCKED_STATUSES` in `apps/web/lib/vendors-plan-budget.ts`, which drives
--    the couple's own "N locked" team chip — so the roster below reuses the
--    app's one locked-vendor vocabulary rather than inventing a second one.
--    No new column, no new table.
--
-- 2. FINALIZED FLAG. `events.guest_count_locked_at` /
--    `events.guest_list_edit_deadline` already exist
--    (`20261211000000_adaptive_pax_pricing_columns.sql`, Adaptive Pax Pricing
--    owner decision #6). `apps/web/lib/guest-list-closed.ts` is the ONE place
--    the app already answers "is the guest list closed?", and it is
--    deliberately a PURE function (no DB write) for exactly this function's
--    situation: `ensureFinalized` (`lib/pax.ts`) is allowed to stamp
--    `guest_count_locked_at` because it runs behind a couple-owned write path,
--    but a read like this one must not write on a supplier's page load. So
--    `guestListIsClosed()`'s exact arithmetic — stamped, OR now() is past the
--    deadline (explicit `guest_list_edit_deadline`, else
--    `event_date - FINALIZE_LEAD_DAYS`, end of day UTC) — is mirrored here in
--    SQL rather than only reading the lazy stamp. Reading the stamp ALONE
--    would report "still moving" for however many days pass between the
--    deadline and the next time the COUPLE happens to open a page that
--    triggers the lazy write — a stale "open" answer is exactly the "reads
--    must be honest" defect class this repo already fixed once on the guest
--    hub for the same column.
--    ⚠ `FINALIZE_LEAD_DAYS = 14` is owner-locked and lives in
--    `apps/web/lib/guest-list-closed.ts`. If that constant ever changes, this
--    migration's copy must change with it — grep
--    `FINALIZE_LEAD_DAYS` before touching either side.
--
-- ── WHAT ELSE COULD HAVE LEAKED, AND WAS DELIBERATELY KEPT OUT ──────────────
--   • `event_vendors.marketplace_vendor_id`, contact info, cost/price columns,
--     lock-request timestamps of OTHER vendors — none of it crosses. Only
--     `category` + `vendor_name` (already the couple-facing display name).
--   • The calling supplier's OWN row(s) are excluded from the roster — they
--     already know their own booking; the ask was "which OTHER vendors".
--   • The roster is BOOKED-STAGE ONLY. `inquiry`/`requested` suppliers have
--     not signed anything yet — the disclosure ladder already withholds venue
--     address and the running order at those rungs for the same reason, and
--     "who else is booked" is the same class of fact.
--   • `pax.finalized` is a boolean derived from dates already on `events` —
--     no guest identity, no count precision beyond what `pax` already
--     discloses. It is added at BOTH rungs because `pax` (the counts
--     themselves) is already shared by both.
--
-- Re-emitted from 20271198063551 by EXTRACTION; the diff is exactly:
--   1. `e.guest_count_locked_at, e.guest_list_edit_deadline` added to the
--      event SELECT list.
--   2. A `v_finalized` compute block, mirroring `guestListIsClosed()`.
--   3. `'finalized', v_finalized` added into the `pax` object (both stages).
--   4. A `v_vendor_roster` compute block + `'vendor_roster'` key, BOOKED STAGE
--      ONLY.
-- Everything else — the stage gate, the disclosure ladder, the budget-band
-- arithmetic, both payload builders — is byte-for-byte the shipped one.
--
-- Idempotent (CREATE OR REPLACE). No grant change: EXECUTE stays where it sat.
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
  v_finalized         BOOLEAN;
  v_deadline_date     DATE;
  v_deadline_end      TIMESTAMPTZ;
  v_vendor_roster     JSONB;
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
  -- guest_count_locked_at + guest_list_edit_deadline added for pax.finalized.
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
  -- migration's header for why this function may not call `ensureFinalized`).
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

  -- 3 · Pax counts (both stages — quote inputs). Soft-deleted rows excluded.
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
  --   * pax TOTALS (quote inputs) + finalized flag
  --   * palette + monogram (style is quote-relevant + safe). attire_guide is
  --     now a shape-preserving empty constant — see 20271198063551's header.
  --   * budget_band (NULL unless opted-in + allocation exists) — a quote input
  --   * booked_categories = the inquiring categories if cheaply derivable, else []
  --   * timeline = [] · seat_plan zeroed · dietary NULL · NO vendor_roster
  --     (booked-stage only — see this migration's header)
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
      -- attire_guide: SHAPE-PRESERVING CONSTANT. See 20271198063551's header.
      'attire_guide', '{}'::jsonb,
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
  -- BOOKED STAGE — full payload, UNCHANGED from 20270507380212 (plus
  -- "budget_band", plus "pax.finalized" and "vendor_roster" — this migration).
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
END;
$$;

COMMENT ON FUNCTION public.get_vendor_event_brief(UUID) IS
  'The vendor-facing Customer Card brief, on a THREE-rung disclosure ladder (PR-H slice B). booked = a live post-contract event_vendors row; requested = the couple has ASKED and this supplier has not answered (lock_request_state = ''pending''); inquiry = an accepted chat thread. Anything else raises not_booked. 🔒 requested and inquiry SHARE ONE PAYLOAD BY CONSTRUCTION — venue_name and venue_address are hard-NULL, timeline is [], seat_plan is zeroed and dietary is NULL for both — so the venue address and the run-of-show are earned by an AGREEMENT and never by an ask. Do not give ''requested'' a payload of its own: the single build object IS the ceiling, and it is what stops a later field from reaching a supplier who can still decline. The only key ''requested'' adds is lock_request, every field of which is a fact about the supplier''s own row rather than about the wedding. ⚠ attire_guide is a SHAPE-PRESERVING EMPTY CONSTANT since 20271198063551 (see that migration for why). Per-role colour lives in events.role_palette, returned as ''palette''. 🆕 Since 20271213732174: ''pax.finalized'' (boolean, both stages) mirrors apps/web/lib/guest-list-closed.ts''s guestListIsClosed() — stamped OR past the deadline, end of day UTC, never re-derived from a second formula; and ''vendor_roster'' (BOOKED STAGE ONLY — array of {vendor_name, category} for every OTHER locked vendor on the event, same locked-status vocabulary as v_booked_categories, caller''s own rows excluded). Neither addition loosens anything already withheld: no guest names, no per-guest RSVP/dietary detail, no seating chart, no exact budget, and vendor_roster carries no contact info or cost.';
