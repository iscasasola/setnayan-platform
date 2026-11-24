-- deep_search_sale_retired_monthly_allowance
-- ============================================================================
-- 🔎✂️ DEEP SEARCH: THE ₱499 SALE RETIRES · 1 RUN A MONTH IS INCLUDED ON PLUS · PRO · ULTRA.
--
-- Created via `pnpm migration:new`. KEEP THIS MIGRATION IDEMPOTENT (it may be re-applied).
--
-- ⚖ DECISION_LOG rows dated 2026-11-22 (corpus `SUPPLIER_SUBSCRIPTIONS_BUILD_SPEC_2026-11-22.md` § ★ B, C):
--   · ✂️ "DEEP SEARCH IS RETIRED — 'NO ADD-ONS' MEANS NONE". Owner, verbatim: *"Retire it"*.
--   · 🧰✅ "SPECIAL TOOLS STAY INSIDE THE PLANS — PLUS, PRO AND ULTRA; NO UNLOCK FEES. DEEP SEARCH IS INCLUDED WITH A
--     MONTHLY ALLOWANCE." — admin-editable, never sold separately.
--   · 🔎 "DEEP SEARCH ALLOWANCE = 1 RUN A MONTH on every paid supplier plan (Plus · Pro · Ultra)". Owner, verbatim:
--     *"Deep Search 1 a month"*. Free/Verified get none. Resets each paid month; unused runs do not carry over.
--     Kept as an admin setting, not hard-coded.
-- Measured 24 Nov 2026 (read-only): `vendor_billing_catalog.vendor_deep_search` still `is_active` at ₱499.
--
-- ── WHAT THIS FILE DOES ────────────────────────────────────────────────────
--   1 · `vendor_deep_search` RETIRES: `is_active = FALSE`, `retired_at`, `retirement_reason` quoting the owner. The
--       row is NOT deleted, and no replacement SKU is named (the run is inside the plans, not sold). An order somebody
--       already paid for still runs its one search exactly as bought: the approval hook dispatches on
--       `orders.service_key`, never on this row (`activateVendorDeepSearchOrder`, lib/sku-activation.ts).
--   2 · `platform_settings.deep_search_runs_per_month` — THE ALLOWANCE, one number for Plus, Pro and Ultra, edited on
--       Admin › Settings by the existing settings action (the same home and shape as the Today numbers,
--       20271350875090). Seeded to the owner's 1 (the row above). NULL = not set = no run is included (fails closed).
--   3 · `vendor_deep_search_uses.allowance_slot` — WHICH of the month's included runs a row used (1..N). The run action
--       claims slot 1, then 2, … up to the allowance BEFORE the search runs; the unique index below makes the claim
--       atomic, so a burst of presses can never take more runs than the month includes. `free_cycle_start` (added by
--       20270912537338) now holds the start of the shop's PAID MONTH. The old one-per-cycle index is replaced by one
--       that includes the slot; legacy free rows (slot NULL) stay as history and are outside both.
--
-- No new table, so no new RLS. platform_settings keeps its existing policies; vendor_deep_search_uses keeps its
-- vendor-read / admin-all policies and still has no vendor write policy (only the service-role run path writes).
-- ============================================================================

BEGIN;

-- ── 1 · THE PER-SEARCH SALE RETIRES ──────────────────────────────────────────
UPDATE public.vendor_billing_catalog
   SET is_active         = FALSE,
       retired_at        = COALESCE(retired_at, NOW()),
       retirement_reason = COALESCE(retirement_reason,
         'Owner 2026-11-22, DECISION_LOG "DEEP SEARCH IS RETIRED": "Retire it". Deep Search is no longer sold per search; it is included on Plus, Pro and Ultra with a monthly allowance ("Deep Search 1 a month"), set on Admin › Settings. Searches already paid for run exactly as bought.'),
       updated_at        = NOW()
 WHERE sku_code = 'vendor_deep_search';

-- ── 2 · THE MONTHLY ALLOWANCE IS AN ADMIN SETTING ────────────────────────────
ALTER TABLE public.platform_settings
  ADD COLUMN IF NOT EXISTS deep_search_runs_per_month INTEGER;

ALTER TABLE public.platform_settings
  DROP CONSTRAINT IF EXISTS platform_settings_deep_search_runs_per_month_range;
ALTER TABLE public.platform_settings
  ADD CONSTRAINT platform_settings_deep_search_runs_per_month_range
  CHECK (deep_search_runs_per_month IS NULL OR (deep_search_runs_per_month > 0 AND deep_search_runs_per_month <= 31));

COMMENT ON COLUMN public.platform_settings.deep_search_runs_per_month IS
  'Deep Search runs included each paid month on Plus, Pro and Ultra (Free and Verified: none). Resets each paid month; unused runs do not carry over. NULL = not set = no run included. Owner 2026-11-22: "Deep Search 1 a month". Edited on Admin › Settings.';

-- The owner's number. COALESCE: a re-apply never overwrites what the admin has since set.
UPDATE public.platform_settings
   SET deep_search_runs_per_month = COALESCE(deep_search_runs_per_month, 1),
       updated_at                 = NOW()
 WHERE id = 1;

-- ── 3 · ONE ROW PER INCLUDED RUN, CLAIMED ATOMICALLY ─────────────────────────
ALTER TABLE public.vendor_deep_search_uses
  ADD COLUMN IF NOT EXISTS allowance_slot SMALLINT;

ALTER TABLE public.vendor_deep_search_uses
  DROP CONSTRAINT IF EXISTS vendor_deep_search_uses_allowance_slot_range;
ALTER TABLE public.vendor_deep_search_uses
  ADD CONSTRAINT vendor_deep_search_uses_allowance_slot_range
  CHECK (allowance_slot IS NULL OR (allowance_slot BETWEEN 1 AND 31));

COMMENT ON COLUMN public.vendor_deep_search_uses.allowance_slot IS
  'Which of the paid month''s included Deep Search runs this row used (1..platform_settings.deep_search_runs_per_month). Set with was_free = true and free_cycle_start = the paid month''s start; NULL for a paid order''s run and for history before 2026-11-24.';

COMMENT ON COLUMN public.vendor_deep_search_uses.free_cycle_start IS
  'The start of the paid month an included Deep Search run was claimed against (since 2026-11-24; before that, the retired 28-day cycle). NULL for paid-order runs.';

DROP INDEX IF EXISTS public.vendor_deep_search_uses_free_cycle_uidx;
CREATE UNIQUE INDEX IF NOT EXISTS vendor_deep_search_uses_month_slot_uidx
  ON public.vendor_deep_search_uses (vendor_profile_id, free_cycle_start, allowance_slot)
  WHERE was_free = true AND free_cycle_start IS NOT NULL AND allowance_slot IS NOT NULL;

COMMIT;

-- ============================================================================
-- VERIFICATION:
--
-- SELECT sku_code, is_active, retired_at IS NOT NULL AS retired FROM vendor_billing_catalog
--   WHERE sku_code = 'vendor_deep_search';
-- -- Expected: is_active = false, retired = true.
--
-- SELECT deep_search_runs_per_month FROM platform_settings WHERE id = 1;
-- -- Expected: 1 (unless an admin has since changed it).
--
-- SELECT indexname FROM pg_indexes WHERE tablename = 'vendor_deep_search_uses'
--   AND indexname IN ('vendor_deep_search_uses_month_slot_uidx', 'vendor_deep_search_uses_free_cycle_uidx');
-- -- Expected: only vendor_deep_search_uses_month_slot_uidx.
-- ============================================================================
