-- Papic Games — Phase 3a: guest-facing RPCs (the data layer for the guest capture surface).
-- Spec §5 #3 / §4. Guests are the ZERO-ACCOUNT model — identified by guest_id from the
-- guest-session cookie, no Supabase auth session — so these are SECURITY DEFINER, granted
-- to anon, mirroring public.papic_record_guest_capture (advisory lock + anon grant).
-- Flag-gated at the call site (NEXT_PUBLIC_PAPIC_GAMES_V1).

BEGIN;

-- ---------------------------------------------------------------------------
-- Read the guest's event's LIVE missions + whether THIS guest has completed each.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.papic_guest_missions(p_guest_id UUID)
RETURNS TABLE (
  mission_id      UUID,
  mission_type    TEXT,
  prompt          TEXT,
  vendor_id       UUID,
  target_guest_id UUID,
  target_role     public.guest_role,
  completed       BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
DECLARE
  v_event_id UUID;
BEGIN
  SELECT g.event_id INTO v_event_id
  FROM public.guests g
  WHERE g.guest_id = p_guest_id AND g.deleted_at IS NULL;
  IF v_event_id IS NULL THEN
    RETURN;  -- unknown / deleted guest → empty set
  END IF;

  RETURN QUERY
  SELECT m.mission_id, m.mission_type, m.prompt, m.vendor_id, m.target_guest_id, m.target_role,
         EXISTS (
           SELECT 1 FROM public.papic_mission_completions c
           WHERE c.mission_id = m.mission_id AND c.guest_id = p_guest_id
         ) AS completed
  FROM public.papic_missions m
  WHERE m.event_id = v_event_id
    AND m.is_active
    AND m.approved
    -- targeted (roster) missions show only to the targeted guest; general missions show to all.
    AND (m.target_guest_id IS NULL OR m.target_guest_id = p_guest_id)
  ORDER BY m.created_at;
END;
$$;

REVOKE ALL ON FUNCTION public.papic_guest_missions(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.papic_guest_missions(UUID) TO authenticated, anon;
COMMENT ON FUNCTION public.papic_guest_missions(UUID) IS
  'Papic Games §5#3: a guest reads their own event''s live missions + own completion flags. Zero-account guest (anon), SECURITY DEFINER.';

-- ---------------------------------------------------------------------------
-- Record (or update) a guest's completion of a mission + the §4 per-photo consent.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.papic_complete_mission(
  p_guest_id         UUID,
  p_mission_id       UUID,
  p_capture_id       UUID DEFAULT NULL,
  p_consent_to_share BOOLEAN DEFAULT false
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_guest_event   UUID;
  v_mission_event UUID;
  v_completion_id UUID;
BEGIN
  SELECT g.event_id INTO v_guest_event
  FROM public.guests g
  WHERE g.guest_id = p_guest_id AND g.deleted_at IS NULL;
  IF v_guest_event IS NULL THEN
    RAISE EXCEPTION 'unknown guest';
  END IF;

  -- the mission must be live and belong to the guest's OWN event (and, if targeted, to this guest).
  SELECT m.event_id INTO v_mission_event
  FROM public.papic_missions m
  WHERE m.mission_id = p_mission_id
    AND m.is_active
    AND m.approved
    AND (m.target_guest_id IS NULL OR m.target_guest_id = p_guest_id);
  IF v_mission_event IS NULL OR v_mission_event IS DISTINCT FROM v_guest_event THEN
    RAISE EXCEPTION 'mission not available for this guest';
  END IF;

  -- a supplied capture must belong to THIS guest (same event) — no cross-guest photo attach.
  IF p_capture_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.papic_guest_captures c
    WHERE c.capture_id = p_capture_id AND c.guest_id = p_guest_id AND c.event_id = v_guest_event
  ) THEN
    RAISE EXCEPTION 'capture does not belong to this guest';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended(p_guest_id::text, 0));

  INSERT INTO public.papic_mission_completions
    (mission_id, event_id, guest_id, capture_id, consent_to_share)
  VALUES
    (p_mission_id, v_guest_event, p_guest_id, p_capture_id, COALESCE(p_consent_to_share, false))
  ON CONFLICT (mission_id, guest_id) DO UPDATE
    SET capture_id = EXCLUDED.capture_id,
        consent_to_share = EXCLUDED.consent_to_share
  RETURNING completion_id INTO v_completion_id;

  RETURN v_completion_id;
END;
$$;

REVOKE ALL ON FUNCTION public.papic_complete_mission(UUID, UUID, UUID, BOOLEAN) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.papic_complete_mission(UUID, UUID, UUID, BOOLEAN) TO authenticated, anon;
COMMENT ON FUNCTION public.papic_complete_mission(UUID, UUID, UUID, BOOLEAN) IS
  'Papic Games §4/§5#3: a guest records completing a mission + the per-photo share consent (RA 10173 explicit opt-in). Validates guest/mission/capture same-event; upsert one per (mission,guest). Anon, SECURITY DEFINER.';

COMMIT;
