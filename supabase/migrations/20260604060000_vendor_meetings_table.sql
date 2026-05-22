-- ============================================================================
-- 20260604060000_vendor_meetings_table.sql
--
-- Vendor meetings — closes the table gap left by PR #336 Home aggregation.
--
-- PR #336 (UpcomingSchedules unification) wired five data sources into a
-- single merged stream on Home. One source — vendor meetings — was specced
-- in iteration 0006 (CLAUDE.md decision log row "0006 meetings module added
-- to vendor profiles", 2026-05-09) but never migrated. The plumbing in
-- apps/web/lib/upcoming-items.ts holds the source position open with an
-- empty array (`const meetings: UpcomingItem[] = [];` at line 430) so a
-- future migration could drop the data in without touching the merged-
-- render code. This is that migration.
--
-- Spec source-of-truth: iteration 0006 § "Meetings module" — locked
-- 2026-05-09. CLAUDE.md decision log 2026-05-22 row 459 (queued Wave 2 of
-- the Home aggregation work).
--
-- Architectural decisions in this migration:
--
--   1. The FK target is public.event_vendors(vendor_id) — the per-event,
--      couple-encoded vendor record — NOT public.vendor_profiles. This
--      matches the canonical 0006 spec ("relationship_id REFERENCES
--      event_vendor_relationships") with the V1 actually-shipped table
--      name (event_vendors). Two practical wins:
--        a) Off-platform vendors (no marketplace profile row) can still
--           have meetings — the couple encodes them in event_vendors and
--           the meeting hangs off that row directly.
--        b) Same pattern as fetchVendorPaymentItems in upcoming-items.ts
--           (line 224) — display name flows from event_vendors.vendor_name
--           rather than chasing a vendor_profiles join.
--      The Din migration path (2026-05-09 spec § 8) is preserved via
--      created_by_actor — vendors writing through Din phase 3 will set
--      created_by_actor='vendor' on the same table without schema churn.
--
--   2. RLS scopes meetings to the event's hosts. Three patterns combine
--      to capture every legitimate caller per V1.2 multi-host work
--      (iteration 0048):
--        - event_moderators row with accepted_at IS NOT NULL AND
--          removed_at IS NULL  → CRUD
--        - event_members row with member_type='couple' → CRUD
--          (backwards-compat for events created before iteration 0048's
--          backfill landed)
--        - public.is_admin() helper → read (admin moderation surface)
--      Vendor-side read access (when Din ships) wires in a later
--      migration that knows which event_vendors row maps to which
--      vendor_profiles row via existing linked_vendor_profile_id +
--      marketplace_vendor_id columns; not in scope for this PR.
--
--   3. The "mode" CHECK enumerates 7 values — broader than the 0006
--      spec's 3 ('in_person', 'video', 'phone') because the actual
--      Filipino-wedding-planning vocabulary is richer (site_visit /
--      food_tasting / fitting / consultation all have distinct
--      semantics that affect Home subtitle copy). Forward-compatible
--      with the spec's 3 values — V1.x UI can render any of the 7
--      using familiar copy.
--
--   4. ends_at is nullable. Open-ended meetings ("3pm food tasting,
--      ends when it ends") are common; the spec's duration_minutes
--      column captured this loosely. Using ends_at TIMESTAMPTZ NULL
--      mirrors event_schedule_blocks.end_at and lets the Home merged
--      stream render mode-aware subtitles without parsing a separate
--      duration unit.
--
--   5. No data migration. The table doesn't exist yet on production
--      (verified via 2026-05-20 row 451 "Prod migration parity verified"
--      and the upcoming-items.ts source-position placeholder). Idempotent
--      CREATE TABLE IF NOT EXISTS means re-running is safe.
--
-- Out of scope for this PR:
--   - Meeting creation / edit / cancel UI (V1.x — likely on
--     /dashboard/[eventId]/vendors/[vendor_id] vendor detail). The Home
--     surface will display rows whenever the owner manually inserts via
--     SQL or once V1.x ships the UI.
--   - Vendor-side write access (Din phase 3 migration adds it).
--   - Backfill from chat_messages or any other source — meetings are
--     forward-only data; there is no existing source to backfill from.
--
-- Reversal recipe:
--   DROP TABLE public.vendor_meetings;
-- ============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS public.vendor_meetings (
  meeting_id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id            UUID NOT NULL REFERENCES public.events(event_id) ON DELETE CASCADE,
  vendor_id           UUID NOT NULL REFERENCES public.event_vendors(vendor_id) ON DELETE CASCADE,
  starts_at           TIMESTAMPTZ NOT NULL,
  ends_at             TIMESTAMPTZ,                 -- nullable for open-ended meetings
  mode                TEXT NOT NULL DEFAULT 'in_person' CHECK (mode IN (
    'in_person',
    'video_call',
    'phone_call',
    'site_visit',
    'food_tasting',
    'fitting',
    'consultation'
  )),
  title               TEXT NOT NULL CHECK (length(title) > 0 AND length(title) <= 200),
  location            TEXT,                        -- venue address OR video link OR phone number depending on mode
  agenda              TEXT,
  notes               TEXT,                        -- post-meeting notes
  created_by_user_id  UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_by_actor    TEXT NOT NULL DEFAULT 'couple' CHECK (created_by_actor IN (
    'couple',
    'vendor',
    'admin'
  )),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (ends_at IS NULL OR ends_at > starts_at)
);

-- Read-pattern indexes. The Home upcoming-items fetcher filters by
-- (event_id, starts_at > now) ORDER BY starts_at — the composite index
-- on (event_id, starts_at) covers that path. The single-column vendor_id
-- index supports vendor-detail-page reads ("all meetings with this vendor")
-- once that surface ships.
CREATE INDEX IF NOT EXISTS vendor_meetings_event_idx
  ON public.vendor_meetings(event_id);

CREATE INDEX IF NOT EXISTS vendor_meetings_vendor_idx
  ON public.vendor_meetings(vendor_id);

CREATE INDEX IF NOT EXISTS vendor_meetings_starts_at_idx
  ON public.vendor_meetings(event_id, starts_at);

ALTER TABLE public.vendor_meetings ENABLE ROW LEVEL SECURITY;

-- ----------------------------------------------------------------------------
-- RLS policies
-- ----------------------------------------------------------------------------

-- Hosts can CRUD their own event's meetings.
--   - event_moderators row (accepted + not removed) per iteration 0048
--   - event_members row with member_type='couple' for backwards-compat
DROP POLICY IF EXISTS vendor_meetings_host_all ON public.vendor_meetings;
CREATE POLICY vendor_meetings_host_all ON public.vendor_meetings
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.event_moderators em
       WHERE em.event_id = public.vendor_meetings.event_id
         AND em.user_id  = auth.uid()
         AND em.accepted_at IS NOT NULL
         AND em.removed_at IS NULL
    )
    OR EXISTS (
      SELECT 1 FROM public.event_members em
       WHERE em.event_id = public.vendor_meetings.event_id
         AND em.user_id  = auth.uid()
         AND em.member_type = 'couple'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.event_moderators em
       WHERE em.event_id = public.vendor_meetings.event_id
         AND em.user_id  = auth.uid()
         AND em.accepted_at IS NOT NULL
         AND em.removed_at IS NULL
    )
    OR EXISTS (
      SELECT 1 FROM public.event_members em
       WHERE em.event_id = public.vendor_meetings.event_id
         AND em.user_id  = auth.uid()
         AND em.member_type = 'couple'
    )
  );

