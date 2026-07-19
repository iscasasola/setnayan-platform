-- ============================================================================
-- 20270328922621_setnayan_ai_sub_billing_period_and_retire_stories.sql
--
-- Catalog DATA HYGIENE only (no schema changes). Two fixes:
--
--   1. SETNAYAN_AI_SUB (the per-USER subscription term-pass SKU, ₱499 / 28-day
--      cycle · owner 2026-06-29) was seeded with billing_period='one_time' (the
--      column default from 20270322883953). It is a recurring 28-day pass, so the
--      "/period" suffix in the price label must read per_28d. Fix the recurrence
--      UNIT — nothing else (price + is_active are untouched here; flipping the SKU
--      ACTIVE is an owner-gated go-live step done separately).
--
--   2. PAPIC_ADDON_STORIES (Guest Stories) is stale: Guest Stories is owner-locked
--      FREE, so the paid ₱X SKU must not surface. Deactivate it (is_active=false).
--
-- DELIBERATELY NOT TOUCHED (owner-gated go-live steps, handled separately):
--   • platform_settings.setnayan_ai_per_user_enabled stays NULL/OFF.
--   • SETNAYAN_AI_SUB stays is_active=false (dormant until go-live).
--   • The per-EVENT SETNAYAN_AI row stays active (couples who bought it keep it).
--
-- IDEMPOTENT: both statements are UPDATEs guarded by an exact service_code match
-- and are safe to re-apply (same target state every run). The IS DISTINCT FROM
-- guard makes a re-run a true no-op (no needless updated_at churn), and a missing
-- row (pre-seed) simply matches nothing.
-- ============================================================================

BEGIN;

-- 1. Per-user subscription SKU → 28-day recurrence (was wrongly one_time).
UPDATE public.platform_retail_catalog_v2
   SET billing_period = 'per_28d',
       updated_at     = now()
 WHERE service_code = 'SETNAYAN_AI_SUB'
   AND billing_period IS DISTINCT FROM 'per_28d';

-- 2. Retire the stale paid Guest Stories SKU (Guest Stories is owner-locked FREE).
UPDATE public.platform_retail_catalog_v2
   SET is_active  = false,
       updated_at = now()
 WHERE service_code = 'PAPIC_ADDON_STORIES'
   AND is_active IS DISTINCT FROM false;

COMMIT;
