-- Reception refinement leaf gets its own header photo.
-- Previously main_photo reused /onboarding/prefs/setting_ballroom.webp — the exact
-- file shown on the "Hotel ballroom" option card, making the category header
-- indistinguishable from one of its own options (2026-06-12 photo accuracy audit).
UPDATE public.onboarding_refinements
SET main_photo = '/onboarding/refinements/reception/_main.webp',
    updated_at = now()
WHERE tile_id = 'reception'
  AND main_photo = '/onboarding/prefs/setting_ballroom.webp';
