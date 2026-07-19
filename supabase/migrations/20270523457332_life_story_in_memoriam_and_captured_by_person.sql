-- life story in memoriam and captured by person
-- Created via `pnpm migration:new`. Prefix auto-allocated to sort AFTER every
-- existing migration. KEEP THIS MIGRATION IDEMPOTENT (it may be re-applied):
--   • CREATE TABLE IF NOT EXISTS …   (+ ALTER TABLE … ENABLE ROW LEVEL SECURITY in the SAME migration)
--   • ALTER TABLE … ADD COLUMN IF NOT EXISTS …
--   • CREATE INDEX IF NOT EXISTS …
--   • CREATE OR REPLACE FUNCTION …
--   • DROP POLICY IF EXISTS … ; CREATE POLICY …   (policies have no IF NOT EXISTS)

-- ============================================================================
-- LIFE STORY · Phase 1 (own-events, ship-live) — two minimal, additive columns
-- that light up the two signature beats of the "living memorial of your
-- celebrations" experience. Reframe owner-locked 2026-07-08 ("make it while
-- they're alive, not for when they die"). Strategy:
--   ~/Documents/Claude/Projects/Setnayan/03_Strategy/Life_Story_Strategy_2026-07-08.md
--
-- Additive + idempotent. RLS on both tables is UNCHANGED — these columns ride
-- inside the existing people / papic_photos policies (a photo's capturer sees
-- and edits nothing new; the couple/admin scope is untouched).
--
-- WHAT THIS ADDS:
--   1. people.in_memoriam            — drives the OPT-IN ✦ "held beat". A person
--      is only ever surfaced in-memoriam when the user opts in; never a surprise,
--      never an "on this day" grief nudge (ethics guardrail, strategy §6).
--      Adults-first; full memorialisation remains a later, counsel-gated phase.
--   2. papic_photos.captured_by_person_id — normalized "whose camera shot this
--      frame", so the within-event perspective-shift ("this is how Bea saw that
--      day") resolves in ONE hop instead of the lossy 3-hop
--      seat → claimer_user_id → people chain at read time.
--
-- CAPTUREDBY IS NOT FACE-DERIVED. It is resolved purely from the seat claim
-- (paparazzi_seats.claimer_user_id → people.claimed_by_user_id) — never from
-- face recognition (project_setnayan_face_recognition_boundary). Nullable:
-- unclaimed / ephemeral seats, or a claimer with no claimed person node, stay
-- NULL by design.
-- ============================================================================

BEGIN;

-- 1. people.in_memoriam ------------------------------------------------------
ALTER TABLE public.people
  ADD COLUMN IF NOT EXISTS in_memoriam BOOLEAN NOT NULL DEFAULT FALSE;

COMMENT ON COLUMN public.people.in_memoriam IS
  'Life Story: this person is remembered (in memoriam). Drives the OPT-IN ✦ held-beat only — never an unsolicited surprise/notification/"on this day" nudge (strategy §6). Adults-first; full memorialisation is a later counsel-gated phase.';

-- 2. papic_photos.captured_by_person_id --------------------------------------
ALTER TABLE public.papic_photos
  ADD COLUMN IF NOT EXISTS captured_by_person_id UUID
    REFERENCES public.people(person_id) ON DELETE SET NULL;

COMMENT ON COLUMN public.papic_photos.captured_by_person_id IS
  'Life Story: normalized capturer identity (whose camera shot this frame), resolved from paparazzi_seats.claimer_user_id → people.claimed_by_user_id. Powers the within-event perspective-shift. NOT face-derived; nullable for unclaimed/ephemeral seats.';

-- Partial index: the perspective-shift read groups a person's own-event frames
-- by capturer; only non-null rows are of interest.
CREATE INDEX IF NOT EXISTS papic_photos_captured_by_person_idx
  ON public.papic_photos (captured_by_person_id)
  WHERE captured_by_person_id IS NOT NULL;

-- 3. Backfill existing photos ------------------------------------------------
-- Resolve capturer for already-captured frames via seat → claimer → person.
-- people.claimed_by_user_id is UNIQUE (one account claims ≤1 person) and holds
-- the auth.uid(); paparazzi_seats.claimer_user_id references auth.users(id) —
-- same id space (proven by both tables' RLS keying on auth.uid()), so the join
-- is direct and one-to-one, no fan-out. Only fills rows still NULL, so re-runs
-- never clobber a value the app has since set (idempotent).
UPDATE public.papic_photos AS ph
SET captured_by_person_id = pe.person_id
FROM public.paparazzi_seats AS s
JOIN public.people AS pe
  ON pe.claimed_by_user_id = s.claimer_user_id
WHERE ph.paparazzi_seat_id = s.seat_id
  AND s.claimer_user_id IS NOT NULL
  AND ph.captured_by_person_id IS NULL;

COMMIT;
