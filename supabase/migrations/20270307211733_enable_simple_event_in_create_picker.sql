-- enable simple event in create picker
-- Created via `pnpm migration:new`. Prefix auto-allocated to sort AFTER every
-- existing migration. KEEP THIS MIGRATION IDEMPOTENT (it may be re-applied):
--   • CREATE TABLE IF NOT EXISTS …   (+ ALTER TABLE … ENABLE ROW LEVEL SECURITY in the SAME migration)
--   • ALTER TABLE … ADD COLUMN IF NOT EXISTS …
--   • CREATE INDEX IF NOT EXISTS …
--   • CREATE OR REPLACE FUNCTION …
--   • DROP POLICY IF EXISTS … ; CREATE POLICY …   (policies have no IF NOT EXISTS)
--
-- ITERATION 0053 follow-on — ACTIVATE the Simple Event type (owner 2026-06-27).
-- The foundation migration (20270307127948) seeded the vocab row enabled=FALSE
-- so it stayed out of the couple create-event picker while /onboarding/simple +
-- the Explore/Budget nav-gating were built. This flips it on: "Simple Event" now
-- appears in the picker and routes to its date-only onboarding. No-op if already
-- enabled. Safe to re-run.

UPDATE public.event_type_vocab
  SET enabled = TRUE
  WHERE event_type = 'simple_event';
