-- Manual vs automatic website launch (owner 2026-07-02).
--
-- The public /[slug] wedding website advances through four lifecycle phases:
-- save_the_date -> rsvp -> event -> editorial. Until now that phase was ALWAYS
-- date-driven (lib/invitation-widgets.ts getLifecyclePhase). Owner ask: let the
-- couple flip the site between:
--   launch_mode = 'auto'   -> phase follows the event date (unchanged behaviour)
--   launch_mode = 'manual' -> the couple PINS one phase via manual_phase and it
--                             stays live for every visitor until they switch
--                             (activating one phase deactivates the others).
-- manual_phase is IGNORED while launch_mode = 'auto'. Both columns are couple-
-- controlled from an in-context host bar on their own live page; the DB-level
-- couple_can_update_event policy already governs writes (no new RLS needed —
-- these are plain columns on the existing, RLS-enabled events table).

ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS launch_mode text NOT NULL DEFAULT 'auto',
  ADD COLUMN IF NOT EXISTS manual_phase text;

-- Guard the domains. IF-EXISTS drops keep the migration idempotent on re-run.
ALTER TABLE public.events
  DROP CONSTRAINT IF EXISTS events_launch_mode_check;
ALTER TABLE public.events
  ADD CONSTRAINT events_launch_mode_check
    CHECK (launch_mode IN ('auto', 'manual'));

ALTER TABLE public.events
  DROP CONSTRAINT IF EXISTS events_manual_phase_check;
ALTER TABLE public.events
  ADD CONSTRAINT events_manual_phase_check
    CHECK (
      manual_phase IS NULL
      OR manual_phase IN ('save_the_date', 'rsvp', 'event', 'editorial')
    );
