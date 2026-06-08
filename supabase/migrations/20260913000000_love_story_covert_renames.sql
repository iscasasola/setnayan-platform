-- ============================================================================
-- 20260913000000 · Love-story covert renames
-- ----------------------------------------------------------------------------
-- The wedding onboarding's LOVE STAGE writes the couple's told-back story into
-- events.love_story (JSONB) and the story voice/language into two columns that
-- the foundation migration (20260912000000) created as editorial_tone /
-- editorial_language. Those identifiers leak the hidden downstream reuse, so they
-- are renamed to the couple-facing-safe story_tone / story_language. The richer
-- v2 love-story fields (spark, obstacle*, proposal_voice/feel, anchors{}) all live
-- INSIDE the existing love_story JSONB — no new column is needed; we only document
-- the expanded shape.
--
-- COVERT: every couple-facing identifier is story-shaped. The internal
-- event_editorial.editorial_tone column is a downstream (non-couple-facing) field
-- and is intentionally left untouched.
--
-- Idempotent: every step is guarded so a re-run (or a prod where the rename already
-- landed) is a no-op. DO NOT APPLY blindly in this PR — applied in-session via
-- `supabase db push --db-url "$SUPABASE_DB_URL"`.
-- ============================================================================
BEGIN;

-- editorial_tone → story_tone (drop the old CHECK, rename, re-add CHECK)
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_name='events' AND column_name='editorial_tone') THEN
    ALTER TABLE public.events DROP CONSTRAINT IF EXISTS events_editorial_tone_check;
    ALTER TABLE public.events RENAME COLUMN editorial_tone TO story_tone;
    ALTER TABLE public.events ADD CONSTRAINT events_story_tone_check
      CHECK (story_tone IS NULL OR story_tone IN ('warm','playful','formal'));
  END IF;
END $$;

-- editorial_language → story_language
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_name='events' AND column_name='editorial_language') THEN
    ALTER TABLE public.events RENAME COLUMN editorial_language TO story_language;
  END IF;
END $$;

COMMENT ON COLUMN public.events.story_tone IS
  'Love-story voice (warm|playful|formal). Drives website story voice + hidden Editorial. Covert rename of editorial_tone. 2026-06-08.';
COMMENT ON COLUMN public.events.story_language IS
  'Love-story generation language (en|tl|ceb), silent-inherit. Covert rename of editorial_language. 2026-06-08.';
COMMENT ON COLUMN public.events.love_story IS
  'Expanded love-story JSONB. v1: how_we_met,met_year,together_since,proposal,proposal_setting,proposal_year. Redesign v2 keys: + spark,spark_why,spark_anchor,obstacle,obstacle_kind,obstacle_kept,proposal_voice,proposal_feel,milestones[],anchors{song,place,injoke,food}. 2026-06-08.';

COMMIT;
