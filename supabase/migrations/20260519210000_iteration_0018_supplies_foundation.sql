-- ============================================================================
-- 20260519210000_iteration_0018_supplies_foundation.sql
--
-- Renamed 2026-05-19 from 20260519200000 to 20260519210000 to resolve a
-- timestamp collision with a parallel-agent migration (vendor_invites
-- foundation) that landed at the same 20:00 prefix.
--
-- PR 1 of 8 for V1 iteration 0018 Setnayan Supplies (curated reseller).
-- Spec corpus: 0018_supplies_marketplace/0018_supplies_marketplace.md
-- Engineering brief: ENGINEERING_BRIEF.md at this worktree's root
-- CLAUDE.md decision log: 2026-05-19 "0018 business-model pivot" row and
--                         2026-05-19 "0018 lowest-available-wholesale" row.
--
-- Schema foundation for the Setnayan-sourced resale model:
--   • Setnayan negotiates wholesale prices per service area with supplier
--     vendors.
--   • Setnayan retail = wholesale × 1.5 (50% markup; ~33% of retail).
--   • For each (SKU, service_area), the pricing engine picks the cheapest
--     available supplier vendor at order time and snapshots wholesale + retail
--     into the line item.
--   • Setnayan is the seller of record; couples buy from Setnayan, not from
--     supplier vendors directly.
--   • Supplier vendor payout = wholesale (NOT retail-minus-commission).
--
-- This migration adds the MINIMAL foundation so PRs 2-8 can pick up:
--
--   (1) ALTER public.vendor_profiles: add is_supplier_vendor flag +
--       supplier_categories array. Supplier vendors do NOT appear in the
--       couples-facing marketplace (0006) — they're sourcing-channel only.
--       A vendor CAN be both marketplace + supplier; both classifications
--       coexist independently.
--
--   (2) supplier_vendor_skus — one row per (vendor, sku_code). Vendor's
--       canonical SKU identifier. Inactive SKUs are skipped by the pricing
--       engine.
--
--   (3) supplier_vendor_sku_pricing — one row per (sku, service_area_code,
--       effective_from). Stores wholesale_centavos for the (sku, area) at
--       a point in time. Volume tiers as JSONB.
--
--   (4) supplies_orders — Setnayan's order to couple (NOT the vendor's order
--       to Setnayan). Separate from public.orders (which serves 0006 vendor
--       bookings + 0034 SKU cart). Setnayan IS the seller of record on every
--       supplies_orders row.
--
--   (5) supplies_order_line_items — per-line wholesale + retail snapshot,
--       per-line supplier_vendor_id snapshot. Snapshots protect against
--       wholesale price changes mid-fulfillment.
--
--   (6) ALTER public.vendor_payouts: add payout_type ('commission' or
--       'wholesale') and supplies_order_id FK. Existing rows backfilled to
--       payout_type='commission'. New supplies wholesale payouts will get
--       payout_type='wholesale' with supplies_order_id set and order_id NULL.
--       XOR constraint ensures exactly one of (order_id, supplies_order_id)
--       is set per payout row.
--
-- Out of scope for this PR (Phases 2-8 cover):
--   - Pricing engine (PR 2) — lowest-available-wholesale resolver
--   - Couple-facing browse / cart / checkout (PR 3-4)
--   - Admin supplier onboarding surface (PR 5)
--   - BIR OR + invoice chain (PR 6)
--   - Coordinator-specific features (PR 7; depends on V1.2 multi-moderator)
--   - Email templates + tests (PR 8)
--
-- Pre-launch operational gate (separate from engineering):
--   - At least 1-3 supplier vendor agreements signed per SKU category per
--     service area (V1 = METRO_MANILA only) before couples see real listings.
--   - Until then, surface stays behind "Coming to your area soon" empty state.
--   - 01_Contracts/Setnayan_Supplier_Vendor_Agreement.md template owed.
--
-- Backwards compatibility:
--   - vendor_profiles ALTER is purely additive (new nullable/defaulted cols).
--   - Existing vendor_payouts rows backfill to payout_type='commission' so
--     no behavior changes for already-disbursed commission payouts.
--   - All new tables; no DROP, no destructive change.
--   - Idempotent (IF NOT EXISTS · ADD COLUMN IF NOT EXISTS · CHECK constraints
--     use DO blocks where needed).
--
-- Risk surface:
--   - Pricing engine (PR 2) interprets these rows; this PR just lays the
--     groundwork. No couples can transact yet (no UI wired).
--   - vendor_payouts XOR constraint: validates after backfill so existing
--     commission payouts (order_id set) satisfy it cleanly.
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- 1. Extend vendor_profiles for supplier-vendor classification
-- ----------------------------------------------------------------------------

