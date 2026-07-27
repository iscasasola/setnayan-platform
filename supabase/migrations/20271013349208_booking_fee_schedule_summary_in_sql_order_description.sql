-- booking fee schedule summary in sql order description
--
-- THE DEFECT (live in prod). `public.booking_fee_upsert_vendor_order` — the SQL
-- twin of the TS order minter, used on the AMENDMENT path where no TypeScript is
-- in the loop — mints the vendor's money document with a hardcoded rate:
--
--     'Setnayan booking fee (5%) — amended booking, up for verification within 24 hrs'
--
-- The fee has been a TAPER since 2026-07-25 (5% on the first ₱100,000, then 1%,
-- floor ₱50, no cap — migration 20271009120000). "(5%)" is therefore only true at
-- or below ₱100,000. An amended booking of ₱1,000,000 is billed ₱14,000 — 1.40% —
-- on a document that claims 5%. That is a wrong statement of the rate on a
-- vendor-facing bill.
--
-- THE FIX, in two parts:
--   1. `public.booking_fee_schedule_summary()` — an IMMUTABLE, service_role-only
--      SQL mirror of `bookingFeeScheduleSummary()` in apps/web/lib/booking-fee.ts,
--      returning the SAME sentence that TS derives from the BOOKING_FEE constants.
--   2. `booking_fee_upsert_vendor_order` re-created with its body BYTE-IDENTICAL
--      except that the description now COMPOSES that summary instead of asserting
--      a rate. No behaviour, no math, no schedule version, no grant changes.
--
-- ANTI-DRIFT. SQL cannot import the TS constants, so the sentence is duplicated
-- by necessity. The duplication is guarded exactly the way
-- `booking_fee_is_sourced_surface` vs `SOURCED_INQUIRY_SOURCES` already is: a db
-- test calls BOTH and asserts the strings are identical
-- (apps/web/tests/db/booking-fee-rederive.db.test.ts). Reprice the taper and the
-- TS side moves (it is derived from BOOKING_FEE), this SQL literal does not, and
-- the test fails loudly instead of shipping another wrong bill.
--
-- NOT CHANGED, deliberately: `booking_fee_centavos` (the math), the schedule
-- version string, the re-derive core, the trigger, and the public marketing /
-- vendor-dashboard copy that still says "flat 5%" (a positioning decision, not
-- an engineering one).

BEGIN;

-- ── 1) The schedule sentence, as SQL ─────────────────────────────────────────
-- MUST equal bookingFeeScheduleSummary() in apps/web/lib/booking-fee.ts, which
-- composes it from BOOKING_FEE = { rate 0.05, tailRate 0.01, tier1LimitPhp
-- 100_000, minPhp 50 }. Copied from that function's real output, not retyped
-- from prose. IMMUTABLE: it is a constant.
CREATE OR REPLACE FUNCTION public.booking_fee_schedule_summary()
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT '5% of the first ₱100,000, then 1%, minimum ₱50'::TEXT;
$$;

COMMENT ON FUNCTION public.booking_fee_schedule_summary() IS
  'The vendor Booking Fee schedule as one human sentence, for money documents '
  'minted in SQL (the amendment path, where no TypeScript runs). Authoritative '
  'mirror of bookingFeeScheduleSummary() in apps/web/lib/booking-fee.ts — the two '
  'are asserted identical by apps/web/tests/db/booking-fee-rederive.db.test.ts, so '
  'a reprice cannot leave this string behind. service_role-only.';

