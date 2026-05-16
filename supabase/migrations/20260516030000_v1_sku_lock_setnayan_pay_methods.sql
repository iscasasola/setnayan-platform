-- ============================================================================
-- 20260516030000_v1_sku_lock_setnayan_pay_methods.sql
-- V1 SKU framework lock (2026-05-16). Adds the setnayan_pay_methods table.
--
-- Per-payment-method configuration for Setnayan Pay convenience fee. Each
-- payment channel has its own gateway fee (passed through to the underlying
-- processor) plus a Setnayan Pay platform fee. Admin-configurable so we
-- can adjust without a code release if a provider repasses costs.
--
-- The previously-hardcoded `SETNAYAN_PAY_FEE_PCT = 3` in
-- apps/web/lib/vendor-earnings.ts was a placeholder; this table is the
-- new source of truth. The TS constant stays for now (display fallback)
-- and will be migrated to read from this table in a follow-up.
--
-- Source of truth: spec corpus commit a0fa3c7 (2026-05-16).
-- Idempotent. No drops.
-- ============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS public.setnayan_pay_methods (
  method_code            TEXT PRIMARY KEY,
  display_name           TEXT NOT NULL,
  -- Percentages stored as DECIMAL(5,4) so 0.0150 == 1.50%. Apps multiply
  -- by 100 for display. Keeps the math precise; CHECK guards against the
  -- obvious bad inputs (negative, > 100%).
  gateway_fee_pct        NUMERIC(5,4) NOT NULL
                         CHECK (gateway_fee_pct >= 0 AND gateway_fee_pct <= 1),
  setnayan_pay_pct       NUMERIC(5,4) NOT NULL
                         CHECK (setnayan_pay_pct >= 0 AND setnayan_pay_pct <= 1),
  is_active              BOOLEAN NOT NULL DEFAULT TRUE,
  effective_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  display_order          INTEGER NOT NULL DEFAULT 100,
  notes                  TEXT,
  updated_by_user_id     UUID REFERENCES public.users(user_id) ON DELETE SET NULL,
  created_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at             TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS setnayan_pay_methods_active_idx
  ON public.setnayan_pay_methods(is_active, display_order)
  WHERE is_active = TRUE;

ALTER TABLE public.setnayan_pay_methods ENABLE ROW LEVEL SECURITY;

-- Public read — fees are disclosed to users at checkout, no secrets here.
DROP POLICY IF EXISTS setnayan_pay_methods_read_all
  ON public.setnayan_pay_methods;
CREATE POLICY setnayan_pay_methods_read_all
  ON public.setnayan_pay_methods FOR SELECT
  TO anon, authenticated
  USING (true);

-- ----------------------------------------------------------------------------
-- Seed: the 6 V1 payment methods locked 2026-05-16.
-- ----------------------------------------------------------------------------

INSERT INTO public.setnayan_pay_methods
  (method_code, display_name, gateway_fee_pct, setnayan_pay_pct,
   is_active, display_order)
VALUES
  ('maya_qr_ph',     'Maya QR Ph',                              0.0150, 0.0550, TRUE, 1),
  ('bank_transfer',  'Bank Transfer (PESONet/InstaPay)',        0.0150, 0.0550, TRUE, 2),
  ('gcash_direct',   'GCash Direct',                            0.0150, 0.0550, TRUE, 3),
  ('ewallet',        'Other eWallet',                           0.0200, 0.0600, TRUE, 4),
  ('credit_card',    'Credit Card',                             0.0250, 0.0650, TRUE, 5),
  ('otc_cash',       'OTC (7-11, M Lhuillier, Bayad)',          0.0250, 0.0650, TRUE, 6)
ON CONFLICT (method_code) DO UPDATE SET
  display_name = EXCLUDED.display_name,
  gateway_fee_pct = EXCLUDED.gateway_fee_pct,
  setnayan_pay_pct = EXCLUDED.setnayan_pay_pct,
  display_order = EXCLUDED.display_order,
  is_active = TRUE,
  updated_at = NOW();

COMMIT;
