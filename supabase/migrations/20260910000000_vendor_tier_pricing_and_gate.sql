-- ============================================================================
-- 20260910000000_vendor_tier_pricing_and_gate.sql
-- Vendor tier matrix — Phase A: pricing alignment + tier-gated burn-on-answer.
-- Canonical: corpus Vendor_Tier_Capability_Matrix_2026-06-07.md (owner-provided).
--
-- 1. Subscription PRICE alignment to the matrix (owner 2026-06-07: matrix wins):
--      Pro        ₱1,999/mo → ₱3,999/mo · ₱19,999/yr → ₱39,999/yr
--      Enterprise ₱5,499/mo → ₱9,999/mo · ₱54,999/yr → ₱99,999/yr
--    Plus the Pro per-tier caps the catalog carries are corrected to the matrix:
--      max_categories 1 → 3 · max_sub_seats 5 → 3.  (Enterprise stays NULL = ∞.)
--
-- 2. Tier-GATE the burn-on-answer (revises 20260908000000's tier-blind burn).
--    OWNER 2026-06-07 model:
--      FREE            → cannot accept in-app inquiries at all (RAISE).
--      FREE-VERIFIED   → up to 10 in-app inquiries / rolling week, AND burns
--                        1-3 tokens each (no free allowance — owner override of
--                        the matrix "gate ✗" cell). Beyond 10/week → RAISE.
--      PRO/ENTERPRISE  → unlimited, burns 1-3 tokens each.
--    Re-accepting an ALREADY-unlocked (vendor,event) stays free + un-gated
--    (idempotent) — the weekly limit only counts/charges NEW unlocks.
-- ============================================================================

-- ── 1 · Price + cap alignment ───────────────────────────────────────────────
UPDATE public.vendor_billing_catalog SET price_php = 3999.00,  max_categories = 3,    max_sub_seats = 3    WHERE sku_code = 'pro_vendor_monthly';
UPDATE public.vendor_billing_catalog SET price_php = 39999.00, max_categories = 3,    max_sub_seats = 3    WHERE sku_code = 'pro_vendor_annual';
UPDATE public.vendor_billing_catalog SET price_php = 9999.00,  max_categories = NULL, max_sub_seats = NULL WHERE sku_code = 'enterprise_vendor_monthly';
UPDATE public.vendor_billing_catalog SET price_php = 99999.00, max_categories = NULL, max_sub_seats = NULL WHERE sku_code = 'enterprise_vendor_annual';

-- ── 2 · Tier-gated burn RPC (CREATE OR REPLACE — supersedes 20260908000000) ──
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
BEGIN
  -- Ownership check (SECURITY DEFINER + granted to authenticated → mandatory).
  IF NOT EXISTS (
    SELECT 1 FROM public.vendor_profiles vp
    WHERE vp.vendor_profile_id = p_vendor_profile_id
      AND vp.user_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'FORBIDDEN: caller does not own this vendor profile';
  END IF;

  -- Idempotent re-accept: an already-unlocked (vendor,event) is FREE + un-gated.
  -- The tier gate + weekly limit only apply to NEW unlocks.
  SELECT EXISTS (
    SELECT 1 FROM public.vendor_event_unlocks
    WHERE vendor_profile_id = p_vendor_profile_id AND event_id = p_event_id
  ) INTO v_already;
  IF v_already THEN
    RETURN jsonb_build_object('charged', false, 'already', true, 'tokens', 0);
  END IF;

  -- Tier gate (owner-locked 2026-06-07).
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
  -- pro / enterprise → no volume cap.

  -- Resolve the wedding's region → band/tokens (fallback to __default__).
  SELECT region INTO v_region FROM public.events WHERE event_id = p_event_id;
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

  -- Insert the unlock (ON CONFLICT guards a concurrent double-accept race).
  INSERT INTO public.vendor_event_unlocks
    (vendor_profile_id, event_id, tokens_burned, region_slug, band)
  VALUES
    (p_vendor_profile_id, p_event_id, v_tokens, v_region, v_band)
  ON CONFLICT (vendor_profile_id, event_id) DO NOTHING;

  GET DIAGNOSTICS v_rowcount = ROW_COUNT;
  IF v_rowcount = 0 THEN
    -- Lost a concurrent race → treat as already-unlocked, no charge.
    RETURN jsonb_build_object('charged', false, 'already', true, 'tokens', 0);
  END IF;

  -- Burn. Insufficient balance RAISES → whole tx (incl. the insert) rolls back.
  PERFORM public.consume_vendor_assets_per_voucher(
    p_vendor_profile_id, v_tokens, 'INQUIRY_UNLOCK', p_event_id,
    jsonb_build_object('region', v_region, 'band', v_band, 'tier', v_tier)
  );

  RETURN jsonb_build_object(
    'charged', true, 'already', false, 'tokens', v_tokens,
    'region', v_region, 'band', v_band, 'tier', v_tier);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION public.unlock_vendor_event(UUID, UUID) IS
  'Tier-gated burn-on-answer (Phase A, owner 2026-06-07): FREE blocked · VERIFIED ≤10 new unlocks/rolling-week + burns · PRO/ENTERPRISE unlimited + burns. Idempotent per (vendor,event); re-accept is free+ungated. Ownership-checked. RAISES TIER_FREE_NO_INAPP / VERIFIED_WEEKLY_LIMIT / INSUFFICIENT_WALLET_BALANCES (each rolls back).';

REVOKE ALL ON FUNCTION public.unlock_vendor_event(UUID, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.unlock_vendor_event(UUID, UUID) TO authenticated;
