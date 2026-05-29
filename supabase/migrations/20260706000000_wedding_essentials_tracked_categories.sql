-- Wedding Essentials · per-event tracked-categories array.
--
-- Owner directive 2026-05-29 in conversation closing CLAUDE.md
-- "today's focus is paid" reminder · canonical lock TBD (this PR captures
-- the spec).
--
-- WHY this column exists:
--
-- The Today menu now renders differently per tier (per the v2.1 brief
-- amendment in flight + CLAUDE.md 2026-05-28 V2 publisher cutover):
--
--   - PAID Today's Focus (₱1,499) · events.concierge_status='active' ·
--     renders the full 65-card guided wizard substrate (WizardHero)
--     with hard-floor scheduler + religion-adaptive copy + 5-tier
--     ranking + coordinator-scheduled meetings · everything intelligent
--     the wizard ships.
--
--   - FREE DIY · events.concierge_status IN ('diy','trial','expired') OR
--     NULL · renders the new WeddingEssentialsHero · 7 always-visible
--     essentials (date · venue · budget · guest list · catering ·
--     officiant · marriage license) · couples can opt-in to additional
--     plan-grid categories as they progress · marketplace + Compare +
--     Lock flows shared with paid.
--
-- This column tracks WHICH categories the couple has actively opted in
-- to track in the Plan grid (and adjacent surfaces). Defaults to the
-- four vendor-pick essentials that map to PLAN_GROUP_IDs. Couples on
-- the Free DIY tier add categories via "+ Add category" picker (queued
-- post-pilot per the conversation lock). Couples on paid Today's Focus
-- get the entire 22-category plan grid implicitly · the column still
-- ships but the paid surface ignores it because it tracks everything.
--
-- WHY default to ARRAY[ceremony_venue, reception_venue, officiant,
-- catering]: those are the 4 vendor-pick PlanGroups that map to the 7
-- Wedding Essentials. The non-vendor essentials (date · budget ·
-- guest_list · marriage_license) don't live in PLAN_GROUPS — they have
-- their own surfaces (events.event_date · estimated_budget_centavos ·
-- /dashboard/[eventId]/guests · documents tracker) so they don't need
-- to be in tracked_categories.
--
-- WHY no dismissed_categories column this PR: the hard-floor nudge
-- ("Most couples lock a photographer 8+ months out · Add Photography?")
-- + "+ Add category" picker are queued for the follow-up PR. Until those
-- surfaces ship, dismissed_categories has no consumer.
--
-- Idempotent: ADD COLUMN IF NOT EXISTS · the schema is safe to re-run.

ALTER TABLE events
  ADD COLUMN IF NOT EXISTS tracked_categories TEXT[]
    NOT NULL
    DEFAULT ARRAY['ceremony_venue', 'reception_venue', 'officiant', 'catering']::TEXT[];

COMMENT ON COLUMN events.tracked_categories IS
  'PlanGroupIds the couple has opted to track in the Plan grid · Free DIY tier respects this filter · paid Today''s Focus tier tracks all 22 categories implicitly · default is the 4 vendor-pick essentials (ceremony_venue · reception_venue · officiant · catering) per Wedding Essentials lock 2026-05-29.';

-- GIN index on the array column so PlanGroups membership lookups
-- (`tracked_categories @> ARRAY['photography']` etc.) don't full-scan
-- the events table when the Plan grid filter consumer ships.
CREATE INDEX IF NOT EXISTS events_tracked_categories_gin_idx
  ON events USING GIN (tracked_categories);
