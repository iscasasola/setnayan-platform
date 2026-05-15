-- ============================================================================
-- 20260516020000_v1_sku_lock_vendor_payouts.sql
-- V1 SKU framework lock (2026-05-16). Adds the vendor_payouts table.
--
-- Tracks Setnayan -> vendor disbursements for a couple's paid order.
-- The 2026-05-16 lock standardizes a 20/60/20 staged release:
--   • 20% on reservation         (trigger: booking_confirmed)
--   • 60% pre-event              (trigger: pre_event_check, T-2 days)
--   • 20% post-event             (trigger: post_event_check, event done)
-- "Immediate" 100% release stage exists for one-time deliverables that
-- don't have an event date (e.g. a render).
--
-- BIR withholding (0.5% marketplace withholding) is tracked per payout
-- so Form 2307 can be issued to the vendor.
--
-- Source of truth: spec corpus commit a0fa3c7 (2026-05-16).
-- Idempotent. No drops.
-- ============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS public.vendor_payouts (
  payout_id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  public_id                       TEXT UNIQUE NOT NULL
                                  DEFAULT public.generate_public_id('P'),
    -- 'P' prefix = payout. (Payment records still use 'O' since they
    -- belong to a couple's order, not the vendor disbursement side.)

  -- ---- Order + vendor linkage ----
  order_id                        UUID NOT NULL
                                  REFERENCES public.orders(order_id)
                                  ON DELETE CASCADE,
  vendor_profile_id               UUID NOT NULL
                                  REFERENCES public.vendor_profiles(vendor_profile_id)
                                  ON DELETE RESTRICT,
    -- RESTRICT — a vendor row should never disappear while payouts exist;
    -- admins must reassign / reconcile before deleting a vendor.

  -- ---- Stage tracking (20/60/20 release schedule) ----
  stage                           TEXT NOT NULL
                                  CHECK (stage IN
                                    ('reservation', 'pre_event',
                                     'post_event', 'immediate')),
  stage_pct                       INTEGER NOT NULL
                                  CHECK (stage_pct BETWEEN 0 AND 100),
    -- 20, 60, 20, or 100. We don't constrain to exactly those values so
    -- admins can override (e.g. a vendor agrees to 50/50 or 100/0 split).
  amount_centavos                 INTEGER NOT NULL
                                  CHECK (amount_centavos >= 0),

  -- ---- Trigger logic ----
  trigger_type                    TEXT NOT NULL
                                  CHECK (trigger_type IN
                                    ('booking_confirmed', 'pre_event_check',
                                     'post_event_check', 'admin_override')),
  trigger_date                    TIMESTAMPTZ,
  released_at                     TIMESTAMPTZ,

  -- ---- Disbursement details ----
  payout_method                   TEXT NOT NULL
                                  CHECK (payout_method IN
                                    ('bank_account', 'gcash',
                                     'maya_account', 'check')),
  payout_reference                TEXT,
  disbursement_fee_centavos       INTEGER NOT NULL DEFAULT 0
                                  CHECK (disbursement_fee_centavos >= 0),
    -- ₱15-25 absorbed by Setnayan (not deducted from vendor net).

  -- ---- BIR withholding (0.5% marketplace withholding) ----
  bir_withholding_centavos        INTEGER NOT NULL DEFAULT 0
                                  CHECK (bir_withholding_centavos >= 0),
  form_2307_issued                BOOLEAN NOT NULL DEFAULT FALSE,
  form_2307_url                   TEXT,

  -- ---- Dispute handling ----
  on_hold                         BOOLEAN NOT NULL DEFAULT FALSE,
  hold_reason                     TEXT,
  released_after_dispute_at       TIMESTAMPTZ,

  -- ---- Timestamps ----
  created_at                      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS vendor_payouts_order_idx
  ON public.vendor_payouts(order_id);
CREATE INDEX IF NOT EXISTS vendor_payouts_vendor_idx
  ON public.vendor_payouts(vendor_profile_id);
CREATE INDEX IF NOT EXISTS vendor_payouts_released_at_idx
  ON public.vendor_payouts(released_at);
CREATE INDEX IF NOT EXISTS vendor_payouts_pending_idx
  ON public.vendor_payouts(stage, released_at)
  WHERE released_at IS NULL;

-- ----------------------------------------------------------------------------
-- RLS — vendors can read their own payouts. Admin (service-role) writes.
-- ----------------------------------------------------------------------------

ALTER TABLE public.vendor_payouts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS vendor_payouts_self_read ON public.vendor_payouts;
CREATE POLICY vendor_payouts_self_read
  ON public.vendor_payouts FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.vendor_profiles vp
      WHERE vp.vendor_profile_id = vendor_payouts.vendor_profile_id
        AND vp.user_id = auth.uid()
    )
  );

-- INSERT/UPDATE/DELETE intentionally not policied for users — payouts are
-- a privileged admin/cron concern. Service-role only.

COMMIT;
