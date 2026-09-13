-- WIDEN moodboard_theme_templates.mood_tag — 10 → 11 moods, adding
-- `festive_celebratory` ("Festive & Celebratory").
--
-- WHY AN ELEVENTH MOOD, and why it is not a synonym for one of the ten: all
-- ten existing moods are aesthetic REGISTER (how polished, how dark, how
-- ornate — dark_moody, romantic_ethereal, minimalist, glam_luxurious …).
-- Not one of them expresses OCCASION ENERGY, i.e. whether the day is a party.
-- The owner typed "i want to feel christmas vibe with a hint of classy
-- elegance" into events.moodboard_theme_description and the first half of
-- that sentence had nowhere in the taxonomy to land.
--
-- Measured across all 2,600 rows of this table before adding it:
--   christmas 0 · pasko 0 · parol 0 · evergreen 0 · poinsettia 0
--   (against capiz 1,125 and gold 1,299)
-- Re-measure with:
--   select count(*) from moodboard_theme_templates
--    where name ilike '%christmas%' or description ilike '%christmas%';
--
-- ⚠ THIS MIGRATION ADDS A MOOD, NOT ANY ROWS. `festive_celebratory` ships
-- with ZERO themes behind it; regenerating the 2,500 seeded rows to populate
-- it is a separate owner decision (it would rewrite the committed seed
-- migration 20271196372720 and every count the unit tests assert against).
-- apps/web/lib/moodboard-theme-generator.ts therefore keeps its own
-- GENERATED_MOOD_TAGS list at the ten it actually generated, and the gallery
-- says "no themes carry this feeling yet" instead of drawing an empty grid.
--
-- Purely additive, and the house widening idiom exactly as 20271195711446 did
-- it (which in turn followed 20271194900000): DROP the old-named constraint,
-- DROP any existing next-version name so a re-run is idempotent, ADD the
-- wider one under a new _vN name. Every existing row stays valid — the ten
-- original strings are reproduced verbatim.

ALTER TABLE public.moodboard_theme_templates
  DROP CONSTRAINT IF EXISTS moodboard_theme_templates_mood_tag_check;
ALTER TABLE public.moodboard_theme_templates
  DROP CONSTRAINT IF EXISTS moodboard_theme_templates_mood_tag_check_v2;
ALTER TABLE public.moodboard_theme_templates
  DROP CONSTRAINT IF EXISTS moodboard_theme_templates_mood_tag_check_v3;
ALTER TABLE public.moodboard_theme_templates
  ADD CONSTRAINT moodboard_theme_templates_mood_tag_check_v3
  CHECK (
    mood_tag IN (
      -- original 6
      'whimsical_storybook',
      'minimalist',
      'dark_moody',
      'bold_contrasting',
      'simple_understated',
      'maximalist_complex',
      -- +4 (2026-09-03 taxonomy expansion, 20271195711446)
      'romantic_ethereal',
      'nostalgic_vintage',
      'glam_luxurious',
      'organic_natural',
      -- +1 (2026-09-03, occasion energy — see the header)
      'festive_celebratory'
    )
  );
