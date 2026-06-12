-- ============================================================================
-- VENDOR EVENT BRIEF — Phase 1 of the feature-access-by-category program
-- (corpus: 03_Strategy/Feature_Access_By_Vendor_Category_2026-06-12.md § 2,
--  owner-locked 2026-06-12).
--
-- One SECURITY DEFINER read model: a vendor org with a live BOOKED
-- relationship to an event (event_vendors.status in the 4 post-contract
-- states, linked via marketplace_vendor_id) gets an aggregates-only brief:
-- pax/RSVP counts, palette swatches, monogram, full day-of timeline (locked
-- D2), seat-plan publication status, ceremony context.
--
-- PRIVACY GUARD (RA 10173, doc § 8): guest PII never crosses — this function
-- returns COUNTS from guests, never rows. Dietary/meal counts only surface to
-- food-relevant categories + the coordinator (doc § 7 matrix). Schedule block
-- `notes` (couple-private annotations) are excluded from the timeline.
--
-- No new tables, no new per-table vendor RLS — the booked gate and the
-- aggregation both live inside this function.
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

  -- 2 · Booked gate: access keys on BOOKED status (doc § 1 hard rule #1).
  SELECT ARRAY_AGG(DISTINCT ev.category::TEXT) INTO v_booked_categories
  FROM public.event_vendors ev
  WHERE ev.event_id = p_event_id
    AND ev.marketplace_vendor_id = ANY (v_profile_ids)
    AND ev.status IN ('contracted', 'deposit_paid', 'delivered', 'complete');

  IF v_booked_categories IS NULL THEN
    RAISE EXCEPTION 'not_booked' USING ERRCODE = '42501';
  END IF;

  -- Dietary counts: food-relevant categories + coordinator only (§ 7 matrix).
  v_dietary_allowed := v_booked_categories
    && ARRAY['catering', 'cake_maker', 'mobile_bar', 'venue', 'planner_coordinator'];

  SELECT e.display_name, e.event_date, e.venue_name, e.venue_address,
         e.ceremony_type, e.role_palette, e.attire_guide_palette,
         e.monogram_text, e.monogram_color, e.monogram_font_key,
         e.monogram_frame_key, e.monogram_custom_svg
  INTO v_event
  FROM public.events e
  WHERE e.event_id = p_event_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'event_not_found' USING ERRCODE = 'P0002';
  END IF;

  -- 3 · Pax: counts only, soft-deleted rows excluded (parity with the
  -- couple dashboard's computeGuestStats).
  SELECT jsonb_build_object(
    'invited',   COUNT(*),
    'attending', COUNT(*) FILTER (WHERE g.rsvp_status = 'attending'),
    'maybe',     COUNT(*) FILTER (WHERE g.rsvp_status = 'maybe'),
    'pending',   COUNT(*) FILTER (WHERE g.rsvp_status = 'pending'),
    'declined',  COUNT(*) FILTER (WHERE g.rsvp_status = 'declined')
  ) INTO v_pax
  FROM public.guests g
  WHERE g.event_id = p_event_id AND g.deleted_at IS NULL;

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
  'Vendor Event Brief (feature-access program Phase 1): aggregates-only event brief for vendors with a live booked event_vendors relationship. Guest PII never crosses; dietary counts gated to food-relevant categories + coordinator.';
