-- ============================================================================
-- 20270728100000_vendor_token_pack_reprice_200.sql
-- Vendor token unit price ₱100 → ₱200 (owner PRICING LOCK 2026-07-12).
--
-- Rationale: spec corpus DECISION_LOG.md 2026-07-12 "PRICING LOCK" ① —
--   "token unit price ₱100 → ₱200 ... packs reprice 4=₱800 · 10=₱2,000 ·
--    25=₱5,000 · 50=₱10,000 · 100=₱20,000".
-- Effective per-inquiry lead fee becomes 1 token × ₱200 = ₱200 (paired with the
-- burn-flatten migration 20270728200000 and the token HOLD-and-release mechanic
-- PR #3133/#3134 — a ₱200 token is held on accept, released if the lead is fake).
--
-- price_php on vendor_billing_catalog is stored in WHOLE PESOS (NUMERIC(10,2)),
-- e.g. 800.00 = ₱800 (NOT centavos). token_grant_count is UNCHANGED — only the
-- peso price moves, so the per-token rate goes 100 → 200. getVendorPrices()
-- (lib/v2-catalog.ts) derives the displayed ₱/token as price_php ÷
-- token_grant_count, so the marketing + admin surfaces pick up ₱200 with no code
-- change.
--
-- Scoped by sku_code · idempotent (re-running lands the same values). Does NOT
-- touch the 100-free-on-verification grant (that faucet is a token COUNT, not a
-- price — see 20260703500000_vendor_token_grants.sql / the verification bonus
-- trigger — and is deliberately left alone).
-- ============================================================================

UPDATE public.vendor_billing_catalog SET price_php =   800, updated_at = now()
  WHERE sku_code = 'vendor_token_pack_4';    -- 4  × ₱200  (was ₱400  @ ₱100/tok)
UPDATE public.vendor_billing_catalog SET price_php =  2000, updated_at = now()
  WHERE sku_code = 'vendor_token_pack_10';   -- 10 × ₱200  (was ₱1,000)
UPDATE public.vendor_billing_catalog SET price_php =  5000, updated_at = now()
  WHERE sku_code = 'vendor_token_pack_25';   -- 25 × ₱200  (was ₱2,500)
UPDATE public.vendor_billing_catalog SET price_php = 10000, updated_at = now()
  WHERE sku_code = 'vendor_token_pack_50';   -- 50 × ₱200  (was ₱5,000)
UPDATE public.vendor_billing_catalog SET price_php = 20000, updated_at = now()
  WHERE sku_code = 'vendor_token_pack_100';  -- 100 × ₱200 (was ₱10,000)
