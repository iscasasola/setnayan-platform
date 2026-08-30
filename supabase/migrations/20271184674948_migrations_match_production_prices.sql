-- ============================================================================
-- THE MIGRATIONS SELL WHAT PRODUCTION SELLS — two of four rows, measured.
--
-- 🚨 THE DEFECT. A database built from `supabase/migrations/` alone did NOT
-- match production on four catalogue rows. Measured 2026-08-31 by replaying
-- every migration into PGlite and diffing against the live Supabase catalogue:
--
--     row                   replay      production   consequence of the replay value
--     CUSTOM_QR_GUEST       ₱999.00     ₱0.00        charges for a QR that is FREE
--     SEATING_3D            (NO ROW)    ₱1,500.00    the 3D Plan cannot be sold at all
--     pro_vendor_monthly    ₱2,499.00   ₱2,500.00    undercharges Pro vendors
--     pro_vendor_annual     ₱24,999.00  ₱26,000.00   undercharges Pro vendors by ₱1,001
--
-- ✅ PRODUCTION IS AUTHORITATIVE — owner ruled twice, 2026-08-30 and 2026-08-31,
-- in those words: "the production prices are the correct prices". This migration
-- moves the MIGRATIONS to production, never the reverse.
--
-- ⛔ NOTHING CUSTOMER-FACING WAS EVER WRONG. Live pages resolve every figure
-- from `platform_retail_catalog_v2` / `vendor_billing_catalog` at render, so the
-- prices a real person saw have always been production's. What was wrong is
-- every database built from migrations: a fresh environment, a restore, and the
-- `*.db.test.ts` replay — which is why four price assertions could only ever
-- have tested fiction.
--
-- 🚨 THIS MIGRATION FIXES TWO OF THE FOUR. THE OTHER TWO CANNOT BE FIXED HERE,
-- AND THE REASON IS A TEST-HARNESS DEFECT, NOT A MIGRATION ONE.
--
--     CUSTOM_QR_GUEST   ✅ fixed by this file
--     SEATING_3D        ✅ fixed by this file
--     pro_vendor_monthly ❌ still drifts after this file
--     pro_vendor_annual  ❌ still drifts after this file
--
-- MEASURED, with a canary inside this very file: at the END of this migration
-- `pro_vendor_annual` reads ₱26,000 — this file's UPDATE works. After the whole
-- replay finishes it reads ₱24,999 again. Something re-applies the old value
-- AFTER the last migration has run.
--
-- 🔑 WHAT DOES IT: `tests/db/replay-migrations.ts` DEFERS any migration that
-- fails on first pass and RETRIES IT AT THE END, after every later-numbered
-- file. Seven files take that path on a normal run, and one of them —
-- `20260530010000_iteration_0006_v2_1_amendment_2.sql` (2026-05-30) — re-seeds
-- the pre-price-sheet Pro Vendor figures. So the OLDEST file wins, not the
-- newest. That is an ordering PRODUCTION NEVER HAD: prod applied each migration
-- once, when it was authored, and never re-ran a 2026-05-30 seed after a
-- 2026-08-27 reprice.
--   ⇒ A LATER PREFIX CANNOT WIN AGAINST A DEFERRED EARLIER FILE. That is why
--     this migration reconciles the two `platform_retail_catalog_v2` rows (whose
--     values nothing re-seeds) and cannot reconcile the two vendor rows.
--   ⛔ SO DO NOT "FIX" THE REMAINING TWO WITH ANOTHER MIGRATION — a later prefix
--     will lose the same way. The fix belongs in the replay's retry ordering,
--     which 1,919 db tests depend on, and is booked as its own change.
--
-- ⚖ A NO-OP IN PRODUCTION, BY CONSTRUCTION. Every statement is guarded with
-- `IS DISTINCT FROM`, so on the live database — where these values are already
-- correct — this migration updates ZERO rows and does not touch `updated_at`.
-- It changes only databases that had drifted.
-- ============================================================================

BEGIN;

-- ── 1 · the guest QR is FREE ────────────────────────────────────────────────
UPDATE public.platform_retail_catalog_v2
   SET retail_price_php = 0.00,
       updated_at       = NOW()
 WHERE service_code = 'CUSTOM_QR_GUEST'
   AND retail_price_php IS DISTINCT FROM 0.00;

-- ── 2 · the 3D Plan exists and is sold ──────────────────────────────────────
-- Absent from the migration set entirely. Values copied from the production row.
INSERT INTO public.platform_retail_catalog_v2
  (service_code, title, retail_price_php, saas_overhead_cost_php,
   is_active, is_pax_priced, billing_period)
VALUES
  ('SEATING_3D', '3D Plan', 1500.00, 0.00, TRUE, FALSE, 'one_time')
ON CONFLICT (service_code) DO UPDATE
   SET retail_price_php = EXCLUDED.retail_price_php,
       updated_at       = NOW()
 WHERE public.platform_retail_catalog_v2.retail_price_php
         IS DISTINCT FROM EXCLUDED.retail_price_php;

-- ── 3 · the Pro Vendor ladder ───────────────────────────────────────────────
-- ⚠ 2,500 and 26,000 are the owner's own 2026-08-27 sheet: annual is exactly
--   four_week × 10.4 (thirteen 28-day periods at 20% off). 2,500 × 10.4 = 26,000.
--   The replay's 2,499 / 24,999 are the PRE-sheet charm figures.
UPDATE public.vendor_billing_catalog
   SET price_php  = 2500.00,
       updated_at = NOW()
 WHERE sku_code = 'pro_vendor_monthly'
   AND price_php IS DISTINCT FROM 2500.00;

UPDATE public.vendor_billing_catalog
   SET price_php  = 26000.00,
       updated_at = NOW()
 WHERE sku_code = 'pro_vendor_annual'
   AND price_php IS DISTINCT FROM 26000.00;

COMMIT;
