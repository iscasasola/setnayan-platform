-- ═══════════════════════════════════════════════════════════════════════════
-- FIND-MY-SEAT for the floor coordinator — one question, one answer.
-- Build plan §10 #5 (coordinator find-my-seat scanner). 2026-07-27.
-- ═══════════════════════════════════════════════════════════════════════════
--
-- NO NEW SCHEMA. No table, no column, no enum — this is a read over
-- `guests` ⨝ `event_seat_assignments` ⨝ `event_tables` that already exist,
-- shaped exactly like the #3607 seat-finder RPC (`public_seat_lookup`) it is
-- modelled on.
--
-- WHY A FUNCTION AND NOT A POLICY. A booked vendor deliberately cannot read
-- `guests`, `event_seat_assignments` or `event_tables` — `get_vendor_seat_plan`
-- (20261202000000) hands them per-table COUNTS and never a person. That is the
-- right default and this migration does not change it: no policy is added or
-- widened, and after this the coordinator still cannot list the guests, browse
-- the seating, or read a name.
--
-- WHAT IT DISCLOSES, EXACTLY. Given a QR token the coordinator is physically
-- holding, it returns the table label for that ONE guest and nothing else — no
-- name, no guest id, no seat number, no neighbours, no meal preference. It
-- cannot be enumerated: `guests.qr_token` is 16 random bytes, so a caller who
-- does not have the card in their hand has nothing to ask about.
--
-- ⚠ BEING THE COORDINATOR IS NOT ENOUGH. Owner ruling 2026-07-27: "coordinator
-- will ask for access from the host; host must approve what features they want
-- to share with the vendor." So booking does NOT self-grant this. The host must
-- have shared the SEAT PLAN with this person through the delegate mechanism
-- that already ships — `event_moderators.permissions_json.areas.seat_plan`,
-- resolved by `moderator_area_level` (20261129003000). Revoke the area and this
-- function goes dark for them the same minute, with no code change.
--
-- THE GATES (all five, in order):
--   1. the caller is a vendor (own profile or a team member of one);
--   2. they are BOOKED on this event (same statuses as
--      current_vendor_booked_event_ids);
--   3. they carry the `coordinator` tile — this is the floor coordinator's
--      tool, not every supplier's;
--   4. THE HOST HAS SHARED THE SEAT PLAN with them
--      (`moderator_area_level(event_id,'seat_plan') IS NOT NULL`) — 'view' is
--      enough, since this only ever reads;
--   5. the seat plan is PUBLISHED (`event_floor_plan.published_at IS NOT NULL`)
--      — the same published-map gate `public_seat_lookup` and
--      `get_vendor_seat_plan` both use. A draft plan answers nothing.
--
-- Returns JSONB so "not on this event" and "on the list but not seated yet"
-- stay distinguishable — they send the coordinator to different people (the
-- couple vs the seating plan). See resolveSeatScan in lib/floor-command.ts.

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
  v_published TIMESTAMPTZ;
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

  -- 5 · the plan must be PUBLISHED
  SELECT fp.published_at INTO v_published
  FROM public.event_floor_plan fp WHERE fp.event_id = p_event_id;
  IF v_published IS NULL THEN
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
  'Find-my-seat for the floor coordinator: given a guest QR token they are physically holding, return that ONE guest''s table label and nothing else — no name, no guest id, no neighbours. Gated on booked + coordinator tile + a PUBLISHED floor plan. Adds no table, column or policy: a booked vendor still cannot read guests, seat assignments or tables directly (get_vendor_seat_plan gives them counts, never people).';

-- Name the roles explicitly — Supabase's default privileges give anon and
-- authenticated their OWN EXECUTE entry at CREATE time, which `FROM PUBLIC`
-- alone does not remove (supabase/security/README.md).
REVOKE ALL ON FUNCTION public.coordinator_seat_by_guest_qr(UUID, TEXT)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.coordinator_seat_by_guest_qr(UUID, TEXT) TO authenticated;
