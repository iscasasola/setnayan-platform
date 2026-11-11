-- a_bundle_prices_itself_and_carries_its_plan
-- Created via `pnpm migration:new`. Prefix auto-allocated to sort AFTER every
-- existing migration. Idempotent: ADD COLUMN IF NOT EXISTS · DROP/ADD CONSTRAINT.
--
-- ═══════════════════════════════════════════════════════════════════════════
-- THE BUNDLE MAKER'S TWO MISSING FACTS — its extra discount and its own plan.
--
-- Owner, 9 Nov 2026 (DECISION_LOG "SHOP › DISCOUNTS PAGE · BUNDLE MAKER TOTALS
-- …" and "A BUNDLE = 2+ SERVICE CARDS + ITS OWN PINNED PRICE + OFFER
-- SWITCHES…"): each card counts at its LOWEST price, an EXTRA BUNDLE DISCOUNT
-- comes off that sum "in pesos only, never a percent", and the bundle keeps
-- "its own payment plan" — a copy of the shop's default, adjusted here, adding
-- up to the new total. Prototype: specs `prototypes/shop_discounts_bundle_card_
-- open_2026-11-09/bundle-maker.html` (v3).
--
-- RULE 0 — a flag beats new schema. Checked first, neither fact has a home:
--   • `vendor_packages.total_price_centavos` IS the bundle's one price and stays
--     so — the maker now COMPUTES it (cards at their lowest − the extra) and the
--     server re-computes it before writing; every reader (the configurator, the
--     lock, `pricing_snapshot`) keeps reading the same column, untouched.
--     The extra discount is a separate fact: without it the maker cannot reopen
--     and show "₱139,000 − ₱9,000"; it would have to guess the split.
--   • A payment plan lives on a CARD (`vendor_service_payment_schedules`, one
--     row per installment, keyed to a service) or on a sent QUOTE
--     (`vendor_proposals.payment_schedule`, a resolved snapshot). Neither is a
--     bundle's. The plan is stored here as the editor's DRAFTS (the shape
--     `lib/proposal-payment-schedule.ts` resolves), never as resolved amounts:
--     resolved centavos would go stale the moment the total moves.
--
-- Nothing is billed, granted or computed here. Prod measured 2026-11-10:
-- 0 vendor_packages rows, so no backfill exists to get wrong.
--
-- RLS AND GRANTS — checked, not assumed. `vendor_packages` has RLS enabled at
-- CREATE TABLE (20260604110000) with row-scoped policies (public read of
-- active packages, owner write); new columns inherit them, no policy changes.
-- No per-column GRANT allowlist exists on the table (20271320001366 checked
-- the same), so the columns are readable the moment they exist — and neither
-- is private: a couple is shown both the discount and the plan.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 1) The extra bundle discount, in centavos ───────────────────────────────
-- "Pesos only" (owner): there is no unit column on purpose. ≥ 0 here; the
-- "above ₱0 and below the cards' total" rule needs the card prices, so it is
-- the server action's (lib/bundle-sums.ts `bundleProblems`), and 0 = none.
ALTER TABLE public.vendor_packages
  ADD COLUMN IF NOT EXISTS extra_discount_centavos BIGINT NOT NULL DEFAULT 0;

ALTER TABLE public.vendor_packages
  DROP CONSTRAINT IF EXISTS vendor_packages_extra_discount_ck;
ALTER TABLE public.vendor_packages
  ADD CONSTRAINT vendor_packages_extra_discount_ck
  CHECK (extra_discount_centavos >= 0);

COMMENT ON COLUMN public.vendor_packages.extra_discount_centavos IS
  'The Bundle Maker''s "Extra bundle discount" (owner 2026-11-09: pesos only, never a percent), in centavos; 0 = none. '
  'total_price_centavos = the picked cards at their lowest price − this, computed by the server on save '
  '(lib/bundle-sums.ts). Stored so the maker reopens showing the same sum.';

-- ── 2) The bundle's own payment plan, as drafts ─────────────────────────────
-- NULL = the bundle has not adjusted a plan; the maker shows a copy of the
-- shop's default. A JSON object { manual: InstallmentDraft[], autoBalance }.
ALTER TABLE public.vendor_packages
  ADD COLUMN IF NOT EXISTS payment_schedule_json JSONB;

ALTER TABLE public.vendor_packages
  DROP CONSTRAINT IF EXISTS vendor_packages_payment_schedule_shape_ck;
ALTER TABLE public.vendor_packages
  ADD CONSTRAINT vendor_packages_payment_schedule_shape_ck
  CHECK (
    payment_schedule_json IS NULL
    OR (
      jsonb_typeof(payment_schedule_json) = 'object'
      AND jsonb_typeof(payment_schedule_json -> 'manual') = 'array'
      AND jsonb_typeof(payment_schedule_json -> 'autoBalance') = 'object'
    )
  );

COMMENT ON COLUMN public.vendor_packages.payment_schedule_json IS
  'The bundle''s own payment plan (owner 2026-11-09: "a copy of the shop''s default plan that can be adjusted here"), '
  'stored as the editor''s drafts { manual: InstallmentDraft[], autoBalance } from lib/proposal-payment-schedule.ts — '
  'never resolved amounts, so it re-balances against the total it is read with. NULL = the shop default.';
