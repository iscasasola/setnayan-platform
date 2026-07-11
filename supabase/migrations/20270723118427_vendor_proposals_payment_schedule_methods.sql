-- vendor_proposals_payment_schedule_methods
-- Prefix chosen to sort AFTER every existing migration. KEEP IDEMPOTENT
-- (may be re-applied): ADD COLUMN IF NOT EXISTS only; no data backfill; RLS
-- policies UNCHANGED (the new columns are set at INSERT time by the vendor's
-- own draft insert, which the existing vendor_proposals_org_insert WITH CHECK
-- already scopes to the vendor's own booked event).
--
-- ============================================================================
-- VENDOR PROPOSAL MAKER — deferred half (self-balancing payment schedule +
-- accepted payment methods). See Vendor_Proposal_Maker_2026-07-10.md § 8
-- ("Payment schedule — self-balancing, pays to ₱0") + § 9 ("Accepted payment
-- methods").
--
-- The shipped in-thread editor (#3061) persists LINE ITEMS into
-- vendor_proposals.line_items (jsonb) but DEFERRED the payment schedule + the
-- payment-methods pick. This migration adds the two sibling JSONB columns those
-- need, so a sent quote also carries HOW the couple pays it (installments +
-- which of the vendor's published rails to use). Both are additive snapshots
-- frozen on send, alongside line_items — no new table, no RLS change.
--
--   • payment_schedule  — the resolved self-balancing schedule snapshot
--     produced by apps/web/lib/proposal-payment-schedule.ts::resolveSchedule.
--     Shape: { version, base_centavos, credit_centavos, total_centavos,
--     balances, over_by_centavos, credit_over_centavos,
--     installments: [{ seq, label, kind, amount_centavos, raw_centavos,
--     percent_bps, due, offset_days, is_downpayment, is_auto_balance,
--     credit_applied_centavos }] }. Empty {} = no schedule (a proposal sent
--     before this feature, or a vendor who didn't build one) → the couple view
--     degrades to line items only.
--     seq-0 = the downpayment = the guest-side lock amount (protected from the
--     crew-meal credit); the last row is the auto "Final balance" that makes the
--     raw plan pay to ₱0 against base_centavos (the proposal total before the
--     crew credit).
--
--   • payment_method_ids — an array of the vendor's own
--     vendor_payment_methods.payment_method_id (UUID strings) the vendor chose
--     to show the couple with this quote. [] = show all of the vendor's
--     approved + shown methods by default (the couple-facing resolver treats an
--     empty list as "all approved").
--
-- ADDITIVE + DEFAULTED — every existing vendor_proposals row keeps behaving
-- EXACTLY as before ('{}'::jsonb / '[]'::jsonb defaults; no code path reads a
-- missing schedule as an error).
-- ============================================================================

ALTER TABLE public.vendor_proposals
  ADD COLUMN IF NOT EXISTS payment_schedule  JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS payment_method_ids JSONB NOT NULL DEFAULT '[]'::jsonb;

COMMENT ON COLUMN public.vendor_proposals.payment_schedule IS
  'Frozen-on-send self-balancing payment schedule snapshot (Vendor Proposal Maker § 8). Resolved by apps/web/lib/proposal-payment-schedule.ts. seq-0 = downpayment/lock (crew-credit-protected); final row = auto "Final balance" paying the raw plan to ₱0 against base_centavos. {} = no schedule (degrades to line items only).';
COMMENT ON COLUMN public.vendor_proposals.payment_method_ids IS
  'Array of the vendor''s own vendor_payment_methods.payment_method_id shown with this quote (Vendor Proposal Maker § 9). [] = show all of the vendor''s approved + shown methods by default.';
