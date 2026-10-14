-- ════════════════════════════════════════════════════════════════════════════
-- PATIKTOK IS PER EVENT — THE CATALOG'S LABEL NOW SAYS WHAT THE CODE GRANTS
--
-- ⚖ OWNER, 2026-10-14 (DECISION_LOG 🧩 "THE PAPIC PATTERN FOR SETNAYAN AI, LIVE
-- WATCH, MUSIC MAKER, PATIKTOK", answer 3): *"Patiktok is PER EVENT — the
-- catalog's per_day billing_period is corrected to match the code."*
--
-- `PATIKTOK_COMPILER` has carried `billing_period = 'per_day'` since
-- 20270331500000 (owner 2026-07-01, "per day"). The code never followed: one
-- approved order unlocks save / download / share for the life of the event
-- (`eventSkuActive` in lib/patiktok-access.ts · lib/patiktok-save-gate.ts — no
-- day window, no expiry). So every surface that prints the catalog's suffix
-- ("₱1,500 / day" on /pricing, the feature page, the buy card) told a couple
-- they were buying ONE day of something they in fact keep.
--
-- 🔑 THIS MOVES NO MONEY. `billing_period` never reaches the charge:
-- `resolveRetailChargeCentavos` does not select it (measured and written up in
-- 20271178765838). The only reader is the display suffix
-- (`BILLING_PERIOD_SUFFIX`, lib/v2-catalog-pure.ts), where `one_time` renders
-- nothing. The price (retail_price_php, admin-managed) is untouched.
--
-- Idempotent, and scoped to the single row by service_code.
-- ════════════════════════════════════════════════════════════════════════════

BEGIN;

UPDATE public.platform_retail_catalog_v2
   SET billing_period = 'one_time',
       updated_at = NOW()
 WHERE service_code = 'PATIKTOK_COMPILER'
   AND billing_period IS DISTINCT FROM 'one_time';

COMMIT;
