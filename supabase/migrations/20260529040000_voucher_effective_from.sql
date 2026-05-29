-- ============================================================================
-- 20260529040000_voucher_effective_from.sql
--
-- Adds `effective_from TIMESTAMPTZ NULL` to `discount_codes` so vouchers can
-- be scheduled to activate at a future date. NULL = effective immediately
-- (backward compat with existing rows). When set, the voucher is invalid
-- until NOW() >= effective_from. CHECK ensures effective_from < expires_at
-- when set so admin can't create impossible windows.
--
-- Owner request 2026-05-29: enables "gift card" use case via voucher_type=
-- 'free' + max_uses=1 + effective_from window for birthdays/anniversaries.
--
-- Idempotent on re-run.
-- ============================================================================

BEGIN;

ALTER TABLE public.discount_codes
  ADD COLUMN IF NOT EXISTS effective_from TIMESTAMPTZ;

COMMENT ON COLUMN public.discount_codes.effective_from IS
  'Effective-from window start. NULL = effective immediately at creation. CHECK ensures it is before expires_at when set.';

-- Drop + recreate the window CHECK so re-runs don't fail on duplicate name.
ALTER TABLE public.discount_codes
  DROP CONSTRAINT IF EXISTS discount_codes_window_check;

ALTER TABLE public.discount_codes
  ADD CONSTRAINT discount_codes_window_check
  CHECK (effective_from IS NULL OR effective_from < expires_at);

COMMIT;
