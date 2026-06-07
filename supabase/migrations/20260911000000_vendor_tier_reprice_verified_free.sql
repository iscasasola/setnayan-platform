-- ============================================================================
-- 20260911000000_vendor_tier_reprice_verified_free.sql
-- Vendor tier sheet REISSUE (owner 2026-06-07, second sheet). Capabilities
-- unchanged; pricing + the verified token gate change.
--   Canonical: Vendor_Tier_Capability_Matrix_2026-06-07.md (UPDATE note).
--
-- 1. Reprice (owner: round numbers, supersedes Phase A's ₱3,999/₱9,999):
--      Pro        ₱3,999/mo → ₱6,000/mo · ₱39,999/yr → ₱60,000/yr
--      Enterprise ₱9,999/mo → ₱10,000/mo · ₱99,999/yr → ₱100,000/yr
--    (Subscription FREE-token bundles 30/300 · 100/1,000 and the ₱100/token
--     buy rule are granted/enforced at the app layer — bundle on admin tier-set
--     now per owner; buy-token flow is Phase D. Not in this migration.)
--
-- 2. Verified token gate REVERTED to FREE (owner re-confirmed 2026-06-07 via the
--    reissued sheet — In-App Customer Gate = ✗ for FREE-VERIFIED). Supersedes
--    Phase A (20260910000000) which charged verified. New model:
--      FREE            → RAISE (no in-app inquiries)
--      FREE-VERIFIED   → ≤10 NEW unlocks / rolling week, FREE (0 tokens, no burn)
--      PRO/ENTERPRISE  → unlimited, burns 1-3 tokens (region-banded)
--    Re-accept of an already-unlocked (vendor,event) stays free + un-gated.
-- ============================================================================

-- ── 1 · Reprice ──────────────────────────────────────────────────────────────
UPDATE public.vendor_billing_catalog SET price_php = 6000.00   WHERE sku_code = 'pro_vendor_monthly';
UPDATE public.vendor_billing_catalog SET price_php = 60000.00  WHERE sku_code = 'pro_vendor_annual';
UPDATE public.vendor_billing_catalog SET price_php = 10000.00  WHERE sku_code = 'enterprise_vendor_monthly';
UPDATE public.vendor_billing_catalog SET price_php = 100000.00 WHERE sku_code = 'enterprise_vendor_annual';

-- ── 2 · Verified-free burn gate (CREATE OR REPLACE) ─────────────────────────
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

  -- Tier gate.
  SELECT tier_state INTO v_tier FROM public.vendor_profiles
    WHERE vendor_profile_id = p_vendor_profile_id;

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
  'Tier-gated burn-on-answer (owner 2026-06-07 reissue): FREE blocked · FREE-VERIFIED ≤10 new unlocks/rolling-week FREE (0 tokens) · PRO/ENTERPRISE unlimited + burns 1-3 region-banded tokens. Idempotent per (vendor,event); re-accept free+ungated. Ownership-checked. RAISES TIER_FREE_NO_INAPP / VERIFIED_WEEKLY_LIMIT / INSUFFICIENT_WALLET_BALANCES (each rolls back).';

REVOKE ALL ON FUNCTION public.unlock_vendor_event(UUID, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.unlock_vendor_event(UUID, UUID) TO authenticated;
