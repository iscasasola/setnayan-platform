-- Camera Bridge reprice ₱1,299 → ₱499 (owner-locked 2026-07-08 · Live Studio
-- packaging). The estimator fallback was already moved to 499 on 2026-07-08
-- (app/pricing/page.tsx: `fb: 499 // owner 2026-07-08 (was 1299)`), but the
-- catalog row + llms.txt were never updated — so /pricing + the estimator
-- (which read the LIVE catalog rate) still showed ₱1,299. This aligns the
-- source-of-truth row to the owner-locked figure. Idempotent.

update public.platform_retail_catalog_v2
set retail_price_php = 499,
    updated_at = now()
where service_code = 'CAMERA_BRIDGE'
  and retail_price_php <> 499;

