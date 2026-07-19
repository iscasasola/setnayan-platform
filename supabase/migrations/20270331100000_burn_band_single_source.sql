-- ============================================================================
-- 20270331100000_burn_band_single_source.sql
-- Reconcile the two min-wage region->burn-band maps onto ONE source of truth:
-- public.regions.burn_band. (Owner-approved 2026-07-01 — ship the correction.)
--
-- THE BUG BEING FIXED (PR #2456 follow-up)
-- ----------------------------------------
-- Two maps disagreed on the *key*, not just the value:
--   • token_burn_bands (seeded 20260908000000) is keyed on underscore/PSGC-style
--     slugs ('central_luzon','central_visayas','northern_mindanao',
--     'cagayan_valley','western_visayas',…) and is what the RPC actually
--     charges (exact-match lookup).
--   • events.region stores the canonical HYPHEN slugs ('c-luzon','c-visayas',
--     'n-mindanao','cagayan','w-visayas','nir',…).
-- The RPC's `WHERE region_slug = events.region` exact-match therefore MISSED 6
-- regions, which silently fell through to band 1 (the __default__ floor) and
-- UNDER-CHARGED: cagayan, c-luzon (₱300→₱100, worst case), w-visayas,
-- c-visayas, n-mindanao, nir.
--
-- public.regions (20270128395443) already carries the correct band for all 19
-- regions PLUS an aliases[] array that absorbs the underscore/PSGC/legacy
-- spellings — it is the canonical taxonomy the rest of the app reads through
-- lib/region-source.ts. This migration unifies the burn on it.
--
-- WHAT THIS MIGRATION DOES (Option 1 — single source)
-- ---------------------------------------------------
--   1a. Adds regions.min_wage_php (the wage rationale the admin ratifies bands
--       against — token_burn_bands carried it; regions did not).
--   1b. Adds a BEFORE UPDATE touch trigger so regions.updated_at bumps on edit
--       (mirrors token_burn_bands.updated_at semantics for the admin "last
--       changed" column).
--   1c. CREATE OR REPLACE unlock_vendor_event — copied VERBATIM from the live
--       body (20270307985604) with EXACTLY ONE change: the band-lookup block now
--       alias-resolves events.region against public.regions instead of an
--       exact-match against token_burn_bands. Every tier gate is preserved
--       byte-for-byte: FREE blocked · VERIFIED ≤10/week AND burns · solo/pro/
--       enterprise burn. (NB — the live body has NO is_founder bypass and NO
--       __resync__ returning-customer branch; both were dropped at
--       20270221294989. This migration does NOT reintroduce them — see PR body.)
--   1d. Deprecates token_burn_bands via COMMENT (still read-free now). The
--       DROP is a SEPARATE follow-up migration, sequenced AFTER the admin page
--       repoints to regions, so the deployed page never queries a dropped table.
--
-- No new tables -> no new RLS. regions already has public-read + admin-write
-- (regions_read_all / regions_admin_write). The RPC stays SECURITY DEFINER.
--
-- Idempotent: ADD COLUMN IF NOT EXISTS · CREATE OR REPLACE · DROP TRIGGER IF
-- EXISTS before CREATE. Apply ONLY via CI `supabase db push` (never hand-apply).
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1a. regions.min_wage_php — the wage rationale behind each band (admin-visible)
-- ----------------------------------------------------------------------------
ALTER TABLE public.regions
  ADD COLUMN IF NOT EXISTS min_wage_php SMALLINT;

COMMENT ON COLUMN public.regions.min_wage_php IS
  'Non-agri daily minimum wage (PHP, approx, mid-2026 wage orders) — the rationale the admin ratifies burn_band against at /admin/token-bands. Advisory only; burn_band is the charged value.';

-- Seed the wage figures lifted from lib/v2/region-token-burn.ts band notes
-- (NCR ₱695 top; band 3 ≥ ~₱600 · band 2 ~₱480-550 · band 1 ~₱415-475).
-- Approximate, owner-ratifiable; does NOT drive any charge.
UPDATE public.regions r
SET min_wage_php = m.wage
FROM (VALUES
  ('ncr',          695),
  ('calabarzon',   560),
  ('c-luzon',      560),
  ('car',          500),
  ('ilocos',       480),
  ('cagayan',      480),
  ('mimaropa',     430),
  ('w-visayas',    513),
  ('c-visayas',    500),
  ('n-mindanao',   480),
  ('davao',        481),
  ('nir',          480),
  ('bicol',        420),
  ('e-visayas',    405),
  ('zamboanga',    381),
  ('soccsksargen', 368),
  ('caraga',       400),
  ('barmm',        361),
  ('abroad',       NULL)
) AS m(slug, wage)
WHERE r.slug = m.slug;

-- ----------------------------------------------------------------------------
-- 1b. Touch trigger so regions.updated_at bumps on every UPDATE (mirrors the
--     token_burn_bands.updated_at semantics the admin "last changed" column
--     relied on). Follows the repo's per-table set_updated_at idiom.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.regions_set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS regions_set_updated_at ON public.regions;
CREATE TRIGGER regions_set_updated_at
  BEFORE UPDATE ON public.regions
  FOR EACH ROW
  EXECUTE FUNCTION public.regions_set_updated_at();

-- ----------------------------------------------------------------------------
-- 1c. unlock_vendor_event — VERBATIM live body (20270307985604) with ONE change:
--     the band lookup now alias-resolves events.region against public.regions.
-- ----------------------------------------------------------------------------
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
    -- RECONCILED 2026-07-01 (burn-band single source). Resolve events.region —
    -- ANY of the 4 spellings (canonical hyphen slug · underscore variant · PSGC
    -- code · 'cagayan-valley'/'outside_ph' alias) — against the canonical
    -- public.regions row, mirroring lib/region-source.ts resolveRegion():
    -- lower(slug) = OR lower(psgc_code) = OR aliases @> ARRAY[lower(value)]
    -- (the regions_aliases_gin index keeps the @> alias match fast). This
    -- REPLACES the old exact-match against token_burn_bands, which silently
    -- mis-keyed 6 regions (cagayan, c-luzon, w-visayas, c-visayas, n-mindanao,
    -- nir) to the band-1 floor and under-charged them. tokens = band (flat 1:1
    -- band:token at ₱100/token — economy lock 2026-06-05).
    SELECT r.burn_band
      INTO v_band
      FROM public.regions r
     WHERE lower(COALESCE(NULLIF(v_region, ''), '')) = lower(r.slug)
        OR lower(COALESCE(NULLIF(v_region, ''), '')) = lower(r.psgc_code)
        OR r.aliases @> ARRAY[lower(COALESCE(NULLIF(v_region, ''), ''))]
     LIMIT 1;
    IF v_band IS NULL THEN
      v_band := 1;           -- kind floor for null / blank / unknown / 'abroad'
    END IF;
    v_tokens := v_band;      -- flat 1:1 band:token at ₱100/token
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
  'Tier-gated burn-on-answer (2026-06-25 verified retune; 2026-07-01 burn-band single source): FREE blocked · VERIFIED ≤10/week AND burns 1-3 region-banded tokens · SOLO/PRO/ENTERPRISE unlimited + burns 1-3 region-banded tokens. Band resolves events.region -> public.regions.burn_band via alias-match (canonical single source; replaces the mis-keyed token_burn_bands lookup). Idempotent per (vendor,event). RAISES TIER_FREE_NO_INAPP / VERIFIED_WEEKLY_LIMIT / INSUFFICIENT_WALLET_BALANCES.';

REVOKE ALL ON FUNCTION public.unlock_vendor_event(UUID, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.unlock_vendor_event(UUID, UUID) TO authenticated;

-- ----------------------------------------------------------------------------
-- 1d. Deprecate token_burn_bands. The RPC no longer reads it; the admin page is
--     repointed to public.regions in the same PR. DROP is a SEPARATE follow-up
--     migration (after this ships) so the deployed admin page never 500s on a
--     dropped table mid-deploy.
-- ----------------------------------------------------------------------------
COMMENT ON TABLE public.token_burn_bands IS
  'DEPRECATED 2026-07-01 — superseded by public.regions.burn_band as the single burn-band source (RPC unlock_vendor_event now alias-resolves events.region against regions). Retained read-free during the /admin/token-bands cutover to regions; DROP in a follow-up migration once nothing reads it.';
