-- std_theme_remap_to_five_set
-- Created via `pnpm migration:new`. Prefix auto-allocated to sort AFTER every
-- existing migration. KEEP THIS MIGRATION IDEMPOTENT (it may be re-applied):
--   • CREATE TABLE IF NOT EXISTS …   (+ ALTER TABLE … ENABLE ROW LEVEL SECURITY in the SAME migration)
--   • ALTER TABLE … ADD COLUMN IF NOT EXISTS …
--   • CREATE INDEX IF NOT EXISTS …
--   • CREATE OR REPLACE FUNCTION …
--   • DROP POLICY IF EXISTS … ; CREATE POLICY …   (policies have no IF NOT EXISTS)

-- Save-the-Date film themes trimmed from 10 → 5 (Default · Mood Board · Heritage
-- · Noir · Botanical), per owner 2026-06-18. 'editorial' was renamed to 'default'
-- (same clean palette); the five niche themes (blush/midnight/coastal/sunset/plum)
-- were removed. Remap any saved events.std_theme so no wedding silently resets:
--   editorial → default (pure rename — palette preserved)
--   blush/midnight/coastal/sunset/plum → moodboard (the warm safe default)
-- NULL rows are left untouched (they already resolve to 'moodboard').
-- Idempotent: re-running only touches rows still holding a retired id.

UPDATE public.events SET std_theme = 'default'
  WHERE std_theme = 'editorial';

UPDATE public.events SET std_theme = 'moodboard'
  WHERE std_theme IN ('blush', 'midnight', 'coastal', 'sunset', 'plum');
