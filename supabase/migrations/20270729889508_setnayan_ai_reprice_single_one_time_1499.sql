-- setnayan ai reprice single one time 1499
-- Setnayan AI collapses to a SINGLE ₱1,499 one-time SKU (owner FINAL 2026-07-12).
--
-- WHAT CHANGES
-- -----------
-- The live SETNAYAN_AI row in platform_retail_catalog_v2 is repriced from ₱499
-- to ₱1,499. It stays a ONE-TIME, PERMANENT unlock: billing_period 'one_time',
-- is_active TRUE, granting the existing events.setnayan_ai_active boolean gate
-- (per-event pricing flag is OFF since 20270714262264, so no lapsing window is
-- stamped — eventOwnsSetnayanAi returns a permanent grant).
--
-- Supersedes the ₱499 low-friction ENTRY and the ₱4,999 EVENT PASS floated in
-- the interim draft of this same PR (#3145): there is now exactly ONE active
-- Setnayan AI door. The EVENT_PASS SKU was never applied to prod — its seed
-- migration was removed from this branch, so there is nothing to un-seed here.
--
-- WHAT DELIBERATELY DOES NOT CHANGE
-- --------------------------------
--   • billing_period stays 'one_time'; is_active stays TRUE (re-asserted below
--     so a re-apply is self-healing, never a round-trip through per_28d).
--   • SETNAYAN_AI_SUB (dormant ₱499/28-day per-USER subscription) stays
--     is_active=FALSE — the couple monthly/annual is dropped, NOT reactivated.
--   • SETNAYAN_AI_RENEW stays is_active=FALSE (retired in 20270712300000).
--   • No feature flag is flipped; no charge/entitlement logic changes.
--
-- CHECK CONSTRAINTS: an UPDATE on the existing row touches only retail_price_php
-- (positive integer), billing_period ('one_time' is allowed) and is_active — all
-- within the platform_retail_catalog_v2_* constraints. Idempotent (re-runnable).

UPDATE public.platform_retail_catalog_v2
   SET retail_price_php = 1499,
       billing_period   = 'one_time',
       is_active        = true,
       updated_at       = now()
 WHERE service_code = 'SETNAYAN_AI';
