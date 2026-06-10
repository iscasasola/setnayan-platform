-- =============================================================================
-- 20261111000000_event_monogram_motion.sql
--
-- Monogram Motion Library — persist the chosen animation SIGNATURE
-- Repo: setnayan-platform · Monogram premium-motion overhaul 2026-06-11.
--
-- WHY: the paid ANIMATED_MONOGRAM SKU shipped with a single hardcoded
-- stroke-trace draw-on — the same effect every template tool on the market
-- ships. The motion-library overhaul replaces that one effect with six
-- premium signatures (draw · foil · bloom · editorial · halo · stardust);
-- the couple picks one in the Monogram Maker and the landing-page hero plays
-- it (still gated by ANIMATED_MONOGRAM ownership — the orders table, not a
-- column). This column captures WHICH signature the couple chose.
--
-- Schema philosophy: ADDITIVE + NULLABLE + idempotent (IF NOT EXISTS) — the
-- exact pattern of 20260817000000_event_monogram_style.sql. NULL means "draw"
-- (the legacy stroke-trace), so every already-owned Animated Monogram keeps
-- rendering exactly as it did before this migration. Zero rollback risk.
-- =============================================================================

BEGIN;

ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS monogram_motion_key TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'events_monogram_motion_key_check'
  ) THEN
    ALTER TABLE public.events
      ADD CONSTRAINT events_monogram_motion_key_check
      CHECK (monogram_motion_key IS NULL OR monogram_motion_key IN (
        'draw', 'foil', 'bloom', 'editorial', 'halo', 'stardust'
      ));
  END IF;
END$$;

COMMENT ON COLUMN public.events.monogram_motion_key IS
  'Animated Monogram motion signature chosen in the Monogram Maker: draw (stroke-trace) · foil (gold sheen sweep) · bloom (ink blooms from center) · editorial (rise + tracking settle) · halo (ring sweep, letters fade up) · stardust (gold particles twinkle in). NULL = draw (pre-motion-library default). Render is still gated by ANIMATED_MONOGRAM order ownership (lib/animated-monogram.ts); this only selects WHICH animation plays. Mirrors MONOGRAM_MOTIONS in lib/monogram-motion.ts.';

COMMIT;

-- Verification:
--   SELECT column_name, data_type, is_nullable FROM information_schema.columns
--   WHERE table_schema='public' AND table_name='events' AND column_name='monogram_motion_key';
--   -- Expect 1 row, text, is_nullable='YES'.
