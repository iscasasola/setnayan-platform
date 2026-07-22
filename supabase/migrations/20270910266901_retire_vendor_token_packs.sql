-- ============================================================================
-- 20270910266901_retire_vendor_token_packs.sql
--
-- RETIRE the vendor token PACKS — stop the sale (owner 2026-07-21: tokens
-- retired). The 5 pack SKUs are flipped is_active=false. This is the honored
-- retire path:
--   • lib/v2-catalog.ts fetchV2VendorCatalog() filters `.eq('is_active', true)`,
--     so the packs vanish from the vendor Plan & tokens hub (the BuyTokensCta
--     falls to its empty state — no pack ever renders / can be started).
--   • create_vendor_token_purchase guards `WHERE sku_code = … AND is_active =
--     TRUE` and RAISES INVALID_PACK, so a stale/direct buy attempt is refused.
--
-- Rows are KEPT (not deleted): vendor_token_purchases.pack_sku_code is plain
-- TEXT with NO FK and each purchase row SNAPSHOTS token_count + amount_php at
-- buy time, so every historical purchase stays valid and self-describing.
-- Deleting the catalog rows would gain nothing and risk dangling references.
--
-- Companion to 20270909586177 (answering an inquiry was made FREE first), so no
-- paid vendor is stranded by the packs becoming unsellable.
--
-- Idempotent + scoped by sku_code (re-running is a no-op once already inactive).
-- The token WALLET / bundle-grant / burn plumbing is intentionally LEFT DORMANT
-- (not deleted) — retiring the SALE is the scope, not tearing out the economy.
-- ============================================================================

UPDATE public.vendor_billing_catalog
   SET is_active = false, updated_at = now()
 WHERE sku_code IN (
         'vendor_token_pack_5',
         'vendor_token_pack_10',
         'vendor_token_pack_25',
         'vendor_token_pack_50',
         'vendor_token_pack_100'
       )
   AND is_active <> false;
