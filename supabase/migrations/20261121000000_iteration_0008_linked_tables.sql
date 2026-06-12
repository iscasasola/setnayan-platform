-- ============================================================================
-- 20261121000000_iteration_0008_linked_tables.sql (3rd re-timestamp: ledger row at 20261116000000 was replaced by security_alert in a concurrent session; SQL is idempotent so re-applying re-registers it) (re-timestamped from 20261115000000 — collided with born_again_pastor_retag already applied at that version; ledger matches VERSION so this file would be silently skipped)
-- Iteration 0008 — linked tables: combine tables into ONE named unit
-- (owner-directed 2026-06-10 "tables can link together to be named as 1
-- table"; depth owner-locked 2026-06-10 = IDENTITY + QR only — shared
-- name/number, one printed QR sign, one find-my-seat entry. Seating math
-- stays per-table; a shared capacity pool is a future enhancement.)
--
-- Tables sharing a link_group_id render and print as one unit under
-- link_group_label. The print pack emits ONE sign per group (the lead =
-- lowest sort_order; siblings suppress their own sign). Mirrors the additive
-- pattern of 20261016 (rotation/removed_seats). RLS inherited.
-- ============================================================================

BEGIN;

ALTER TABLE public.event_tables
  ADD COLUMN IF NOT EXISTS link_group_id    UUID,
  ADD COLUMN IF NOT EXISTS link_group_label TEXT;

CREATE INDEX IF NOT EXISTS event_tables_link_group_idx
  ON public.event_tables(link_group_id)
  WHERE link_group_id IS NOT NULL;

COMMENT ON COLUMN public.event_tables.link_group_id IS
  'Tables sharing this UUID form ONE named unit (shared label + one printed QR sign + one find-my-seat entry). NULL = unlinked. Seating math stays per-table (identity+QR-only lock, 2026-06-10).';
COMMENT ON COLUMN public.event_tables.link_group_label IS
  'The linked unit''s display name (e.g. "Head table"). Kept in sync on rename of any member.';

COMMIT;
