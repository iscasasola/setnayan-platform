-- ============================================================================
-- 20260516040000_v1_sku_lock_vendor_tool_bundles.sql
-- V1 SKU framework lock (2026-05-16). Adds the vendor_tool_bundles table.
--
-- Tracks vendor purchases of vendor-tool subscriptions: both the All Tools
-- Unlock annual bundle (sku_code = 'all_tools_unlock_annual', ₱9,999/yr)
-- and the individual weekly tool subscriptions (Mood Board / Palette /
-- Seating / QR Reader / Advanced Pricing — ₱99/wk each, sku_code prefix
-- 'tool_'). One row per active subscription period; new purchases insert
-- a fresh row rather than mutating the previous one (audit-friendly).
--
-- A vendor is considered to have a tool unlocked if they have a row where
-- (sku_code = 'all_tools_unlock_annual' OR sku_code matches the specific
-- tool) AND cancelled_at IS NULL AND expires_at > NOW(). The
-- `vendor_active_tools` view collapses both paths so app code can do a
-- single uniform lookup.
--
-- Source of truth: spec corpus commit a0fa3c7 (2026-05-16); pairs with
-- service_catalog rows seeded in 20260516000000_v1_sku_lock_service_catalog.sql.
-- Idempotent. No drops.
-- ============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS public.vendor_tool_bundles (
  bundle_id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  vendor_profile_id      UUID NOT NULL
                         REFERENCES public.vendor_profiles(vendor_profile_id)
                         ON DELETE RESTRICT,
    -- RESTRICT — paid bundles must not silently disappear when a vendor
    -- profile is removed. Admins reconcile / refund first.

  sku_code               TEXT NOT NULL
                         REFERENCES public.service_catalog(sku_code)
                         ON DELETE RESTRICT,

  order_id               UUID
                         REFERENCES public.orders(order_id)
                         ON DELETE SET NULL,
    -- Nullable so admins can comp a vendor without an order (e.g. apology
    -- comp after an outage). The order_id link is the audit trail when
    -- the bundle was bought through the normal cart.

  activated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at             TIMESTAMPTZ NOT NULL
                         CHECK (expires_at > activated_at),

  cancelled_at           TIMESTAMPTZ,
  cancel_reason          TEXT,

  notes                  TEXT,

  created_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at             TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS vendor_tool_bundles_vendor_idx
  ON public.vendor_tool_bundles(vendor_profile_id);
CREATE INDEX IF NOT EXISTS vendor_tool_bundles_sku_idx
  ON public.vendor_tool_bundles(sku_code);
CREATE INDEX IF NOT EXISTS vendor_tool_bundles_active_idx
  ON public.vendor_tool_bundles(vendor_profile_id, sku_code, expires_at)
  WHERE cancelled_at IS NULL;

-- ----------------------------------------------------------------------------
-- vendor_active_tools view — uniform "does vendor X currently have tool Y
-- unlocked?" lookup. Expands the All Tools Unlock bundle into the 5
-- individual tool SKUs so callers don't need to special-case the bundle.
-- ----------------------------------------------------------------------------

CREATE OR REPLACE VIEW public.vendor_active_tools AS
WITH bundle_expansions AS (
  SELECT
    vtb.vendor_profile_id,
    unnest(ARRAY[
      'tool_mood_board_weekly',
      'tool_seat_arrangement_weekly',
      'tool_palette_weekly',
      'tool_qr_reader_weekly',
      'tool_advanced_pricing_weekly'
    ]) AS tool_sku_code,
    vtb.expires_at,
    vtb.bundle_id AS source_bundle_id,
    'all_tools_unlock_annual'::TEXT AS source_sku_code
  FROM public.vendor_tool_bundles vtb
  WHERE vtb.sku_code = 'all_tools_unlock_annual'
    AND vtb.cancelled_at IS NULL
    AND vtb.expires_at > NOW()
),
individual_tools AS (
  SELECT
    vtb.vendor_profile_id,
    vtb.sku_code AS tool_sku_code,
    vtb.expires_at,
    vtb.bundle_id AS source_bundle_id,
    vtb.sku_code AS source_sku_code
  FROM public.vendor_tool_bundles vtb
  WHERE vtb.sku_code <> 'all_tools_unlock_annual'
    AND vtb.cancelled_at IS NULL
    AND vtb.expires_at > NOW()
)
SELECT * FROM bundle_expansions
UNION ALL
SELECT * FROM individual_tools;

-- ----------------------------------------------------------------------------
-- RLS — vendors can read their own bundles. Admin (service-role) writes.
-- ----------------------------------------------------------------------------

ALTER TABLE public.vendor_tool_bundles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS vendor_tool_bundles_self_read ON public.vendor_tool_bundles;
CREATE POLICY vendor_tool_bundles_self_read
  ON public.vendor_tool_bundles FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.vendor_profiles vp
      WHERE vp.vendor_profile_id = vendor_tool_bundles.vendor_profile_id
        AND vp.user_id = auth.uid()
    )
  );

-- INSERT/UPDATE/DELETE intentionally not policied for users — bundle
-- activation is a privileged admin/cron concern (purchase fulfillment +
-- expiration sweeps). Service-role only.

COMMIT;
