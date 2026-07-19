-- 20270821100000_life_event_gate_honoree.sql
--
-- Life-event creation gate — honoree columns (council verdict
-- Event_Creation_Limits_Council_Verdict_2026-07-17.md § 7, owner "build it now"
-- 2026-07-17).
--
-- "One IN-PLANNING life event per (creator account × event type × honoree)."
-- The honoree key is: honoree_dependent_id when linked → else the normalized
-- honoree_label → else the per-type singleton slot. Enforcement is APP-LAYER
-- (create-event/life-event-guard.ts at every events-insert server action —
-- wedding-guard precedent; a CHECK can't reference now() and inserts run
-- through the admin client, so the server action is the choke point).
--
-- honoree_label is an OPTIONAL free-text first name — ordinary PI at the
-- sensitivity of existing guest names, a display/guard key only. It does NOT
-- duplicate or extend the pre-existing signature_details honoree SPI
-- (christening birthdate/sex, reveal due date — that gap stays on the NPC task
-- list, lib/npc-filing-tasks.ts). Disclosed under "Event honoree details" on
-- /privacy. Excluded from public read paths (they are column-scoped selects).
--
-- honoree_dependent_id links the honoree to a dependents row (counsel-gated
-- People layer). NULL until the person-picker PR; ON DELETE SET NULL so wiping
-- a dependent never orphans an event.
--
-- No new table → no new RLS surface; the columns ride events' existing
-- policies. Idempotent.

BEGIN;

ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS honoree_label TEXT
    CHECK (honoree_label IS NULL OR char_length(btrim(honoree_label)) BETWEEN 1 AND 80),
  ADD COLUMN IF NOT EXISTS honoree_dependent_id UUID
    REFERENCES public.dependents(dependent_id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS events_honoree_dependent_idx
  ON public.events(honoree_dependent_id)
  WHERE honoree_dependent_id IS NOT NULL;

COMMENT ON COLUMN public.events.honoree_label IS
  'Optional free-text honoree first name ("Para kanino?") — the life-event cardinality key (one in-planning life event per account × type × honoree). Ordinary PI; never rendered on public/vendor/guest surfaces.';
COMMENT ON COLUMN public.events.honoree_dependent_id IS
  'Optional link to the dependents row this life event is for (counsel-gated People layer). Takes precedence over honoree_label as the cardinality key.';

COMMIT;
