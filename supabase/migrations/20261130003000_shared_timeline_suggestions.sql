-- ============================================================================
-- SHARED DAY-OF TIMELINE + VENDOR SUGGEST — Phase 3 of the feature-access
-- program (corpus: 03_Strategy/Feature_Access_By_Vendor_Category_2026-06-12.md
-- § 4, owner-locked 2026-06-12; D2 = booked vendors see the FULL timeline).
--
--   1. current_vendor_booked_event_ids() — events where the caller's vendor
--      org(s) hold a live BOOKED event_vendors relationship
--   2. Booked vendors get live SELECT on event_schedule_blocks (full
--      timeline, locked D2; the Brief RPC snapshot stays for the card)
--   3. event_schedule_suggestions — the Suggest flow: vendors PROPOSE
--      changes, couple/coordinator approve or decline. Vendors never write
--      the timeline directly (conflict-architecture lock: suggestion rows,
--      not 2-way writes).
-- ============================================================================

-- 1 · Booked-vendor membership (org = profile owner or team member, same
--     resolution as the Brief RPC).
CREATE OR REPLACE FUNCTION public.current_vendor_booked_event_ids()
RETURNS SETOF UUID
LANGUAGE SQL SECURITY DEFINER STABLE
SET search_path = public
AS $$
  SELECT DISTINCT ev.event_id
  FROM public.event_vendors ev
  WHERE ev.status IN ('contracted', 'deposit_paid', 'delivered', 'complete')
    AND ev.marketplace_vendor_id IN (
      SELECT vp.vendor_profile_id FROM public.vendor_profiles vp WHERE vp.user_id = auth.uid()
      UNION
      SELECT tm.vendor_profile_id FROM public.vendor_team_members tm WHERE tm.user_id = auth.uid()
    );
$$;

-- 2 · Full-timeline read for booked vendors (locked D2). Couple-private
--     block `notes` stay couple-side at the UI layer (vendor surfaces never
--     select the column; the Brief RPC already excludes it).
DROP POLICY IF EXISTS event_schedule_blocks_booked_vendor_read ON public.event_schedule_blocks;
CREATE POLICY event_schedule_blocks_booked_vendor_read
  ON public.event_schedule_blocks FOR SELECT TO authenticated
  USING (event_id IN (SELECT public.current_vendor_booked_event_ids()));

-- 3 · Suggestions
CREATE TABLE IF NOT EXISTS public.event_schedule_suggestions (
  suggestion_id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id             UUID NOT NULL REFERENCES public.events(event_id) ON DELETE CASCADE,
  block_id             UUID REFERENCES public.event_schedule_blocks(block_id) ON DELETE CASCADE,
  vendor_profile_id    UUID NOT NULL REFERENCES public.vendor_profiles(vendor_profile_id) ON DELETE CASCADE,
  suggested_by_user_id UUID NOT NULL,
  suggested_by_name    TEXT,                       -- denormalized business name for the couple's queue
  kind                 TEXT NOT NULL CHECK (kind IN ('adjust', 'new')),
  proposed_label       TEXT,
  proposed_start_at    TIMESTAMPTZ,
  proposed_end_at      TIMESTAMPTZ,
  proposed_location    TEXT,
  note                 TEXT NOT NULL CHECK (char_length(note) BETWEEN 1 AND 1000),
  status               TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'accepted', 'declined')),
  resolved_by_user_id  UUID,
  resolved_at          TIMESTAMPTZ,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- an 'adjust' must point at a block; a 'new' must not
  CHECK ((kind = 'adjust') = (block_id IS NOT NULL))
);

CREATE INDEX IF NOT EXISTS event_schedule_suggestions_event_status_idx
  ON public.event_schedule_suggestions(event_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS event_schedule_suggestions_vendor_idx
  ON public.event_schedule_suggestions(vendor_profile_id, created_at DESC);

ALTER TABLE public.event_schedule_suggestions ENABLE ROW LEVEL SECURITY;

-- Vendors: insert + read their own org's suggestions, only on events they're
-- booked on. No vendor UPDATE/DELETE — a suggestion is withdrawn by asking
-- the couple in chat (V1 keeps the state machine one-directional).
DROP POLICY IF EXISTS schedule_suggestions_vendor_insert ON public.event_schedule_suggestions;
CREATE POLICY schedule_suggestions_vendor_insert
  ON public.event_schedule_suggestions FOR INSERT TO authenticated
  WITH CHECK (
    event_id IN (SELECT public.current_vendor_booked_event_ids())
    AND vendor_profile_id IN (SELECT public.current_vendor_profile_ids())
    AND suggested_by_user_id = auth.uid()
    AND status = 'open'
  );

DROP POLICY IF EXISTS schedule_suggestions_vendor_read ON public.event_schedule_suggestions;
CREATE POLICY schedule_suggestions_vendor_read
  ON public.event_schedule_suggestions FOR SELECT TO authenticated
  USING (vendor_profile_id IN (SELECT public.current_vendor_profile_ids()));

-- Couple + delegates: read everything on their events.
DROP POLICY IF EXISTS schedule_suggestions_couple_read ON public.event_schedule_suggestions;
CREATE POLICY schedule_suggestions_couple_read
  ON public.event_schedule_suggestions FOR SELECT TO authenticated
  USING (
    event_id IN (SELECT public.current_couple_event_ids())
    OR event_id IN (SELECT public.current_moderator_event_ids())
  );

-- Resolution (status flip) — couple, or a delegate holding schedule edit.
DROP POLICY IF EXISTS schedule_suggestions_couple_resolve ON public.event_schedule_suggestions;
CREATE POLICY schedule_suggestions_couple_resolve
  ON public.event_schedule_suggestions FOR UPDATE TO authenticated
  USING (
    event_id IN (SELECT public.current_couple_event_ids())
    OR public.moderator_area_level(event_id, 'schedule') = 'edit'
  )
  WITH CHECK (
    event_id IN (SELECT public.current_couple_event_ids())
    OR public.moderator_area_level(event_id, 'schedule') = 'edit'
  );

COMMENT ON TABLE public.event_schedule_suggestions IS
  'Vendor Suggest flow on the shared day-of timeline (feature-access program Phase 3). Vendors propose; couple/coordinator resolve; no direct vendor writes to event_schedule_blocks.';
