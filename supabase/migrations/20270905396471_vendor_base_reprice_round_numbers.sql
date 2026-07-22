-- Vendor base-tier reprice to round numbers (owner 2026-07-22).
--
-- Part of the 2026-07-22 vendor base + add-on restructure. This PR ships ONLY
-- the base reprice (the fully-decided, self-contained piece); the four add-ons
-- (Vendor AI ₱1,500 · 3D Plan ₱1,500 · Photo Challenge ₱400/event · Deep Search
-- ₱500/search) + the two free-first-cycle trials + token-pack retirement land in
-- follow-on PRs.
--
--   Solo        ₱999   -> ₱1,000  /28d   ·  ₱9,999  -> ₱10,000 /yr
--   Pro         ₱2,499 -> ₱2,500  /28d   ·  ₱24,999 -> ₱25,000 /yr
--   Enterprise  ₱7,999 -> ₱8,000  /28d   ·  ₱79,999 -> ₱80,000 /yr
--
-- Annual stays = 10x the 28-day fee (a subscription year is 13 cycles, billed
-- for 10 — first 3 free). vendor_billing_catalog is the price SSOT; the app
-- fallbacks (v2-catalog.ts, vendor-tier-caps.ts), the AI-crawler surface
-- (public/llms.txt + llms-price-fixture.ts) and vendor-dashboard copy are
-- updated in the same PR so nothing drifts.

UPDATE public.vendor_billing_catalog SET price_php = 1000,  updated_at = now() WHERE sku_code = 'solo_vendor_monthly';
UPDATE public.vendor_billing_catalog SET price_php = 10000, updated_at = now() WHERE sku_code = 'solo_vendor_annual';
UPDATE public.vendor_billing_catalog SET price_php = 2500,  updated_at = now() WHERE sku_code = 'pro_vendor_monthly';
UPDATE public.vendor_billing_catalog SET price_php = 25000, updated_at = now() WHERE sku_code = 'pro_vendor_annual';
UPDATE public.vendor_billing_catalog SET price_php = 8000,  updated_at = now() WHERE sku_code = 'enterprise_vendor_monthly';
UPDATE public.vendor_billing_catalog SET price_php = 80000, updated_at = now() WHERE sku_code = 'enterprise_vendor_annual';
