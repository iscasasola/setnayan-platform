-- bdo_only_pay_flow_and_the_payment_max
-- Created via `pnpm migration:new`. KEEP THIS MIGRATION IDEMPOTENT (it may be re-applied).
--
-- ============================================================================
-- THE BDO-ONLY PAY FLOW AND THE ₱100,000 CEILING (owner rulings 2026-11-17,
-- DECISION_LOG, verbatim):
--   · "we will make all our transactions enter BDO Account. So we show them QRPH
--     with the exact data. Show QR."
--   · the booking fee can never exceed ₱100,000, and no single payment made TO
--     SETNAYAN may exceed ₱100,000 (exactly ₱100,000 is allowed). Couples paying
--     suppliers are NOT covered.
--   · "the don't have to type. we detect after they sent it and log the data for
--     the admin to send his counterpart screenshot"
--
--   1. platform_settings.max_payment_php — IDENTICAL to the definition in
--      `20271350291059_gift_cart_orders_and_the_payment_max` (PR #7923, unmerged
--      when this was written). `ADD COLUMN IF NOT EXISTS` + a DROP/ADD of the
--      same named CHECK, so whichever of the two applies first creates it and
--      the other is a no-op. Same type, same default, same constraint name.
--   2. public.booking_fee_centavos — the AUTHORITATIVE fee mirror of
--      apps/web/lib/booking-fee.ts now caps the fee at max_payment_php
--      (COALESCE 100000). Body otherwise unchanged from
--      `20271177298989_the_owner_sets_the_booking_fee`.
--   3. payment_receipt_reads.seen_paid_on / seen_paid_time — the date and the
--      clock time the receipt reader found on the screenshot, so the admin can
--      match it against the bank's own record. ADVISORY like every other column
--      of that table: nothing reads them to approve money.
--
-- 🛑 NEVER APPLIED BY HAND. The pipeline pushes this file (CLAUDE.md).
-- ============================================================================

BEGIN;

-- ── 1 · the most in one payment (identical to #7923) ────────────────────────
ALTER TABLE public.platform_settings
  ADD COLUMN IF NOT EXISTS max_payment_php NUMERIC(12,2) NOT NULL DEFAULT 100000;

ALTER TABLE public.platform_settings
  DROP CONSTRAINT IF EXISTS platform_settings_max_payment_php_positive;
ALTER TABLE public.platform_settings
  ADD CONSTRAINT platform_settings_max_payment_php_positive
  CHECK (max_payment_php > 0);

COMMENT ON COLUMN public.platform_settings.max_payment_php IS
  'The most one payment may be, in pesos (owner 2026-11-17, verbatim: "We do not allow transactions above 100,000."). '
  'Seeded 100000. Read by lib/max-payment.server.ts; /pay, the couple checkout and the booking fee refuse or cap above it. '
  'Written only from Admin › Settings › Payment methods.';

-- ── 2 · the booking fee is capped at the same ceiling ───────────────────────
CREATE OR REPLACE FUNCTION public.booking_fee_centavos(p_amount_centavos BIGINT)
RETURNS BIGINT
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  WITH s AS (
    SELECT
      COALESCE((SELECT booking_fee_rate_pct        FROM public.platform_settings WHERE id = 1),   5.00) AS head_pct,
      COALESCE((SELECT booking_fee_tail_rate_pct   FROM public.platform_settings WHERE id = 1),   1.00) AS tail_pct,
      COALESCE((SELECT booking_fee_tier1_limit_php FROM public.platform_settings WHERE id = 1), 100000) AS band_php,
      COALESCE((SELECT max_payment_php             FROM public.platform_settings WHERE id = 1), 100000) AS max_php
  )
  SELECT CASE
    WHEN p_amount_centavos IS NULL OR p_amount_centavos <= 0 THEN 0::BIGINT
    ELSE LEAST(
      GREATEST(
        round(
          LEAST(p_amount_centavos, (s.band_php * 100)::BIGINT) * (s.head_pct / 100.0)
          + GREATEST(p_amount_centavos - (s.band_php * 100)::BIGINT, 0::BIGINT) * (s.tail_pct / 100.0)
        )::BIGINT,
        5000::BIGINT                -- ₱50 floor — FIXED, not owner-editable.
      ),
      round(s.max_php * 100)::BIGINT -- the ceiling (owner 2026-11-17): never above max_payment_php.
    )
  END
  FROM s;
$$;
COMMENT ON FUNCTION public.booking_fee_centavos(BIGINT) IS
  'Vendor Booking Fee (centavos) for an agreed amount (centavos). Reads the '
  'admin-set head rate, band ceiling and tail rate from platform_settings '
  '(defaults 5%% / PHP 100,000 / 1%%); the PHP 50 floor is FIXED in this body. '
  'Capped at platform_settings.max_payment_php (default PHP 100,000 - owner '
  '2026-11-17: the booking fee can never exceed it). AUTHORITATIVE mirror of '
  'apps/web/lib/booking-fee.ts. STABLE because it reads a table. Non-positive -> 0.';

-- ── 3 · the date and time the reader found on the receipt ───────────────────
ALTER TABLE public.payment_receipt_reads
  ADD COLUMN IF NOT EXISTS seen_paid_on date,
  ADD COLUMN IF NOT EXISTS seen_paid_time time;

COMMENT ON COLUMN public.payment_receipt_reads.seen_paid_on IS
  'The transfer date read off the screenshot (advisory; NULL when none could be read). Owner 2026-11-17: the payer does not type, we read it for the admin to match.';
COMMENT ON COLUMN public.payment_receipt_reads.seen_paid_time IS
  'The transfer clock time read off the screenshot, Manila wall time as printed (advisory; NULL when none could be read).';

COMMIT;
