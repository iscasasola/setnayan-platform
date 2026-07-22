-- Papic Games — open the custom-challenge create gate to SOLO (owner 2026-07-22).
-- Owner priced the custom challenge at ₱400/event for SOLO, PRO, ENTERPRISE —
-- extending eligibility DOWN to Solo (was Pro-and-up). 'custom' (bespoke top
-- tier) stays eligible. Only the tier gate in papic_create_vendor_challenge
-- changes; everything else (booked-gate, copy bounds, approved=false) is verbatim
-- from 20270902380131. CREATE OR REPLACE (signature unchanged → grants preserved).
--
-- NOTE on the ₱400 CHARGE: there is no vendor per-event payment primitive (tokens
-- retired), so this does NOT collect the ₱400 — during free-during-launch creation
-- is open to the paid tiers with ₱400 as the recorded price; a per-event
-- apply-then-pay gate is deferred until paying vendors exist (owner call).

BEGIN;

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
  -- tier for the paid-tier gate in the same pass.
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

  -- Paid-tier gate (§3.4). Owner 2026-07-22: ₱400/event for SOLO, PRO, ENTERPRISE
  -- (eligibility extended DOWN to Solo). 'custom' (the bespoke tier above
  -- Enterprise) stays eligible. free/verified vendors get an upsell in the UI,
  -- not a create. (During free-during-launch the ₱400 is the recorded price;
  -- per-event collection is deferred — see the header note.)
  IF v_tier IS NULL OR v_tier NOT IN ('solo', 'pro', 'enterprise', 'custom') THEN
    RAISE EXCEPTION 'custom challenges require a paid vendor plan (Solo, Pro, Enterprise, or Custom)';
  END IF;

  INSERT INTO public.papic_missions
    (event_id, mission_type, source, vendor_id, prompt, approved, is_active)
  VALUES
    (p_event_id, 'vendor_booth', 'vendor', v_event_vendor_id, v_prompt, false, true)
  RETURNING mission_id INTO v_mission_id;

  RETURN v_mission_id;
END;
$$;

COMMIT;