ALTER TABLE public.vendor_profiles
  ADD COLUMN IF NOT EXISTS is_supplier_vendor BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS supplier_categories TEXT[] NOT NULL DEFAULT '{}';

COMMENT ON COLUMN public.vendor_profiles.is_supplier_vendor IS
  '0018 Setnayan Supplies — TRUE if this vendor supplies physical goods/rentals to Setnayan for resale. NOT discoverable by couples; sourcing-channel only. A vendor CAN be both marketplace (0006) and supplier (0018).';

COMMENT ON COLUMN public.vendor_profiles.supplier_categories IS
  '0018 Setnayan Supplies — which categories this supplier covers: print_fulfillment, equipment_rental, decor_rental, nfc_qr_keepsake, specialty_merch';

-- Index to find supplier vendors quickly by category.
CREATE INDEX IF NOT EXISTS vendor_profiles_supplier_categories_idx
  ON public.vendor_profiles USING GIN (supplier_categories)
  WHERE is_supplier_vendor = TRUE;

-- ----------------------------------------------------------------------------
-- 2. supplier_vendor_skus — per-vendor SKU catalog
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.supplier_vendor_skus (
  sku_id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_profile_id   UUID NOT NULL
                      REFERENCES public.vendor_profiles(vendor_profile_id)
                      ON DELETE CASCADE,
  category            TEXT NOT NULL CHECK (category IN (
                        'print_fulfillment',
                        'equipment_rental',
                        'decor_rental',
                        'nfc_qr_keepsake',
                        'specialty_merch'
                      )),
  sku_code            TEXT NOT NULL,        -- vendor's canonical SKU identifier
  display_name        TEXT NOT NULL,
  description         TEXT,
  unit_of_measure     TEXT NOT NULL,        -- e.g., 'per_piece', 'per_day', 'per_event'
  is_active           BOOLEAN NOT NULL DEFAULT TRUE,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (vendor_profile_id, sku_code)
);

CREATE INDEX IF NOT EXISTS supplier_vendor_skus_vendor_idx
  ON public.supplier_vendor_skus(vendor_profile_id);
CREATE INDEX IF NOT EXISTS supplier_vendor_skus_category_active_idx
  ON public.supplier_vendor_skus(category, is_active)
  WHERE is_active = TRUE;

-- ----------------------------------------------------------------------------
-- 3. supplier_vendor_sku_pricing — wholesale prices per (sku, service_area)
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.supplier_vendor_sku_pricing (
  pricing_id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sku_id              UUID NOT NULL
                      REFERENCES public.supplier_vendor_skus(sku_id)
                      ON DELETE CASCADE,
  service_area_code   TEXT NOT NULL CHECK (service_area_code IN (
                        -- V1: Metro Manila only. V1.5+ expands.
                        'METRO_MANILA'
                      )),
  wholesale_centavos  INTEGER NOT NULL CHECK (wholesale_centavos > 0),
  min_order_quantity  INTEGER NOT NULL DEFAULT 1
                      CHECK (min_order_quantity >= 1),
  volume_tiers        JSONB,                -- optional [{"min_qty": N, "wholesale_centavos": M}, ...]
  effective_from      DATE NOT NULL DEFAULT CURRENT_DATE,
  effective_to        DATE,                 -- NULL = open-ended
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT supplier_vendor_sku_pricing_effective_range
    CHECK (effective_to IS NULL OR effective_to >= effective_from),
  UNIQUE (sku_id, service_area_code, effective_from)
);

