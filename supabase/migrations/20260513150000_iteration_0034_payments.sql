-- ============================================================================
-- 20260513150000_iteration_0034_payments.sql
-- Iteration 0034 Payments & Cart MVP — orders + payments + reconciliation.
--
-- Schema:
--   • order_status enum (draft → submitted → awaiting_payment → paid →
--     fulfilled, plus cancelled / refunded)
--   • payment_status enum (pending / matched / rejected)
--   • orders — couple applies for a service; gets a reference_code
--     they paste into bank-transfer notes.
--   • payments — couple logs a payment record (channel, reference number,
--     screenshot URL). Admin reconciles via /admin/payments.
--
-- Deferred:
--   • 4-tier fuzzy SQL matcher (manual reconciliation in V1)
--   • Refund workflow
--   • Vendor payouts / marketplace split
--   • In-app cart UX (V1 = one application at a time)
--   • Receipt PDFs
--
-- Idempotent.
-- ============================================================================

BEGIN;

DO $$ BEGIN
  CREATE TYPE public.order_status AS ENUM (
    'draft',
    'submitted',
    'awaiting_payment',
    'paid',
    'fulfilled',
    'cancelled',
    'refunded'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.payment_status AS ENUM ('pending', 'matched', 'rejected');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ----------------------------------------------------------------------------
-- orders
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.orders (
  order_id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  public_id             TEXT UNIQUE NOT NULL DEFAULT public.generate_public_id('O'),
  event_id              UUID REFERENCES public.events(event_id) ON DELETE SET NULL,
  user_id               UUID NOT NULL REFERENCES public.users(user_id) ON DELETE CASCADE,
  service_key           TEXT,
  description           TEXT NOT NULL CHECK (length(description) > 0 AND length(description) <= 2000),
  requested_total_php   NUMERIC(12,2) NOT NULL CHECK (requested_total_php >= 0),
  confirmed_total_php   NUMERIC(12,2) CHECK (confirmed_total_php IS NULL OR confirmed_total_php >= 0),
  status                public.order_status NOT NULL DEFAULT 'submitted',
  reference_code        TEXT NOT NULL UNIQUE,
  admin_notes           TEXT,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS orders_event_id_idx ON public.orders(event_id);
CREATE INDEX IF NOT EXISTS orders_user_id_idx ON public.orders(user_id);
CREATE INDEX IF NOT EXISTS orders_status_idx ON public.orders(status);
CREATE INDEX IF NOT EXISTS orders_reference_code_idx ON public.orders(reference_code);

ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;

-- Pattern A: the buying user owns the order.
DROP POLICY IF EXISTS orders_owner_read ON public.orders;
CREATE POLICY orders_owner_read
  ON public.orders FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS orders_owner_write ON public.orders;
CREATE POLICY orders_owner_write
  ON public.orders FOR ALL
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- ----------------------------------------------------------------------------
-- payments
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.payments (
  payment_id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id              UUID NOT NULL REFERENCES public.orders(order_id) ON DELETE CASCADE,
  user_id               UUID NOT NULL REFERENCES public.users(user_id) ON DELETE CASCADE,
  amount_php            NUMERIC(12,2) NOT NULL CHECK (amount_php > 0),
  channel               TEXT NOT NULL,
  reference_number      TEXT,
  screenshot_url        TEXT,
  paid_at               DATE NOT NULL DEFAULT CURRENT_DATE,
  status                public.payment_status NOT NULL DEFAULT 'pending',
  admin_notes           TEXT,
  reviewed_by_user_id   UUID REFERENCES public.users(user_id) ON DELETE SET NULL,
  reviewed_at           TIMESTAMPTZ,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS payments_order_id_idx ON public.payments(order_id);
CREATE INDEX IF NOT EXISTS payments_user_id_idx ON public.payments(user_id);
CREATE INDEX IF NOT EXISTS payments_status_idx ON public.payments(status);

ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS payments_owner_read ON public.payments;
CREATE POLICY payments_owner_read
  ON public.payments FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- Couples can INSERT their own payment records but cannot UPDATE/DELETE —
-- admin reconciles via service-role.
DROP POLICY IF EXISTS payments_owner_insert ON public.payments;
CREATE POLICY payments_owner_insert
  ON public.payments FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

COMMIT;
