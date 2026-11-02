-- seating vip tables
-- Created via `pnpm migration:new`. Prefix auto-allocated to sort AFTER every
-- existing migration. Idempotent (it may be re-applied).
--
-- 🪑 Owner 2026-11-02 (DECISION_LOG "+1 OF A ROLE SITS BY THEIR MAIN; VIP TABLES" and "FINAL SEATING PRECEDENCE"):
--   *"VIP Table/s will be identified"* · *"VIP should always be role first then group. then if there are plus 1, we
--   pick if they sit beside on the VIP or locate them. to the nearest table of the VIP."*
--
-- Rule 0 — no existing column already says "VIP": `table_type` is the SHAPE (round / banquet / …), `link_group_*` is
-- identity for joined tables, `walkthrough_zone_id` is the 3D walk's zone. So two new columns:
--   · event_tables.is_vip — the host's per-table mark (the table's own setting on Seats).
--   · event_floor_plan.vip_plus_ones — the ONE seating pick for where VIP guests' +1s sit:
--       'beside'  (default) = beside them at the VIP table
--       'nearest'           = all of them together at the table(s) nearest the VIP tables
--
-- RLS unchanged: both tables already have RLS enabled and their existing row policies cover every column.
-- Additive only, defaults on the column, no UPDATE (nothing to backfill: every existing table is "not VIP", every
-- existing plan is "beside").

ALTER TABLE public.event_tables
  ADD COLUMN IF NOT EXISTS is_vip BOOLEAN NOT NULL DEFAULT FALSE;

COMMENT ON COLUMN public.event_tables.is_vip IS
  'Host-marked VIP table (owner 2026-11-02). Auto arrange seats role holders here first: role order, then group.';

ALTER TABLE public.event_floor_plan
  ADD COLUMN IF NOT EXISTS vip_plus_ones TEXT NOT NULL DEFAULT 'beside';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'event_floor_plan_vip_plus_ones_check'
  ) THEN
    ALTER TABLE public.event_floor_plan
      ADD CONSTRAINT event_floor_plan_vip_plus_ones_check CHECK (vip_plus_ones IN ('beside', 'nearest'));
  END IF;
END $$;

COMMENT ON COLUMN public.event_floor_plan.vip_plus_ones IS
  'Where VIP guests'' +1s sit (owner 2026-11-02): beside = beside them at the VIP table (default); nearest = all together at the table(s) nearest the VIP tables.';
