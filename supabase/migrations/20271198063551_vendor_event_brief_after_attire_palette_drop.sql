-- REPAIR get_vendor_event_brief AFTER events.attire_guide_palette WAS DROPPED.
-- ============================================================================
-- 🛑 A SHIPPING BUG INTRODUCED EARLIER ON THIS SAME BRANCH.
--
-- 20271193010764_retire_dead_moodboard_schema_… drops
-- `events.attire_guide_palette`. Dropping it was correct — the column's only
-- writer was dead code. But the CURRENT definition of
-- `public.get_vendor_event_brief(UUID)` (20271144258091_lock_handshake_slice_b)
-- still SELECTed that column into v_event and read it back twice.
--
-- ⚠ POSTGRES DOES NOT CATCH THIS AT DROP TIME. A plpgsql function body is an
-- opaque string to the dependency tracker, so `ALTER TABLE … DROP COLUMN`
-- succeeded with no error and no warning while leaving the function broken. It
-- fails at INVOCATION, with 42703 `column e.attire_guide_palette does not
-- exist` — i.e. the first time a supplier opens an event brief in production.
--
-- 🔑 THIS IS THE REPO'S OWN "a failure that renders identically to success"
-- SHAPE, one level down: the DROP reported success, CI's schema replay reported
-- success, and only the tests that actually CALL the function went red — four of
-- them, in tests/db/lock-handshake-slice-b.db.test.ts. Every other db test
-- passed, because replaying DDL never invokes a function body.
--
-- The blast radius is not one screen. `get_vendor_event_brief` backs the vendor
-- client page, the .ics calendar feed, challenge-photos, the on-the-day console
-- and its live view, proposals, the supplier desk and the song-desk gate.
--
-- ── WHAT CHANGED, AND NOTHING ELSE ──────────────────────────────────────────
-- Re-emitted from the shipped 20271144258091 by EXTRACTION, never retyped. The
-- diff against it is exactly three things, all forced by the dropped column:
--   1. `e.attire_guide_palette` removed from the event SELECT list.
--   2. + 3. Both `'attire_guide', COALESCE(v_event.attire_guide_palette, …)`
--      sites become the constant `'{}'::jsonb`.
-- The stage gate, the disclosure ladder, the budget-band arithmetic and both
-- payload builders are byte-for-byte the shipped ones.
--
-- ── WHY THE `attire_guide` KEY SURVIVES AS AN EMPTY OBJECT ──────────────────
-- ❌ NOT DELETED. This repo treats an RPC's return shape as a contract (the
-- sibling 20271193469029 on this branch is additive-only for that reason), and
-- the key has a declared consumer: the `Brief` type in
-- apps/web/app/vendor-dashboard/clients/[eventId]/page.tsx declares
-- `attire_guide: Record<string, unknown>` as a REQUIRED field. Dropping the key
-- would leave that type lying about the wire. `'{}'::jsonb` keeps both the key
-- and its object shape, so no caller can crash on it.
--
-- ❌ NOT RE-SOURCED FROM role_palette — and this was the tempting wrong answer.
-- The pitch is that `role_palette` survives, carries per-role colours (bride,
-- groom, "guest dress code", wedding party, sponsors, officiants, plus couple
-- defined custom_roles) and would therefore "preserve the vendor's actual
-- information rather than blanking it". THAT PREMISE IS FALSE, measured two
-- ways rather than assumed:
--   • Against PRODUCTION, 2026-09-03:
--       select count(*) filter (where attire_guide_palette <> '{}'::jsonb)
--         from public.events;   →  0   (of 5 events)
--     No couple ever set an attire colour. Re-measure, do not trust this line.
--   • No migration ever INSERTs or UPDATEs the column, and its only writer
--     (saveAttireGuidePaletteColor, behind wedding-attire-guide.tsx) hung off a
--     component that `origin/main` imports from nowhere.
-- So `COALESCE(attire_guide_palette, '{}')` has ALWAYS evaluated to `{}` for
-- every vendor on every event. There is no information here to preserve, and
-- `'{}'::jsonb` is byte-identical to what production has always returned.
--
-- 🔑 AND THE VENDOR IS ALREADY INFORMED, BY THE KEY NEXT DOOR. `role_palette`
-- is already on this same wire as `'palette'`, and the vendor client page
-- already RENDERS every attire role from it via PALETTE_LABELS — Bride, Groom,
-- Guest dress code, Wedding party, VIP family, Principal/Secondary sponsors,
-- Bearers & flower girl, Officiants. Feeding role_palette into `attire_guide`
-- too would ship a SECOND, COMPETING COPY of one fact — the exact failure the
-- repo's RULE 0 §8 near-miss describes — and would silently change the key's
-- VALUE shape from `{role: "#hex"}` to `{role: ["#hex", …]}` while we were
-- claiming to protect the contract. It would also mislabel `role_palette`'s
-- non-attire members (`ceremony`, `reception` are venue/decor palettes) as
-- attire. Blanking a key that was always blank is the honest option; inventing
-- data under a stale name is not.
--
-- ➡ IF A REAL ATTIRE GUIDE IS REBUILT, it should read `role_palette` and be
-- named for it — not resurrect this key.
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
         e.ceremony_type, e.role_palette,
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
  --   * palette + monogram (style is quote-relevant + safe). attire_guide is
  --     now a shape-preserving empty constant — see this migration's header.
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
      -- attire_guide: SHAPE-PRESERVING CONSTANT. See this migration's header.
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
    -- attire_guide: SHAPE-PRESERVING CONSTANT. See this migration's header.
    'attire_guide', '{}'::jsonb,
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
  'The vendor-facing Customer Card brief, on a THREE-rung disclosure ladder (PR-H slice B). booked = a live post-contract event_vendors row; requested = the couple has ASKED and this supplier has not answered (lock_request_state = ''pending''); inquiry = an accepted chat thread. Anything else raises not_booked. 🔒 requested and inquiry SHARE ONE PAYLOAD BY CONSTRUCTION — venue_name and venue_address are hard-NULL, timeline is [], seat_plan is zeroed and dietary is NULL for both — so the venue address and the run-of-show are earned by an AGREEMENT and never by an ask. Do not give ''requested'' a payload of its own: the single build object IS the ceiling, and it is what stops a later field from reaching a supplier who can still decline. The only key ''requested'' adds is lock_request, every field of which is a fact about the supplier''s own row rather than about the wedding. ⚠ attire_guide is a SHAPE-PRESERVING EMPTY CONSTANT since 20271198063551: events.attire_guide_palette was dropped by 20271193010764 and had never been written for ANY event (measured against prod 2026-09-03: 0 of 5 rows non-empty), so this function had in practice always returned an empty object for it. The key is retained at ''{}'' purely so no caller''s shape changes. Per-role colour lives in events.role_palette, which this same function already returns as ''palette''. Do NOT re-source attire_guide from role_palette: that would be a second, competing copy of one fact under a stale name, and would change the key''s value shape from a hex string to an array of them.';
