-- ============================================================================
-- 20270218000000_vendor_tier_solo.sql
-- Introduce the Solo vendor tier (₱2,000/28d).
--
-- Background: the previous Free + Verified tiers are retired from the
-- marketing surface. Solo is the new entry-level PAID tier — one category,
-- one operator, full in-app suite, token-burn model same as Pro/Enterprise.
--
-- Changes:
--   1. Add 'solo' value to public.vendor_tier_state ENUM.
--   2. Seed vendor_billing_catalog with solo_vendor_monthly at ₱2,000/28d
--      (max_categories = 1, max_sub_seats = 0 — truly solo operator).
--   3. Update unlock_vendor_event to treat 'solo' identically to 'pro' —
--      unlimited in-app inquiries, token-burn applies (inAppGated = true).
--
-- Existing free/verified rows in vendor_profiles are left as-is for backward
-- compatibility. New sign-ups default to 'free' at creation time and must
-- subscribe to Solo/Pro/Enterprise to gain marketplace presence.
-- ============================================================================

-- ── 1 · Extend the ENUM ──────────────────────────────────────────────────────
-- ALTER TYPE ... ADD VALUE cannot run inside a transaction block.
ALTER TYPE public.vendor_tier_state ADD VALUE IF NOT EXISTS 'solo' BEFORE 'pro';

-- ── 2 · Seed Solo billing SKU ────────────────────────────────────────────────
INSERT INTO public.vendor_billing_catalog
  (sku_code, title, price_php, offering_type, token_grant_count, max_categories, max_sub_seats, display_order)
VALUES
  ('solo_vendor_monthly', 'Solo Vendor (Monthly)', 2000.00, 'subscription_monthly', NULL, 1, 0, 5)
ON CONFLICT (sku_code) DO UPDATE SET
  title          = EXCLUDED.title,
  price_php      = EXCLUDED.price_php,
  max_categories = EXCLUDED.max_categories,
  max_sub_seats  = EXCLUDED.max_sub_seats,
  display_order  = EXCLUDED.display_order,
  updated_at     = NOW();

-- ── 3 · Update unlock_vendor_event to accept 'solo' as a paid tier ───────────
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

  -- 'verified' retains its legacy weekly free-unlock cap.
  IF v_tier = 'verified' THEN
    SELECT COUNT(*) INTO v_week_count
      FROM public.vendor_event_unlocks
     WHERE vendor_profile_id = p_vendor_profile_id
       AND unlocked_at > NOW() - INTERVAL '7 days';
    IF v_week_count >= 10 THEN
      RAISE EXCEPTION 'VERIFIED_WEEKLY_LIMIT: verified vendors can answer up to 10 in-app inquiries per week';
    END IF;
  END IF;

  -- solo / pro / enterprise all burn tokens (no weekly cap).
  v_paid := (v_tier IN ('solo', 'pro', 'enterprise'));

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
  'Tier-gated burn-on-answer (2027-02-18 solo update): FREE blocked · VERIFIED ≤10/week FREE · SOLO/PRO/ENTERPRISE unlimited + burns 1-3 region-banded tokens. Idempotent per (vendor,event). RAISES TIER_FREE_NO_INAPP / VERIFIED_WEEKLY_LIMIT / INSUFFICIENT_WALLET_BALANCES.';

REVOKE ALL ON FUNCTION public.unlock_vendor_event(UUID, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.unlock_vendor_event(UUID, UUID) TO authenticated;
