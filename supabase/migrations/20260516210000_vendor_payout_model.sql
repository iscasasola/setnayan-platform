-- ============================================================================
-- 20260516210000_vendor_payout_model.sql
-- Vendor Payout model (locked 2026-05-16 — 0006_vendors_management §
-- "Vendor Payout model" + 0034_payments_and_cart § 6.7 Schema updates).
--
-- Builds on top of 20260516020000_v1_sku_lock_vendor_payouts.sql by:
--   1. Adding the canonical `payout_stage` ENUM matching the 2026-05-16 spec
--      lock (immediate_full / stage_1_confirm / stage_2_event_start /
--      stage_3_event_end). The earlier table created a TEXT CHECK column;
--      we keep that for backward compat and ADD the enum + a parallel column
--      for code that wants the enum-typed surface.
--   2. Filling in the audit-trail columns the spec calls out:
--        scheduled_at, dispute_window_ends_at, audit_log JSONB,
--        gross_centavos, gateway_fee_centavos, vendor_net_centavos,
--        bir_withholding_centavos (already present), paid_at, payment_method.
--   3. ALTERing public.orders (this repo's analog of the spec's
--      `service_orders` table) with the audit-trail columns from § 6.7:
--        setnayan_fee_bps, gateway_fee_centavos, bir_withholding_centavos,
--        vendor_net_centavos, disbursement_fee_centavos, payment_method_key.
--   4. Adding `vendor_disputes` so the cron can roll a 30-day window and
--      auto-demote vendors with 3+ disputes per 0006 § "Demote-to-coming_soon
--      trigger".
--
-- Source of truth: spec corpus 2026-05-16.
-- Idempotent. No drops on existing data. RLS preserved.
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- 1. payout_stage ENUM (per 0006 § Vendor Payout model)
--    immediate_full       = verified vendor, T+1 single payout
--    stage_1_confirm      = coming_soon · 20% on booking confirmation
--    stage_2_event_start  = coming_soon · 60% T+7 from event start (was
--                            "pre-event check" — spec lock standardises the
--                            trigger to T+7 from event_date)
--    stage_3_event_end    = coming_soon · 20% T+7 from event end
-- ----------------------------------------------------------------------------

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type WHERE typname = 'payout_stage'
  ) THEN
    CREATE TYPE public.payout_stage AS ENUM (
      'immediate_full',
      'stage_1_confirm',
      'stage_2_event_start',
      'stage_3_event_end'
    );
  END IF;
END$$;

-- ----------------------------------------------------------------------------
-- 2. vendor_payouts — additive audit-trail columns. The existing migration
--    (20260516020000) created the row shape; this migration fills in the
--    spec § 6.7 audit fields without dropping anything.
-- ----------------------------------------------------------------------------

ALTER TABLE public.vendor_payouts
  ADD COLUMN IF NOT EXISTS payout_stage public.payout_stage,
  ADD COLUMN IF NOT EXISTS gross_centavos INTEGER
    CHECK (gross_centavos IS NULL OR gross_centavos >= 0),
  ADD COLUMN IF NOT EXISTS gateway_fee_centavos INTEGER NOT NULL DEFAULT 0
    CHECK (gateway_fee_centavos >= 0),
  ADD COLUMN IF NOT EXISTS vendor_net_centavos INTEGER
    CHECK (vendor_net_centavos IS NULL OR vendor_net_centavos >= 0),
  ADD COLUMN IF NOT EXISTS scheduled_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS paid_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS dispute_window_ends_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS payment_method TEXT,
    -- Tracks the disbursement rail at execution time (Maya / GCash / BDO).
    -- Distinct from the row's `payout_method` column (the *requested* rail);
    -- this column is the rail that was actually used when paid_at is set.
  ADD COLUMN IF NOT EXISTS audit_log JSONB NOT NULL DEFAULT '[]'::jsonb;
    -- Append-only log of every state transition + reason. Shape:
    --   [{ at: ISO, actor: 'system'|'admin:<user_id>'|'cron',
    --      action: 'scheduled'|'released'|'held'|'released_after_dispute'|
    --              'demoted_trigger'|'admin_override',
    --      reason: TEXT|null,
    --      meta: JSONB|null }]

