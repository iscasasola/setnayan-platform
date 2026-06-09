-- ============================================================================
-- 20261013000000_founder_vendor_overrides.sql
--
-- Owner 2026-06-09:
--   (1) Bump the founder vendor to `verified` tier.
--   (2) The founder vendor: unlimited categories + services (app caps) AND
--       full token-gate bypass (no tier gate, no weekly cap, no burn).
--
-- This adds a `vendor_profiles.is_founder` flag, sets it (+ verified tier) on
-- the single founder account, and teaches unlock_vendor_event to bypass all
-- token gating for a founder. The unlimited categories/services overrides live
-- in the app cap-check (vendor-dashboard/services/actions.ts reads is_founder).
-- ============================================================================

BEGIN;

-- (1) founder override flag (constant DEFAULT → fast, no table rewrite).
ALTER TABLE public.vendor_profiles
  ADD COLUMN IF NOT EXISTS is_founder BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN public.vendor_profiles.is_founder IS
  'Founder/owner vendor override (owner 2026-06-09). TRUE on the single Setnayan founder account only: unlimited parent-categories + services-per-leaf (enforced in vendor-dashboard/services/actions.ts) AND full token-gate bypass in unlock_vendor_event (no FREE block, no verified weekly cap, no burn). Not a tier — it composes on top of tier_state (founder is verified).';

-- (2) bump the founder vendor to verified + flag it. Idempotent.
UPDATE public.vendor_profiles
   SET tier_state = 'verified',
       is_founder = true
 WHERE vendor_profile_id = '646c9457-3450-412e-8d60-7281224da157';

-- (3) founder bypass in the burn-on-answer RPC. Identical to the 20260911000000
-- body EXCEPT: it also reads is_founder, and a founder unlocks unlimited
-- inquiries for free (no tier gate, no weekly cap, no token burn — just record
-- the unlock for idempotency). Everything else (FREE block · verified ≤10/wk ·
-- PRO/ENT 1-3 region-banded burn · idempotency · ownership) is unchanged.
CREATE OR REPLACE FUNCTION public.unlock_vendor_event(
  p_vendor_profile_id UUID,
  p_event_id          UUID
) RETURNS JSONB AS $$
DECLARE
  v_region     TEXT;
  v_tokens     INT;
  v_band       SMALLINT;
  v_tier       TEXT;
  v_already    BOOLEAN;
  v_week_count INT;
  v_rowcount   INT;
  v_paid       BOOLEAN;
  v_is_founder BOOLEAN;
BEGIN
  -- Ownership check (SECURITY DEFINER + granted to authenticated → mandatory).
  IF NOT EXISTS (
    SELECT 1 FROM public.vendor_profiles vp
    WHERE vp.vendor_profile_id = p_vendor_profile_id
      AND vp.user_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'FORBIDDEN: caller does not own this vendor profile';
  END IF;

  -- Idempotent re-accept → free + un-gated.
  SELECT EXISTS (
    SELECT 1 FROM public.vendor_event_unlocks
    WHERE vendor_profile_id = p_vendor_profile_id AND event_id = p_event_id
  ) INTO v_already;
  IF v_already THEN
    RETURN jsonb_build_object('charged', false, 'already', true, 'tokens', 0);
  END IF;

  -- Tier gate + founder override.
  SELECT tier_state, COALESCE(is_founder, false)
    INTO v_tier, v_is_founder
    FROM public.vendor_profiles
   WHERE vendor_profile_id = p_vendor_profile_id;

  -- Founder bypass (owner 2026-06-09): unlimited free unlocks — no tier gate,
  -- no weekly cap, no burn. Record the unlock at 0 tokens for idempotency.
  IF v_is_founder THEN
    SELECT region INTO v_region FROM public.events WHERE event_id = p_event_id;
    INSERT INTO public.vendor_event_unlocks
      (vendor_profile_id, event_id, tokens_burned, region_slug, band)
    VALUES (p_vendor_profile_id, p_event_id, 0, v_region, NULL)
    ON CONFLICT (vendor_profile_id, event_id) DO NOTHING;
    RETURN jsonb_build_object('charged', false, 'already', false,
                              'founder', true, 'tokens', 0);
  END IF;

  IF v_tier IS NULL OR v_tier = 'free' THEN
    RAISE EXCEPTION 'TIER_FREE_NO_INAPP: free vendors cannot accept in-app inquiries';
  END IF;

  IF v_tier = 'verified' THEN
    SELECT COUNT(*) INTO v_week_count
      FROM public.vendor_event_unlocks
     WHERE vendor_profile_id = p_vendor_profile_id
       AND unlocked_at > NOW() - INTERVAL '7 days';
    IF v_week_count >= 10 THEN
      RAISE EXCEPTION 'VERIFIED_WEEKLY_LIMIT: verified vendors can answer up to 10 in-app inquiries per week';
    END IF;
  END IF;

  v_paid := (v_tier IN ('pro', 'enterprise'));

  -- Resolve region for context; only PAID tiers compute a token cost.
  SELECT region INTO v_region FROM public.events WHERE event_id = p_event_id;
  IF v_paid THEN
    SELECT band, tokens INTO v_band, v_tokens
      FROM public.token_burn_bands
     WHERE region_slug = COALESCE(NULLIF(v_region, ''), '__default__');
    IF v_tokens IS NULL THEN
      SELECT band, tokens INTO v_band, v_tokens
        FROM public.token_burn_bands WHERE region_slug = '__default__';
    END IF;
    IF v_tokens IS NULL THEN
      v_tokens := 1; v_band := 1;
    END IF;
  ELSE
    -- Verified: FREE unlock — recorded (for the 10/week count + idempotency) at 0 tokens.
    v_tokens := 0;
    v_band := NULL;
  END IF;

  INSERT INTO public.vendor_event_unlocks
    (vendor_profile_id, event_id, tokens_burned, region_slug, band)
  VALUES
    (p_vendor_profile_id, p_event_id, v_tokens, v_region, v_band)
  ON CONFLICT (vendor_profile_id, event_id) DO NOTHING;

  GET DIAGNOSTICS v_rowcount = ROW_COUNT;
  IF v_rowcount = 0 THEN
    RETURN jsonb_build_object('charged', false, 'already', true, 'tokens', 0);
  END IF;

  -- Only PAID tiers burn. Insufficient balance RAISES → whole tx rolls back.
  IF v_paid THEN
    PERFORM public.consume_vendor_assets_per_voucher(
      p_vendor_profile_id, v_tokens, 'INQUIRY_UNLOCK', p_event_id,
      jsonb_build_object('region', v_region, 'band', v_band, 'tier', v_tier)
    );
  END IF;

  RETURN jsonb_build_object(
    'charged', v_paid, 'already', false, 'tokens', v_tokens,
    'region', v_region, 'band', v_band, 'tier', v_tier);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION public.unlock_vendor_event(UUID, UUID) IS
  'Tier-gated burn-on-answer: FREE blocked · FREE-VERIFIED <=10 new unlocks/rolling-week FREE (0 tokens) · PRO/ENTERPRISE unlimited + burns 1-3 region-banded tokens. FOUNDER (is_founder=true) bypasses ALL gating (unlimited free unlocks, no burn) — owner 2026-06-09. Idempotent per (vendor,event); ownership-checked. RAISES TIER_FREE_NO_INAPP / VERIFIED_WEEKLY_LIMIT / INSUFFICIENT_WALLET_BALANCES.';

REVOKE ALL ON FUNCTION public.unlock_vendor_event(UUID, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.unlock_vendor_event(UUID, UUID) TO authenticated;

COMMIT;
