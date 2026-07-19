-- ============================================================================
-- 20270314132689_enable_realtime_budget.sql
-- Enable Supabase Realtime for the couple's budget ledger (iteration 0007).
--
-- The budget page shows live payment progress — total to pay, total paid,
-- balance, % complete, and the next coming payments. For those numbers to
-- update without a page refresh the moment a payment is logged (or a
-- milestone added/edited), the two host-owned ledger tables must be members
-- of the `supabase_realtime` PostgreSQL publication. Supabase creates that
-- publication for every project; we just opt the right tables in.
--
-- RLS is already enabled on both tables (iteration 0007,
-- 20260513110000_iteration_0007_budget.sql), and Realtime honors RLS — a
-- couple only receives change events for rows on their own event. No extra
-- policy work is needed.
--
-- Idempotent: each ALTER PUBLICATION is guarded by a pg_publication_tables
-- check, so re-running the migration is a no-op. Mirrors the chat realtime
-- migration (20260514140000_enable_realtime_chat.sql).
-- ============================================================================

BEGIN;

-- event_vendor_payments — INSERT/UPDATE/DELETE drive the live "paid so far",
-- balance, and % progress, plus removing a settled milestone from the
-- "next payments" list.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'event_vendor_payments'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.event_vendor_payments;
  END IF;
END $$;

-- event_vendor_line_items — the payment milestones themselves. Adding,
-- editing, or deleting a milestone (amount or due date) re-shapes the
-- total-to-pay figure and the "next coming payments" schedule.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'event_vendor_line_items'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.event_vendor_line_items;
  END IF;
END $$;

COMMIT;
