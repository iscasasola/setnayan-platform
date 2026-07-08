-- seating_group_adjacency_flag
-- Created via `pnpm migration:new`. Prefix auto-allocated to sort AFTER every
-- existing migration. KEEP THIS MIGRATION IDEMPOTENT (it may be re-applied):
--   • CREATE TABLE IF NOT EXISTS …   (+ ALTER TABLE … ENABLE ROW LEVEL SECURITY in the SAME migration)
--   • ALTER TABLE … ADD COLUMN IF NOT EXISTS …
--   • CREATE INDEX IF NOT EXISTS …
--   • CREATE OR REPLACE FUNCTION …
--   • DROP POLICY IF EXISTS … ; CREATE POLICY …   (policies have no IF NOT EXISTS)

-- Smart seat-plan · Phase 6 — group-overflow adjacency opt-out (gap G8).
--
-- Adjacency (a custom group's overflow spills onto the physically nearest table,
-- not the next stage-ranked one) ships ON as a strict improvement. This flag lets
-- a couple revert to the classic stage-ranked fill if they preferred it. Plain
-- column on events; existing events RLS covers it. DEFAULT TRUE = adjacency on.
ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS seating_group_adjacency BOOLEAN NOT NULL DEFAULT TRUE;

COMMENT ON COLUMN public.events.seating_group_adjacency IS
  'Smart seat-plan Phase 6: TRUE = a group''s overflow spills to the nearest table by floor coordinates; FALSE = classic stage-ranked fill.';
