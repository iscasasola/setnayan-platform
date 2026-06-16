-- ============================================================================
-- 20270103030000_platform_settings_setnayan_pay_fee.sql
-- Make the Setnayan Pay convenience fee admin-editable.
--
-- The convenience-fee percentage was previously a code-only constant
-- (lib/payouts.ts DEFAULT_SETNAYAN_FEE_BPS = 500 · lib/vendor-earnings.ts
-- SETNAYAN_PAY_FEE_PCT = 5.0). This adds a column to the platform_settings
-- singleton so the owner can edit it from /admin/pricing → "Platform fee".
--
-- DEFAULT = 5.00 == the CURRENT code value, so behavior is byte-identical
-- until an admin changes it. lib/payouts.ts::getSetnayanFeeBps and
-- lib/vendor-earnings.ts::getSetnayanFeePct read this column with the code
-- constant as a fallback, so an unset / NULL value also keeps current behavior.
--
-- This migration does NOT re-price anything (no money value changes) — it only
-- adds the column with the existing fee as its default.
--
-- Idempotent (ADD COLUMN IF NOT EXISTS). Safe to re-run.
-- ============================================================================

BEGIN;

ALTER TABLE public.platform_settings
  ADD COLUMN IF NOT EXISTS setnayan_pay_fee_pct NUMERIC(5, 2) NOT NULL DEFAULT 5.00
    CHECK (setnayan_pay_fee_pct >= 0 AND setnayan_pay_fee_pct <= 100);

COMMENT ON COLUMN public.platform_settings.setnayan_pay_fee_pct IS
  'Setnayan Pay convenience-fee percentage added to a customer invoice when they pay a vendor booking through Setnayan (the vendor receives the full booking amount; the fee is the customer''s cost). Admin-editable at /admin/pricing → Platform fee. Default 5.00 == the legacy code constant (lib/payouts.ts DEFAULT_SETNAYAN_FEE_BPS / lib/vendor-earnings.ts SETNAYAN_PAY_FEE_PCT), which remain the runtime fallback when this is NULL.';

COMMIT;

-- ============================================================================
-- VERIFICATION:
--   SELECT setnayan_pay_fee_pct FROM public.platform_settings WHERE id = 1;
--   -- → 5.00 (the current effective fee · unchanged from the code constant)
-- ============================================================================