-- Backfill — for rows created before this migration (none today, but be
-- defensive): infer payout_stage from the existing `stage` text column.
UPDATE public.vendor_payouts
   SET payout_stage = CASE stage
     WHEN 'immediate'  THEN 'immediate_full'::public.payout_stage
     WHEN 'reservation' THEN 'stage_1_confirm'::public.payout_stage
     WHEN 'pre_event'  THEN 'stage_2_event_start'::public.payout_stage
     WHEN 'post_event' THEN 'stage_3_event_end'::public.payout_stage
   END
 WHERE payout_stage IS NULL;

-- Useful aggregate indexes for the admin queue + the dispatcher.
CREATE INDEX IF NOT EXISTS vendor_payouts_payout_stage_idx
  ON public.vendor_payouts(payout_stage);
CREATE INDEX IF NOT EXISTS vendor_payouts_scheduled_at_idx
  ON public.vendor_payouts(scheduled_at)
  WHERE paid_at IS NULL;
CREATE INDEX IF NOT EXISTS vendor_payouts_dispute_window_idx
  ON public.vendor_payouts(dispute_window_ends_at)
  WHERE dispute_window_ends_at IS NOT NULL AND released_at IS NULL;

-- ----------------------------------------------------------------------------
-- 3. orders (this repo's `service_orders`) — audit-trail columns per
--    0034 § 6.7. All additive; existing read paths unaffected.
--
--    Note on `setnayan_fee_bps`: stored in basis points so the 5.5% default
--    rail lands as 550 (cheap rails) and the 6.5% premium rails as 650. Per
--    method config lives in setnayan_pay_methods (20260516030000).
-- ----------------------------------------------------------------------------

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS setnayan_fee_bps INTEGER NOT NULL DEFAULT 550
    CHECK (setnayan_fee_bps >= 0 AND setnayan_fee_bps <= 10000),
  ADD COLUMN IF NOT EXISTS gateway_fee_centavos INTEGER NOT NULL DEFAULT 0
    CHECK (gateway_fee_centavos >= 0),
  ADD COLUMN IF NOT EXISTS bir_withholding_centavos INTEGER NOT NULL DEFAULT 0
    CHECK (bir_withholding_centavos >= 0),
  ADD COLUMN IF NOT EXISTS vendor_net_centavos INTEGER NOT NULL DEFAULT 0
    CHECK (vendor_net_centavos >= 0),
  ADD COLUMN IF NOT EXISTS disbursement_fee_centavos INTEGER NOT NULL DEFAULT 0
    CHECK (disbursement_fee_centavos >= 0),
    -- ₱15-25 absorbed by Setnayan (not deducted from vendor net) — tracked
    -- here so Finance can roll up real disbursement cost per order.
  ADD COLUMN IF NOT EXISTS payment_method_key TEXT,
    -- Soft FK to setnayan_pay_methods.method_key. No hard FK because the
    -- payment method catalog is admin-editable and we don't want to break
    -- historical orders if a method is renamed.
  ADD COLUMN IF NOT EXISTS vendor_profile_id UUID
    REFERENCES public.vendor_profiles(vendor_profile_id) ON DELETE SET NULL;
    -- Couple-side orders don't currently link to a vendor (couples just
    -- pick a service_key); this nullable FK lets the payout dispatcher
    -- resolve order → vendor when the cart flow starts setting it.

CREATE INDEX IF NOT EXISTS orders_vendor_profile_idx
  ON public.orders(vendor_profile_id)
  WHERE vendor_profile_id IS NOT NULL;