-- Indexed for the pricing engine: "give me the cheapest available wholesale
-- for (sku, area) where today is within the effective window."
CREATE INDEX IF NOT EXISTS supplier_vendor_sku_pricing_lookup_idx
  ON public.supplier_vendor_sku_pricing(sku_id, service_area_code, wholesale_centavos);
CREATE INDEX IF NOT EXISTS supplier_vendor_sku_pricing_effective_idx
  ON public.supplier_vendor_sku_pricing(effective_from, effective_to);

-- ----------------------------------------------------------------------------
-- 4. supplies_orders — Setnayan's order to the couple (seller-of-record table)
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.supplies_orders (
  order_id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  public_id                 TEXT UNIQUE NOT NULL
                            DEFAULT public.generate_public_id('SO'),
    -- 'SO' prefix = Supplies Order. Distinct from 'O' (commission orders)
    -- and 'P' (vendor_payouts).

  event_id                  UUID NOT NULL
                            REFERENCES public.events(event_id)
                            ON DELETE CASCADE,
  buyer_user_id             UUID NOT NULL
                            REFERENCES public.users(user_id)
                            ON DELETE RESTRICT,

  -- ---- Delivery ----
  delivery_service_area_code TEXT NOT NULL CHECK (delivery_service_area_code IN (
                              'METRO_MANILA'
                            )),
  delivery_address          JSONB NOT NULL,
    -- {street, barangay, city, province, postal_code, contact_phone}
  delivery_window_start     TIMESTAMPTZ,
  delivery_window_end       TIMESTAMPTZ,

  -- ---- Lifecycle ----
  status                    TEXT NOT NULL DEFAULT 'pending_payment'
                            CHECK (status IN (
                              'pending_payment',
                              'paid',
                              'accepted',         -- supplier vendor accepted
                              'in_production',
                              'shipped',
                              'delivered',
                              'completed',
                              'refunded',
                              'cancelled'
                            )),

  -- ---- Financials (centavos, computed at checkout, snapshot of line totals) ----
  total_retail_centavos     INTEGER NOT NULL CHECK (total_retail_centavos >= 0),
  total_wholesale_centavos  INTEGER NOT NULL CHECK (total_wholesale_centavos >= 0),
  total_markup_centavos     INTEGER NOT NULL CHECK (total_markup_centavos >= 0),
    -- markup = retail - wholesale. Setnayan's gross margin per order.
    -- Computed at checkout for reporting + reconciliation; line items carry
    -- the per-line truth.

  -- ---- Payment ----
  payment_status            TEXT NOT NULL DEFAULT 'pending'
                            CHECK (payment_status IN (
                              'pending', 'paid', 'refunded', 'failed'
                            )),
  paid_at                   TIMESTAMPTZ,

  -- ---- Audit ----
  created_at                TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Markup sanity check: retail = wholesale + markup
  CONSTRAINT supplies_orders_totals_consistency
    CHECK (total_retail_centavos = total_wholesale_centavos + total_markup_centavos)
);

CREATE INDEX IF NOT EXISTS supplies_orders_event_idx
  ON public.supplies_orders(event_id);
CREATE INDEX IF NOT EXISTS supplies_orders_buyer_idx
  ON public.supplies_orders(buyer_user_id);
CREATE INDEX IF NOT EXISTS supplies_orders_status_idx
  ON public.supplies_orders(status);
CREATE INDEX IF NOT EXISTS supplies_orders_paid_pending_idx
  ON public.supplies_orders(payment_status, created_at)
  WHERE payment_status = 'pending';