-- ── 2) The order minter — body unchanged except the description ──────────────
-- Reproduced verbatim from 20270930120000 § 2 (which stays untouched: it is
-- already applied, and editing an applied migration is drift, not a fix). The
-- ONLY delta is the `description` value in the INSERT.
CREATE OR REPLACE FUNCTION public.booking_fee_upsert_vendor_order(p_charge_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_charge     RECORD;
  v_order      RECORD;
  v_svc        TEXT;
  v_amount_php NUMERIC(12, 2);
  v_payer      UUID;
  v_ref        TEXT;
  v_order_id   UUID;
BEGIN
  SELECT charge_id, event_id, vendor_profile_id, amount_charged_centavos, status, kind
    INTO v_charge
    FROM public.booking_fee_charges
    WHERE charge_id = p_charge_id;
  IF NOT FOUND THEN RETURN; END IF;

  -- Mirrors bookingFeeLockServiceKey() in apps/web/lib/booking-fee-lock.ts.
  v_svc := 'vendor_booking_fee__' || p_charge_id::text;

  SELECT order_id, status, requested_total_php
    INTO v_order
    FROM public.orders
    WHERE service_key = v_svc
    LIMIT 1;

  -- Not collectible → make sure no OPEN order lingers.
  IF v_charge.status <> 'pending' OR COALESCE(v_charge.amount_charged_centavos, 0) <= 0 THEN
    IF v_order.order_id IS NOT NULL
       AND v_order.status NOT IN ('paid', 'fulfilled', 'refunded', 'cancelled') THEN
      UPDATE public.orders
        SET status = 'cancelled', updated_at = NOW()
        WHERE order_id = v_order.order_id;
      UPDATE public.payments
        SET status = 'rejected',
            admin_notes = COALESCE(admin_notes || ' ', '') || '[auto-void: booking amended]'
        WHERE order_id = v_order.order_id AND status = 'pending';
    END IF;
    RETURN;
  END IF;

  v_amount_php := round(v_charge.amount_charged_centavos)::numeric / 100.0;

  IF v_order.order_id IS NOT NULL THEN
    -- Never touch a settled/cancelled order — reconciliation there is the paid
    -- branch's supplementary-charge job, not an in-place rewrite.
    IF v_order.status IN ('paid', 'fulfilled', 'refunded', 'cancelled') THEN RETURN; END IF;
    IF v_order.requested_total_php IS DISTINCT FROM v_amount_php THEN
      UPDATE public.orders
        SET requested_total_php = v_amount_php, updated_at = NOW()
        WHERE order_id = v_order.order_id;
      UPDATE public.payments
        SET amount_php = v_amount_php
        WHERE order_id = v_order.order_id AND status = 'pending';
    END IF;
    RETURN;
  END IF;

  -- No order yet → mint one (needs a claimable vendor user as payer).
  SELECT user_id INTO v_payer
    FROM public.vendor_profiles
    WHERE vendor_profile_id = v_charge.vendor_profile_id;
  IF v_payer IS NULL THEN RETURN; END IF;

  v_ref := 'SN' || upper(substr(md5(gen_random_uuid()::text), 1, 8));
  INSERT INTO public.orders
    (event_id, user_id, vendor_profile_id, service_key, description,
     requested_total_php, status, reference_code)
  VALUES
    (v_charge.event_id, v_payer, v_charge.vendor_profile_id, v_svc,
     -- DERIVED, never asserted: the fee is a taper, so a bare "(5%)" is a false
     -- statement of the rate on every booking above ₱100,000.
     'Setnayan booking fee (' || public.booking_fee_schedule_summary()
       || ') — amended booking, up for verification within 24 hrs',
     v_amount_php, 'submitted', v_ref)
  RETURNING order_id INTO v_order_id;

  INSERT INTO public.payments
    (order_id, user_id, amount_php, channel, paid_at)
  VALUES
    (v_order_id, v_payer, v_amount_php, 'manual', CURRENT_DATE);
END;
$$;

-- CREATE OR REPLACE keeps the existing comment and grants, but re-issuing them is
-- free and makes this migration self-contained if it is ever replayed onto a
-- schema where the function did not previously exist.
COMMENT ON FUNCTION public.booking_fee_upsert_vendor_order(UUID) IS
  'Make a booking-fee charge''s vendor-payer QR order match its collectible amount '
  '(mint / sync / cancel), idempotently. SQL twin of collectBookingFeeAtLock''s '
  'order minter, for the amendment path where no TS is in the loop. service_role-only.';

-- ── Grants — money copy is service_role-only; no new client surface ──────────
-- New functions are born EXECUTE-able by PUBLIC in this project, which is how the
-- exposure baseline widens by accident. Same pattern as 20270930120000 § grants.
REVOKE ALL ON FUNCTION public.booking_fee_schedule_summary() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.booking_fee_schedule_summary() TO service_role;
REVOKE ALL ON FUNCTION public.booking_fee_upsert_vendor_order(UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.booking_fee_upsert_vendor_order(UUID) TO service_role;

-- ── Post-condition: refuse to apply if the description would still claim a bare
--    rate. Cheap, and it makes the intent of this migration unfakeable.
DO $$
DECLARE
  def TEXT;
BEGIN
  SELECT pg_get_functiondef(p.oid) INTO def
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'booking_fee_upsert_vendor_order';
  IF position('booking fee (5%)' in def) > 0 THEN
    RAISE EXCEPTION 'booking_fee_upsert_vendor_order still hardcodes the 5%% rate';
  END IF;
  IF position('booking_fee_schedule_summary' in def) = 0 THEN
    RAISE EXCEPTION 'booking_fee_upsert_vendor_order does not compose the fee schedule summary';
  END IF;
END $$;

COMMIT;
