## 2026-07-10 · fix(seo): SEO health audit reads the LIVE v2 catalogs, not the legacy service_catalog

Follow-up to PR #2990 (the `/admin/seo` daily audit). The price-drift check read `public.service_catalog` in centavos — but that table is legacy: live prod has 43 rows, **only 1 active, 0 active-priced**. Live pricing moved to `platform_retail_catalog_v2` (`retail_price_php`) + `vendor_billing_catalog` (`price_php`), both in **pesos**. As shipped, the audit would find zero catalog figures → flag every `llms.txt` price as an orphan and detect no real drift — misleading.

- `lib/seo/health-checks.ts`: `CatalogRow` now `{ sku_code, price_php, source: 'retail' | 'vendor' }`; `formatPeso(centavos)` → `pesoFigure(php)`. The `missing` (fail) check is scoped to **retail** SKUs — the customer à-la-carte services `llms.txt` is expected to quote; **vendor** figures only suppress false orphans (vendor micro-SKUs like extra-seat ₱250 / custom-plan ₱8,999 are intentionally omitted from the copy and must never raise a fail).
- `app/api/cron/seo-health/route.ts`: pulls active rows from both v2 catalogs (pesos) instead of `service_catalog`.
- `lib/seo/health-checks.test.ts`: retable to peso/source model + a new case asserting a vendor micro-SKU absent from `llms.txt` is NOT a `missing` fail.

Verified against live prod (read directly): with the real catalogs, today's audit = 0 `missing` (every active retail price is in `llms.txt`), 3 `orphan` warns that are legit non-SKU figures (₱300 token band · ₱500 voucher example · ₱15,000 Papic daily cap). First snapshot seeded live (`generated_by='manual'`). typecheck ✅ · lint ✅ · unit (8) ✅.

SPEC IMPACT: None (internal ops audit; corrects the data source of a just-shipped admin tool).
