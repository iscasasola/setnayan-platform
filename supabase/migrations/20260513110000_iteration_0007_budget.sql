-- ============================================================================
-- 20260513110000_iteration_0007_budget.sql
-- Iteration 0007 Budget & Expenses MVP.
--
-- Two new tables atop 0006's `event_vendors`:
--   1. event_vendor_line_items — itemized cost lines per vendor
--      (e.g., "Deposit", "Balance", "Tip") with amount + due_date.
--   2. event_vendor_payments — actual payments made, optionally linked to
--      a specific line item.
--
-- Both have Pattern B RLS: only couples on the event can read + write.
--
-- Deferred:
--   • Payment-method enum (free-form TEXT for now)
--   • Editing line items / payments (V1 supports add + delete only)
--   • Subscribable calendar feed (V1 ships a one-shot .ics download via API)
--   • Multi-currency (PHP only)
--
-- Idempotent.
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- 1. event_vendor_line_items
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.event_vendor_line_items (
  line_item_id  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id      UUID NOT NULL REFERENCES public.events(event_id) ON DELETE CASCADE,
  vendor_id     UUID NOT NULL REFERENCES public.event_vendors(vendor_id) ON DELETE CASCADE,
  label         TEXT NOT NULL CHECK (length(label) > 0 AND length(label) <= 64),
  amount_php    NUMERIC(12,2) NOT NULL CHECK (amount_php >= 0),
  due_date      DATE,
  sort_order    INTEGER NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS event_vendor_line_items_event_id_idx
  ON public.event_vendor_line_items(event_id);
CREATE INDEX IF NOT EXISTS event_vendor_line_items_vendor_id_idx
  ON public.event_vendor_line_items(vendor_id);

ALTER TABLE public.event_vendor_line_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS event_vendor_line_items_couple_read
  ON public.event_vendor_line_items;
CREATE POLICY event_vendor_line_items_couple_read
  ON public.event_vendor_line_items FOR SELECT
  TO authenticated
  USING (event_id IN (SELECT public.current_couple_event_ids()));

DROP POLICY IF EXISTS event_vendor_line_items_couple_write
  ON public.event_vendor_line_items;
CREATE POLICY event_vendor_line_items_couple_write
  ON public.event_vendor_line_items FOR ALL
  TO authenticated
  USING (event_id IN (SELECT public.current_couple_event_ids()))
  WITH CHECK (event_id IN (SELECT public.current_couple_event_ids()));

-- ----------------------------------------------------------------------------
-- 2. event_vendor_payments
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.event_vendor_payments (
  payment_id    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id      UUID NOT NULL REFERENCES public.events(event_id) ON DELETE CASCADE,
  vendor_id     UUID NOT NULL REFERENCES public.event_vendors(vendor_id) ON DELETE CASCADE,
  line_item_id  UUID REFERENCES public.event_vendor_line_items(line_item_id) ON DELETE SET NULL,
  amount_php    NUMERIC(12,2) NOT NULL CHECK (amount_php > 0),
  paid_at       DATE NOT NULL DEFAULT CURRENT_DATE,
  method        TEXT,
  reference     TEXT,
  notes         TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS event_vendor_payments_event_id_idx
  ON public.event_vendor_payments(event_id);
CREATE INDEX IF NOT EXISTS event_vendor_payments_vendor_id_idx
  ON public.event_vendor_payments(vendor_id);

ALTER TABLE public.event_vendor_payments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS event_vendor_payments_couple_read
  ON public.event_vendor_payments;
CREATE POLICY event_vendor_payments_couple_read
  ON public.event_vendor_payments FOR SELECT
  TO authenticated
  USING (event_id IN (SELECT public.current_couple_event_ids()));

DROP POLICY IF EXISTS event_vendor_payments_couple_write
  ON public.event_vendor_payments;
CREATE POLICY event_vendor_payments_couple_write
  ON public.event_vendor_payments FOR ALL
  TO authenticated
  USING (event_id IN (SELECT public.current_couple_event_ids()))
  WITH CHECK (event_id IN (SELECT public.current_couple_event_ids()));

COMMIT;