-- Admin moderation read.
DROP POLICY IF EXISTS vendor_meetings_admin_read ON public.vendor_meetings;
CREATE POLICY vendor_meetings_admin_read ON public.vendor_meetings
  FOR SELECT TO authenticated
  USING (public.is_admin());

-- ----------------------------------------------------------------------------
-- updated_at trigger — keeps the timestamp current on UPDATE.
-- Pattern matches the existing vendor_meetings_set_updated_at / equivalent
-- triggers across other 0006-era tables in the corpus.
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.vendor_meetings_set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS vendor_meetings_updated_at_trigger ON public.vendor_meetings;
CREATE TRIGGER vendor_meetings_updated_at_trigger
  BEFORE UPDATE ON public.vendor_meetings
  FOR EACH ROW EXECUTE FUNCTION public.vendor_meetings_set_updated_at();

COMMENT ON TABLE public.vendor_meetings IS
  'Scheduled meetings between hosts and event-vendor rows. Iteration 0006 § Meetings module. '
  'Closes the table gap left by PR #336 Home aggregation. created_by_actor is forward-compat for Din phase 3.';

COMMENT ON COLUMN public.vendor_meetings.created_by_actor IS
  'V1 always ''couple''. Phase 3 (Din supplier app) will set ''vendor''. Admin support actions set ''admin''.';

COMMIT;
