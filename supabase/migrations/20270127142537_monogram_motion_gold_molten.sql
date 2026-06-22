-- =============================================================================
-- 20270127142537_monogram_motion_gold_molten.sql
--
-- Monogram Motion Library — add GOLD TURN + MOLTEN GOLD signatures
-- Repo: setnayan-platform · owner 2026-06-22 "this is monogram animation".
--
-- WHY: the gold "monogram turn" (CSS) and the molten-gold (WebGL) effects were
-- first shipped as Save-the-Date *reveal openings*. The owner clarified they are
-- MONOGRAM ANIMATIONS, chosen from the Monogram editor's Animate side — so they
-- join the 6-key motion library (draw·foil·bloom·editorial·halo·stardust) as two
-- new keys and leave the reveal-opening registry entirely.
--
-- Two changes, both additive + idempotent:
--   1. Widen events_monogram_motion_key_check to allow 'gold' + 'molten'.
--   2. Backfill: any event whose std_reveal_template still points at the removed
--      'gold-monogram'/'molten-monogram' openings → NULL (house default). The app
--      coerces unknown templates to the default anyway, but this clears stale rows
--      so admin/enumeration surfaces stay consistent.
-- =============================================================================

BEGIN;

-- 1 · widen the motion-key CHECK to the 8-key library (drop + re-add).
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'events_monogram_motion_key_check'
  ) THEN
    ALTER TABLE public.events DROP CONSTRAINT events_monogram_motion_key_check;
  END IF;

  ALTER TABLE public.events
    ADD CONSTRAINT events_monogram_motion_key_check
    CHECK (monogram_motion_key IS NULL OR monogram_motion_key IN (
      'draw', 'foil', 'bloom', 'editorial', 'halo', 'stardust', 'gold', 'molten'
    ));
END$$;

COMMENT ON COLUMN public.events.monogram_motion_key IS
  'Animated Monogram motion signature chosen in the Monogram editor: draw · foil · bloom · editorial · halo · stardust · gold (flowing-gold turn, CSS) · molten (molten metal floods the mark then hardens to gold, WebGL). NULL = draw (pre-motion-library default). Render is gated by ANIMATED_MONOGRAM order ownership (lib/animated-monogram.ts); this only selects WHICH animation plays. Mirrors MONOGRAM_MOTIONS in lib/monogram-motion.ts.';

-- 2 · clear events that still reference the retired gold/molten reveal OPENINGS.
UPDATE public.events
   SET std_reveal_template = NULL
 WHERE std_reveal_template IN ('gold-monogram', 'molten-monogram');

COMMIT;

-- Verification:
--   SELECT conname, pg_get_constraintdef(oid) FROM pg_constraint
--   WHERE conname='events_monogram_motion_key_check';
--   -- Expect the 8-value IN list.
--   SELECT count(*) FROM public.events
--   WHERE std_reveal_template IN ('gold-monogram','molten-monogram');  -- Expect 0.
