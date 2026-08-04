-- ============================================================================
-- 20271001130000_papic_challenge_all_tiers_flag.sql
-- Open Papic Challenge creation to ALL tiers under the 2026-07-25 vendor
-- monetization model (owner-locked) — flag-dark.
--
-- The model prices Papic Challenge for Free/Solo (₱500) AND Pro/Ent (₱400), i.e.
-- every tier may sponsor it (was Solo-and-up per 20270906348207). This migration:
--   1. Adds platform_settings.vendor_addon_tiered_pricing_enabled — the DB mirror
--      of the NEXT_PUBLIC_VENDOR_ADDON_TIERED_PRICING env flag (SQL can't read
--      env; the owner flips both together at go-live). It gates the SQL-side
--      add-on tier opens.
--   2. Makes the tier gate in papic_create_vendor_challenge CONDITIONAL on it:
--      ON  → free/verified may also create (they pay the entry price);
--      OFF (default) → the pre-2026-07-25 Solo+ gate stands, VERBATIM.
--
-- The RPC body is otherwise identical to 20270906348207_papic_challenge_solo_tier
-- (CREATE OR REPLACE, signature unchanged → grants preserved). SHIP-DARK: the
-- flag defaults FALSE, so the create gate behaves exactly as today until flipped.
-- NB: opening the RPC alone is user-inert until the buy action + UI also pass the
-- flag (a follow-up PR) — the TS eligibility (photoChallengeEligibility) still
-- gates the purchase surface.
-- ============================================================================

ALTER TABLE public.platform_settings
  ADD COLUMN IF NOT EXISTS vendor_addon_tiered_pricing_enabled BOOLEAN NOT NULL DEFAULT FALSE;

COMMENT ON COLUMN public.platform_settings.vendor_addon_tiered_pricing_enabled IS
  'DB mirror of NEXT_PUBLIC_VENDOR_ADDON_TIERED_PRICING (2026-07-25 tiered add-on model). Flip together with the env flag. Gates SQL-side add-on tier opens (e.g. papic_create_vendor_challenge all-tiers). Default FALSE = inert.';

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
  v_all_tiers       BOOLEAN;
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

  -- BOOKED-only: the caller must own a booked event_vendors row for this event;
  -- read the tier in the same pass for the gate below.
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

  -- 2026-07-25 tiered add-on model: when enabled, Papic Challenge opens to ALL
  -- tiers (free/verified pay the entry price); otherwise the pre-2026-07-25
  -- paid-tier gate (Solo/Pro/Enterprise/Custom) stands verbatim.
  SELECT COALESCE(ps.vendor_addon_tiered_pricing_enabled, FALSE)
    INTO v_all_tiers
    FROM public.platform_settings ps
   WHERE ps.id = 1;

  IF NOT COALESCE(v_all_tiers, FALSE) THEN
    IF v_tier IS NULL OR v_tier NOT IN ('solo', 'pro', 'enterprise', 'custom') THEN
      RAISE EXCEPTION 'custom challenges require a paid vendor plan (Solo, Pro, Enterprise, or Custom)';
    END IF;
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
