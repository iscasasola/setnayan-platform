-- ============================================================================
-- 20271350389612_shop_rooms_and_seating.sql
--
-- ROOMS & SEATING — THE SHOP MAKES ITS PLACES ONCE (piece A of the units map).
--
-- Owner, 2026-11-18 (specs `prototypes/units_rooms_seating_2026-11-18/MAP.md`,
-- DECISION_LOG 2026-11-18 "SUPPLIER'S CLIENT PAGE …" and ruling 35 "CARD MAKER
-- UNITS VIEW"): *"Just map them appropriately"* — one place, under Shop ›
-- Makers › Specialized tools, where a shop makes its hotel rooms, its dining
-- areas and tables, and its hall's doors ONCE. Each service card will later
-- only PICK from it (Availability plan Step 5 — NOT this file).
--
-- SUPPLIER-ONLY STORAGE. This file changes no booking, no card, no couple
-- read. Owner, 18 Nov: *"Couples see 'available', never which one. The
-- supplier assigns."* So no policy here admits a couple: a published shop's
-- rooms and tables are NOT public. A later couple-facing read (Step 5) must go
-- through a SECURITY DEFINER count ("N seats confirmed"), never these rows.
--
-- THREE TABLES:
--   vendor_unit_groups   a hotel FLOOR (holds rooms) or a DINING AREA (holds
--                        tables, with its own optional room size).
--   vendor_units         one ROOM or one TABLE. A table has a type — Round ·
--                        Long · Half-moon booth — and ONE chair count; a Long
--                        table may put chairs at the ends (counted in the one
--                        number). This is the "unit grid" plan Steps 4 and 5
--                        read; a Step 5 reservation will point at unit_id.
--   vendor_unit_doors    a door on a dining area, or on THE HALL. Main or
--                        Service · which wall · where along it. Size + doors
--                        only, never wiring (owner 18 Nov: halls share "size
--                        + doors only").
--
-- 🔑 THE HALL HAS NO SIZE HERE. Its size is the shipped
-- `vendor_profiles.venue_width_m` / `venue_length_m` (the shop's "Room size &
-- capacity" row, migration 20271120090000). A door with group_id NULL is a
-- door of that room. Adding a second hall size would be a second source of
-- truth for one fact (repo CLAUDE.md Rule 0 · 8).
--
-- FLOOR PLAN (ruling 35: Pro · Max · Ultra; owner 18 Nov, DECISION_LOG
-- "THE SUPPLIER'S FLOOR PLAN WORKS LIKE THE COUPLE'S SEAT PLAN — REUSE IT"):
-- vendor_units carries x_pos / y_pos / rotation_deg exactly as event_tables
-- does, so the shipped seat-plan editor can place a shop's tables. Grid order
-- is sort_order and needs no position.
--
-- NOT HERE (each waits on its own word):
--   · Any link from a card to a unit, and any reservation (Step 5).
--
-- RLS AT CREATE (RLS_Policy_Pattern: owner-scoped vendor table). Every member
-- of the shop's team reads (current_vendor_ids() — viewer and up); admin and
-- owner seats write (current_vendor_ids('admin')); Setnayan admins read.
-- anon gets nothing.
-- ============================================================================

BEGIN;

-- ── 1 · FLOORS AND DINING AREAS ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.vendor_unit_groups (
  group_id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_profile_id  UUID NOT NULL
                     REFERENCES public.vendor_profiles(vendor_profile_id)
                     ON DELETE CASCADE,
  kind               TEXT NOT NULL CHECK (kind IN ('floor', 'dining_area')),
  name               TEXT NOT NULL CHECK (char_length(btrim(name)) BETWEEN 1 AND 60),
  -- A dining area's own room size, in metres. Both or neither; never on a
  -- floor (a hotel floor is a list of rooms, not a drawn room). The 500 m
  -- ceiling is the one `vendor_profiles_venue_dimensions_check` uses.
  width_m            NUMERIC,
  length_m           NUMERIC,
  sort_order         INT NOT NULL DEFAULT 0,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT vendor_unit_groups_size_check CHECK (
    (width_m IS NULL AND length_m IS NULL)
    OR (
      kind = 'dining_area'
      AND width_m  > 0 AND width_m  <= 500
      AND length_m > 0 AND length_m <= 500
    )
  ),
  CONSTRAINT vendor_unit_groups_name_unique UNIQUE (vendor_profile_id, kind, name)
);

CREATE INDEX IF NOT EXISTS vendor_unit_groups_profile_idx
  ON public.vendor_unit_groups(vendor_profile_id, kind, sort_order);

COMMENT ON TABLE public.vendor_unit_groups IS
  'Rooms & seating (owner 2026-11-18): a shop''s hotel FLOOR (holds rooms) or DINING AREA (holds tables, optional size). Supplier-only: couples never see which room or table.';

-- ── 2 · ROOMS AND TABLES ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.vendor_units (
  unit_id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_profile_id  UUID NOT NULL
                     REFERENCES public.vendor_profiles(vendor_profile_id)
                     ON DELETE CASCADE,
  group_id           UUID NOT NULL
                     REFERENCES public.vendor_unit_groups(group_id)
                     ON DELETE CASCADE,
  kind               TEXT NOT NULL CHECK (kind IN ('room', 'table')),
  name               TEXT NOT NULL CHECK (char_length(btrim(name)) BETWEEN 1 AND 30),
  table_shape        TEXT CHECK (table_shape IN ('round', 'long', 'half_moon')),
  -- ONE chair count. On a Long table it counts EVERY chair, ends included.
  chairs             INT CHECK (chairs BETWEEN 1 AND 60),
  chairs_at_ends     BOOLEAN NOT NULL DEFAULT FALSE,
  sort_order         INT NOT NULL DEFAULT 0,
  -- Floor plan place (Pro · Max · Ultra). The SAME three columns, units and
  -- sense as event_tables (x_pos / y_pos / rotation_deg, lib/seating.ts), so the
  -- couple seat-plan editor can draw a shop's tables (owner 2026-11-18: "floor
  -- plan can function similar to our event dashboard guest list's seat plan").
  -- NULL = never placed: the Grid shows it, the plan lays it out.
  x_pos              NUMERIC,
  y_pos              NUMERIC,
  rotation_deg       INTEGER NOT NULL DEFAULT 0 CHECK (rotation_deg BETWEEN -360 AND 360),
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT vendor_units_shape_check CHECK (
    (kind = 'room'  AND table_shape IS NULL     AND chairs IS NULL     AND chairs_at_ends = FALSE)
    OR
    (kind = 'table' AND table_shape IS NOT NULL AND chairs IS NOT NULL
                    AND (chairs_at_ends = FALSE OR table_shape = 'long'))
  ),
  -- Room 301 is one room; Table 7 is one table. A name is unique in the shop.
  CONSTRAINT vendor_units_name_unique UNIQUE (vendor_profile_id, kind, name)
);

CREATE INDEX IF NOT EXISTS vendor_units_group_idx
  ON public.vendor_units(group_id, sort_order);
CREATE INDEX IF NOT EXISTS vendor_units_profile_idx
  ON public.vendor_units(vendor_profile_id);

COMMENT ON TABLE public.vendor_units IS
  'Rooms & seating (owner 2026-11-18): one hotel ROOM or one dining TABLE (Round · Long · Half-moon booth, one chair count). The unit grid Availability plan Steps 4-5 read. Supplier-only.';

-- ── 3 · DOORS ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.vendor_unit_doors (
  door_id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_profile_id  UUID NOT NULL
                     REFERENCES public.vendor_profiles(vendor_profile_id)
                     ON DELETE CASCADE,
  -- NULL = a door of THE HALL (the shop's own room, sized by
  -- vendor_profiles.venue_width_m / venue_length_m). Else a dining area.
  group_id           UUID
                     REFERENCES public.vendor_unit_groups(group_id)
                     ON DELETE CASCADE,
  door_kind          TEXT NOT NULL DEFAULT 'main' CHECK (door_kind IN ('main', 'service')),
  wall               TEXT NOT NULL CHECK (wall IN ('front', 'back', 'left', 'right')),
  along              TEXT NOT NULL DEFAULT 'middle' CHECK (along IN ('left', 'middle', 'right')),
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS vendor_unit_doors_profile_idx
  ON public.vendor_unit_doors(vendor_profile_id, group_id);
CREATE INDEX IF NOT EXISTS vendor_unit_doors_group_idx
  ON public.vendor_unit_doors(group_id);

COMMENT ON TABLE public.vendor_unit_doors IS
  'Rooms & seating (owner 2026-11-18): a door of a dining area, or of the hall when group_id IS NULL (the hall''s size is vendor_profiles.venue_width_m/length_m). Size + doors only, never wiring.';

-- ── 4 · ONE SHOP'S OWN — a row may only point at the SAME shop's group, of
-- the right kind. RLS checks the row's vendor_profile_id, not the group's;
-- without this a room could be filed on ANOTHER shop's floor. (The shape of
-- guard_vendor_service_hall, migration 20271269411264.)
CREATE OR REPLACE FUNCTION public.guard_vendor_unit_group()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = public
AS $$
DECLARE
  want_kind TEXT;
BEGIN
  IF NEW.group_id IS NULL THEN
    RETURN NEW;  -- only a door may have no group: the hall
  END IF;
  IF TG_TABLE_NAME = 'vendor_units' THEN
    want_kind := CASE NEW.kind WHEN 'room' THEN 'floor' ELSE 'dining_area' END;
  ELSE
    want_kind := 'dining_area';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.vendor_unit_groups g
     WHERE g.group_id = NEW.group_id
       AND g.vendor_profile_id = NEW.vendor_profile_id
       AND g.kind = want_kind
  ) THEN
    RAISE EXCEPTION 'unit_group_not_yours' USING ERRCODE = '42501',
      HINT = 'A room goes on one of the shop''s own floors; a table or a door on one of its own dining areas.';
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.guard_vendor_unit_group() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS vendor_units_guard_group ON public.vendor_units;
CREATE TRIGGER vendor_units_guard_group
  BEFORE INSERT OR UPDATE OF group_id, kind, vendor_profile_id ON public.vendor_units
  FOR EACH ROW EXECUTE FUNCTION public.guard_vendor_unit_group();

DROP TRIGGER IF EXISTS vendor_unit_doors_guard_group ON public.vendor_unit_doors;
CREATE TRIGGER vendor_unit_doors_guard_group
  BEFORE INSERT OR UPDATE OF group_id, vendor_profile_id ON public.vendor_unit_doors
  FOR EACH ROW EXECUTE FUNCTION public.guard_vendor_unit_group();

-- ── 5 · RLS AT CREATE ───────────────────────────────────────────────────────
ALTER TABLE public.vendor_unit_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vendor_units       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vendor_unit_doors  ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.vendor_unit_groups FROM anon;
REVOKE ALL ON TABLE public.vendor_units       FROM anon;
REVOKE ALL ON TABLE public.vendor_unit_doors  FROM anon;

DROP POLICY IF EXISTS vendor_unit_groups_team_read ON public.vendor_unit_groups;
CREATE POLICY vendor_unit_groups_team_read ON public.vendor_unit_groups
  FOR SELECT TO authenticated
  USING ((SELECT public.is_admin()) OR vendor_profile_id IN (SELECT public.current_vendor_ids()));

DROP POLICY IF EXISTS vendor_unit_groups_team_write ON public.vendor_unit_groups;
CREATE POLICY vendor_unit_groups_team_write ON public.vendor_unit_groups
  FOR ALL TO authenticated
  USING (vendor_profile_id IN (SELECT public.current_vendor_ids('admin')))
  WITH CHECK (vendor_profile_id IN (SELECT public.current_vendor_ids('admin')));

DROP POLICY IF EXISTS vendor_units_team_read ON public.vendor_units;
CREATE POLICY vendor_units_team_read ON public.vendor_units
  FOR SELECT TO authenticated
  USING ((SELECT public.is_admin()) OR vendor_profile_id IN (SELECT public.current_vendor_ids()));

DROP POLICY IF EXISTS vendor_units_team_write ON public.vendor_units;
CREATE POLICY vendor_units_team_write ON public.vendor_units
  FOR ALL TO authenticated
  USING (vendor_profile_id IN (SELECT public.current_vendor_ids('admin')))
  WITH CHECK (vendor_profile_id IN (SELECT public.current_vendor_ids('admin')));

DROP POLICY IF EXISTS vendor_unit_doors_team_read ON public.vendor_unit_doors;
CREATE POLICY vendor_unit_doors_team_read ON public.vendor_unit_doors
  FOR SELECT TO authenticated
  USING ((SELECT public.is_admin()) OR vendor_profile_id IN (SELECT public.current_vendor_ids()));

DROP POLICY IF EXISTS vendor_unit_doors_team_write ON public.vendor_unit_doors;
CREATE POLICY vendor_unit_doors_team_write ON public.vendor_unit_doors
  FOR ALL TO authenticated
  USING (vendor_profile_id IN (SELECT public.current_vendor_ids('admin')))
  WITH CHECK (vendor_profile_id IN (SELECT public.current_vendor_ids('admin')));

COMMIT;
