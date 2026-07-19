-- demo_sessions_bound_ref
-- Created via `pnpm migration:new`. Prefix auto-allocated to sort AFTER every
-- existing migration. KEEP THIS MIGRATION IDEMPOTENT (it may be re-applied):
--   • CREATE TABLE IF NOT EXISTS …   (+ ALTER TABLE … ENABLE ROW LEVEL SECURITY in the SAME migration)
--   • ALTER TABLE … ADD COLUMN IF NOT EXISTS …
--   • CREATE INDEX IF NOT EXISTS …
--   • CREATE OR REPLACE FUNCTION …
--   • DROP POLICY IF EXISTS … ; CREATE POLICY …   (policies have no IF NOT EXISTS)

-- The 3D Plan homepage demo (DECISION_LOG 2026-07-03) reuses the generic
-- `demo_sessions` scaffold, but its shape is per-GUEST rather than the
-- two-phone "you + a friend" pairing Papic/Panood use: clicking a seated
-- guest in the sample 3D room mints a session bound to that ONE guest, and
-- scanning its QR opens the phone experience as that guest. `bound_ref`
-- carries the (fictional, zero-privacy) sample guest_id the session is
-- bound to; NULL for every existing Papic/Panood row and every future
-- two-phone session (they never set it). Additive + nullable, so this never
-- touches the already-shipped Papic/Panood read/write paths.
ALTER TABLE public.demo_sessions ADD COLUMN IF NOT EXISTS bound_ref TEXT NULL;
