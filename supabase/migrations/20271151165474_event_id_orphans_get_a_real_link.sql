-- ============================================================================
-- TWO TABLES POINT AT EVENTS WITH NOTHING HOLDING THE POINTER.
--
-- `event_software_activations_v2.event_id` and `couple_briefs.event_id` are
-- plain uuid columns with NO foreign key. Deleting an event therefore does
-- nothing to them: the row stays, holding the id of a celebration that no
-- longer exists. Nothing errors, nothing cascades, nothing is set null — the
-- only symptom is a pointer to nowhere.
--
-- Measured in production 2026-08-21: **17 orphan rows already exist** in
-- `event_software_activations_v2`, and the owner's own delete on 2026-08-20
-- added to them.
--
-- ⚠ THIS IS WHY THE CLEANUP RUNS FIRST. `ADD CONSTRAINT ... REFERENCES` is
-- validated against existing rows and HARD-FAILS on the first orphan it meets.
-- A migration that adds the key without clearing them cannot deploy — it would
-- take the whole release with it.
--
-- ── WHY CASCADE, AND WHY THAT IS SAFE HERE ──────────────────────────────────
-- Both tables are dead ends:
--   · `event_software_activations_v2` — the entitlement gate moved OFF it in the
--     2026-06-15 repair (`20271137526696`); no reader remains.
--   · `couple_briefs` — a retired RFP idea: no reader, no writer, RLS enabled
--     with zero policies, so only service_role could ever see it.
-- Its sibling born in the same migration already carries the same key
-- (`registered_crew_devices`, `20260704000000`), so this restores a pattern
-- rather than inventing one.
--
-- ⚠ ONE DELIBERATE ASYMMETRY. `couple_briefs` has a child,
-- `vendor_bid_submissions.brief_id ... ON DELETE CASCADE`, so a cascade here
-- would transitively destroy SUPPLIERS' BIDS if that feature ever revived.
-- It is harmless at zero rows and a bad default to bake in silently, so the
-- brief takes **SET NULL** instead: the brief loses its event, the bids on it
-- survive, and nothing about a supplier's work is destroyed by a couple
-- deleting a celebration. That matches the owner's 2026-08-21 rule —
-- "only data from the user gets lost... data for the vendor stays".
-- ============================================================================

BEGIN;

-- ── 1 · CLEAR THE EXISTING ORPHANS, OR THE CONSTRAINT CANNOT BE ADDED ──────
DELETE FROM public.event_software_activations_v2 a
 WHERE a.event_id IS NOT NULL
   AND NOT EXISTS (
     SELECT 1 FROM public.events e WHERE e.event_id = a.event_id
   );

-- `couple_briefs` is emptied of orphans the same way. SET NULL below means new
-- deletions null the column rather than removing the row, but rows that are
-- ALREADY dangling have no event to null against and would fail validation.
UPDATE public.couple_briefs b
   SET event_id = NULL
 WHERE b.event_id IS NOT NULL
   AND NOT EXISTS (
     SELECT 1 FROM public.events e WHERE e.event_id = b.event_id
   );

-- ── 2 · GIVE EACH COLUMN A REAL KEY ────────────────────────────────────────
ALTER TABLE public.event_software_activations_v2
  DROP CONSTRAINT IF EXISTS event_software_activations_v2_event_id_fkey;
ALTER TABLE public.event_software_activations_v2
  ADD CONSTRAINT event_software_activations_v2_event_id_fkey
  FOREIGN KEY (event_id) REFERENCES public.events(event_id) ON DELETE CASCADE;

-- 🪤 SET NULL REQUIRES A NULLABLE COLUMN, AND THIS ONE IS NOT NULL.
-- Attaching ON DELETE SET NULL to a NOT NULL column is accepted at CREATE time
-- and then RAISES at delete time — the null it writes violates the constraint,
-- the whole DELETE aborts, and the couple simply cannot remove their
-- celebration. A "safety" key that blocks the feature it was added to protect.
-- Caught by the db test seeding a real row, not by reading the DDL.
ALTER TABLE public.couple_briefs ALTER COLUMN event_id DROP NOT NULL;

ALTER TABLE public.couple_briefs
  DROP CONSTRAINT IF EXISTS couple_briefs_event_id_fkey;
ALTER TABLE public.couple_briefs
  ADD CONSTRAINT couple_briefs_event_id_fkey
  FOREIGN KEY (event_id) REFERENCES public.events(event_id) ON DELETE SET NULL;

COMMENT ON CONSTRAINT couple_briefs_event_id_fkey ON public.couple_briefs IS
  'SET NULL, not CASCADE, on purpose: vendor_bid_submissions cascades off the '
  'brief, so a cascade here would destroy suppliers'' bids when a couple deletes '
  'a celebration. Owner rule 2026-08-21 — only the user''s data is lost.';

COMMIT;
