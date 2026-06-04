-- =============================================================================
-- 20260817000000_event_monogram_style.sql
--
-- Iteration 0037 — Monogram lockups · persist the chosen STYLE
-- Repo: setnayan-platform · CHANGELOG 2026-06-04 "monogram → 5 live-typography
-- lockups" follow-up.
--
-- WHY: PR #960 replaced the 10 {frame·font·ink} monogram presets with 5 live
-- typographic lockups (bar · script · duo · framed · infinity). Onboarding only
-- persisted monogram_frame_key + monogram_font_key, so the chosen *style* was
-- thrown away — downstream surfaces (chrome switcher, future invitation / QR /
-- save-the-date) could not tell a "bar" lockup from an "infinity" one. This
-- column captures the style so the exact lockup can be re-rendered anywhere.
--
-- Schema philosophy: ADDITIVE + NULLABLE + idempotent (IF NOT EXISTS). Zero
-- impact on existing rows (they keep frame+font; resolveMonogramDesign() falls
-- back to frame+font matching when monogram_style IS NULL). Zero rollback risk.
-- =============================================================================

BEGIN;

ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS monogram_style TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'events_monogram_style_check'
  ) THEN
    ALTER TABLE public.events
      ADD CONSTRAINT events_monogram_style_check
      CHECK (monogram_style IS NULL OR monogram_style IN (
        'bar', 'script', 'duo', 'framed', 'infinity'
      ));
  END IF;
END$$;

COMMENT ON COLUMN public.events.monogram_style IS
  'Live-typography monogram lockup style chosen in onboarding (screen 4): bar · script · duo · framed · infinity. NULL for events onboarded before 2026-06-04 (the 10-preset era) — those fall back to monogram_frame_key + monogram_font_key. Mirrors MONO_DESIGNS in app/onboarding/wedding + lib/monogram.ts.';

COMMIT;

-- Verification:
--   SELECT column_name, data_type, is_nullable FROM information_schema.columns
--   WHERE table_schema='public' AND table_name='events' AND column_name='monogram_style';
--   -- Expect 1 row, text, is_nullable='YES'.
