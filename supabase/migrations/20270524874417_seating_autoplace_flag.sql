-- seating_autoplace_flag
-- Created via `pnpm migration:new`. Prefix auto-allocated to sort AFTER every
-- existing migration. KEEP THIS MIGRATION IDEMPOTENT (it may be re-applied):
--   • CREATE TABLE IF NOT EXISTS …   (+ ALTER TABLE … ENABLE ROW LEVEL SECURITY in the SAME migration)
--   • ALTER TABLE … ADD COLUMN IF NOT EXISTS …
--   • CREATE INDEX IF NOT EXISTS …
--   • CREATE OR REPLACE FUNCTION …
--   • DROP POLICY IF EXISTS … ; CREATE POLICY …   (policies have no IF NOT EXISTS)

-- Smart seat-plan · Phase 5 — live provisional seating on/off switch.
--
-- When TRUE (the default), adding a guest or changing their role/group auto-places
-- a PROVISIONAL (unlocked) seat via reconcileProvisionalSeats, so the seat plan
-- stays in sync with the guest list without the couple pressing Auto-Arrange. A
-- couple can switch it off to keep seating a purely manual Auto-Arrange/drag action.
--
-- Plain column on events — the existing events RLS policies already cover it; no
-- new policy needed. DEFAULT TRUE so the feature is on for every existing event.
ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS seating_autoplace_enabled BOOLEAN NOT NULL DEFAULT TRUE;

COMMENT ON COLUMN public.events.seating_autoplace_enabled IS
  'Smart seat-plan Phase 5: TRUE = auto-place a provisional seat when a guest is added or re-roled; FALSE = seating stays a manual Auto-Arrange/drag action.';
