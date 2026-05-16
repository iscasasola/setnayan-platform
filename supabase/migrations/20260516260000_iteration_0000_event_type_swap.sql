-- ============================================================================
-- Iteration 0000 — Event-type swap (locked 2026-05-16)
-- ============================================================================
-- Replaces the `public.event_type` enum so the visible-but-disabled tile list
-- on /dashboard/create-event matches the 2026-05-16 owner decision:
--
--   Before:  wedding · birthday · celebration · travel · corporate · burial
--   After:   wedding · birthday · celebration · travel · corporate · tournament · christening
--
-- Wedding remains the only value the V1 UI can insert (per iteration 0000
-- § 2.5). The other six values are reserved for future iterations and surface
-- as `Coming soon` tiles in the picker. `burial` is dropped because the owner
-- removed it from the visible roadmap — recreating the enum is the only way
-- to drop a value in Postgres.
--
-- Defensive: any existing rows with event_type='burial' are migrated to
-- 'celebration' before the type swap so the USING cast cannot fail. In
-- practice this should never fire because the V1 UI never inserts 'burial',
-- but we defend against ad-hoc SQL just in case.

DO $$
DECLARE
  burial_rows INT;
BEGIN
  -- ----------------------------------------------------------------------
  -- 1) Migrate any stray 'burial' rows to 'celebration'
  -- ----------------------------------------------------------------------
  SELECT COUNT(*) INTO burial_rows
  FROM public.events
  WHERE event_type::text = 'burial';

  IF burial_rows > 0 THEN
    RAISE NOTICE 'Migrating % burial event rows to celebration before enum swap', burial_rows;
    UPDATE public.events
       SET event_type = 'celebration'::public.event_type
     WHERE event_type::text = 'burial';
  END IF;
END $$;

-- ----------------------------------------------------------------------------
-- 2) Recreate the enum without 'burial', with 'tournament' + 'christening'
-- ----------------------------------------------------------------------------

ALTER TYPE public.event_type RENAME TO event_type_old;

CREATE TYPE public.event_type AS ENUM (
  'wedding',
  'birthday',
  'celebration',
  'travel',
  'corporate',
  'tournament',
  'christening'
);

-- ----------------------------------------------------------------------------
-- 3) Swap the events.event_type column over to the new enum
-- ----------------------------------------------------------------------------
-- The column default references the old type, so drop it before the cast and
-- restore it afterwards. The text-round-trip cast is the standard way to move
-- between two enums in Postgres.

ALTER TABLE public.events ALTER COLUMN event_type DROP DEFAULT;

ALTER TABLE public.events
  ALTER COLUMN event_type TYPE public.event_type
  USING event_type::text::public.event_type;

ALTER TABLE public.events
  ALTER COLUMN event_type SET DEFAULT 'wedding'::public.event_type;

-- ----------------------------------------------------------------------------
-- 4) Drop the now-orphaned old enum
-- ----------------------------------------------------------------------------

DROP TYPE public.event_type_old;
