-- ============================================================================
-- 20260604020000_phase_0_date_selection.sql
--
-- Phase 0 Date Selection — cultural intelligence layer (V1).
-- Spec corpus: CLAUDE.md decision log, 2026-05-22 owner directive — "the
-- emotional entry point to wedding planning: pick your wedding date with
-- positive-only cultural intelligence." Replaces the silent
-- events.event_date / events.event_date_precision input on event home with a
-- guided /date-selection flow that surfaces a positive auspicious-card view
-- before lock-in.
--
-- WHY:
--   The 2026-05-22 owner directive captured a real gap in the V1 funnel.
--   Today the host lands on event home and sees an inline date input next
--   to a precision picker; there is no acknowledgement that the date is
--   the most emotionally loaded decision in Filipino wedding planning.
--   Hosts go through these states:
--     (a) "I have a date in mind"    → just pick + lock.
--     (b) "Help me pick"             → walk the 4-question flow + 5 suggested dates.
--     (c) "I'm not ready yet"        → undecided, return to home.
--   In every case the host needs positive-only framing — never "this date
--   is bad", always "here's what's great about whichever date you pick".
--   The flow lives at /dashboard/[eventId]/date-selection; this migration
--   ships the persistence layer.
--
-- WHAT:
--   (1) events.date_status TEXT — three-state machine: undecided / tentative /
--       locked. Default 'undecided' (new events start without a date status).
--       Lifecycle: undecided → tentative (via "Help me pick" entry path) →
--       locked (host clicks Lock-this-date) OR undecided → locked (via "I
--       have a date in mind" entry path). Locked maps to events.event_date
--       being set + events.event_date_precision narrowed accordingly (the
--       date-precision columns from migration 20260603100000 stay canonical
--       for the actual date value + precision; date_status is a separate
--       lifecycle marker so the auspicious chip on event home knows whether
--       to render).
--
--   (2) events.auspicious_reasons JSONB — array of positive-reason strings
--       computed at lock time by apps/web/lib/auspicious-date.ts.
--       Persisted (not just computed at render) so the host's locked
--       reasons survive future tweaks to the library. Default empty array.
--
--   (3) event_meaningful_dates table — kind ∈ honor/avoid/anniversary/
--       birthday/other. Honor = "we'd love to be on or near this date"
--       (e.g. parent's birthday, grandparent's wedding anniversary). Avoid
--       = "we'd prefer not to be on this date" (e.g. sibling's wedding,
--       death anniversary). The 4-question flow collects these to feed
--       suggested-date scoring. Foreign-keyed to events with ON DELETE
--       CASCADE so removing an event cleans up its meaningful-date rows.
--
--   (4) RLS — hosts read + write their event's meaningful dates. Membership
--       check goes through event_moderators (the canonical multi-host model
--       per iteration 0048). The 'couple' member_type in event_members is
--       NOT used here because every event has an event_moderators row for
--       its creator post-migration 20260519100000_iteration_0048_event_
--       moderators_foundation.sql. Removed_at IS NULL filters out hosts who
--       have been removed.
--
-- WHO IT TOUCHES:
--   - apps/web/app/dashboard/[eventId]/date-selection/* — new route.
--   - apps/web/app/dashboard/[eventId]/page.tsx — small chip integration.
--   - apps/web/lib/auspicious-date.ts — positive-only reasoning library.
--
-- POSITIVE-ONLY DISCIPLINE (load-bearing across all surfaces):
--   The library NEVER tells the host "this date is bad." For sensitive
--   considerations (Holy Week, typhoon season, sukob with siblings, weekday
--   weddings, the 13th, etc.) it always finds a positive reframe. The
--   auspicious_reasons JSONB column stores ONLY positive-framed strings.
--   Reasons like "avoids Holy Week" are reframed to "honors the rhythm of
--   Catholic families who celebrate before or after Holy Week".
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- 1. events.date_status — three-state lifecycle marker
-- ----------------------------------------------------------------------------

ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS date_status TEXT NOT NULL DEFAULT 'undecided';

ALTER TABLE public.events
  DROP CONSTRAINT IF EXISTS events_date_status_check;

ALTER TABLE public.events
  ADD CONSTRAINT events_date_status_check
  CHECK (date_status IN ('undecided', 'tentative', 'locked'));

COMMENT ON COLUMN public.events.date_status IS
  'Phase 0 date-selection lifecycle: undecided (default · no date picked yet), '
  'tentative (host walking the guided flow, date may still change), locked '
  '(host clicked Lock-this-date · paired with events.event_date populated + '
  'events.event_date_precision set). Drives the auspicious chip render on '
  'event home. Per CLAUDE.md 2026-05-22 Phase 0 lock.';

-- Backfill: any event that already has a non-null event_date is treated as
-- 'locked' so existing pre-Phase-0 events render the auspicious chip if the
-- host re-visits and the auspicious_reasons get computed lazily. Events with
-- NULL event_date stay 'undecided' (matches the default for new rows).
UPDATE public.events
  SET date_status = 'locked'
  WHERE event_date IS NOT NULL AND date_status = 'undecided';

-- ----------------------------------------------------------------------------
-- 2. events.auspicious_reasons — JSONB array of positive-framed strings
-- ----------------------------------------------------------------------------

ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS auspicious_reasons JSONB NOT NULL DEFAULT '[]'::jsonb;

COMMENT ON COLUMN public.events.auspicious_reasons IS
  'Positive-only reasons computed at lock time by '
  'apps/web/lib/auspicious-date.ts. Persisted so the host''s locked '
  'reasons survive library updates. Always a JSONB array of strings; '
  'empty array when date is not locked. Per CLAUDE.md 2026-05-22 Phase 0 lock.';

-- ----------------------------------------------------------------------------
-- 3. event_meaningful_dates — feeds the guided-flow scoring
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.event_meaningful_dates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES public.events(event_id) ON DELETE CASCADE,
  meaningful_date DATE NOT NULL,
  kind TEXT NOT NULL,
  note TEXT,
  created_by_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT event_meaningful_dates_kind_check
    CHECK (kind IN ('honor', 'avoid', 'anniversary', 'birthday', 'other'))
);

CREATE INDEX IF NOT EXISTS event_meaningful_dates_event_idx
  ON public.event_meaningful_dates(event_id);

COMMENT ON TABLE public.event_meaningful_dates IS
  'Dates the host has flagged as meaningful (honor or avoid) — feeds the '
  'Phase 0 guided-flow suggestion algorithm. Kind ∈ honor / avoid / '
  'anniversary / birthday / other. Per CLAUDE.md 2026-05-22 Phase 0 lock.';

-- ----------------------------------------------------------------------------
-- 4. RLS on event_meaningful_dates — host read + write via event_moderators
-- ----------------------------------------------------------------------------

ALTER TABLE public.event_meaningful_dates ENABLE ROW LEVEL SECURITY;

-- Read: any active accepted moderator on the event can see its meaningful
-- dates. Mirrors the pattern from event_moderators_select_own_events in
-- migration 20260519100000.
DROP POLICY IF EXISTS event_meaningful_dates_host_read ON public.event_meaningful_dates;
CREATE POLICY event_meaningful_dates_host_read ON public.event_meaningful_dates
  FOR SELECT TO authenticated
  USING (
    event_id IN (
      SELECT m.event_id FROM public.event_moderators m
      WHERE m.user_id = auth.uid()
        AND m.accepted_at IS NOT NULL
        AND m.removed_at IS NULL
    )
  );

-- Insert: same gate — only active accepted moderators can add meaningful
-- dates to events they're on.
DROP POLICY IF EXISTS event_meaningful_dates_host_insert ON public.event_meaningful_dates;
CREATE POLICY event_meaningful_dates_host_insert ON public.event_meaningful_dates
  FOR INSERT TO authenticated
  WITH CHECK (
    event_id IN (
      SELECT m.event_id FROM public.event_moderators m
      WHERE m.user_id = auth.uid()
        AND m.accepted_at IS NOT NULL
        AND m.removed_at IS NULL
    )
  );

-- Update: same gate. Hosts may correct typos in notes / fix the date /
-- recategorize kind. created_by_user_id is preserved.
DROP POLICY IF EXISTS event_meaningful_dates_host_update ON public.event_meaningful_dates;
CREATE POLICY event_meaningful_dates_host_update ON public.event_meaningful_dates
  FOR UPDATE TO authenticated
  USING (
    event_id IN (
      SELECT m.event_id FROM public.event_moderators m
      WHERE m.user_id = auth.uid()
        AND m.accepted_at IS NOT NULL
        AND m.removed_at IS NULL
    )
  )
  WITH CHECK (
    event_id IN (
      SELECT m.event_id FROM public.event_moderators m
      WHERE m.user_id = auth.uid()
        AND m.accepted_at IS NOT NULL
        AND m.removed_at IS NULL
    )
  );

-- Delete: same gate. The 4-question flow lets hosts revise their meaningful
-- dates; a delete + reinsert is cleaner than juggling soft-delete columns
-- for V1.
DROP POLICY IF EXISTS event_meaningful_dates_host_delete ON public.event_meaningful_dates;
CREATE POLICY event_meaningful_dates_host_delete ON public.event_meaningful_dates
  FOR DELETE TO authenticated
  USING (
    event_id IN (
      SELECT m.event_id FROM public.event_moderators m
      WHERE m.user_id = auth.uid()
        AND m.accepted_at IS NOT NULL
        AND m.removed_at IS NULL
    )
  );

COMMIT;
