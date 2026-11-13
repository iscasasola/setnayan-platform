-- a_self_added_price_says_how_it_works
-- Created via `pnpm migration:new`. Prefix auto-allocated to sort AFTER every
-- existing migration. KEEP THIS MIGRATION IDEMPOTENT (it may be re-applied).
--
-- 🧾 A SUPPLIER THE COUPLE ADDS SAYS HOW ITS PRICE WORKS — v2 (owner 2026-11-13, DECISION_LOG "SELF-ADDED PRICE: THE
-- COUPLE RECORDS WHAT WAS AGREED" · "AFTER THE CLAIM, THE SUPPLIER'S PRICE FOLLOWS THE GUEST LIST" · "PRICE BASIS v2
-- AGREED — BUILT WITH THE SHIPPED BOXES AND THE SHIPPED PAYMENT PLAN"; prototype
-- `prototypes/manual_service_price_basis_2026-11-13/v2.html`).
--
-- The couple records WHAT WAS AGREED, both numbers typed — never read from the schedule or the live guest list:
--   One price  — one payment for the whole day.                 total_cost_php
--   Per guest  — the total agreed + the guests agreed.            total_cost_php · pax_quote_base
--   Per hour   — the total agreed + the hours agreed.             total_cost_php · agreed_hours (NEW)
-- `total_cost_php` STAYS THE ONE TOTAL the budget reads, written by the shipped `updateVendorCosts` exactly as One
-- price always was. Nothing here re-prices it: before the claim the couple's numbers stay as typed.
--
-- ── RULE 0: WHICH COLUMN ALREADY SAYS THIS? ───────────────────────────────────────────────────────────────────────────
--   guests agreed → `event_vendors.pax_quote_base` (20261211000000): "Guest count the vendor base price is anchored to".
--                   For a self-added per-guest booking that is exactly the agreed guests the total is anchored to. It
--                   only ever drives the retired added-guest surcharge on a SETNAYAN shop's row (lib/pax.ts reads
--                   `marketplace_vendor_id = <shop>` rows only), and the quote-follow (20271339826198) writes it as the
--                   billed count — the same meaning. No new column.
--   hours agreed  → nothing on the booking holds hours (`min_hours` lives on `vendor_services` and
--                   `vendor_package_items`, the supplier's own catalogue). ONE new column: `agreed_hours`.
--   how it works  → `pricing_basis`, in the Card Maker's vocabulary (`vendor_services.pricing_basis`); NULL = One price.
-- RLS: columns on `event_vendors` ride its existing policies — no new table, no new policy.
--
-- ── PER HEAD ON THE GUEST LIST ────────────────────────────────────────────────────────────────────────────────────────
-- `event_vendor_counts_per_head` (20271307968824) joined only `vendor_services.pricing_basis`, so a self-added caterer
-- never showed on the guest list's per-head Show & sort row. It now also counts a booking whose own basis is per guest.
--
-- Held by apps/web/tests/db/a-self-added-price-says-how-it-works.db.test.ts and
-- apps/web/lib/self-added-price-basis.test.ts.

BEGIN;

-- ── 1 · The facts on the booking ──────────────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.event_vendors
  ADD COLUMN IF NOT EXISTS pricing_basis TEXT,
  ADD COLUMN IF NOT EXISTS agreed_hours NUMERIC(5,2);

ALTER TABLE public.event_vendors DROP CONSTRAINT IF EXISTS event_vendors_pricing_basis_check;
ALTER TABLE public.event_vendors
  ADD CONSTRAINT event_vendors_pricing_basis_check
  CHECK (pricing_basis IS NULL OR pricing_basis IN ('per_pax', 'per_hour'));

-- Hours agreed exist exactly when the basis is per hour; per guest carries its guests agreed.
ALTER TABLE public.event_vendors DROP CONSTRAINT IF EXISTS event_vendors_agreed_hours_with_basis_check;
ALTER TABLE public.event_vendors
  ADD CONSTRAINT event_vendors_agreed_hours_with_basis_check
  CHECK (
    -- COALESCE: with a NULL basis a bare `pricing_basis = 'per_hour'` is NULL, and a CHECK lets NULL through.
    (COALESCE(pricing_basis, '') <> 'per_hour' AND agreed_hours IS NULL)
    OR (COALESCE(pricing_basis, '') = 'per_hour' AND agreed_hours IS NOT NULL AND agreed_hours > 0)
  );
ALTER TABLE public.event_vendors DROP CONSTRAINT IF EXISTS event_vendors_per_pax_has_guests_agreed_check;
ALTER TABLE public.event_vendors
  ADD CONSTRAINT event_vendors_per_pax_has_guests_agreed_check
  CHECK (pricing_basis IS DISTINCT FROM 'per_pax' OR pax_quote_base IS NOT NULL);

COMMENT ON COLUMN public.event_vendors.pricing_basis IS
  'How a supplier the COUPLE added prices (owner 2026-11-13, v2): per_pax | per_hour; NULL = One price. The Card '
  'Maker''s vocabulary (vendor_services.pricing_basis). total_cost_php stays the one total; per_pax carries the guests '
  'agreed in pax_quote_base, per_hour the hours agreed in agreed_hours. Migration 20271342032145.';
COMMENT ON COLUMN public.event_vendors.agreed_hours IS
  'The hours the couple and a self-added supplier agreed, typed by the couple (never read from the schedule). Set '
  'exactly when pricing_basis = per_hour. Migration 20271342032145.';

-- ── 2 · Per head: the one test, now also the booking's own basis ──────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.event_vendor_counts_per_head(p_event_vendor_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1
      FROM public.event_vendors ev
      JOIN public.vendor_services vs
        ON vs.vendor_service_id = ev.service_id
        OR vs.vendor_service_id = ANY (COALESCE(ev.requested_service_ids, ARRAY[]::UUID[]))
     WHERE ev.vendor_id = p_event_vendor_id
       AND vs.pricing_basis = 'per_pax'
  ) OR EXISTS (
    -- A supplier the couple added and priced per guest (20271342032145).
    SELECT 1
      FROM public.event_vendors ev
     WHERE ev.vendor_id = p_event_vendor_id
       AND ev.pricing_basis = 'per_pax'
  );
$$;
REVOKE ALL ON FUNCTION public.event_vendor_counts_per_head(UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.event_vendor_counts_per_head(UUID) TO service_role;

COMMIT;
