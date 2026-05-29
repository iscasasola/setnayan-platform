-- =============================================================================
-- 20260530020000_iteration_0006_v2_1_amendment_2_titles.sql
-- Follow-up to 20260530010000_iteration_0006_v2_1_amendment_2 · updates
-- vendor_billing_catalog titles to reflect 28-day cadence labels (Pro +
-- Enterprise 28-day). The original migration UPDATEd the Pro Monthly
-- price + Pro Annual price + title · this follow-up updates the title
-- fields on the two 28-day rows so BIR receipt line-item descriptions
-- + app-layer rendering all read "Pro/Enterprise Vendor (28-day prepaid
-- block)" instead of the legacy "(Monthly)" suffix.
--
-- WHY: CLAUDE.md 2026-05-30 "🔒 V2.1 BRIEF AMENDMENT #2 LOCKED" row § 7(h)
-- BIR receipt cadence labels · vendor_billing_catalog.title is the canonical
-- source for BIR generator line-item description rendering (per
-- lib/v2-catalog.ts row.title mapping). Pre-this-migration the receipts
-- said "Pro Vendor (Monthly)" which contradicts the 28-day cadence locked
-- in row § 1(a). Post-migration: "(28-day prepaid block)".
--
-- Idempotent · safe to re-run.
-- =============================================================================

BEGIN;

UPDATE public.vendor_billing_catalog
   SET title      = 'Pro Vendor (28-day prepaid block)',
       updated_at = NOW()
 WHERE sku_code = 'pro_vendor_monthly'
   AND title    <> 'Pro Vendor (28-day prepaid block)';

UPDATE public.vendor_billing_catalog
   SET title      = 'Enterprise Vendor (28-day prepaid block)',
       updated_at = NOW()
 WHERE sku_code = 'enterprise_vendor_monthly'
   AND title    <> 'Enterprise Vendor (28-day prepaid block)';

COMMIT;
