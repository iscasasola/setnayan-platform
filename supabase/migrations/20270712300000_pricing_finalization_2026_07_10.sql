-- Pricing finalization 2026-07-10 (owner, comprehensive pricing session).
-- Source-of-truth reprices in platform_retail_catalog_v2 + vendor_billing_catalog.
-- Rationale: DECISION_LOG 2026-07-10 "COMPREHENSIVE PRICING FINALIZATION" (spec corpus).
-- Safe: Setnayan AI billing_period is DISPLAY-ONLY — the entitlement gate reads
-- setnayan_ai_active (+ an optional window written only by the flag-off per-event
-- flow), so flipping to one_time does not change access. Idempotent UPDATEs.

-- ── Couple à-la-carte reprices ──────────────────────────────────────────────
UPDATE platform_retail_catalog_v2 SET retail_price_php = 999,  updated_at = now() WHERE service_code = 'ANIMATED_MONOGRAM';    -- was ₱1,999 (cross-sell gateway)
UPDATE platform_retail_catalog_v2 SET retail_price_php = 2999, updated_at = now() WHERE service_code = 'SEATING_3D';           -- was ₱2,499 (whitespace crown jewel)
UPDATE platform_retail_catalog_v2 SET retail_price_php = 2999, updated_at = now() WHERE service_code = 'EDITORIAL_PRO';        -- was ₱3,499
UPDATE platform_retail_catalog_v2 SET retail_price_php = 999,  updated_at = now() WHERE service_code = 'STD_PREMIUM_OPENINGS'; -- Cinematic Reveal, was ₱1,499

-- ── Setnayan AI → one-time (price 499 unchanged); retire the ₱799 recurring renewal ──
UPDATE platform_retail_catalog_v2 SET billing_period = 'one_time', updated_at = now() WHERE service_code = 'SETNAYAN_AI';
UPDATE platform_retail_catalog_v2 SET is_active = false,           updated_at = now() WHERE service_code = 'SETNAYAN_AI_RENEW';

-- ── Couple Website PRO umbrella deprecated (Editorial + Reveal now sell standalone) ──
-- Existing owners keep their entitlement grants (order-based); this only stops new sales.
UPDATE platform_retail_catalog_v2 SET is_active = false, updated_at = now() WHERE service_code = 'COUPLE_WEBSITE_PRO';

-- ── Vendor Enterprise reprice (₱7,499 → ₱7,999 / 28d; annual recomputed ~23% prepay) ──
UPDATE vendor_billing_catalog SET price_php = 7999,  updated_at = now() WHERE sku_code = 'enterprise_vendor_monthly';
UPDATE vendor_billing_catalog SET price_php = 79999, updated_at = now() WHERE sku_code = 'enterprise_vendor_annual';
