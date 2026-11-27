-- seat_plan_table_names_kinds_locks
-- Created via `pnpm migration:new`. Prefix auto-allocated to sort AFTER every
-- existing migration. KEEP THIS MIGRATION IDEMPOTENT (it may be re-applied):
--   • CREATE TABLE IF NOT EXISTS …   (+ ALTER TABLE … ENABLE ROW LEVEL SECURITY in the SAME migration)
--   • ALTER TABLE … ADD COLUMN IF NOT EXISTS …
--   • CREATE INDEX IF NOT EXISTS …
--   • CREATE OR REPLACE FUNCTION …
--   • DROP POLICY IF EXISTS … ; CREATE POLICY …   (policies have no IF NOT EXISTS)

--
-- ── WHY (owner 2026-11-27, corpus SEAT-PLAN-COMPLETE-2026-11-27.md § 6, rulings R6 + R8) ────────────────────
-- The seat plan's ONE migration. Columns on two existing tables only — no new table, no new policy: the
-- existing event_tables / event_floor_plan policies already cover every column added here.
--
--   event_tables.label_is_auto  · "a table names itself after its majority group; a host-set name is never
--                                  overwritten". TRUE = the shown name is read by `tableDisplayNames`
--                                  (apps/web/lib/table-auto-name.ts); FALSE = the host typed it. Backfill: every
--                                  label that is not the default `Table <n>` is a name a couple typed, so it is
--                                  kept (FALSE).
--   event_tables.table_kind     · regular · vip · elders · spare. Backfilled 'vip' from is_vip. is_vip stays (no
--                                  drop) for a later cleanup; the VIP writer now writes both.
--   event_tables.locked         · the table lock (seat locks stay event_seat_assignments.locked). A hard rule
--                                  for auto arrange.
--   event_floor_plan.speakers_* · the Speakers element, the entrance_* pattern (enabled + x/y percent).
--   event_floor_plan.auto_seat_rsvps / seat_suggestions · the two ⋯ switches, on by default.
--
-- Idempotent: ADD COLUMN IF NOT EXISTS; the backfills only touch rows still at their defaults; the CHECK is
-- dropped and re-added by name.

BEGIN;

ALTER TABLE public.event_tables
  ADD COLUMN IF NOT EXISTS label_is_auto BOOLEAN NOT NULL DEFAULT TRUE;

-- Every name a couple already typed is kept: only the default "Table <n>" stays auto.
UPDATE public.event_tables
   SET label_is_auto = FALSE
 WHERE label_is_auto = TRUE
   AND btrim(table_label) !~* '^table\s+[0-9]+$';

COMMENT ON COLUMN public.event_tables.label_is_auto IS
  'TRUE = the shown name is read (tableDisplayNames: majority group, else table_label "Table N"). FALSE = the host typed table_label and it never changes when guests move. Written by updateTableLabel / createTable.';

ALTER TABLE public.event_tables
  ADD COLUMN IF NOT EXISTS table_kind TEXT NOT NULL DEFAULT 'regular';

ALTER TABLE public.event_tables DROP CONSTRAINT IF EXISTS event_tables_table_kind_check;
ALTER TABLE public.event_tables
  ADD CONSTRAINT event_tables_table_kind_check
  CHECK (table_kind IN ('regular', 'vip', 'elders', 'spare'));

UPDATE public.event_tables
   SET table_kind = 'vip'
 WHERE is_vip = TRUE
   AND table_kind = 'regular';

COMMENT ON COLUMN public.event_tables.table_kind IS
  'regular · vip · elders · spare (seat plan § 4.7). Replaces is_vip as the read (is_vip kept, written in step, until a cleanup drops it).';

ALTER TABLE public.event_tables
  ADD COLUMN IF NOT EXISTS locked BOOLEAN NOT NULL DEFAULT FALSE;

COMMENT ON COLUMN public.event_tables.locked IS
  'The table lock: auto arrange keeps this table exactly as it is (a hard rule). Seat locks stay event_seat_assignments.locked.';

ALTER TABLE public.event_floor_plan
  ADD COLUMN IF NOT EXISTS speakers_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS speakers_x NUMERIC NOT NULL DEFAULT 10,
  ADD COLUMN IF NOT EXISTS speakers_y NUMERIC NOT NULL DEFAULT 10,
  ADD COLUMN IF NOT EXISTS auto_seat_rsvps BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS seat_suggestions BOOLEAN NOT NULL DEFAULT TRUE;

COMMENT ON COLUMN public.event_floor_plan.speakers_enabled IS
  'The Speakers element is on the plan (the entrance_* pattern). The solver keeps elders and children away from it.';
COMMENT ON COLUMN public.event_floor_plan.auto_seat_rsvps IS
  '⋯ "Seat new RSVPs for me": a new yes is seated by the rules, nobody already seated moves. Fails closed.';
COMMENT ON COLUMN public.event_floor_plan.seat_suggestions IS
  '⋯ "Suggest seats on the cards": the dry run''s suggestions show on the table cards.';

COMMIT;
