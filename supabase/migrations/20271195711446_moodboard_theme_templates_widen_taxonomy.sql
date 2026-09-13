-- WIDEN moodboard_theme_templates.style_family AND .mood_tag — 5→10 style
-- families, 6→10 mood tags (owner directive: 10×10 taxonomy, ≥25 themes per
-- combination, procedurally generated — see 20271196372720's seed and
-- apps/web/lib/moodboard-theme-generator.ts).
--
-- Purely additive on both axes: the original 5 style_family strings and 6
-- mood_tag strings are kept verbatim (existing rows from 20271194462267 stay
-- valid), only new values are appended to each IN-list. Per house style
-- (20271194900000 widened event_inspiration_assets.slot_key the same way):
-- DROP the old-named constraint, DROP any existing _v2 (idempotent re-run),
-- ADD a _v2 with the wider IN-list.

ALTER TABLE public.moodboard_theme_templates
  DROP CONSTRAINT IF EXISTS moodboard_theme_templates_style_family_check;
ALTER TABLE public.moodboard_theme_templates
  DROP CONSTRAINT IF EXISTS moodboard_theme_templates_style_family_check_v2;
ALTER TABLE public.moodboard_theme_templates
  ADD CONSTRAINT moodboard_theme_templates_style_family_check_v2
  CHECK (
    style_family IN (
      -- original 5
      'elegant · simple · classic',
      'bridgerton · regal',
      'editorial cream',
      'tropical heritage',
      'modern minimalist',
      -- new 5 (2026-09-03 taxonomy expansion)
      'boho beach',
      'vintage ilustrado',
      'industrial loft',
      'moody garden',
      'destination resort'
    )
  );

ALTER TABLE public.moodboard_theme_templates
  DROP CONSTRAINT IF EXISTS moodboard_theme_templates_mood_tag_check;
ALTER TABLE public.moodboard_theme_templates
  DROP CONSTRAINT IF EXISTS moodboard_theme_templates_mood_tag_check_v2;
ALTER TABLE public.moodboard_theme_templates
  ADD CONSTRAINT moodboard_theme_templates_mood_tag_check_v2
  CHECK (
    mood_tag IN (
      -- original 6
      'whimsical_storybook',
      'minimalist',
      'dark_moody',
      'bold_contrasting',
      'simple_understated',
      'maximalist_complex',
      -- new 4 (2026-09-03 taxonomy expansion)
      'romantic_ethereal',
      'nostalgic_vintage',
      'glam_luxurious',
      'organic_natural'
    )
  );
