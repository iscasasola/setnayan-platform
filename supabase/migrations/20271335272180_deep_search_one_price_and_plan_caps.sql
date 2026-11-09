-- deep_search_one_price_and_plan_caps
-- ============================================================================
-- 🔎💳 DEEP SEARCH = ₱499, ONE USE, EVERY PLAN · 🗂 THE PLAN ROWS' CAPS FOLLOW TIER_CAPS.
--
-- Created via `pnpm migration:new`. Prefix auto-allocated to sort AFTER every
-- existing migration (including Supplier Build 3's, #7416).
--
-- ⚖ DECISION_LOG rows dated 2026-11-09:
--   · 🔎💳 "DEEP SEARCH = ₱499, ONE USE, EVERY PLAN — NO FREE SEARCH ON PRO/ULTRA;
--     CHATBOT KEEPS TWO PRICES." Owner, verbatim: *"Deep search is 1 use only"* +
--     *"Yes remove deepsearch from pro and ultra."*
--   · 💳⬢ "PRO AND ULTRA INCLUDE THE SPECIALIZED TOOLS UNLOCK; FINAL ADD-ON PRICES"
--     — *"Deep search 499 · Chatbot 1490 · Specialized tools 499"*, and: "Also fix
--     stale `vendor_billing_catalog` max_categories/max_sub_seats to the
--     2026-11-04 TIER_CAPS."
--
-- ── WHAT THIS FILE DOES ────────────────────────────────────────────────────
--   1 · `vendor_deep_search` (₱499.00, unchanged) becomes the ONE Deep Search row
--       on every plan — its title stops saying "Pro and Ultra". The app now names
--       it on both sides of the band (`lib/vendor-addon-tier-pricing.ts`), one
--       search per purchase, and the Pro/Ultra free search is gone from the code
--       (`lib/vendor-deep-search-addon.ts`, `deep-search/actions.ts`).
--   2 · `vendor_deep_search_entry` (₱799) RETIRES into it: `is_active = FALSE`,
--       `retired_at`, `retirement_reason`, `replaced_by_sku_code`. NOTHING IS
--       DELETED. Every Deep Search order — on either band — has always carried
--       `orders.service_key = 'vendor_deep_search'` (the entry row only ever priced
--       it), so an order somebody already paid at ₱799 is approved and runs its one
--       search exactly as before: the activation hook dispatches on the service key,
--       never on this row.
--   3 · The AI chatbot's two rows are NOT touched: ₱1,490 (`vendor_ai_addon`,
--       Pro/Ultra) and ₱1,990 (`vendor_ai_addon_entry`, Free/Verified/Solo) stay.
--   4 · The plan rows' `max_categories` / `max_sub_seats` follow the code. The
--       2026-11-04 allowances live in `TIER_CAPS` (apps/web/lib/vendor-tier-caps.ts,
--       `parentCategories` / `agentAccounts`) — THE CODE IS THE TRUTH and these
--       columns are a mirror nobody reads for a decision. Read live 2026-11-09
--       (read-only) before this file was written:
--         sku_code                   max_categories   max_sub_seats
--         solo_vendor_monthly/annual   1 → 2            0 → 1
--         pro_vendor_monthly/annual    3 → 8            3 → 5
--         enterprise_vendor_*        NULL → 15        NULL → 10
--       (Ultra's NULL read "unlimited", which it has not been since 2026-11-04:
--       "ULTRA … WITH TRIMMED ALLOWANCES".) Pinned against TIER_CAPS by
--       tests/db/deep-search-one-price-and-plan-caps.db.test.ts, so the next
--       allowance change cannot leave the rows behind silently.
--
-- No ALTER: no column, constraint or grant changes — UPDATEs only, idempotent.
-- ============================================================================

-- ── 1 · ONE DEEP SEARCH ROW, EVERY PLAN ──────────────────────────────────────
UPDATE public.vendor_billing_catalog
   SET title      = 'Deep Search (per search · every plan)',
       updated_at = NOW()
 WHERE sku_code = 'vendor_deep_search';

-- ── 2 · THE ₱799 ENTRY ROW RETIRES INTO IT ───────────────────────────────────
UPDATE public.vendor_billing_catalog
   SET is_active            = FALSE,
       retired_at           = COALESCE(retired_at, NOW()),
       retirement_reason    = COALESCE(retirement_reason,
         'Owner 2026-11-09 (DEEP SEARCH = ₱499, ONE USE, EVERY PLAN): retired into vendor_deep_search — one price on every plan. Searches already paid for at this price run exactly as bought.'),
       replaced_by_sku_code = COALESCE(replaced_by_sku_code, 'vendor_deep_search'),
       updated_at           = NOW()
 WHERE sku_code = 'vendor_deep_search_entry';

-- ── 4 · THE PLAN ROWS FOLLOW TIER_CAPS (2026-11-04) ──────────────────────────
UPDATE public.vendor_billing_catalog
   SET max_categories = 2, max_sub_seats = 1, updated_at = NOW()
 WHERE sku_code IN ('solo_vendor_monthly', 'solo_vendor_annual');

UPDATE public.vendor_billing_catalog
   SET max_categories = 8, max_sub_seats = 5, updated_at = NOW()
 WHERE sku_code IN ('pro_vendor_monthly', 'pro_vendor_annual');

UPDATE public.vendor_billing_catalog
   SET max_categories = 15, max_sub_seats = 10, updated_at = NOW()
 WHERE sku_code IN ('enterprise_vendor_monthly', 'enterprise_vendor_annual');
