-- ============================================================================
-- EVENT-TYPE SIZE AND CORE CATEGORIES (Find · Build · Book, Build 1 — owner 2026-11-17)
-- ============================================================================
--
-- Owner, 2026-11-17 (DECISION_LOG "STARTING GUEST COUNT WHEN THE HOST HAS NO NUMBER: SMALL 30 · MEDIUM 50 ·
-- LARGE (WEDDING) 150 — SHOWN AS THEIR MINIMUM, CHANGEABLE" and "Find·Build·Book open questions" Q4 — "core-category
-- list per event type, Admin-editable"); approved for this PR by the owner the same day ("Yes, all five", relayed by
-- the controller on PR #7920):
--
--   event_size       small · medium · large — the onboarding's starting guest number reads it
--                    (small 30 · medium 50 · large 150, `lib/event-size.ts`), worded as the minimum.
--   core_categories  the bench tiles a NEW event of this type starts with, each an empty category in Build
--                    (taxonomy `WeddingTile` keys, the keys the Suppliers bench already speaks).
--
-- 🔒 ONLY THE WEDDING IS SEEDED. Every other type stays NULL until somebody sets it in Admin › Categories
-- (owner: "leave every non-wedding type unset … No guessed numbers"). NULL means "not set", and each reader keeps
-- today's behaviour for it: no start number on the guest step, and the shipped starter ring on Suppliers.
-- ⛔ NOT `team_first`: that column is "the ordered first supplier suggestions" (8 for a wedding) — a different fact.
--
-- Wedding's five, in the owner's words "Venue, Ceremony, Catering, Coordinator and Photo & video", as tile keys:
-- venue = `reception`, ceremony = `ceremony_venue`.
--
-- RLS is unchanged: the table is public-read, is_admin() write (migration 20270220834284). Idempotent.
-- ============================================================================

ALTER TABLE public.event_type_profiles ADD COLUMN IF NOT EXISTS event_size TEXT;
ALTER TABLE public.event_type_profiles ADD COLUMN IF NOT EXISTS core_categories TEXT[];

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'event_type_profiles_event_size_check'
  ) THEN
    ALTER TABLE public.event_type_profiles
      ADD CONSTRAINT event_type_profiles_event_size_check
      CHECK (event_size IS NULL OR event_size IN ('small', 'medium', 'large'));
  END IF;
END $$;

COMMENT ON COLUMN public.event_type_profiles.event_size IS
  'small · medium · large — the onboarding guest step starts at 30 · 50 · 150 (worded as the minimum). NULL = not set: no start number. Admin-editable (Admin › Categories › event types). Owner 2026-11-17.';
COMMENT ON COLUMN public.event_type_profiles.core_categories IS
  'Bench tile keys (taxonomy WeddingTile) a NEW event of this type starts with, each an empty category in Build. NULL = not set: the shipped starter ring. Not team_first (suggestions). Owner 2026-11-17.';

UPDATE public.event_type_profiles SET
  event_size = 'large',
  core_categories = ARRAY['reception', 'ceremony_venue', 'catering', 'coordinator', 'photo_video']
WHERE event_type = 'wedding'
  AND event_size IS NULL
  AND core_categories IS NULL;
