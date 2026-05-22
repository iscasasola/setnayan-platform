-- ============================================================================
-- Iteration 0008 — Seating table-type enum realignment to locked 2026-05-09 spec
-- ============================================================================
-- The original 2026-05-13 seating migration shipped 13 enum entries but they
-- were the WRONG 13 — the author baked in `rectangle_*`, `long_12/16`,
-- `head_table`, `crescent_*`, and `custom` instead of the canonical
-- `long_banquet_*`, `family_head_12/14/16`, and `serpentine_6/12/18` locked
-- in the 2026-05-09 CLAUDE.md decision-log row (see § "0008 Seating Chart
-- table catalog locked at 13 entries" and the same-day "0008 serpentine
-- geometry locked" refinement).
--
-- Discovered 2026-05-22 when the owner spotted the missing serpentines in
-- the live UI's table-shape picker on www.setnayan.com.
--
-- Owner chose Full alignment (vs. Surgical add-serpentines-only). This
-- migration:
--   1. Removes 4 non-spec entries (head_table, crescent_8, crescent_10, custom)
--   2. Renames 5 entries (rectangle_* → long_banquet_*, long_12/16 → family_head_12/16)
--   3. Adds 4 new entries (family_head_14, serpentine_6, serpentine_12, serpentine_18)
--
-- End state: 13 canonical entries. UI catalog + rendering layer ship in the
-- same PR.
--
-- Existing-row remapping (defensive; pilot data is near-empty as of 2026-05-22
-- per CLAUDE.md decision-log row 8 "pilot-before-June-1"):
--   rectangle_6/8/10   → long_banquet_6/8/10
--   long_12            → family_head_12
--   long_16            → family_head_16
--   head_table         → family_head_14   (variable-capacity → default 14-seat family head)
--   crescent_8         → round_8          (closest spec fallback; no crescent in V1)
--   crescent_10        → round_10         (closest spec fallback)
--   custom             → round_8          (generic fallback; custom shapes deferred V1.1)
--
-- Enum-swap pattern follows the 2026-05-16 event_type_swap migration
-- (`20260516260000_iteration_0000_event_type_swap.sql`), adapted with a
-- temp-text staging column because the new enum's value set is mostly
-- disjoint from the old set — a plain `column::text::new_type` cast would
-- fail on rectangle_*, long_12/16, head_table, crescent_*, and custom rows.
--
-- Idempotent: re-running on an already-canonical schema is a no-op via the
-- DO-block guard around the enum existence check.
-- ============================================================================

BEGIN;

DO $$
DECLARE
  needs_swap BOOLEAN;
BEGIN
  -- Idempotency guard: only run if the legacy values are still present in the enum.
  -- If 'rectangle_6' (a canary value from the 2026-05-13 drift set) is not in the
  -- current enum, the swap has already been done and this migration is a no-op.
  SELECT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_enum e ON e.enumtypid = t.oid
    WHERE t.typname = 'table_type'
      AND e.enumlabel = 'rectangle_6'
  ) INTO needs_swap;

  IF NOT needs_swap THEN
    RAISE NOTICE 'table_type enum already realigned; skipping migration.';
    RETURN;
  END IF;

  -- --------------------------------------------------------------------------
  -- Step 1: Stage canonical text values via a temp column.
  -- We can't UPDATE the enum column to new strings directly because the new
  -- strings don't exist in the current enum.
  -- --------------------------------------------------------------------------
  ALTER TABLE public.event_tables ADD COLUMN IF NOT EXISTS table_type_v2_staging TEXT;

  UPDATE public.event_tables SET table_type_v2_staging = CASE table_type::text
    WHEN 'round_8'      THEN 'round_8'
    WHEN 'round_10'     THEN 'round_10'
    WHEN 'round_12'     THEN 'round_12'
    WHEN 'rectangle_6'  THEN 'long_banquet_6'
    WHEN 'rectangle_8'  THEN 'long_banquet_8'
    WHEN 'rectangle_10' THEN 'long_banquet_10'
    WHEN 'long_12'      THEN 'family_head_12'
    WHEN 'long_16'      THEN 'family_head_16'
    WHEN 'sweetheart_2' THEN 'sweetheart_2'
    WHEN 'head_table'   THEN 'family_head_14'
    WHEN 'crescent_8'   THEN 'round_8'
    WHEN 'crescent_10'  THEN 'round_10'
    WHEN 'custom'       THEN 'round_8'
    ELSE 'round_8'  -- defensive: any unknown value gets the safest fallback
  END;

  -- --------------------------------------------------------------------------
  -- Step 2: Rename the old enum out of the way.
  -- --------------------------------------------------------------------------
  ALTER TYPE public.table_type RENAME TO table_type_legacy_20260513;

  -- --------------------------------------------------------------------------
  -- Step 3: Create the canonical enum (13 entries per 2026-05-09 lock).
  -- --------------------------------------------------------------------------
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
    'serpentine_6',
    'serpentine_12',
    'serpentine_18'
  );

  -- --------------------------------------------------------------------------
  -- Step 4: Drop the legacy-typed column, add the new canonical-typed column.
  -- DROP first to release the legacy enum reference cleanly; ADD second so the
  -- staging values can be backfilled in step 5.
  -- --------------------------------------------------------------------------
  ALTER TABLE public.event_tables DROP COLUMN table_type;
  ALTER TABLE public.event_tables ADD COLUMN table_type public.table_type;

  -- --------------------------------------------------------------------------
  -- Step 5: Backfill the new column from the text staging column.
  -- --------------------------------------------------------------------------
  UPDATE public.event_tables
     SET table_type = table_type_v2_staging::public.table_type;

  -- --------------------------------------------------------------------------
  -- Step 6: Restore the NOT NULL constraint (matches the original schema).
  -- --------------------------------------------------------------------------
  ALTER TABLE public.event_tables ALTER COLUMN table_type SET NOT NULL;

  -- --------------------------------------------------------------------------
  -- Step 7: Drop the staging column.
  -- --------------------------------------------------------------------------
  ALTER TABLE public.event_tables DROP COLUMN table_type_v2_staging;

  -- --------------------------------------------------------------------------
  -- Step 8: Drop the legacy enum (no longer referenced anywhere).
  -- --------------------------------------------------------------------------
  DROP TYPE public.table_type_legacy_20260513;
END $$;

COMMIT;
