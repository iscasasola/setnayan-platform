-- notification_type_event_auto_surfaced
-- Created via `pnpm migration:new`. Prefix auto-allocated to sort AFTER every
-- existing migration. KEEP THIS MIGRATION IDEMPOTENT (it may be re-applied):
--   • CREATE TABLE IF NOT EXISTS …   (+ ALTER TABLE … ENABLE ROW LEVEL SECURITY in the SAME migration)
--   • ALTER TABLE … ADD COLUMN IF NOT EXISTS …
--   • CREATE INDEX IF NOT EXISTS …
--   • CREATE OR REPLACE FUNCTION …
--   • DROP POLICY IF EXISTS … ; CREATE POLICY …   (policies have no IF NOT EXISTS)

-- Account auto-surface (#7b, gap G6) — notification type for the RA 10173
-- "you were added" notice. Additive enum value; idempotent via IF NOT EXISTS.
-- The notice only fires behind FEATURE_ACCOUNT_AUTOSURFACE (default OFF), so this
-- value is inert until counsel clears the flag. Adding the value does NOT use it
-- in this migration, so it is transaction-safe on PG12+.
ALTER TYPE public.notification_type ADD VALUE IF NOT EXISTS 'event_auto_surfaced';
