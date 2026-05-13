-- ============================================================================
-- 20260513210000_iteration_0026_bir_tax_compliance.sql
-- Iteration 0026 BIR Tax Compliance MVP.
--
-- Adds a `receipts` table linked 1:1 to orders, auto-populated with a
-- sequential OR number (SR-2026-000001 format). Triggered manually from
-- the admin approve-payment action when an order moves to `paid`.
--
-- VAT math: PH default rate is 12%. Couples are charged the gross figure
-- (confirmed_total_php). The receipt breaks down pre-VAT base + VAT amount.
--
-- Deferred:
--   • PDF generation (V1 renders HTML, browser handles print → PDF)
--   • Customer TIN UI (admin can edit via service-role)
--   • VAT-exempt classification (8% income tax option, zero-rated exports)
--   • BIR 2303 / COR registration tracking
--   • Monthly/quarterly summary reports (V1 ships per-row list only)
--
-- Idempotent.
-- ============================================================================

BEGIN;

CREATE SEQUENCE IF NOT EXISTS public.or_serial_seq START 1;

CREATE TABLE IF NOT EXISTS public.receipts (
  receipt_id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  or_serial         BIGINT NOT NULL UNIQUE DEFAULT nextval('public.or_serial_seq'),
  or_number         TEXT NOT NULL UNIQUE,
  order_id          UUID NOT NULL UNIQUE
                    REFERENCES public.orders(order_id) ON DELETE CASCADE,
  user_id           UUID NOT NULL REFERENCES public.users(user_id) ON DELETE CASCADE,
  issued_to_email   TEXT NOT NULL,
  issued_to_name    TEXT,
  issued_to_tin     TEXT,
  pre_vat_php       NUMERIC(12,2) NOT NULL CHECK (pre_vat_php >= 0),
  vat_rate_pct      NUMERIC(5,2) NOT NULL DEFAULT 12.00 CHECK (vat_rate_pct >= 0 AND vat_rate_pct <= 100),
  vat_amount_php    NUMERIC(12,2) NOT NULL CHECK (vat_amount_php >= 0),
  gross_total_php   NUMERIC(12,2) NOT NULL CHECK (gross_total_php >= 0),
  issued_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (
    abs(pre_vat_php + vat_amount_php - gross_total_php) < 0.01
  )
);

CREATE INDEX IF NOT EXISTS receipts_user_id_idx ON public.receipts(user_id);
CREATE INDEX IF NOT EXISTS receipts_issued_at_idx ON public.receipts(issued_at DESC);
CREATE INDEX IF NOT EXISTS receipts_order_id_idx ON public.receipts(order_id);

ALTER TABLE public.receipts ENABLE ROW LEVEL SECURITY;

-- Pattern A: the order's owner can read their own receipts. Admin queue
-- bypasses via the service-role client. No write policy — receipts are
-- service-role-only writes from the admin action.
DROP POLICY IF EXISTS receipts_owner_read ON public.receipts;
CREATE POLICY receipts_owner_read
  ON public.receipts FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

COMMIT;
