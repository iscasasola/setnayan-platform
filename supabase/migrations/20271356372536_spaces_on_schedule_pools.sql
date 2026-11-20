-- 20271356372536_spaces_on_schedule_pools
-- Created via `pnpm migration:new`. Idempotent — safe to re-apply.
--
-- SPACES — A SHOP'S HALLS, ROOMS AND RENTALS ARE ITS SCHEDULE POOLS, WITH A KIND (owner 19 Nov, DECISION_LOG
-- "Build rule for Spaces / availability": "Spaces ARE vendor_schedule_pools rows plus a kind column (no new table)";
-- "SHOP PAGE FINAL + SPACES COMBINED WITH ROOMS & SEATING — APPROVED": #7968 keeps only tables, table types, doors and
-- the shared plan core, HUNG ON A SPACE; its floors / dining areas / rooms-as-units storage is dropped).
-- Build drawing: specs prototypes/spaces_final_screens_2026-11-19.html.
--
-- 1 · vendor_schedule_pools gains the Spaces columns. A pool with a space_kind IS a space; NULL = a team's schedule
--     (photo team, cakes …), exactly as before.
--       space_kind     hall · room · cart · clothing · object · vehicle · item (the six kinds; "Halls and rooms" is
--                      two words because a hall is named Hall001 and a room Room001 below Pro).
--       is_hall        TRUE for every space a card books WHOLE (hall · room · cart · vehicle · item), so the shipped
--                      Uses pick, acquire_schedule_pools' seat per pool and the day's halls view serve them unchanged.
--                      FALSE for COUNTED things (object · clothing): those are a number, never one booking a day.
--       space_width_m / space_length_m   a hall's floor size, or the space a cart / object needs. Both or neither,
--                      the same 500 m ceiling as vendor_profiles_venue_dimensions_check.
--       connects_to_pool_id   "Connects to" (set once, saved both ways by the app): only connected halls join.
--       floor_label    the floor a room is on ("2F"). A floor is a label on the room (pick 6), never its own row.
--       space_count / in_repair_count   how many a COUNTED space owns, and how many are out for repair.
--       space_details  the kind's own rows (clothing type, colour, sizes; vehicle type, seats, driver; needs power;
--                      days out and back …). An object, small, never a person.
--     Existing halls (is_hall) become space_kind 'hall', so nothing a shop already made is lost.
--
-- 2 · #7968's tables and doors hang on a hall or room (pool_id), not on vendor_unit_groups. Rooms are pools now, so
--     the 'room' units go; vendor_unit_groups is dropped. A table's name is unique in its room, not the whole shop
--     (T1 in each hall). RLS on both tables is unchanged (the shop's team reads; admin and owner seats write; no
--     couple policy, so a couple never sees a table number).
--
-- ⚠ Every CHECK below is written so it can never evaluate to NULL (a NULL CHECK passes): sides and kinds are tested
-- IS NOT NULL / COALESCEd before they are compared. tests/db/a-shops-spaces-are-its-own.db.test.ts holds each one.
--
-- No couple-facing read is added here. vendor_schedule_pools keeps its two shipped policies.
BEGIN;

