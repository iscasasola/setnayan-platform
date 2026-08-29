-- challenges_are_for_paid_plans
-- ============================================================================
-- OWNER 2026-08-29, verbatim: **"Solo and Pro can buy Papic Challenges. they can
-- only but if they are solo,pro,enterprise,custom. but not when they are free"**
--
-- Said in the same message as: *"NEXT_PUBLIC_VENDOR_ADDON_TIERED_PRICING was 0
-- and now i made it true and redeployed."*
--
-- ┌───────────────────────────────────────────────────────────────────────────┐
-- │ 🚨 THAT FLIP OPENED THE DOOR HE IS NOW CLOSING, AND THIS IS THE FIX.      │
-- └───────────────────────────────────────────────────────────────────────────┘
-- The 2026-07-25 tiered add-on model made ONE switch answer TWO questions:
-- which PRICE BAND a shop pays, and WHETHER IT MAY BUY AT ALL. Both this RPC and
-- the TypeScript gate read it as *"all tiers allowed"*, so the moment the switch
-- went on, a **FREE** shop could author Papic Challenges. Inert in fact — prod
-- holds 0 vendor missions ever — but open.
--
-- 🔑 ONE SWITCH ANSWERING TWO QUESTIONS IS HOW A PRICE CHANGE SILENTLY BECOMES
--    AN ACCESS CHANGE. The flag keeps its PRICE job. The floor becomes its own
--    unconditional rule, on both sides of the wire, and neither can be widened
--    by moving a price.
--
-- ⚖ AND THE RULE HE STATED IS THE ONE THIS FUNCTION ALREADY HAD. Before the
--    tiered model was introduced (20270906348207) the gate read
--    `('solo','pro','enterprise','custom')` — exactly his four. 20271001130000
--    made it conditional. This restores it as an unconditional floor. **The
--    owner has re-ruled his way back to the pre-flag behaviour**, which is worth
--    recording: the flag's access half was never a decision he made, it was a
--    side effect of a pricing model.
--
-- ⚠ `verified` IS REFUSED AND HE NAMED IT NEITHER WAY. It is the LEGACY FREE
--    tier — a real, checked business on the ₱0 plan — so it falls under *"not
--    when they are free"*. Stated here and in `PHOTO_CHALLENGE_MIN_TIER` rather
--    than buried: if a verified free shop should be admitted, those are the two
--    places to change.
--
-- ⛔ SCOPE: **Papic Challenges only.** The same flag also lifts the tier gate on
--    the **3D Booth** (`booth-addon-actions.ts` + the subscription card), which
--    is likewise now open to free shops. That is what the 2026-07-25 model says
--    should happen, and the owner ruled about Papic Challenges. **Surfaced to
--    him, deliberately NOT changed here** — applying one product's ruling to
--    another product is assuming, and it is the kind of assumption that is
--    invisible afterwards.
--
-- ⚠ Body copied from the LIVE object (`pg_get_functiondef`, read 2026-08-29),
--    never from the migration that last touched it. Diff: the conditional tier
--    block becomes unconditional, and `v_all_tiers` + its read of
--    platform_settings are removed with it — a variable kept "just in case" is
--    how the condition grows back.
--
-- Idempotent: CREATE OR REPLACE only. No schema change, no grant change.
-- ============================================================================

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
  v_profile_ids       UUID[];
  v_event_vendor_id   UUID;
  v_vendor_profile_id UUID;
  v_tier              public.vendor_tier_state;
  v_prompt            TEXT;
  v_mission_id        UUID;
BEGIN
  -- Normalize + bound the copy to the papic_missions length(prompt) 1..280 CHECK.
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

  -- BOOKED-only: the caller must own a booked event_vendors row for this event.
  -- Capture the marketplace vendor_profile_id (for the entitlement gate) and the
  -- tier (for the paid-plan floor) in the same pass.
  SELECT ev.vendor_id, vp.vendor_profile_id, vp.tier_state
    INTO v_event_vendor_id, v_vendor_profile_id, v_tier
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

  -- PAID-PLAN FLOOR, UNCONDITIONAL (owner 2026-08-29). Not gated on
  -- platform_settings.vendor_addon_tiered_pricing_enabled any more: that switch
  -- decides the PRICE BAND, and letting it decide ACCESS is what put a free shop
  -- inside this function the day it was turned on.
  IF v_tier IS NULL OR v_tier NOT IN ('solo', 'pro', 'enterprise', 'custom') THEN
    RAISE EXCEPTION 'Papic Challenges comes with a paid plan (Solo, Pro, Enterprise or Custom)';
  END IF;

  -- PAID gate: the shop must hold a live 28-day subscription. Apply-then-pay —
  -- the window is written by the sku-activation hook on admin payment approval,
  -- so this is also the payment-verified handshake.
  IF NOT public.vendor_papic_challenge_entitled(v_vendor_profile_id, p_event_id) THEN
    RAISE EXCEPTION 'PAPIC_CHALLENGE_NOT_SUBSCRIBED: turn on Papic Challenges for your shop first';
  END IF;

  INSERT INTO public.papic_missions
    (event_id, mission_type, source, vendor_id, prompt, approved, is_active)
  VALUES
    (p_event_id, 'vendor_booth', 'vendor', v_event_vendor_id, v_prompt, false, true)
  RETURNING mission_id INTO v_mission_id;

  RETURN v_mission_id;
END;
$$;

COMMENT ON FUNCTION public.papic_create_vendor_challenge(UUID, TEXT) IS
  'Papic Games §3.4/§3.6: a BOOKED vendor on a PAID plan (solo/pro/enterprise/custom — owner 2026-08-29, "not when they are free") whose shop holds a live Papic Challenges subscription authors a custom challenge (approved=false until the couple approves). SECURITY DEFINER; booked + paid-plan floor + paid-subscription gated, the last through vendor_papic_challenge_entitled(). ⚠ THE TIER FLOOR IS UNCONDITIONAL AND MUST STAY SO: it was previously gated on platform_settings.vendor_addon_tiered_pricing_enabled, which meant flipping a PRICE switch admitted free shops. One switch must not answer both "what does it cost" and "who may buy". ⚠ And if you replace this function, keep the entitlement call — it was silently deleted once by a CREATE OR REPLACE that rebased on an older body.';

COMMIT;
