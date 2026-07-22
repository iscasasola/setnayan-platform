-- Papic Games — consent rework (spec §4.1 fidelity · RA 10173).
-- The §4 share consent was a single panel-level toggle applied to every completion.
-- This makes it PER-MISSION, naming the vendor ("Share this photo with <vendor>?"),
-- and adds a withdrawal path — the RA 10173 "specific + freely given + as easy to
-- withdraw as to grant" standard. Three changes, all flag-gated at the call site:
--   1. papic_guest_missions also returns vendor_name + this guest's consent_shared.
--   2. papic_complete_mission forces consent=false on VENDORLESS missions (no vendor
--      to share with → no junk consent rows in the §4.2 ledger).
--   3. papic_set_completion_consent(guest, mission, consent) — grant OR withdraw the
--      share on one completed vendor mission, without touching its capture.

BEGIN;

-- ---------------------------------------------------------------------------
-- 1) Reader: add vendor_name (the "Share with <vendor>?" label) + consent_shared
--    (this guest's current share state on the mission). Return-signature change,
--    so DROP + CREATE (CREATE OR REPLACE can't alter the OUT columns).
-- ---------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.papic_guest_missions(UUID);
CREATE FUNCTION public.papic_guest_missions(p_guest_id UUID)
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
  v_event_id UUID;
BEGIN
  SELECT g.event_id INTO v_event_id
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
  ORDER BY m.created_at;
END;
$$;

REVOKE ALL ON FUNCTION public.papic_guest_missions(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.papic_guest_missions(UUID) TO authenticated, anon;
COMMENT ON FUNCTION public.papic_guest_missions(UUID) IS
  'Papic Games §5#3: a guest reads their own event''s live missions + vendor_name + own completed/consent_shared flags. Zero-account guest (anon), SECURITY DEFINER.';

-- ---------------------------------------------------------------------------
-- 2) Completion: force consent=false on VENDORLESS missions. A couple/generic
--    mission has no vendor to share a photo with, so a "true" here would be a
--    junk row in the §4.2 consent ledger. Same signature → CREATE OR REPLACE.
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
  v_mission_event  UUID;
  v_mission_vendor UUID;
  v_consent        BOOLEAN;
  v_completion_id  UUID;
BEGIN
  SELECT g.event_id INTO v_guest_event
  FROM public.guests g
  WHERE g.guest_id = p_guest_id AND g.deleted_at IS NULL;
  IF v_guest_event IS NULL THEN
    RAISE EXCEPTION 'unknown guest';
  END IF;

  -- the mission must be live and belong to the guest's OWN event (and, if targeted, to this guest).
  SELECT m.event_id, m.vendor_id INTO v_mission_event, v_mission_vendor
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

REVOKE ALL ON FUNCTION public.papic_complete_mission(UUID, UUID, UUID, BOOLEAN) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.papic_complete_mission(UUID, UUID, UUID, BOOLEAN) TO authenticated, anon;
COMMENT ON FUNCTION public.papic_complete_mission(UUID, UUID, UUID, BOOLEAN) IS
  'Papic Games §4/§5#3: a guest records completing a mission + the per-photo share consent (vendor missions only; forced false when vendorless). Validates guest/mission/capture same-event; upsert one per (mission,guest). Anon, SECURITY DEFINER.';

-- ---------------------------------------------------------------------------
-- 3) Grant OR withdraw the share on ONE completed vendor mission — the §4.1
--    per-vendor tap + the RA 10173 §16 withdrawal path. Does NOT touch the
--    capture. Returns the effective share state (always false when vendorless).
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.papic_set_completion_consent(
  p_guest_id   UUID,
  p_mission_id UUID,
  p_consent    BOOLEAN
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_vendor  UUID;
  v_consent BOOLEAN;
BEGIN
  -- the completion must exist for THIS guest; read the mission's vendor.
  SELECT m.vendor_id
    INTO v_vendor
  FROM public.papic_mission_completions c
  JOIN public.papic_missions m ON m.mission_id = c.mission_id
  WHERE c.mission_id = p_mission_id AND c.guest_id = p_guest_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'no completion for this guest';
  END IF;

  -- Vendorless completions are never shareable — force false, ignore a true request.
  v_consent := COALESCE(p_consent, false) AND v_vendor IS NOT NULL;

  PERFORM pg_advisory_xact_lock(hashtextextended(p_guest_id::text, 0));
  UPDATE public.papic_mission_completions
  SET consent_to_share = v_consent
  WHERE mission_id = p_mission_id AND guest_id = p_guest_id;

  RETURN v_consent;
END;
$$;

REVOKE ALL ON FUNCTION public.papic_set_completion_consent(UUID, UUID, BOOLEAN) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.papic_set_completion_consent(UUID, UUID, BOOLEAN) TO authenticated, anon;
COMMENT ON FUNCTION public.papic_set_completion_consent(UUID, UUID, BOOLEAN) IS
  'Papic Games §4.1/RA 10173 §16: grant or withdraw the per-vendor share consent on a completed mission (vendor missions only). Anon, SECURITY DEFINER; does not touch the capture.';

COMMIT;
