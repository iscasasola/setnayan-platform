-- xxx.setnayan.com custom subdomain SKU (owner 2026-07-10) — ₱999/year, both couple + vendor.
-- Applied to prod via MCP. Sold as a manual prepaid annual block (like the vendor tiers —
-- no auto-charge; renewal reminder before expiry). Marked "In build" in BUILD_STATUS
-- ('partial') until subdomain provisioning (wildcard DNS + subdomain-aware routing) ships.
-- ~₱0 COGS — a subdomain of a domain Setnayan already owns (setnayan.com / setnayan.ph).

-- Allow an annual billing period on the couple catalog.
ALTER TABLE platform_retail_catalog_v2 DROP CONSTRAINT platform_retail_catalog_v2_billing_period_check;
ALTER TABLE platform_retail_catalog_v2 ADD CONSTRAINT platform_retail_catalog_v2_billing_period_check
  CHECK (billing_period = ANY (ARRAY['one_time'::text, 'per_28d'::text, 'per_day'::text, 'per_year'::text]));

-- Couple-side SKU
INSERT INTO platform_retail_catalog_v2
  (service_code, title, retail_price_php, billing_period, is_active, description, saas_overhead_cost_php, is_token_able, is_pax_priced)
VALUES
  ('EVENT_SUBDOMAIN', 'Custom Subdomain', 999, 'per_year', true,
   'Your own web address — yourname.setnayan.com — for your wedding website. Renewed yearly.',
   0, false, false)
ON CONFLICT (service_code) DO UPDATE SET
  retail_price_php = EXCLUDED.retail_price_php, billing_period = EXCLUDED.billing_period,
  is_active = EXCLUDED.is_active, description = EXCLUDED.description, updated_at = now();

-- Vendor-side SKU (all tiers; mirrors the vendor_custom_domain add-on shape)
INSERT INTO vendor_billing_catalog
  (sku_code, title, price_php, offering_type, is_active, display_order, description)
VALUES
  ('vendor_subdomain', 'Custom Subdomain (per year)', 999, 'custom_addon', true, 97,
   'Your own web address — yourbusiness.setnayan.com — for your vendor profile. Renewed yearly.')
ON CONFLICT (sku_code) DO UPDATE SET
  price_php = EXCLUDED.price_php, is_active = EXCLUDED.is_active,
  description = EXCLUDED.description, updated_at = now();
