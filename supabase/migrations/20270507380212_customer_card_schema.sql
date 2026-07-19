-- ============================================================================
-- CUSTOMER CARD RESPINE — SCHEMA slice (PR-1, migration-only)
-- (corpus design source: 03_Strategy/Customer_Card_Prototype_2026-07-03.html)
--
-- Two deliverables, both vendor-org scoped:
--   1. vendor_client_notes — private, TEAM-SHARED CRM notes attached to a
--      (vendor org, event) pair. Follow-up reminders + done flag.
--   2. get_vendor_event_brief — made STAGE-AWARE: today it hard-raises unless
--      the vendor is BOOKED; now an ACCEPTED-inquiry vendor gets a LIMITED,
--      quote-relevant brief (the disclosure ladder, owner-approved 2026-07-03).
--
-- Precedents mirrored:
--   * vendor_proposals (20261208006000) — vendor-org RLS idioms.
--   * event_schedule_suggestions / internal vendor tables — NO public_id
--     (notes are never customer-facing; internal-table precedent wins).
--   * get_vendor_event_brief (20261128000000) — SECURITY DEFINER hardening,
--     inlined vendor-org resolution, booked gate.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1 · vendor_client_notes
--
-- PRIVACY LOCK (mirrors the owner's admin account-access lock: private
-- client-relationship content is OFF-LIMITS to admins). These are the vendor
-- team's own CRM notes about a couple. There is DELIBERATELY:
--   * no couple/host RLS policy  — couples never see the vendor's private notes
--   * no admin RLS policy        — Setnayan HQ / is_admin() cannot read them
-- Only the owning vendor org's members (owner + team) can touch these rows.
-- Do NOT add a couple or admin policy in a later PR without owner sign-off.
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.vendor_client_notes (
  note_id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_profile_id  UUID NOT NULL
                     REFERENCES public.vendor_profiles(vendor_profile_id) ON DELETE CASCADE,
  event_id           UUID NOT NULL REFERENCES public.events(event_id) ON DELETE CASCADE,
  -- Which team member wrote the note (not an FK gate — team-shared; kept for
  -- attribution/display only, so a departed member's rows survive).
  author_user_id     UUID NOT NULL,
  body               TEXT NOT NULL CHECK (length(body) BETWEEN 1 AND 2000),
  -- Optional follow-up reminder date (e.g. "chase down-payment on the 15th").
  remind_at          DATE,
  -- Set when the note/reminder is marked handled.
  done_at            TIMESTAMPTZ,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS vendor_client_notes_vendor_event_idx
  ON public.vendor_client_notes(vendor_profile_id, event_id, created_at DESC);

ALTER TABLE public.vendor_client_notes ENABLE ROW LEVEL SECURITY;

-- Vendor org (owner + team) gets full CRUD on its OWN org's notes. Team-shared:
-- any member can edit/delete any note in the org (author-only is NOT required).
-- current_vendor_profile_ids() resolves the caller's owned + team-member orgs,
-- exactly as the vendor_proposals precedent does.
DROP POLICY IF EXISTS vendor_client_notes_org_all ON public.vendor_client_notes;
CREATE POLICY vendor_client_notes_org_all
  ON public.vendor_client_notes FOR ALL TO authenticated
  USING (vendor_profile_id IN (SELECT public.current_vendor_profile_ids()))
  WITH CHECK (vendor_profile_id IN (SELECT public.current_vendor_profile_ids()));

-- NOTE: intentionally NO couple/host policy and NO admin policy above.
-- Private team CRM content — off-limits to couples and to Setnayan HQ admins.

COMMENT ON TABLE public.vendor_client_notes IS
  'Private, team-shared CRM notes attached to a (vendor org, event) pair (Customer Card respine). Vendor-org-only RLS: no couple policy, no admin policy — off-limits to hosts and to Setnayan HQ (admin account-access lock).';

-- ----------------------------------------------------------------------------
-- 2 · get_vendor_event_brief — now STAGE-AWARE (booked | inquiry)
--
-- Change vs 20261128000000: instead of hard-raising when the vendor is not
-- BOOKED, we fall through to an INQUIRY stage when the caller's org has an
-- ACCEPTED chat thread for this event (chat_threads.inquiry_status='accepted',
-- keyed by event_id + vendor_profile_id — the same accepted-inquiry join
-- lib/chat.ts keys on). Inquiry stage returns the LIMITED, quote-relevant
-- payload (owner-approved disclosure ladder 2026-07-03); booked stage is
-- UNCHANGED from today plus a new top-level "stage" key. Still SECURITY DEFINER,
-- STABLE, search_path=public — hardening idioms preserved verbatim.
-- ----------------------------------------------------------------------------

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
  v_stage             TEXT;
  v_dietary_allowed   BOOLEAN;
  v_event             RECORD;
  v_pax               JSONB;
  v_dietary           JSONB;
  v_timeline          JSONB;
  v_seat_plan         JSONB;
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
    -- Not booked → INQUIRY stage if the org has an ACCEPTED chat thread for
    -- this event. chat_threads is UNIQUE(event_id, vendor_profile_id); an
    -- accepted thread is the vendor→couple handshake (lib/chat.ts § inquiry).
    IF EXISTS (
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
  SELECT e.display_name, e.event_date, e.venue_name, e.venue_address, e.region,
         e.ceremony_type, e.role_palette, e.attire_guide_palette,
         e.monogram_text, e.monogram_color, e.monogram_font_key,
         e.monogram_frame_key, e.monogram_custom_svg
  INTO v_event
  FROM public.events e
  WHERE e.event_id = p_event_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'event_not_found' USING ERRCODE = 'P0002';
  END IF;

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
  -- INQUIRY STAGE — LIMITED payload (disclosure ladder, owner-approved 2026-07-03)
  --   * event display_name + event_date + ceremony_type
  --   * CITY-GRAIN location only: region exposed; venue_name/venue_address NULL
  --   * pax TOTALS (quote inputs)
  --   * palette + monogram + attire_guide (style is quote-relevant + safe)
  --   * booked_categories = the inquiring categories if cheaply derivable, else []
  --   * timeline = [] · seat_plan zeroed · dietary NULL
  -- ==========================================================================
  IF v_stage = 'inquiry' THEN
    -- Cheaply-derivable inquiring categories: the event_vendors link rows for
    -- this org+event that are NOT yet booked (still shortlisted/inquiring).
    -- If none is derivable, fall back to [] per the brief.
    SELECT ARRAY_AGG(DISTINCT ev.category::TEXT) INTO v_inquiry_categories
    FROM public.event_vendors ev
    WHERE ev.event_id = p_event_id
      AND ev.marketplace_vendor_id = ANY (v_profile_ids);

    RETURN jsonb_build_object(
      'stage', 'inquiry',
      'event', jsonb_build_object(
        'display_name', v_event.display_name,
        'event_date', v_event.event_date,
        'venue_name', NULL,           -- city-grain only at inquiry stage
        'venue_address', NULL,        -- city-grain only at inquiry stage
        'region', v_event.region,     -- city / province grain
        'ceremony_type', v_event.ceremony_type
      ),
      'booked_categories', COALESCE(to_jsonb(v_inquiry_categories), '[]'::jsonb),
      'pax', v_pax,
      'dietary', NULL,
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
  -- BOOKED STAGE — full payload, UNCHANGED from 20261128000000 (plus "stage").
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

REVOKE ALL ON FUNCTION public.get_vendor_event_brief(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_vendor_event_brief(UUID) FROM anon;
GRANT EXECUTE ON FUNCTION public.get_vendor_event_brief(UUID) TO authenticated;

COMMENT ON FUNCTION public.get_vendor_event_brief(UUID) IS
  'Stage-aware Vendor Event Brief (Customer Card respine). BOOKED vendors get the full aggregates-only brief; ACCEPTED-inquiry vendors get a LIMITED quote-relevant payload (city-grain location, pax totals, style, no timeline/seat/dietary). Top-level "stage" key = booked|inquiry. Guest PII never crosses.';
