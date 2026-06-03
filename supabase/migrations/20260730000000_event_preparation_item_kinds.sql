-- Typed preparation items: couples + booked vendors can place 'meeting' and
-- 'payment' schedule entries, not just generic tasks. Additive; existing
-- row-level policies (from 20260729000000) already cover these columns.
ALTER TABLE public.event_preparation_items
  ADD COLUMN IF NOT EXISTS kind VARCHAR(16) NOT NULL DEFAULT 'task'
    CHECK (kind IN ('task','meeting','payment')),
  ADD COLUMN IF NOT EXISTS amount_php NUMERIC(12,2)
    CHECK (amount_php IS NULL OR amount_php >= 0);