-- ----------------------------------------------------------------------------
-- 5. supplies_order_line_items — per-line wholesale + retail + vendor snapshot
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.supplies_order_line_items (
  line_item_id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id                   UUID NOT NULL
                             REFERENCES public.supplies_orders(order_id)
                             ON DELETE CASCADE,

  -- ---- SKU + chosen supplier vendor (snapshot at order time) ----
  sku_id                     UUID NOT NULL
                             REFERENCES public.supplier_vendor_skus(sku_id)
                             ON DELETE RESTRICT,
  supplier_vendor_id         UUID NOT NULL
                             REFERENCES public.vendor_profiles(vendor_profile_id)
                             ON DELETE RESTRICT,
    -- Snapshotted from the cheapest-available resolver at add-to-cart (and
    -- potentially re-resolved at checkout). Locked once order is paid.

  quantity                   INTEGER NOT NULL CHECK (quantity > 0),

  -- ---- Price snapshots (per single unit, centavos) ----
  wholesale_centavos_at_order INTEGER NOT NULL CHECK (wholesale_centavos_at_order > 0),
    -- Locked-in wholesale at the moment this line was added/re-resolved.
    -- Protects the supplier vendor from paying out at a lower rate if their
    -- catalog wholesale moves up, and protects Setnayan margin if it moves
    -- down. Couple's retail is anchored to this snapshot.
  retail_centavos_at_order   INTEGER NOT NULL CHECK (retail_centavos_at_order > 0),
    -- Computed as wholesale_centavos_at_order × 1.5 (rounded to nearest peso).
    -- Stored explicitly to avoid drift between resolver logic and stored
    -- truth. Couple sees this on the receipt.

  -- ---- Lifecycle ----
  status                     TEXT NOT NULL DEFAULT 'queued'
                             CHECK (status IN (
                               'queued',
                               'accepted',
                               'in_production',
                               'shipped',
                               'delivered',
                               'refunded',
                               'cancelled'
                             )),
  shipped_at                 TIMESTAMPTZ,
  delivered_at               TIMESTAMPTZ,

  created_at                 TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                 TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Per-line markup sanity check (50% markup convention; small rounding
  -- tolerance because retail is rounded to peso).
  CONSTRAINT supplies_order_line_items_markup_consistency
    CHECK (retail_centavos_at_order >= wholesale_centavos_at_order)
);

CREATE INDEX IF NOT EXISTS supplies_order_line_items_order_idx
  ON public.supplies_order_line_items(order_id);
CREATE INDEX IF NOT EXISTS supplies_order_line_items_vendor_idx
  ON public.supplies_order_line_items(supplier_vendor_id);
CREATE INDEX IF NOT EXISTS supplies_order_line_items_status_idx
  ON public.supplies_order_line_items(status)
  WHERE status NOT IN ('delivered', 'cancelled', 'refunded');

-- ----------------------------------------------------------------------------
-- 6. Extend vendor_payouts for the wholesale payout type
-- ----------------------------------------------------------------------------

-- Add the new columns first (backfill defaults).
ALTER TABLE public.vendor_payouts
  ADD COLUMN IF NOT EXISTS payout_type TEXT NOT NULL DEFAULT 'commission'
    CHECK (payout_type IN ('commission', 'wholesale')),
  ADD COLUMN IF NOT EXISTS supplies_order_id UUID
    REFERENCES public.supplies_orders(order_id)
    ON DELETE RESTRICT;

COMMENT ON COLUMN public.vendor_payouts.payout_type IS
  '0018 Setnayan Supplies — "commission" = legacy 0006 marketplace booking payout (order_id set, supplies_order_id NULL). "wholesale" = 0018 supplier vendor wholesale payout (supplies_order_id set, order_id NULL).';
COMMENT ON COLUMN public.vendor_payouts.supplies_order_id IS
  '0018 Setnayan Supplies — for wholesale payouts, FK to the supplies_orders row whose delivery triggered this payout. NULL for commission payouts.';

-- Make order_id nullable so wholesale payouts can have order_id=NULL.
-- Existing rows already satisfy NOT NULL because backfill default is
-- payout_type='commission' which requires order_id set, but we drop the
-- column-level NOT NULL so the XOR constraint below can manage the rule.
ALTER TABLE public.vendor_payouts
  ALTER COLUMN order_id DROP NOT NULL;

