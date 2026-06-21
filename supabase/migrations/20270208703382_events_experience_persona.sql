-- Experience-persona onboarding (iteration 0016 · the experience-first reorientation).
--
-- Adds the couple's resolved EXPERIENCE PROFILE to events. The onboarding shifts
-- from "which vendors do you need?" to "what experience do you want to create?" —
-- a 5-axis quiz resolves to a named persona that DERIVES the couple's vendor
-- categories + in-app Setnayan services + style refinements (which the existing
-- deterministic matcher already consumes via style_preferences.refinements).
--
-- All columns are ADDITIVE + NULLABLE + backfill-free + IDEMPOTENT. events already
-- has RLS enabled with policies that cover the whole row, so an ALTER ADD COLUMN
-- needs no new policy. Existing rows keep NULL persona / '{}' axes — harmless.
--
--   experience_for_whom — the genuinely-new axis: who the day is memorable FOR.
--     'couple'  → the couple's own keepsake (film, song, monogram)
--     'guests'  → the guest experience (livestream, photo wall, entertainment)
--     'both'    → balanced. The matcher + admin can read this to weight
--     couple-memory vs guest-experience services.
--   experience_persona — the resolved named persona slug (keepsake /
--     big_celebration / best_of_both / intimate_romance / modern_statement /
--     rooted_tradition). Drives the derived plan; admin can re-tune the mapping.
--   experience_axes — the raw 5-axis answers {for_whom,feel,energy,roots,effort}
--     as JSONB, so the persona can be re-derived / audited and the admin mapping
--     can evolve without losing the couple's original intent.

ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS experience_for_whom text
    CHECK (experience_for_whom IS NULL OR experience_for_whom IN ('couple', 'guests', 'both')),
  ADD COLUMN IF NOT EXISTS experience_persona text,
  ADD COLUMN IF NOT EXISTS experience_axes jsonb NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.events.experience_for_whom IS
  'Onboarding experience axis — who the wedding is memorable for: couple | guests | both (0016 experience-persona reorientation).';
COMMENT ON COLUMN public.events.experience_persona IS
  'Onboarding-resolved experience persona slug — derives interested categories + in-app services + refinement seeds (0016).';
COMMENT ON COLUMN public.events.experience_axes IS
  'Raw 5-axis experience-quiz answers {for_whom,feel,energy,roots,effort} — source for re-deriving the persona + admin tuning (0016).';
