-- Papic Games — Phase 4a: custom vendor challenge data layer (spec §3.4 / §3.6).
-- A BOOKED vendor authors a custom challenge; it lands hidden (approved=false)
-- until the COUPLE taps approve (§3.6 — a vendor is writing on the couple's
-- surface). Three RPCs; no table changes (Phase 1's papic_missions already
-- carries source/vendor_id/approved). Flag-gated at the call site
-- (NEXT_PUBLIC_PAPIC_GAMES_V1) — nothing here runs until the app calls them.
--
-- Why SECURITY DEFINER: event_vendors has NO vendor-facing RLS ("it's a couple
-- table"), and papic_missions' member policy is couple/coordinator+admin only —
-- a vendor can neither read nor write it directly. These RPCs self-resolve the
-- caller's vendor_profile_ids and booked-gate on event_vendors.marketplace_vendor_id,
-- mirroring get_vendor_event_brief.
--
-- ⚠ PRICING GAP (surfaced, not silently decided): §3.4 prices the custom
-- challenge at "₱400/event · UNLIMITED on Pro+" (the ₱400 anchored to 2 retired
-- tokens). Tokens are retired and there is NO per-event vendor add-on entitlement
-- table, so the ₱400 pay-per-event path for Solo/Verified vendors is NOT buildable
-- yet. This layer enforces the buildable half — paid Pro-and-up
-- (pro/enterprise/custom) unlimited, which is exactly the "upgrade to Pro on
-- challenges alone" crossover. The Solo pay-per-use path is deferred to a vendor
-- add-on entitlement (owner sign-off).

BEGIN;

-- ---------------------------------------------------------------------------
-- 1) papic_create_vendor_challenge — a booked Pro/Ent vendor authors custom copy.
--    Lands approved=false (couple must approve, §3.6). Returns the new mission_id.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.papic_create_vendor_challenge(
  p_event_id UUID,
  p_prompt   TEXT
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_profile_ids     UUID[];
  v_event_vendor_id UUID;
  v_tier            public.vendor_tier_state;
  v_prompt          TEXT;
  v_mission_id      UUID;
BEGIN
  -- Normalize + bound the copy to the papic_missions length(prompt) 1..280 CHECK,
  -- so a bad prompt fails here with a clear message rather than at the INSERT.
  v_prompt := btrim(coalesce(p_prompt, ''));
  IF length(v_prompt) = 0 THEN
    RAISE EXCEPTION 'prompt is required';
  END IF;
  IF length(v_prompt) > 280 THEN
    RAISE EXCEPTION 'prompt must be 280 characters or fewer';
  END IF;

  -- The caller's vendor identity (owner + admin team members).
  SELECT array_agg(v) INTO v_profile_ids FROM public.current_vendor_profile_ids() AS v;
  IF v_profile_ids IS NULL OR array_length(v_profile_ids, 1) IS NULL THEN
    RAISE EXCEPTION 'not a vendor';
  END IF;

  -- BOOKED-only (§3.3/§3.4): the caller must own a booked event_vendors row for
  -- this event. That row's vendor_id becomes the mission's vendor_id (the
  -- same-event guard trigger re-checks it belongs to p_event_id). Also read the
  -- tier for the Pro/Ent gate in the same pass.
  SELECT ev.vendor_id, vp.tier_state
    INTO v_event_vendor_id, v_tier
  FROM public.event_vendors ev
  JOIN public.vendor_profiles vp ON vp.vendor_profile_id = ev.marketplace_vendor_id
  WHERE ev.event_id = p_event_id
    AND ev.marketplace_vendor_id = ANY(v_profile_ids)
    AND ev.status IN ('contracted', 'deposit_paid', 'delivered', 'complete')
  ORDER BY ev.created_at
  LIMIT 1;
  IF v_event_vendor_id IS NULL THEN
    RAISE EXCEPTION 'not booked for this event';
  END IF;

  -- Pro-and-up gate (§3.4 — "unlimited on Pro+"). Includes 'custom' (the
  -- truly-unlimited tier ABOVE Enterprise, added after the base enum) to match
  -- the ratified Pro+ precedents (creator_p2_spine, custom_plan_lapse_sweep) —
  -- omitting it would silently deny the highest-paying tier. free/verified/solo
  -- vendors get an upsell in the UI, not a create (the Solo ₱400/event add-on is
  -- deferred — see the header note).
  IF v_tier IS NULL OR v_tier NOT IN ('pro', 'enterprise', 'custom') THEN
    RAISE EXCEPTION 'custom challenges require a Pro, Enterprise, or Custom vendor plan';
  END IF;

  INSERT INTO public.papic_missions
    (event_id, mission_type, source, vendor_id, prompt, approved, is_active)
  VALUES
    (p_event_id, 'vendor_booth', 'vendor', v_event_vendor_id, v_prompt, false, true)
  RETURNING mission_id INTO v_mission_id;

  RETURN v_mission_id;
END;
$$;

REVOKE ALL ON FUNCTION public.papic_create_vendor_challenge(UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.papic_create_vendor_challenge(UUID, TEXT) TO authenticated;
COMMENT ON FUNCTION public.papic_create_vendor_challenge(UUID, TEXT) IS
  'Papic Games §3.4/§3.6: a booked Pro/Enterprise vendor authors a custom challenge (approved=false until the couple approves). SECURITY DEFINER — booked-gated on event_vendors.marketplace_vendor_id.';

-- ---------------------------------------------------------------------------
-- 2) papic_review_vendor_challenge — the couple/coordinator approves or rejects
--    a PENDING vendor challenge (§3.6). Approve → live; reject → deactivated.
--    Returns true when a pending row was actioned.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.papic_review_vendor_challenge(
  p_mission_id UUID,
  p_approve    BOOLEAN
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_event_id UUID;
  v_rows     INTEGER;
BEGIN
  -- Only a PENDING vendor challenge is actionable (source=vendor, approved=false,
  -- still active). FOR UPDATE serializes a double-tap into a single winner.
  SELECT event_id INTO v_event_id
  FROM public.papic_missions
  WHERE mission_id = p_mission_id
    AND source = 'vendor'
    AND approved = false
    AND is_active = true
  FOR UPDATE;
  IF v_event_id IS NULL THEN
    RAISE EXCEPTION 'no pending vendor challenge for this mission';
  END IF;

  -- Couple / coordinator of THIS event only (admin override for support).
  IF NOT (public.is_admin() OR EXISTS (
    SELECT 1 FROM public.event_members em
    WHERE em.event_id = v_event_id
      AND em.user_id = auth.uid()
      AND em.member_type IN ('couple', 'coordinator')
  )) THEN
    RAISE EXCEPTION 'not authorized to review this challenge';
  END IF;

  IF p_approve THEN
    -- Approve → goes live (isMissionLive = is_active AND approved).
    UPDATE public.papic_missions
    SET approved = true, updated_at = NOW()
    WHERE mission_id = p_mission_id
      AND source = 'vendor' AND approved = false AND is_active = true;
  ELSE
    -- Reject → deactivate; it stays approved=false and never shows to guests.
    UPDATE public.papic_missions
    SET is_active = false, updated_at = NOW()
    WHERE mission_id = p_mission_id
      AND source = 'vendor' AND approved = false AND is_active = true;
  END IF;
  GET DIAGNOSTICS v_rows = ROW_COUNT;
  RETURN v_rows > 0;
END;
$$;

REVOKE ALL ON FUNCTION public.papic_review_vendor_challenge(UUID, BOOLEAN) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.papic_review_vendor_challenge(UUID, BOOLEAN) TO authenticated;
COMMENT ON FUNCTION public.papic_review_vendor_challenge(UUID, BOOLEAN) IS
  'Papic Games §3.6: couple/coordinator approves (→ live) or rejects (→ deactivated) a pending vendor custom challenge. SECURITY DEFINER; couple/coordinator/admin of the event only.';

-- ---------------------------------------------------------------------------
-- 3) papic_vendor_challenges — a booked vendor reads THEIR OWN challenges for an
--    event + status + completion count (a non-PII aggregate; the PHOTOS stay
--    DPO-gated in Phase 5). Booked-gated like the create RPC.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.papic_vendor_challenges(p_event_id UUID)
RETURNS TABLE (
  mission_id  UUID,
  prompt      TEXT,
  approved    BOOLEAN,
  is_active   BOOLEAN,
  created_at  TIMESTAMPTZ,
  completions BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
DECLARE
  v_profile_ids UUID[];
BEGIN
  SELECT array_agg(v) INTO v_profile_ids FROM public.current_vendor_profile_ids() AS v;
  IF v_profile_ids IS NULL OR array_length(v_profile_ids, 1) IS NULL THEN
    RETURN;  -- not a vendor → empty set
  END IF;

  RETURN QUERY
  SELECT m.mission_id, m.prompt, m.approved, m.is_active, m.created_at,
         (SELECT count(*) FROM public.papic_mission_completions c
          WHERE c.mission_id = m.mission_id) AS completions
  FROM public.papic_missions m
  JOIN public.event_vendors ev ON ev.vendor_id = m.vendor_id
  WHERE m.event_id = p_event_id
    AND m.source = 'vendor'
    AND ev.marketplace_vendor_id = ANY(v_profile_ids)
    AND ev.status IN ('contracted', 'deposit_paid', 'delivered', 'complete')
  ORDER BY m.created_at DESC;
END;
$$;

REVOKE ALL ON FUNCTION public.papic_vendor_challenges(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.papic_vendor_challenges(UUID) TO authenticated;
COMMENT ON FUNCTION public.papic_vendor_challenges(UUID) IS
  'Papic Games §3.4: a booked vendor reads their own custom challenges for an event + status + completion count (aggregate only; photos stay DPO-gated). SECURITY DEFINER, booked-gated.';

COMMIT;
