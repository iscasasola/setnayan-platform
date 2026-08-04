-- ════════════════════════════════════════════════════════════════════════════
-- CREDIT IS CONSUMABLE ON THE VENDOR'S OTHER SERVICES — the committed price.
--
-- Owner-locked 2026-07-26: **"credits can be consumables to other services,
-- but not deductables."**
--
-- The "not deductible" half shipped already (`20271010903954` retired the
-- refund policy, so unspent credit can never come off the price). This is the
-- "consumable" half: what it costs to buy one of the vendor's OTHER services
-- with package credit.
--
-- ── WHY A NEW COLUMN AND NOT `starting_price_php` ───────────────────────────
-- From the build spec (M2), and this is the whole point of the column:
--
--   "starting_price_php is the synced FLOOR ('min bracket / per_pax×min_pax /
--    hour_base', 20270502342558:51,83), never a committed price — debiting
--    credit against it is exactly the failure we set out to delete, moved one
--    table over."
--
-- `starting_price_php` is the "from ₱X" anchor Explore renders. It is a
-- marketing floor, recomputed whenever a vendor edits brackets. Spending real
-- credit against it would debit a couple at a number the vendor never agreed
-- to for that purchase — the same class of bug as pricing a booking off a stale
-- line total.
--
-- ── FAIL-CLOSED BY DEFAULT ──────────────────────────────────────────────────
-- NULL = this service is NOT purchasable with credit. That is the default, so
-- a vendor's whole catalogue does not silently become spendable the moment the
-- column exists; each service is opted in with a committed number. The credit
-- engine already refuses an addition it has no server-resolved price for
-- (`unknown_addition`) rather than treating it as free.
--
-- ⚠ > 0, not >= 0: a ₱0 credit price would let a couple drain nothing and
-- receive something, and reads as "free" rather than "not for sale on credit" —
-- which is what NULL already says, unambiguously.
-- ════════════════════════════════════════════════════════════════════════════

ALTER TABLE public.vendor_services
  ADD COLUMN IF NOT EXISTS credit_price_centavos BIGINT;

ALTER TABLE public.vendor_services
  DROP CONSTRAINT IF EXISTS vendor_services_credit_price_positive;
ALTER TABLE public.vendor_services
  ADD CONSTRAINT vendor_services_credit_price_positive
  CHECK (credit_price_centavos IS NULL OR credit_price_centavos > 0);

COMMENT ON COLUMN public.vendor_services.credit_price_centavos IS
  'Vendor-COMMITTED price, in centavos, when this service is bought with '
  'package credit. NULL = not spendable on credit (the default, fail-closed). '
  'NEVER derived from starting_price_php, which is a synced marketing FLOOR '
  'recomputed on every bracket edit - debiting credit against a floor would '
  'charge a couple a number the vendor never committed to. Owner-locked '
  '2026-07-26: "credits can be consumables to other services, but not '
  'deductables." Vendor_Package_Credit_BUILD_SPEC_2026-07-26 M2.';

DO $$
BEGIN
  -- Not-for-sale-on-credit is the default.
  IF EXISTS (SELECT 1 FROM public.vendor_services WHERE credit_price_centavos IS NOT NULL) THEN
    RAISE EXCEPTION 'a service is already credit-spendable — the column must default to NULL';
  END IF;

  -- A zero credit price must be impossible: NULL already means "not for sale".
  BEGIN
    UPDATE public.vendor_services SET credit_price_centavos = 0
     WHERE vendor_service_id = (SELECT vendor_service_id FROM public.vendor_services LIMIT 1);
    IF FOUND THEN
      RAISE EXCEPTION 'a zero credit price was accepted — it must be NULL or > 0';
    END IF;
  EXCEPTION WHEN check_violation THEN
    NULL; -- expected
  END;
END $$;
