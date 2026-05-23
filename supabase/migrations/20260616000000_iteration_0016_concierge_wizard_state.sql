-- iteration 0016 Concierge Active Wizard · Phase 0 framework
--
-- Adds events.wizard_state JSONB column tracking per-task completion for the
-- 38-card inline-completion wizard locked in CLAUDE.md "Sixth 2026-05-23 row"
-- (V1 SCOPE EXPANSION · Concierge active-wizard pulled forward from V1.5+).
--
-- WHY this column lives on `events` (not a separate `event_wizard_steps`
-- table):
--   - Wizard state is a per-event property (not many-to-many)
--   - All 38 tasks have <100 chars of state each (completion timestamp +
--     optional metadata like which sub-tags were picked for multi-pick
--     cards) → fits comfortably in a JSONB blob
--   - Server-side WizardSequenceResolver reads the WHOLE state at once to
--     decide the next focus card · separate table would force a JOIN on
--     every event-home render which the defensive shielding work (PRs
--     #448-#459) just got minimized
--   - JSONB lets the shape evolve as new cards land in Phase 1-7 without
--     migrations · safer for an iterative rollout
--
-- Shape locked at framework time (Phase 0):
--
--   {
--     "set_wedding_date":       { "completed_at": "2026-05-24T12:00:00Z" },
--     "reception_venue":        { "completed_at": "...", "vendor_id": "..." },
--     "ceremony_venue":         null,
--     "officiant":              null,
--     ...
--     // Card-specific completion metadata is OPTIONAL · the presence of
--     // `completed_at` is the only field the resolver needs to skip the card.
--   }
--
-- The resolver in apps/web/lib/wizard.ts reads this column + uses the
-- canonical task order from WIZARD_TASKS to decide what to surface as the
-- active focus.
--
-- Push convention per [[feedback_setnayan_push_migrations_myself]] · this is
-- additive (new column with default NULL · no risk of breaking existing
-- queries) so push BEFORE merging the framework PR so the new code finds
-- the column on first deploy.

BEGIN;

ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS wizard_state JSONB NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.events.wizard_state IS
  'Per-task completion state for the 38-card Concierge active wizard '
  '(iteration 0016 · CLAUDE.md Sixth 2026-05-23 row). Keys are task IDs '
  'from WIZARD_TASKS in apps/web/lib/wizard.ts (e.g. set_wedding_date, '
  'reception_venue, ceremony_venue, ...). Values are either NULL (task '
  'pending) or an object containing at least { completed_at: ISO8601 } '
  'plus optional card-specific metadata (vendor_id, multi-pick tags, '
  'paperwork checklist progress, etc.). The WizardSequenceResolver reads '
  'this column to decide which card to surface as Today''s Focus.';

COMMIT;
