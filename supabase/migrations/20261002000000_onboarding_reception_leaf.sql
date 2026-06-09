-- ============================================================================
-- 20261002000000_onboarding_reception_leaf.sql
--
-- Folds the onboarding "reception_setting" screen ("What setting do you love?")
-- into the DB-backed refinement catalogue (onboarding_refinements +
-- onboarding_refinement_options, migration 20260927000001). It was the last
-- hardcoded holdout (the RECEPTION_SETTINGS const in onboarding-shell.tsx);
-- now it renders from the same admin-editable taxonomy data + the uniform
-- RefineStep template like every other "what kind of X?" screen (owner 2026-06-09).
--
-- The option keys are PRESERVED as `setting_*` — they're load-bearing: the find
-- screen's matchReceptionVenues engine + the recap read prefs.reception keyed on
-- exactly these. Photos reuse the existing /onboarding/prefs/setting_*.webp assets.
-- sort_order=-1 keeps `reception` ahead of the catalogue + out of the refine queue.
--
-- Mirrors app/onboarding/wedding/_data/refinements.ts (the seed source + behaviour-
-- preserving fallback). Idempotent: ON CONFLICT … DO UPDATE keeps the DB in sync.
-- ============================================================================

BEGIN;

INSERT INTO public.onboarding_refinements (leaf_key,label_en,description_en,main_photo,is_dynamic_ceremony,sort_order) VALUES
('reception','Reception venue','Where your celebration happens — the dinner, the program, and the dancing.','/onboarding/prefs/setting_ballroom.webp',FALSE,-1)
ON CONFLICT (leaf_key) DO UPDATE SET label_en=EXCLUDED.label_en, description_en=EXCLUDED.description_en, main_photo=EXCLUDED.main_photo, is_dynamic_ceremony=EXCLUDED.is_dynamic_ceremony, sort_order=EXCLUDED.sort_order, updated_at=now();

INSERT INTO public.onboarding_refinement_options (leaf_key,option_key,emoji,label_en,photo,sort_order) VALUES
('reception','setting_ballroom','✨','Hotel ballroom','/onboarding/prefs/setting_ballroom.webp',0),
('reception','setting_events_place','🎪','Events place','/onboarding/prefs/setting_events_place.webp',1),
('reception','setting_heritage','🏛️','Heritage','/onboarding/prefs/setting_heritage.webp',2),
('reception','setting_restaurant','🍽️','Restaurant','/onboarding/prefs/setting_restaurant.webp',3),
('reception','setting_garden','🌿','Garden','/onboarding/prefs/setting_garden.webp',4),
('reception','setting_beach','🏖️','Beach','/onboarding/prefs/setting_beach.webp',5),
('reception','setting_resort','🌴','Resort / destination','/onboarding/prefs/setting_resort.webp',6)
ON CONFLICT (leaf_key,option_key) DO UPDATE SET emoji=EXCLUDED.emoji, label_en=EXCLUDED.label_en, photo=EXCLUDED.photo, sort_order=EXCLUDED.sort_order, updated_at=now();

COMMIT;
