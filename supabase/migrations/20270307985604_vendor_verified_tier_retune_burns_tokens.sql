-- ============================================================================
-- 20270307985604_vendor_verified_tier_retune_burns_tokens.sql
-- Make the vendor ladder strictly monotonic: Free < Verified < Solo < Pro < Ent.
-- (Owner-approved 2026-06-25.)
--
-- Background: Solo (paid ₱2,000/28d) was accidentally WORSE than free Verified
-- on several caps. The capability matrix nerf lives in code
-- (apps/web/lib/vendor-tier-caps.ts — verified: inAppGated false→true,
-- parentCategories 3→1, agentAccounts 1→0). This migration mirrors the one
-- behavioral change that lives in SQL: in-app inquiry answering for VERIFIED
-- must now BURN TOKENS like the paid tiers — WHILE KEEPING verified's existing
-- 10/week free-cap branch (so verified is capped AND pays per answer, strictly
-- worse than Solo's unlimited-no-cap).
--
-- Change vs 20270221294989_vendor_tier_solo.sql:
--   v_paid := (v_tier IN ('solo','pro','enterprise'))
--   →  v_paid := (v_tier IN ('verified','solo','pro','enterprise'))
-- The verified weekly-cap branch (≤10/week) is preserved verbatim. Everything
-- else in the function body is identical to the solo migration.
--
-- Idempotent: CREATE OR REPLACE FUNCTION.
-- ============================================================================

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
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.vendor_profiles vp
    WHERE vp.vendor_profile_id = p_vendor_profile_id
      AND vp.user_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'FORBIDDEN: caller does not own this vendor profile';
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.vendor_event_unlocks
    WHERE vendor_profile_id = p_vendor_profile_id AND event_id = p_event_id
  ) INTO v_already;
  IF v_already THEN
    RETURN jsonb_build_object('charged', false, 'already', true, 'tokens', 0);
  END IF;

  SELECT tier_state INTO v_tier FROM public.vendor_profiles
    WHERE vendor_profile_id = p_vendor_profile_id;

  IF v_tier IS NULL OR v_tier = 'free' THEN
    RAISE EXCEPTION 'TIER_FREE_NO_INAPP: free vendors cannot accept in-app inquiries';
  END IF;

  -- 'verified' retains its legacy weekly free-unlock cap (≤10/week). RETUNE
  -- 2026-06-25: verified now ALSO burns tokens per answer (see v_paid below) —
  -- so it is both capped AND charged, strictly worse than Solo.
  IF v_tier = 'verified' THEN
    SELECT COUNT(*) INTO v_week_count
      FROM public.vendor_event_unlocks
     WHERE vendor_profile_id = p_vendor_profile_id
       AND unlocked_at > NOW() - INTERVAL '7 days';
    IF v_week_count >= 10 THEN
      RAISE EXCEPTION 'VERIFIED_WEEKLY_LIMIT: verified vendors can answer up to 10 in-app inquiries per week';
    END IF;
  END IF;

  -- verified / solo / pro / enterprise all burn tokens. (verified additionally
  -- carries the 10/week cap enforced above; solo/pro/enterprise are uncapped.)
  v_paid := (v_tier IN ('verified', 'solo', 'pro', 'enterprise'));

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
  'Tier-gated burn-on-answer (2026-06-25 verified retune): FREE blocked · VERIFIED ≤10/week AND burns 1-3 region-banded tokens · SOLO/PRO/ENTERPRISE unlimited + burns 1-3 region-banded tokens. Idempotent per (vendor,event). RAISES TIER_FREE_NO_INAPP / VERIFIED_WEEKLY_LIMIT / INSUFFICIENT_WALLET_BALANCES.';

REVOKE ALL ON FUNCTION public.unlock_vendor_event(UUID, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.unlock_vendor_event(UUID, UUID) TO authenticated;
