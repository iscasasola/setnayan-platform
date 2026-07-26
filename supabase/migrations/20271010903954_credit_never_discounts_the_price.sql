-- ════════════════════════════════════════════════════════════════════════════
-- CREDIT SHIFTS, IT NEVER DISCOUNTS — retire 'refundable'.
--
-- Owner-locked 2026-07-26: **"credits can be shifted to other services, but
-- will not discount the price."**
--
-- That settles a question the engine itself had flagged OPEN. `package-credit.ts`
-- carried this warning against `unspent_credit_policy = 'refundable'`:
--
--   "⚠ 'refundable' IS AN UNVERIFIED SEMANTIC — OWNER DECISION OPEN. Read
--    literally ('unspent credit comes off the price'), 'refundable' refunds the
--    WHOLE unspent pool — which includes consumable_budget_centavos, money the
--    sticker price already charged for... It also means removals cut the price,
--    which contradicts the model's own pillar ('changes WHAT you get, not what
--    you pay')."
--
-- Measured before this migration, on the seeded shape (₱1,400,000 package with
-- a ₱200,000 consumable budget), a couple who customized NOTHING:
--
--     policy 'expiring'    → pays ₱1,400,000   (correct)
--     policy 'refundable'  → pays ₱1,200,000   ← ₱200,000 given away for nothing,
--                                               every inclusion still delivered
--
-- The pool is not a discount the couple can bank; it is spending power inside
-- the package. Leftover credit is forfeited.
--
-- SAFE: prod holds 0 vendor_packages, so no row carries the retired value and
-- nothing needs backfilling. The CHECK is tightened rather than the column
-- dropped, so a stored 'refundable' anywhere would REFUSE loudly instead of
-- quietly discounting.
-- ════════════════════════════════════════════════════════════════════════════

-- Defensive: if any row somehow carries the retired value, move it to the only
-- policy that exists rather than letting the CHECK fail the migration.
UPDATE public.vendor_packages
   SET unspent_credit_policy = 'expiring'
 WHERE unspent_credit_policy IS DISTINCT FROM 'expiring';

ALTER TABLE public.vendor_packages
  DROP CONSTRAINT IF EXISTS vendor_packages_unspent_credit_policy_check;
ALTER TABLE public.vendor_packages
  ADD CONSTRAINT vendor_packages_unspent_credit_policy_check
  CHECK (unspent_credit_policy = 'expiring');

ALTER TABLE public.vendor_packages
  ALTER COLUMN unspent_credit_policy SET DEFAULT 'expiring';

COMMENT ON COLUMN public.vendor_packages.unspent_credit_policy IS
  'What happens to leftover credit. ONE value: expiring. Owner-locked '
  '2026-07-26 - "credits can be shifted to other services, but will not '
  'discount the price." refundable is RETIRED: it took unspent budget off the '
  'total, so a couple who customized nothing paid less and still received '
  'everything. Credit changes WHAT you get, never what you pay.';

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.vendor_packages WHERE unspent_credit_policy <> 'expiring') THEN
    RAISE EXCEPTION 'a package still carries a non-expiring credit policy';
  END IF;
END $$;
