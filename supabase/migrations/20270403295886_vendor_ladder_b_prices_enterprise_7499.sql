-- ============================================================================
-- Vendor subscription prices → LADDER B (owner-confirmed 2026-07-01).
--
-- Canonical ladder: Solo ₱999 · Pro ₱2,499 · Enterprise ₱7,499 / 28-day cycle;
-- annual = 10× the 28-day fee (a subscription year is 13 cycles, billed for 10
-- — first 3 free). Enterprise was repriced ₱4,999→₱7,499 the same day it became
-- a BOUNDED tier (finite caps in lib/vendor-tier-caps.ts). The pre-reset
-- "Ladder A" (₱2,000/6,000/10,000) is dead.
--
-- Prices are admin-managed — `vendor_billing_catalog` is authoritative (read via
-- getVendorPrices; TIER_PRICE_PHP is a fallback only). These UPDATEs are
-- idempotent (SET to the target regardless of the current value), so they're
-- safe whether the live row is still Ladder A, an interim Ladder-B admin edit,
-- or already correct. Only PRICE is touched here — the cap columns
-- (max_categories / max_sub_seats) are not the enforcement SSOT (TIER_CAPS is),
-- so they're left alone to avoid drift.
--
-- price_php is in whole pesos (NUMERIC(10,2)). Rows updated only where they
-- exist (WHERE sku_code = …), so a missing annual SKU is a no-op.
-- ============================================================================

UPDATE public.vendor_billing_catalog SET price_php =    999.00 WHERE sku_code = 'solo_vendor_monthly';
UPDATE public.vendor_billing_catalog SET price_php =   9999.00 WHERE sku_code = 'solo_vendor_annual';
UPDATE public.vendor_billing_catalog SET price_php =   2499.00 WHERE sku_code = 'pro_vendor_monthly';
UPDATE public.vendor_billing_catalog SET price_php =  24999.00 WHERE sku_code = 'pro_vendor_annual';
UPDATE public.vendor_billing_catalog SET price_php =   7499.00 WHERE sku_code = 'enterprise_vendor_monthly';
UPDATE public.vendor_billing_catalog SET price_php =  74999.00 WHERE sku_code = 'enterprise_vendor_annual';
