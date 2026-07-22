-- Papic Games — target_role fail-open guard (gap analysis #7).
-- papic_missions has target_role (a public.guest_role) for role-scoped roster
-- missions, but NO read path ever consulted it: a mission with target_role set +
-- target_guest_id NULL took the "target_guest_id IS NULL → show to everyone"
-- branch, LEAKING a role-scoped mission to every guest. It is latent today (no
-- writer sets target_role yet), but this closes the trap before roster authoring
-- lands. Both guest RPCs now also filter on the guest's own role. Same signatures
-- → CREATE OR REPLACE; flag-gated at the call site.

BEGIN;

-- ---------------------------------------------------------------------------
-- Reader: resolve the guest's role and scope role-targeted missions to it.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.papic_guest_missions(p_guest_id UUID)
RETURNS TABLE (
  mission_id      UUID,
  mission_type    TEXT,
  prompt          TEXT,
  vendor_id       UUID,
  vendor_name     TEXT,
  target_guest_id UUID,
  target_role     public.guest_role,
  completed       BOOLEAN,
  consent_shared  BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
DECLARE
  v_event_id   UUID;
  v_guest_role public.guest_role;
BEGIN
  SELECT g.event_id, g.role INTO v_event_id, v_guest_role
  FROM public.guests g
  WHERE g.guest_id = p_guest_id AND g.deleted_at IS NULL;
  IF v_event_id IS NULL THEN
    RETURN;  -- unknown / deleted guest → empty set
  END IF;

  RETURN QUERY
  SELECT m.mission_id, m.mission_type, m.prompt, m.vendor_id, ev.vendor_name,
         m.target_guest_id, m.target_role,
         (c.completion_id IS NOT NULL) AS completed,
         COALESCE(c.consent_to_share, false) AS consent_shared
  FROM public.papic_missions m
  LEFT JOIN public.event_vendors ev ON ev.vendor_id = m.vendor_id
  LEFT JOIN public.papic_mission_completions c
    ON c.mission_id = m.mission_id AND c.guest_id = p_guest_id
  WHERE m.event_id = v_event_id
    AND m.is_active
    AND m.approved
    -- targeted (roster) missions show only to the targeted guest; general missions show to all.
    AND (m.target_guest_id IS NULL OR m.target_guest_id = p_guest_id)
    -- role-scoped missions show only to a guest of that role (fail-CLOSED: a
    -- role-targeted mission never leaks to everyone).
    AND (m.target_role IS NULL OR m.target_role = v_guest_role)
  ORDER BY m.created_at;
END;
$$;

-- ---------------------------------------------------------------------------
-- Completion: a guest can't complete a mission targeted to a role they aren't.
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
  v_guest_event    UUID;
  v_guest_role     public.guest_role;
  v_mission_event  UUID;
  v_mission_vendor UUID;
  v_consent        BOOLEAN;
  v_completion_id  UUID;
BEGIN
  SELECT g.event_id, g.role INTO v_guest_event, v_guest_role
  FROM public.guests g
  WHERE g.guest_id = p_guest_id AND g.deleted_at IS NULL;
  IF v_guest_event IS NULL THEN
    RAISE EXCEPTION 'unknown guest';
  END IF;

  -- the mission must be live and belong to the guest's OWN event, and — if
  -- targeted — to this guest (target_guest_id) or this guest's role (target_role).
  SELECT m.event_id, m.vendor_id INTO v_mission_event, v_mission_vendor
  FROM public.papic_missions m
  WHERE m.mission_id = p_mission_id
    AND m.is_active
    AND m.approved
    AND (m.target_guest_id IS NULL OR m.target_guest_id = p_guest_id)
    AND (m.target_role IS NULL OR m.target_role = v_guest_role);
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

  -- Consent only means something for a VENDOR mission (there's a business to share
  -- with). Vendorless (couple/generic) missions never carry share consent.
  v_consent := COALESCE(p_consent_to_share, false) AND v_mission_vendor IS NOT NULL;

  PERFORM pg_advisory_xact_lock(hashtextextended(p_guest_id::text, 0));

  INSERT INTO public.papic_mission_completions
    (mission_id, event_id, guest_id, capture_id, consent_to_share)
  VALUES
    (p_mission_id, v_guest_event, p_guest_id, p_capture_id, v_consent)
  ON CONFLICT (mission_id, guest_id) DO UPDATE
    SET capture_id = EXCLUDED.capture_id,
        consent_to_share = EXCLUDED.consent_to_share
  RETURNING completion_id INTO v_completion_id;

  RETURN v_completion_id;
END;
$$;

COMMIT;
