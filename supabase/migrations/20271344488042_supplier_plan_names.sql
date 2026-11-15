-- supplier_plan_names — owner 2026-11-13: "for the supplier. we rename their plans.
-- Supplier Plus (formerly solo) / Supplier Pro / Supplier Ultra". DISPLAY NAME ONLY.
-- Only vendor_billing_catalog.title moves. sku_code, prices, caps and every internal key
-- (solo / pro / enterprise) are untouched. Idempotent: each rewrite is guarded on the old words.
UPDATE public.vendor_billing_catalog SET title = CASE sku_code
  WHEN 'solo_vendor_monthly'       THEN 'Supplier Plus (4 weeks)'
  WHEN 'solo_vendor_annual'        THEN 'Supplier Plus (1 year)'
  WHEN 'pro_vendor_monthly'        THEN 'Supplier Pro (4 weeks)'
  WHEN 'pro_vendor_annual'         THEN 'Supplier Pro (1 year)'
  WHEN 'enterprise_vendor_monthly' THEN 'Supplier Ultra (4 weeks)'
  WHEN 'enterprise_vendor_annual'  THEN 'Supplier Ultra (1 year)'
END
WHERE sku_code IN ('solo_vendor_monthly','solo_vendor_annual','pro_vendor_monthly','pro_vendor_annual',
                   'enterprise_vendor_monthly','enterprise_vendor_annual')
  AND title NOT LIKE 'Supplier %';

UPDATE public.vendor_billing_catalog
   SET title = replace(title, 'Ultra only', 'Supplier Ultra only')
 WHERE title LIKE '%· Ultra only)';

UPDATE public.vendor_billing_catalog
   SET title = replace(title, 'Pro and Ultra', 'Supplier Pro and Supplier Ultra')
 WHERE title LIKE '%(4 weeks · Pro and Ultra)';

UPDATE public.vendor_billing_catalog
   SET title = replace(title, 'Free, Verified and Solo', 'Free, Verified and Supplier Plus')
 WHERE title LIKE '%Free, Verified and Solo)';
