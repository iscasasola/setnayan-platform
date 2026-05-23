-- ============================================================================
-- 20260608000000_iteration_0023_setnayan_pay_rate_alignment.sql
--
-- Setnayan Pay rate drift fix — flat 5.0% + ₱50 minimum-fee floor alignment.
--
-- WHY this lands now (pilot 2026-06-01 is real-money flow):
--
--   • CLAUDE.md 2026-05-16 sixteenth row locked the Setnayan Pay convenience
--     fee at flat 5.0% on every rail (superseded the morning's 5.5% / 6.5%
--     dual-rate design). Migration 20260518000000 § 4 already repriced
--     `setnayan_pay_methods.setnayan_pay_pct` rows to 0.0500, but two
--     sibling drifts were left open:
--
--     (a) `orders.setnayan_fee_bps` was created (migration 20260516210000) at
--         DEFAULT 550. Every new `orders` row defaults to the retired 5.5%
--         rate. The order-time snapshot pattern means newly-created orders
--         under-charge by 0.5pp until an admin overrides the column. This
--         migration flips the default to 500 + backfills unpaid existing rows
--         that still carry 550. Paid / refunded / cancelled orders stay frozen
--         (audit-trail discipline — never rewrite settled-money values).
--
--     (b) The ₱50 minimum-fee floor locked CLAUDE.md 2026-05-17 ninth row was
--         never schema'd. Sub-₱1,000 bookings (5.0% × ₱1,000 = ₱50 crossover)
--         under-charge below Setnayan's per-transaction operating cost. This
--         migration adds `setnayan_pay_methods.min_fee_centavos INT NOT NULL
--         DEFAULT 5000` (₱50.00 in centavos) so each rail carries its own
--         floor. Admin can raise per-rail without code changes (matches the
--         existing `setnayan_pay_pct` admin-configurable pattern).
--
-- Code-side enforcement (apps/web/lib/payouts.ts + apps/web/lib/vendor-earnings.ts)
-- ships in the same PR — `computePayoutBreakdown` + `convenienceFeePhp` now
-- apply MAX(gross × bps / 10000, min_fee_centavos) per the canonical formula
-- from CLAUDE.md 2026-05-17 ninth row.
--
-- Idempotent: ADD COLUMN IF NOT EXISTS · safe ALTER DEFAULT · scoped UPDATE
-- (only WHERE the legacy 550 still sits + status is unpaid · only WHERE
-- min_fee_centavos is NULL after the add). Safe to re-run.
--
-- Source of truth: CLAUDE.md decision-log 2026-05-16 row 16 (flat 5.0%) +
-- 2026-05-17 ninth row (₱50 min floor) + 2026-05-23 5-sweep audit (Sweep 3
-- · the audit that surfaced this drift).
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- 1. setnayan_pay_methods.min_fee_centavos — new column, ₱50 floor per rail.
--
-- ALTER ADD COLUMN IF NOT EXISTS so re-runs no-op. NOT NULL DEFAULT 5000
-- (centavos = ₱50) backfills every existing row to the canonical floor in
-- one shot — including the 6 V1 rails seeded in 20260516030000. The CHECK
-- guards against accidental negatives.
--
-- Why centavos (not bps): the floor is an absolute peso amount, not a
-- percentage. Storing as integer centavos matches every other peso-money
-- column on the platform (orders.* / vendor_payouts.* / service_catalog.*)
-- and keeps the math integer-clean — no floating-point centavo rounding.
-- ----------------------------------------------------------------------------

ALTER TABLE public.setnayan_pay_methods
  ADD COLUMN IF NOT EXISTS min_fee_centavos INTEGER NOT NULL DEFAULT 5000
    CHECK (min_fee_centavos >= 0);

COMMENT ON COLUMN public.setnayan_pay_methods.min_fee_centavos IS
  'Minimum Setnayan Pay convenience-fee floor in centavos · canonical 5000 '
  '(₱50.00) per CLAUDE.md decision-log 2026-05-17 ninth row · ensures '
  'sub-₱1,000 bookings clear Setnayan''s per-transaction operating cost. '
  'Admin-configurable per rail (parallel to setnayan_pay_pct). Final '
  'checkout fee = MAX(subtotal × setnayan_pay_pct, min_fee_centavos / 100).';

-- ----------------------------------------------------------------------------
-- 2. setnayan_pay_methods.setnayan_pay_pct — ensure flat 5.0% on every active
-- rail (defensive — migration 20260518000000 § 4 already did this, but if
-- a rail was seeded post-2026-05-18 at the wrong rate, we re-align here).
--
-- This UPDATE only touches rows where the rate is NOT already 0.0500. On a
-- clean prod where 20260518000000 ran, this is a 0-row UPDATE. On a stale
-- env (preview branch, local) it self-heals.
-- ----------------------------------------------------------------------------

UPDATE public.setnayan_pay_methods
   SET setnayan_pay_pct = 0.0500,
       updated_at = NOW(),
       notes = COALESCE(notes || ' | ', '')
             || 'Re-aligned to flat 5.0% on 2026-06-08 per CLAUDE.md 2026-05-16 '
             || 'sixteenth row (defensive · 2026-05-23 5-sweep audit Sweep 3).'
 WHERE setnayan_pay_pct <> 0.0500;

-- Touch up the column comment to reflect the canonical rate + cite the lock.
COMMENT ON COLUMN public.setnayan_pay_methods.setnayan_pay_pct IS
  'Setnayan Pay platform fee per rail as a decimal · canonical 0.0500 (5.0%) '
  'per CLAUDE.md decision-log 2026-05-16 sixteenth row · supersedes the '
  'morning 2026-05-16 5.5%/6.5% dual-rate design. Admin-configurable for '
  'rate adjustments without a code release. Pairs with min_fee_centavos '
  'for the MAX-of-percent-or-floor formula at checkout.';

-- ----------------------------------------------------------------------------
-- 3. orders.setnayan_fee_bps — flip DEFAULT 550 → 500 to match the canonical
-- flat 5.0% rate. Existing UNPAID orders still carrying the old 550 default
-- get re-snapped to 500 so the cart-approval flow computes the right fee.
--
-- Paid / fulfilled / refunded / cancelled orders are LEFT ALONE — they're
-- settled money and rewriting their fee_bps would corrupt downstream
-- receipts, vendor payout history, and BIR audit trails. The audit-trail
-- discipline is the same one applied across all V1 money-touching tables
-- (CLAUDE.md 2026-05-12 § cart-snapshot principle).
-- ----------------------------------------------------------------------------

ALTER TABLE public.orders
  ALTER COLUMN setnayan_fee_bps SET DEFAULT 500;

UPDATE public.orders
   SET setnayan_fee_bps = 500,
       updated_at = NOW()
 WHERE setnayan_fee_bps = 550
   AND status IN ('draft', 'submitted', 'awaiting_payment');

COMMENT ON COLUMN public.orders.setnayan_fee_bps IS
  'Setnayan Pay convenience fee in basis points · canonical 500 (5.0%) per '
  'CLAUDE.md decision-log 2026-05-16 sixteenth row · admin-configurable per '
  'rail via setnayan_pay_methods.setnayan_pay_pct but defaults to 500 (flat '
  '5.0%). Snapshotted onto the order at submit time so post-submit rate '
  'changes never re-charge a settled order. Paired with the ₱50 min-fee '
  'floor (CLAUDE.md 2026-05-17 ninth row) at the application layer — see '
  'apps/web/lib/payouts.ts::computePayoutBreakdown for the canonical '
  'MAX(gross × bps / 10000, min_fee_centavos) formula.';

COMMIT;