-- ── 1 · the Spaces columns ──────────────────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.vendor_schedule_pools
  ADD COLUMN IF NOT EXISTS space_kind          TEXT,
  ADD COLUMN IF NOT EXISTS space_width_m       NUMERIC,
  ADD COLUMN IF NOT EXISTS space_length_m      NUMERIC,
  ADD COLUMN IF NOT EXISTS connects_to_pool_id UUID
                           REFERENCES public.vendor_schedule_pools(pool_id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS floor_label         TEXT,
  ADD COLUMN IF NOT EXISTS space_count         INT,
  ADD COLUMN IF NOT EXISTS in_repair_count     INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS space_details       JSONB NOT NULL DEFAULT '{}'::jsonb;

UPDATE public.vendor_schedule_pools SET space_kind = 'hall' WHERE is_hall AND space_kind IS NULL;

ALTER TABLE public.vendor_schedule_pools DROP CONSTRAINT IF EXISTS vendor_schedule_pools_space_kind_check;
ALTER TABLE public.vendor_schedule_pools ADD CONSTRAINT vendor_schedule_pools_space_kind_check CHECK (
  space_kind IS NULL
  OR (space_kind IN ('hall', 'room', 'cart', 'vehicle', 'item') AND is_hall)
  OR (space_kind IN ('object', 'clothing') AND NOT is_hall)
);
ALTER TABLE public.vendor_schedule_pools DROP CONSTRAINT IF EXISTS vendor_schedule_pools_space_size_check;
ALTER TABLE public.vendor_schedule_pools ADD CONSTRAINT vendor_schedule_pools_space_size_check CHECK (
  (space_width_m IS NULL AND space_length_m IS NULL)
  OR (space_kind IS NOT NULL AND space_width_m IS NOT NULL AND space_length_m IS NOT NULL
      AND space_width_m  > 0 AND space_width_m  <= 500
      AND space_length_m > 0 AND space_length_m <= 500)
);
ALTER TABLE public.vendor_schedule_pools DROP CONSTRAINT IF EXISTS vendor_schedule_pools_space_count_check;
ALTER TABLE public.vendor_schedule_pools ADD CONSTRAINT vendor_schedule_pools_space_count_check CHECK (
  (space_count IS NULL AND in_repair_count = 0)
  OR (COALESCE(space_kind IN ('object', 'clothing'), FALSE) AND space_count IS NOT NULL
      AND space_count BETWEEN 1 AND 100000
      AND in_repair_count BETWEEN 0 AND space_count)
);
ALTER TABLE public.vendor_schedule_pools DROP CONSTRAINT IF EXISTS vendor_schedule_pools_floor_label_check;
ALTER TABLE public.vendor_schedule_pools ADD CONSTRAINT vendor_schedule_pools_floor_label_check CHECK (
  floor_label IS NULL OR (COALESCE(space_kind = 'room', FALSE) AND char_length(btrim(floor_label)) BETWEEN 1 AND 12)
);
ALTER TABLE public.vendor_schedule_pools DROP CONSTRAINT IF EXISTS vendor_schedule_pools_space_details_check;
ALTER TABLE public.vendor_schedule_pools ADD CONSTRAINT vendor_schedule_pools_space_details_check CHECK (
  jsonb_typeof(space_details) = 'object' AND pg_column_size(space_details) <= 4096
);
ALTER TABLE public.vendor_schedule_pools DROP CONSTRAINT IF EXISTS vendor_schedule_pools_connects_not_self;
ALTER TABLE public.vendor_schedule_pools ADD CONSTRAINT vendor_schedule_pools_connects_not_self CHECK (
  connects_to_pool_id IS NULL OR connects_to_pool_id <> pool_id
);

CREATE INDEX IF NOT EXISTS vendor_schedule_pools_spaces_idx
  ON public.vendor_schedule_pools(vendor_profile_id, space_kind) WHERE space_kind IS NOT NULL;

COMMENT ON COLUMN public.vendor_schedule_pools.space_kind IS
  'Spaces (owner 2026-11-19): hall · room · cart · clothing · object · vehicle · item. NULL = a team schedule, not a space. Booked-whole kinds are is_hall; counted kinds (object, clothing) are not.';
COMMENT ON COLUMN public.vendor_schedule_pools.connects_to_pool_id IS
  'Spaces "Connects to": the hall this one opens into. Saved both ways by the app; only connected halls join on a card.';
COMMENT ON COLUMN public.vendor_schedule_pools.space_details IS
  'Spaces: the kind''s own rows (clothing type/colour/sizes, vehicle type/seats/driver, needs power, days out and back). Never a person.';

-- "Connects to" stays inside the shop, and only between halls and rooms.
CREATE OR REPLACE FUNCTION public.guard_space_connects_to()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = public
AS $$
BEGIN
  IF NEW.connects_to_pool_id IS NULL THEN
    RETURN NEW;
  END IF;
  IF NEW.space_kind IS NULL OR NEW.space_kind NOT IN ('hall', 'room') OR NOT EXISTS (
    SELECT 1 FROM public.vendor_schedule_pools p
     WHERE p.pool_id = NEW.connects_to_pool_id
       AND p.vendor_profile_id = NEW.vendor_profile_id
       AND p.space_kind IN ('hall', 'room')
  ) THEN
    RAISE EXCEPTION 'space_connects_not_yours' USING ERRCODE = '42501',
      HINT = 'A hall connects only to another of the shop''s own halls or rooms.';
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.guard_space_connects_to() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS vendor_schedule_pools_guard_connects ON public.vendor_schedule_pools;
CREATE TRIGGER vendor_schedule_pools_guard_connects
  BEFORE INSERT OR UPDATE OF connects_to_pool_id, space_kind, vendor_profile_id ON public.vendor_schedule_pools
  FOR EACH ROW EXECUTE FUNCTION public.guard_space_connects_to();

-- ── 2 · #7968's tables and doors hang on a hall or room ─────────────────────────────────────────────────────────────
ALTER TABLE public.vendor_units      ADD COLUMN IF NOT EXISTS pool_id UUID
  REFERENCES public.vendor_schedule_pools(pool_id) ON DELETE CASCADE;
ALTER TABLE public.vendor_unit_doors ADD COLUMN IF NOT EXISTS pool_id UUID
  REFERENCES public.vendor_schedule_pools(pool_id) ON DELETE CASCADE;

-- Rows from the 18 Nov storage have no space to hang on: a room is a pool now, and a dining area was never one.
-- They only exist if #7968 shipped before this file; they go rather than being guessed onto a hall.
DELETE FROM public.vendor_units      WHERE pool_id IS NULL;
DELETE FROM public.vendor_unit_doors WHERE pool_id IS NULL;

DROP TRIGGER IF EXISTS vendor_units_guard_group ON public.vendor_units;
DROP TRIGGER IF EXISTS vendor_unit_doors_guard_group ON public.vendor_unit_doors;
DROP FUNCTION IF EXISTS public.guard_vendor_unit_group();

ALTER TABLE public.vendor_units DROP CONSTRAINT IF EXISTS vendor_units_shape_check;
ALTER TABLE public.vendor_units DROP CONSTRAINT IF EXISTS vendor_units_name_unique;
ALTER TABLE public.vendor_units DROP CONSTRAINT IF EXISTS vendor_units_kind_check;
DROP INDEX IF EXISTS public.vendor_units_group_idx;
DROP INDEX IF EXISTS public.vendor_unit_doors_profile_idx;
DROP INDEX IF EXISTS public.vendor_unit_doors_group_idx;
ALTER TABLE public.vendor_units      DROP COLUMN IF EXISTS group_id;
ALTER TABLE public.vendor_unit_doors DROP COLUMN IF EXISTS group_id;
ALTER TABLE public.vendor_units      ALTER COLUMN pool_id SET NOT NULL;
ALTER TABLE public.vendor_unit_doors ALTER COLUMN pool_id SET NOT NULL;

ALTER TABLE public.vendor_units ADD CONSTRAINT vendor_units_kind_check CHECK (kind = 'table');
ALTER TABLE public.vendor_units ADD CONSTRAINT vendor_units_shape_check CHECK (
  table_shape IS NOT NULL AND chairs IS NOT NULL AND (chairs_at_ends = FALSE OR table_shape = 'long')
);
ALTER TABLE public.vendor_units ADD CONSTRAINT vendor_units_name_unique UNIQUE (pool_id, name);
CREATE INDEX IF NOT EXISTS vendor_units_pool_idx      ON public.vendor_units(pool_id, sort_order);
CREATE INDEX IF NOT EXISTS vendor_unit_doors_pool_idx ON public.vendor_unit_doors(pool_id);

COMMENT ON TABLE public.vendor_units IS
  'Spaces (owner 2026-11-19): one TABLE in a hall or room (Round · Long · Half-moon booth, one chair count), with its floor-plan place. Supplier-only: couples never see a table number.';
COMMENT ON TABLE public.vendor_unit_doors IS
  'Spaces (owner 2026-11-19): a door (Main or Service) of a hall or room · wall · where along it. Size + doors only, never wiring.';

-- A table or a door hangs only on the shop's OWN hall or room.
CREATE OR REPLACE FUNCTION public.guard_vendor_unit_space()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.vendor_schedule_pools p
     WHERE p.pool_id = NEW.pool_id
       AND p.vendor_profile_id = NEW.vendor_profile_id
       AND p.space_kind IN ('hall', 'room')
  ) THEN
    RAISE EXCEPTION 'unit_space_not_yours' USING ERRCODE = '42501',
      HINT = 'A table or a door goes in one of the shop''s own halls or rooms.';
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.guard_vendor_unit_space() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS vendor_units_guard_space ON public.vendor_units;
CREATE TRIGGER vendor_units_guard_space
  BEFORE INSERT OR UPDATE OF pool_id, vendor_profile_id ON public.vendor_units
  FOR EACH ROW EXECUTE FUNCTION public.guard_vendor_unit_space();
DROP TRIGGER IF EXISTS vendor_unit_doors_guard_space ON public.vendor_unit_doors;
CREATE TRIGGER vendor_unit_doors_guard_space
  BEFORE INSERT OR UPDATE OF pool_id, vendor_profile_id ON public.vendor_unit_doors
  FOR EACH ROW EXECUTE FUNCTION public.guard_vendor_unit_space();

-- The 18 Nov floors and dining areas: replaced by spaces.
DROP TABLE IF EXISTS public.vendor_unit_groups;

COMMIT;
