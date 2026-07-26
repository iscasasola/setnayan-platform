-- ════════════════════════════════════════════════════════════════════════════
-- BOOKING FEE — the 5% / 1% TAPER (owner-locked 2026-07-25)
--
-- Canonical:  Vendor_Monetization_Model_LOCKED_2026-07-25.md § 3
-- Exact spec: Vendor_Monetization_BUILD_PLAN_2026-07-25.md § "EXACT fee-taper spec"
--
--   FROM: flat 5%, floor ₱50, no cap            (2026-07-24)
--   TO:   5% on the first ₱100,000 of the booking,
--         then 1% on the amount above; floor ₱50; no cap.
--
-- The owner's own worked examples, asserted below and in
-- apps/web/lib/booking-fee.test.ts:
--   ₱60,000 → ₱3,000 · ₱300,000 → ₱7,000 · ₱1,000,000 → ₱14,000 · ₱10M → ₱104,000
--
-- WHY A TAPER: the 1% tail softens the top so a large booking is not punished
-- for being large, and removes the pressure to under-declare on big deals.
-- Deals above ~₱3–5M route to Enterprise/Custom hand-pricing rather than the
-- automatic formula.
--
-- ⚠ THE DIRECTION THAT MATTERS: the taper is a DISCOUNT, never a surcharge. It
-- is continuous at ₱100,000 (₱5,000 computed either way) and monotonically
-- non-decreasing, so no vendor is ever better off declaring a smaller amount.
-- Both properties are asserted by the test suite, not just claimed here.
--
-- UNCHANGED, deliberately (build plan § "KEEP unchanged"): the sourced-only
-- gate, first-5-free, the LOCK trigger, the verified-gate and every idempotency
-- guard. This migration changes the RATE FUNCTION and the schedule version
-- string, nothing else. `booking_fee_centavos` is a pure value → value
-- function, so replacing it cannot disturb any existing row.
--
-- ⚠ ALREADY-WRITTEN CHARGES ARE NOT RE-PRICED. Every `booking_fee_charges` row
-- records the `schedule_version` it was computed under, which is exactly why
-- the version string is bumped here: a charge priced on the old schedule stays
-- readable as such. Prod holds 0 ledger rows and 0 charges today, so there is
-- nothing to re-price in practice.
-- ════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.booking_fee_centavos(p_amount_centavos BIGINT)
RETURNS BIGINT
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  -- ₱100,000 = 10,000,000 centavos (the 5% band ceiling)
  --      ₱50 =      5,000 centavos (the floor)
  SELECT CASE
    WHEN p_amount_centavos IS NULL OR p_amount_centavos <= 0 THEN 0::BIGINT
    ELSE GREATEST(
      round(
        LEAST(p_amount_centavos, 10000000::BIGINT) * 0.05
        + GREATEST(p_amount_centavos - 10000000::BIGINT, 0::BIGINT) * 0.01
      )::BIGINT,
      5000::BIGINT
    )
  END;
$$;

COMMENT ON FUNCTION public.booking_fee_centavos(BIGINT) IS
  'Vendor Booking Fee (centavos) for an agreed amount (centavos). 5% on the '
  'first PHP 100,000 (10,000,000c) then 1% above; floor PHP 50 (5000c); NO cap. '
  'Authoritative mirror of apps/web/lib/booking-fee.ts (owner-locked 2026-07-25, '
  'Vendor_Monetization_Model_LOCKED_2026-07-25.md s3; supersedes the 2026-07-24 '
  'flat 5%). Continuous at the band edge and monotonic, so under-declaring can '
  'never pay. Non-positive -> 0.';

-- ── Post-condition: the owner's four worked examples, plus the two properties
--    that make the schedule safe. Fails the migration rather than shipping a
--    fee function that disagrees with the locked model.
DO $$
DECLARE
  bad TEXT[] := ARRAY[]::TEXT[];
  v   BIGINT;
BEGIN
  -- PHP 60,000 -> PHP 3,000
  v := public.booking_fee_centavos(6000000);
  IF v <> 300000 THEN bad := array_append(bad, format('60k=%s want 300000', v)); END IF;

  -- PHP 300,000 -> PHP 7,000
  v := public.booking_fee_centavos(30000000);
  IF v <> 700000 THEN bad := array_append(bad, format('300k=%s want 700000', v)); END IF;

  -- PHP 1,000,000 -> PHP 14,000
  v := public.booking_fee_centavos(100000000);
  IF v <> 1400000 THEN bad := array_append(bad, format('1M=%s want 1400000', v)); END IF;

  -- PHP 10,000,000 -> PHP 104,000
  v := public.booking_fee_centavos(1000000000);
  IF v <> 10400000 THEN bad := array_append(bad, format('10M=%s want 10400000', v)); END IF;

  -- Continuity at the band edge: PHP 100,000 -> PHP 5,000 under either band.
  v := public.booking_fee_centavos(10000000);
  IF v <> 500000 THEN bad := array_append(bad, format('band-edge=%s want 500000', v)); END IF;

  -- The floor still binds below PHP 1,000, and PHP 0 is still free.
  IF public.booking_fee_centavos(50000) <> 5000 THEN
    bad := array_append(bad, 'floor no longer binds at PHP 500');
  END IF;
  IF public.booking_fee_centavos(0) <> 0 THEN
    bad := array_append(bad, 'zero/barter is no longer free');
  END IF;

  -- Monotonic across the band edge: declaring MORE must never pay LESS.
  IF public.booking_fee_centavos(10000001) < public.booking_fee_centavos(10000000) THEN
    bad := array_append(bad, 'fee DECREASES just above the band edge');
  END IF;

  IF array_length(bad, 1) IS NOT NULL THEN
    RAISE EXCEPTION 'booking fee taper post-condition failed: %',
      array_to_string(bad, ' | ');
  END IF;
END $$;
