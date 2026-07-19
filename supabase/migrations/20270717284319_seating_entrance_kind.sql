-- seating_entrance_kind
-- Created via `pnpm migration:new`. Prefix auto-allocated to sort AFTER every
-- existing migration. KEEP THIS MIGRATION IDEMPOTENT (it may be re-applied).
--
-- Main entrance geometry (0008 seat-plan editor): door (shallow, default) vs a
-- deeper WALK-THROUGH. The schema value stays 'tunnel'; the couple-facing UI
-- labels it "Walk-through" to avoid colliding with the decor
-- receptionDesign.tunnel + cold-spark kit.
BEGIN;
ALTER TABLE public.event_floor_plan
  ADD COLUMN IF NOT EXISTS entrance_kind TEXT NOT NULL DEFAULT 'door'
    CHECK (entrance_kind IN ('door', 'tunnel')),
  ADD COLUMN IF NOT EXISTS entrance_depth_m NUMERIC NOT NULL DEFAULT 3;
COMMENT ON COLUMN public.event_floor_plan.entrance_kind IS
  'Main entrance geometry: door (shallow, default) or tunnel/walk-through (deeper, back flush to wall, opening inward).';
COMMENT ON COLUMN public.event_floor_plan.entrance_depth_m IS
  'Inward run of the walk-through entrance in metres (only when entrance_kind=tunnel). Default 3.';
COMMIT;
