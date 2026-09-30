-- event_floor_plan_role_seating
-- Created via `pnpm migration:new`. Prefix auto-allocated to sort AFTER every
-- existing migration. KEEP THIS MIGRATION IDEMPOTENT (it may be re-applied):
--   • CREATE TABLE IF NOT EXISTS …   (+ ALTER TABLE … ENABLE ROW LEVEL SECURITY in the SAME migration)
--   • ALTER TABLE … ADD COLUMN IF NOT EXISTS …
--   • CREATE INDEX IF NOT EXISTS …
--   • CREATE OR REPLACE FUNCTION …
--   • DROP POLICY IF EXISTS … ; CREATE POLICY …   (policies have no IF NOT EXISTS)


-- 🪑 AUTO-SEAT: THE COUPLE CHOOSES, PER ROLE, "SIT TOGETHER" OR "SIT WITH THEIR
-- GROUP" (DECISION_LOG 2026-09-30). One choice per entourage role set, stored
-- beside the floor plan's other auto-seat setting (priority_order) on the
-- per-event floor-plan singleton — no new table.
--
-- Shape: a JSON object of role-set key → 'together' | 'group', e.g.
--   {"wedding_party": "group"}
-- Keys: principal_sponsors · immediate_family · wedding_party ·
-- secondary_sponsors · bearers_flower_girl (lib/seating.ts ROLE_SEATING_SETS).
-- NULL, a missing key, or anything unrecognised = 'together' (the owner's
-- default), so every existing floor plan reads exactly as the rule says.
--
-- Additive + idempotent; inherits event_floor_plan's existing couple-owned RLS
-- (no new policy needed — same as priority_order).
BEGIN;

ALTER TABLE public.event_floor_plan
  ADD COLUMN IF NOT EXISTS role_seating JSONB;

COMMENT ON COLUMN public.event_floor_plan.role_seating IS
  'Auto-seat per-role choice (2026-09-30): JSON object of role-set key → ''together'' | ''group''. NULL / missing key = together. Read by lib/seating.ts parseRoleSeating(); consumed by computeAutoSeat.';

COMMIT;
