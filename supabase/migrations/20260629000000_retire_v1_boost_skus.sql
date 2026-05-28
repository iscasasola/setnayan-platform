-- =============================================================================
-- 20260629000000_retire_v1_boost_skus.sql
-- Retire V1 boost SKUs · owner directive 2026-05-28 "remove the current
-- boosting · we add it later."
-- =============================================================================
--
-- Non-destructive · flips is_active=FALSE + stamps retired_at=NOW() on the
-- 5 active boost SKUs. Row data preserved. Existing vendor subscriptions to
-- these SKUs continue to run until natural expiry — only NEW purchases
-- blocked at the catalog read layer (callers filter by is_active=TRUE).
--
-- Affected SKUs:
--   boosted_ads_5km                ₱4,999/wk  · 5km radius weekly Boosted Ads
--   boosted_ads_10km               ₱7,999/wk  · 10km radius weekly Boosted Ads
--   boosted_ads_20km               ₱14,999/wk · 20km radius weekly Boosted Ads
--   sponsored_boost_quarterly_30km ₱249,999   · 30km radius quarterly Sponsored Boost
--   sponsored_boost_annual_30km    ₱799,999   · 30km radius annual Sponsored Boost
--
-- V2 replacement: per blueprint Part 2 § 2, the V2 token-cost-per-bid sink
-- (high-valuation destination briefs cost 5-8 tokens per submission)
-- replaces the boost-ads visibility mechanic. Boost-ads can return as a
-- separate V2.1 surface if owner specs it later.
--
-- Pilot 2026-06-01 unaffected · no pilot vendor purchased boost ads.
-- Decision-log: CLAUDE.md 2026-05-28 (owner reply after V1→V2 audit).
-- =============================================================================

BEGIN;

UPDATE public.service_catalog
   SET is_active  = FALSE,
       retired_at = COALESCE(retired_at, NOW())
 WHERE sku_code IN (
   'boosted_ads_5km',
   'boosted_ads_10km',
   'boosted_ads_20km',
   'sponsored_boost_quarterly_30km',
   'sponsored_boost_annual_30km'
 )
   AND is_active = TRUE;

COMMIT;

-- =============================================================================
-- VERIFICATION:
--
-- SELECT sku_code, is_active, retired_at FROM service_catalog
--  WHERE sku_code IN ('boosted_ads_5km','boosted_ads_10km','boosted_ads_20km',
--                     'sponsored_boost_quarterly_30km','sponsored_boost_annual_30km');
-- -- Expected: all 5 rows · is_active=FALSE · retired_at set
-- =============================================================================
