-- events_std_reveal_effects
-- Created via `pnpm migration:new`. Prefix auto-allocated to sort AFTER every
-- existing migration. KEEP THIS MIGRATION IDEMPOTENT (it may be re-applied):
--   • CREATE TABLE IF NOT EXISTS …   (+ ALTER TABLE … ENABLE ROW LEVEL SECURITY in the SAME migration)
--   • ALTER TABLE … ADD COLUMN IF NOT EXISTS …
--   • CREATE INDEX IF NOT EXISTS …
--   • CREATE OR REPLACE FUNCTION …
--   • DROP POLICY IF EXISTS … ; CREATE POLICY …   (policies have no IF NOT EXISTS)

-- Per-event Save-the-Date reveal EFFECT toggles (owner 2026-06-18). Couple-facing
-- decorative effects on the opening: { "butterflies": bool, "petals": bool }.
--   butterflies → envelope openings (four-flap / two-flap-*)
--   petals      → church doors + sheer veil
-- NULL → app defaults (resolveRevealEffects: butterflies off, petals on). No RLS
-- change needed — events already has couple_can_update_event (write) +
-- current_event_ids() (select). Length-capped like wax_seal_config.
ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS std_reveal_effects JSONB;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'events_std_reveal_effects_len'
  ) THEN
    ALTER TABLE public.events
      ADD CONSTRAINT events_std_reveal_effects_len
      CHECK (std_reveal_effects IS NULL OR length(std_reveal_effects::text) <= 256);
  END IF;
END $$;

COMMENT ON COLUMN public.events.std_reveal_effects IS
  'Save-the-Date reveal effect toggles {butterflies,petals}; NULL = app defaults (butterflies off, petals on). butterflies→envelopes, petals→doors+veil.';
