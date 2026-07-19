-- Smart seat-plan · Phase 2 — draggable seating priority order.
-- The couple can reorder the role tiers (who fills the stage-closest tables
-- first). Stored on the per-event floor-plan singleton as an ordered JSON array
-- of { tier, label } descriptors, highest priority first. NULL = the locked
-- default order in lib/seating.ts defaultPriorityOrder() (which reproduces the
-- historical hardcoded tier-1→4 fill, so this is back-compatible until a couple
-- reorders). Additive + idempotent; inherits event_floor_plan's existing
-- couple-owned RLS (no new policy needed).
BEGIN;

ALTER TABLE public.event_floor_plan
  ADD COLUMN IF NOT EXISTS priority_order JSONB;

COMMENT ON COLUMN public.event_floor_plan.priority_order IS
  'Smart seat-plan Phase 2: draggable seating-priority tier list — ordered JSON array of { tier (1-4), label }, highest priority first. NULL = lib/seating.ts defaultPriorityOrder(). Consumed by computeAutoSeat tier-fill order.';

COMMIT;
