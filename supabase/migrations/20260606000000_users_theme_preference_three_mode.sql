-- ============================================================================
-- 2026-05-22 BRAND PIVOT — users.theme_preference goes from 5-theme ENUM to
-- 3-mode (Light / Dark / Auto), matching iOS.
--
-- WHY: Owner directive 2026-05-22 verbatim — "make our default color be like
-- facebook white and blue. and remove the personalization of colors. It will
-- be light, dark, auto. just like ios". App chrome flips to Facebook
-- white/blue; the 5-theme personalization picker (Setnayan Default · Victorian
-- · Classy · iOS · Forest Theme locked 2026-05-15 row 5) is retired. The
-- wedding landing page chrome is OUT OF SCOPE — that surface is driven by
-- the couple's mood-board palette per iteration 0010 and is not affected by
-- this migration.
--
-- STRATEGY (follows the canonical ENUM-swap pattern used in
-- 20260516260000_iteration_0000_event_type_swap.sql):
--   1. Stage canonical text values via a temp column with a CASE remap.
--   2. Rename the old ENUM type aside.
--   3. CREATE the new ENUM with the 3 canonical values.
--   4. Swap the column over (DROP typed column, ADD new typed column, backfill
--      from staging, SET DEFAULT, SET NOT NULL, DROP staging column).
--   5. DROP the legacy ENUM.
--
-- LEGACY VALUE REMAP:
--   setnayan_default  → light  (the V1 cream + ink + burgundy default; light
--                              feel maps to the Facebook white we're flipping to)
--   victorian         → light  (burgundy/parchment — light-feeling)
--   classy            → light  (warm white + champagne — light-feeling)
--   forest_champagne  → light  (warm off-cream + forest — light-feeling)
--   ios               → auto   (system grey + black + blue — already followed
--                              system preference in spirit; map to auto)
--
-- IDEMPOTENT: re-running detects the new enum (existence of 'auto') and
-- short-circuits. Safe to re-run.
-- ============================================================================

DO $$
BEGIN
  -- Short-circuit if the migration has already run. We detect the new
  -- 3-mode shape by checking for the 'auto' value on the live enum.
  IF EXISTS (
    SELECT 1 FROM pg_type t
    JOIN pg_enum e ON e.enumtypid = t.oid
    WHERE t.typname = 'theme_preference' AND e.enumlabel = 'auto'
  ) THEN
    RAISE NOTICE 'theme_preference already migrated to 3-mode — skipping';
    RETURN;
  END IF;

  -- 1. Stage canonical text values. Defensive: if a row holds a value not
  --    present in the legacy enum (shouldn't happen but cheap to guard),
  --    fall back to 'light'.
  ALTER TABLE public.users
    ADD COLUMN IF NOT EXISTS theme_preference_staging TEXT;

  UPDATE public.users
  SET theme_preference_staging = CASE theme_preference::text
    WHEN 'ios' THEN 'auto'
    WHEN 'setnayan_default' THEN 'light'
    WHEN 'victorian' THEN 'light'
    WHEN 'classy' THEN 'light'
    WHEN 'forest_champagne' THEN 'light'
    ELSE 'light'
  END;

  -- 2. Rename legacy enum aside (don't drop yet — column still depends on it).
  ALTER TYPE public.theme_preference RENAME TO theme_preference_legacy_20260606;

  -- 3. Create the new 3-mode enum.
  CREATE TYPE public.theme_preference AS ENUM ('light', 'dark', 'auto');

  -- 4. Swap the column.
  ALTER TABLE public.users DROP COLUMN theme_preference;
  ALTER TABLE public.users
    ADD COLUMN theme_preference public.theme_preference;

  UPDATE public.users
  SET theme_preference = theme_preference_staging::public.theme_preference;

  ALTER TABLE public.users
    ALTER COLUMN theme_preference SET DEFAULT 'auto';
  ALTER TABLE public.users
    ALTER COLUMN theme_preference SET NOT NULL;

  ALTER TABLE public.users DROP COLUMN theme_preference_staging;

  -- 5. Drop the legacy enum.
  DROP TYPE public.theme_preference_legacy_20260606;

  RAISE NOTICE 'theme_preference migrated to 3-mode (light/dark/auto)';
END $$;