-- ----------------------------------------------------------------------------
-- 4. vendor_disputes — 30-day rolling counter input.
--
-- Disputes opened by couples count toward the demote-to-coming_soon trigger
-- (3+ in any rolling 30-day window). The dispute counter cron reads from
-- here every night.
--
-- Disputes can attach to either a payout (paid-but-contested) OR an order
-- (booking-stage problem before payout schedule). One of payout_id /
-- order_id MUST be set (CHECK below).
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.vendor_disputes (
  dispute_id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  public_id               TEXT UNIQUE NOT NULL
                          DEFAULT public.generate_public_id('D'),
  vendor_profile_id       UUID NOT NULL
                          REFERENCES public.vendor_profiles(vendor_profile_id)
                          ON DELETE CASCADE,
  payout_id               UUID
                          REFERENCES public.vendor_payouts(payout_id)
                          ON DELETE SET NULL,
  order_id                UUID
                          REFERENCES public.orders(order_id)
                          ON DELETE SET NULL,
  opened_by_user_id       UUID
                          REFERENCES public.users(user_id)
                          ON DELETE SET NULL,
  category                TEXT NOT NULL
                          CHECK (category IN (
                            'no_show', 'late_arrival', 'quality_issue',
                            'communication', 'refund_request', 'other'
                          )),
  description             TEXT NOT NULL CHECK (length(description) > 0),
  status                  TEXT NOT NULL DEFAULT 'open'
                          CHECK (status IN (
                            'open', 'resolved_for_vendor',
                            'resolved_for_couple', 'withdrawn'
                          )),
  resolved_at             TIMESTAMPTZ,
  resolution_notes        TEXT,
  counts_toward_demotion  BOOLEAN NOT NULL DEFAULT TRUE,
    -- Admin can flip to FALSE if the dispute was filed in bad faith or
    -- already-resolved. The cron only counts rows where this is TRUE.
  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (payout_id IS NOT NULL OR order_id IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS vendor_disputes_vendor_idx
  ON public.vendor_disputes(vendor_profile_id);
CREATE INDEX IF NOT EXISTS vendor_disputes_created_at_idx
  ON public.vendor_disputes(created_at DESC);
CREATE INDEX IF NOT EXISTS vendor_disputes_rolling_idx
  ON public.vendor_disputes(vendor_profile_id, created_at)
  WHERE counts_toward_demotion = TRUE
    AND status IN ('open', 'resolved_for_couple');

ALTER TABLE public.vendor_disputes ENABLE ROW LEVEL SECURITY;

-- Couples (the order owner) can read disputes they filed; vendors can read
-- disputes filed against them; admin reads everything via service-role.
DROP POLICY IF EXISTS vendor_disputes_self_read ON public.vendor_disputes;
CREATE POLICY vendor_disputes_self_read
  ON public.vendor_disputes FOR SELECT
  TO authenticated
  USING (
    opened_by_user_id = auth.uid()
    OR EXISTS (
      SELECT 1
      FROM public.vendor_profiles vp
      WHERE vp.vendor_profile_id = vendor_disputes.vendor_profile_id
        AND vp.user_id = auth.uid()
    )
    OR public.is_admin()
  );

DROP POLICY IF EXISTS vendor_disputes_self_insert ON public.vendor_disputes;
CREATE POLICY vendor_disputes_self_insert
  ON public.vendor_disputes FOR INSERT
  TO authenticated
  WITH CHECK (opened_by_user_id = auth.uid());

-- UPDATE/DELETE are admin-only (service-role bypasses RLS).

-- ----------------------------------------------------------------------------
-- 5. count_vendor_disputes_30d — helper invoked by the cron + admin queue.
--
-- Returns the count of dispute rows that count toward the rolling 30-day
-- demotion trigger for a single vendor. Cron compares against threshold
-- (3 per 0006 spec); admin can call this to preview a vendor's risk.
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.count_vendor_disputes_30d(
  v_vendor_profile_id UUID
)
RETURNS INTEGER
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COUNT(*)::INTEGER
    FROM public.vendor_disputes
   WHERE vendor_profile_id = v_vendor_profile_id
     AND counts_toward_demotion = TRUE
     AND status IN ('open', 'resolved_for_couple')
     AND created_at >= NOW() - INTERVAL '30 days'
$$;

COMMIT;
