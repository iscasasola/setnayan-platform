-- ============================================================================
-- 20260513220000_iteration_0026_drop_or_number.sql
-- Iteration 0026 follow-up — drop receipts.or_number.
--
-- The previous migration tried to store both `or_serial` (BIGINT, sourced
-- from a sequence) and `or_number` (TEXT, "SR-2026-000001" display string).
-- That's redundant — the display string is fully derivable from the serial
-- + the receipt's year. Storing it twice creates a race window between
-- INSERT and the post-insert UPDATE that fills it in.
--
-- Fix: keep `or_serial` as the source of truth; the app composes the
-- display label on read via formatOrNumber(serial, year).
--
-- Idempotent.
-- ============================================================================

BEGIN;

ALTER TABLE public.receipts DROP COLUMN IF EXISTS or_number;

COMMIT;