-- XOR: exactly one of (order_id, supplies_order_id) is set per row, and the
-- payout_type matches.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'vendor_payouts_order_xor_supplies_order'
  ) THEN
    ALTER TABLE public.vendor_payouts
      ADD CONSTRAINT vendor_payouts_order_xor_supplies_order
      CHECK (
        (payout_type = 'commission'
          AND order_id IS NOT NULL
          AND supplies_order_id IS NULL)
        OR
        (payout_type = 'wholesale'
          AND order_id IS NULL
          AND supplies_order_id IS NOT NULL)
      );
  END IF;
END$$;

CREATE INDEX IF NOT EXISTS vendor_payouts_supplies_order_idx
  ON public.vendor_payouts(supplies_order_id)
  WHERE supplies_order_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS vendor_payouts_type_idx
  ON public.vendor_payouts(payout_type);

-- ----------------------------------------------------------------------------
-- 7. RLS — buyers read their own supplies orders; vendors read their own SKUs.
--    Admin (service-role) writes; no user-policied INSERT/UPDATE/DELETE.
-- ----------------------------------------------------------------------------

-- supplier_vendor_skus: supplier vendor can read their own SKUs.
ALTER TABLE public.supplier_vendor_skus ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS supplier_vendor_skus_self_read ON public.supplier_vendor_skus;
CREATE POLICY supplier_vendor_skus_self_read
  ON public.supplier_vendor_skus FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.vendor_profiles vp
      WHERE vp.vendor_profile_id = supplier_vendor_skus.vendor_profile_id
        AND vp.user_id = auth.uid()
    )
  );

-- supplier_vendor_sku_pricing: same pattern (vendor reads their own pricing).
ALTER TABLE public.supplier_vendor_sku_pricing ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS supplier_vendor_sku_pricing_self_read ON public.supplier_vendor_sku_pricing;
CREATE POLICY supplier_vendor_sku_pricing_self_read
  ON public.supplier_vendor_sku_pricing FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.supplier_vendor_skus svs
      JOIN public.vendor_profiles vp
        ON vp.vendor_profile_id = svs.vendor_profile_id
      WHERE svs.sku_id = supplier_vendor_sku_pricing.sku_id
        AND vp.user_id = auth.uid()
    )
  );

-- supplies_orders: the buyer can read their own orders.
-- (Couples + future coordinator moderators on the event can also read via
-- 0048 RLS extension; that wiring lands in PR 7.)
ALTER TABLE public.supplies_orders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS supplies_orders_buyer_read ON public.supplies_orders;
CREATE POLICY supplies_orders_buyer_read
  ON public.supplies_orders FOR SELECT
  TO authenticated
  USING (buyer_user_id = auth.uid());

-- supplies_order_line_items: same access as their parent order.
ALTER TABLE public.supplies_order_line_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS supplies_order_line_items_buyer_read ON public.supplies_order_line_items;
CREATE POLICY supplies_order_line_items_buyer_read
  ON public.supplies_order_line_items FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.supplies_orders so
      WHERE so.order_id = supplies_order_line_items.order_id
        AND so.buyer_user_id = auth.uid()
    )
  );

-- Supplier vendor sees the line items they fulfill (so the future PR 5
-- admin surface and the future PR 7 coordinator features can both see the
-- vendor-side view of order activity).
DROP POLICY IF EXISTS supplies_order_line_items_supplier_read ON public.supplies_order_line_items;
CREATE POLICY supplies_order_line_items_supplier_read
  ON public.supplies_order_line_items FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.vendor_profiles vp
      WHERE vp.vendor_profile_id = supplies_order_line_items.supplier_vendor_id
        AND vp.user_id = auth.uid()
    )
  );

-- INSERT/UPDATE/DELETE on all five tables intentionally not policied for
-- end-users — these are privileged admin/cron concerns (PR 5 admin surface;
-- PR 6 payout cron). Service-role only at the API edge.

COMMIT;
