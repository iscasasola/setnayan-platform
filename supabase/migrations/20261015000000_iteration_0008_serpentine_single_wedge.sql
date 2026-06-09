-- ============================================================================
-- Iteration 0008 — Serpentine becomes a single quarter-donut wedge
-- ============================================================================
-- Owner direction 2026-06-09: a serpentine table is ONE quarter-donut wedge
-- seating up to 5 (≤3 outer + ≤2 inner), chained + rotated to build S-curves /
-- circles / ovals — NOT the old multi-segment `serpentine_6/12/18` presets
-- (which assumed 6 seats per segment). This supersedes the 2026-05-09 "6 per
-- segment (4 outer + 2 inner)" lock with "≤5 per wedge (≤3 outer + ≤2 inner)".
--
-- The TS catalog now offers a single `serpentine` type (default 5 seats). This
-- migration swaps the `table_type` enum to drop `serpentine_6/12/18` and add
-- `serpentine`, and remaps existing rows:
--   serpentine_6/12/18 → serpentine   (capacity clamped to 5; seat assignments
--                                       at seat_number >= 5 are unseated)
--   all other values   → unchanged
--
-- ⚠ Destructive backfill: clamps any existing serpentine table to 5 seats and
-- unseats overflow guests. Risk is low (founder-only marketplace + test data),
-- flagged for owner awareness in the PR.
--
-- Enum-swap pattern mirrors 20260603200000_iteration_0008_seating_catalog_
-- realignment.sql (staging text column → rename old enum → create new enum →
-- swap column → backfill → drop staging → drop legacy). Transaction-safe: no
-- "unsafe use of newly added enum value in the same transaction" hazard because
-- the new enum is created fresh and the column is repopulated from text.
--
-- Idempotent: a DO-block guard skips the swap if `serpentine_6` is already gone.
-- ============================================================================

BEGIN;

-- Step 0 (runs while the legacy enum values still exist): clamp the old
-- multi-segment serpentines to a single wedge's capacity and unseat overflow.
DELETE FROM public.event_seat_assignments a
  USING public.event_tables t
 WHERE a.table_id = t.table_id
   AND t.table_type::text IN ('serpentine_6', 'serpentine_12', 'serpentine_18')
   AND a.seat_number >= 5;

UPDATE public.event_tables
   SET capacity = LEAST(capacity, 5)
 WHERE table_type::text IN ('serpentine_6', 'serpentine_12', 'serpentine_18');

DO $$
DECLARE
  needs_swap BOOLEAN;
BEGIN
  -- Idempotency guard: only run if the legacy `serpentine_6` value is still present.
  SELECT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_enum e ON e.enumtypid = t.oid
    WHERE t.typname = 'table_type'
      AND e.enumlabel = 'serpentine_6'
  ) INTO needs_swap;

  IF NOT needs_swap THEN
    RAISE NOTICE 'table_type enum already on single-wedge serpentine; skipping.';
    RETURN;
  END IF;

  -- Step 1: Stage canonical text values via a temp column (the new `serpentine`
  -- value doesn't exist in the current enum, so we can't UPDATE to it directly).
  ALTER TABLE public.event_tables ADD COLUMN IF NOT EXISTS table_type_v3_staging TEXT;

  UPDATE public.event_tables SET table_type_v3_staging = CASE table_type::text
    WHEN 'serpentine_6'  THEN 'serpentine'
    WHEN 'serpentine_12' THEN 'serpentine'
    WHEN 'serpentine_18' THEN 'serpentine'
    ELSE table_type::text  -- the 10 round/banquet/family/sweetheart values are unchanged
  END;

  -- Step 2: Rename the old enum out of the way.
  ALTER TYPE public.table_type RENAME TO table_type_legacy_20260609;

  -- Step 3: Create the canonical enum (11 entries: single `serpentine`).
  CREATE TYPE public.table_type AS ENUM (
    'round_8',
    'round_10',
    'round_12',
    'long_banquet_6',
    'long_banquet_8',
    'long_banquet_10',
    'family_head_12',
    'family_head_14',
    'family_head_16',
    'sweetheart_2',
    'serpentine'
  );

  -- Step 4: Drop the legacy-typed column, add the new canonical-typed column.
  ALTER TABLE public.event_tables DROP COLUMN table_type;
  ALTER TABLE public.event_tables ADD COLUMN table_type public.table_type;

  -- Step 5: Backfill the new column from the text staging column.
  UPDATE public.event_tables
     SET table_type = table_type_v3_staging::public.table_type;

  -- Step 6: Restore NOT NULL.
  ALTER TABLE public.event_tables ALTER COLUMN table_type SET NOT NULL;

  -- Step 7: Drop the staging column.
  ALTER TABLE public.event_tables DROP COLUMN table_type_v3_staging;

  -- Step 8: Drop the legacy enum (no longer referenced).
  DROP TYPE public.table_type_legacy_20260609;
END $$;

COMMIT;
