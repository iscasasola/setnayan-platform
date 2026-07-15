-- ============================================================================
-- 20270728100000_vendor_token_pack_reprice_200.sql
-- Vendor token catalog RESTRUCTURE — flat ₱200/token, ladder anchored at
-- ₱1,000 = 5 tokens (owner-CONFIRMED 2026-07-15: "Restructure the token
-- catalog: ₱200/token, ₱1,000 = 5 tokens (I confirm this)").
--
-- Supersedes the interim 2026-07-12 draft of THIS migration (which kept the
-- 4-token bottom pack at ₱800). The confirmed ladder is:
--     5   tokens = ₱1,000   (NEW anchor pack — vendor_token_pack_5)
--     10  tokens = ₱2,000
--     25  tokens = ₱5,000
--     50  tokens = ₱10,000
--     100 tokens = ₱20,000
-- Every pack is a flat ₱200/token. Effective per-inquiry lead fee becomes
-- 1 token × ₱200 = ₱200 (paired with the burn-flatten migration
-- 20270728200000 and the token HOLD-and-release mechanic PR #3133/#3134 —
-- a ₱200 token is held on accept, released if the lead is fake).
--
-- WHY RETIRE + INSERT (not rename in place):
--   The old bottom pack `vendor_token_pack_4` (4 tokens) does not fit the
--   confirmed anchor. `vendor_billing_catalog` has a first-class `is_active`
--   retire flag that BOTH readers honor:
--     • lib/v2-catalog.ts fetchV2VendorCatalog() filters `.eq('is_active', true)`
--       → getVendorPrices() + the token-purchase UI only ever see active packs;
--     • the purchase RPC create_vendor_token_purchase() looks up the pack
--       `WHERE sku_code = … AND is_active = TRUE` and raises INVALID_PACK
--       otherwise → a retired pack can no longer be bought.
--   `pack_sku_code` on vendor_token_purchases is plain TEXT (NO FK to the
--   catalog) and the purchase row SNAPSHOTS token_count + amount_php at buy
--   time, so retiring pack_4 leaves every historical purchase intact. That
--   makes retire-then-insert the correct, non-destructive path — it keeps a
--   clean, self-describing sku_code (`vendor_token_pack_5`) rather than a
--   `_4` row that now grants 5 tokens.
--
-- price_php on vendor_billing_catalog is stored in WHOLE PESOS (NUMERIC(10,2)),
-- e.g. 1000.00 = ₱1,000 (NOT centavos). getVendorPrices() (lib/v2-catalog.ts)
-- derives the displayed ₱/token as price_php ÷ token_grant_count = ₱200 for
-- every pack, so the marketing + admin surfaces pick up ₱200 with no code
-- change.
--
-- Scoped by sku_code · idempotent (re-running lands the same values — guarded
-- UPDATEs + an ON CONFLICT upsert). Does NOT reference the 100-free-on-
-- verification grant (RETIRED 2026-06-17 · migration 20270110320020 — no longer
-- live).
-- ============================================================================

-- ── (1) NEW anchor pack: 5 tokens = ₱1,000. Idempotent upsert by sku_code. ────
INSERT INTO public.vendor_billing_catalog
  (sku_code, title, price_php, offering_type, token_grant_count,
   max_categories, max_sub_seats, is_active, display_order)
VALUES
  ('vendor_token_pack_5', '5 Bidding Tokens', 1000, 'token_pack', 5,
   NULL, NULL, TRUE, 30)
ON CONFLICT (sku_code) DO UPDATE SET
  title             = EXCLUDED.title,
  price_php         = EXCLUDED.price_php,
  offering_type     = EXCLUDED.offering_type,
  token_grant_count = EXCLUDED.token_grant_count,
  is_active         = TRUE,
  display_order     = EXCLUDED.display_order,
  updated_at        = now();

-- ── (2) RETIRE the old 4-token bottom pack (is_active=false; row kept so any
--        historical purchase snapshot + reference stays valid). ──────────────
UPDATE public.vendor_billing_catalog
   SET is_active = FALSE, updated_at = now()
 WHERE sku_code = 'vendor_token_pack_4'
   AND is_active <> FALSE;

-- ── (3) Reprice the remaining packs to flat ₱200/token. ──────────────────────
UPDATE public.vendor_billing_catalog SET price_php =  2000, updated_at = now()
  WHERE sku_code = 'vendor_token_pack_10'  AND price_php <> 2000;   -- 10  × ₱200
UPDATE public.vendor_billing_catalog SET price_php =  5000, updated_at = now()
  WHERE sku_code = 'vendor_token_pack_25'  AND price_php <> 5000;   -- 25  × ₱200
UPDATE public.vendor_billing_catalog SET price_php = 10000, updated_at = now()
  WHERE sku_code = 'vendor_token_pack_50'  AND price_php <> 10000;  -- 50  × ₱200
UPDATE public.vendor_billing_catalog SET price_php = 20000, updated_at = now()
  WHERE sku_code = 'vendor_token_pack_100' AND price_php <> 20000;  -- 100 × ₱200
