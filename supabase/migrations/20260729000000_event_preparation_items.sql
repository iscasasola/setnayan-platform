-- ============================================================================
-- 20260729000000_event_preparation_items.sql
-- Hybrid Preparation schedule — manual + vendor-added items.
--
-- The /dashboard/[eventId]/schedule "Preparation" mode shipped in PR #840 as
-- a READ-ONLY auto-aggregation (apps/web/lib/preparation.ts merges vendor
-- payment due dates, paperwork deadlines, vendor meetings, and statutory
-- milestones — all from data that already exists). This migration adds the
-- hybrid "couple/vendor can ALSO add their own items" layer on top of that
-- aggregation. The autofill is untouched; lib/preparation.ts gains a NEW
-- source that reads this table and merges its rows into the same agenda.
--
-- RLS-at-create (8-pattern canon):
--   • Couple — Pattern B (current_couple_event_ids): full CRUD on their own
--     event's items, INCLUDING deleting vendor-added rows (a couple can
--     dismiss anything on their own prep schedule).
--   • Vendor — Pattern E-flavored (current_vendor_ids + accepted-thread
--     gate): SELECT items they authored or for events they're booked on;
--     INSERT only for events they hold an ACCEPTED chat_threads row on,
--     stamping their own vendor_profile_id; UPDATE/DELETE only their OWN
--     rows. A vendor can never touch a couple-added or another vendor's row.
--
-- Verified against schema before writing:
--   • events(event_id)                — UUID UNIQUE FK target (20260512000000)
--   • vendor_profiles(vendor_profile_id) — PK            (20260513120000)
--   • users(user_id)                  — PK               (20260512000000)
--   • current_couple_event_ids()      — GRANTed authenticated (20260513040000)
--   • current_vendor_ids()            — GRANTed authenticated (20260512000000)
--   • chat_threads.vendor_profile_id + inquiry_status — enum 'accepted'
--       backfilled for pre-gate threads (20260513130000 + 20260722000000)
--
-- Additive only. Idempotent. Owner pushes (do NOT auto-push). Code
-- graceful-degrades: lib/preparation.ts catches 42P01 and returns the
-- autofill-only agenda until this migration lands.
-- ============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS public.event_preparation_items (
  item_id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id          UUID NOT NULL REFERENCES public.events(event_id) ON DELETE CASCADE,
  vendor_profile_id UUID REFERENCES public.vendor_profiles(vendor_profile_id) ON DELETE CASCADE, -- set when a vendor added it; NULL = couple-added
  due_date          DATE NOT NULL,
  label             TEXT NOT NULL CHECK (length(label) BETWEEN 1 AND 200),
  notes             TEXT,
  source_tag        VARCHAR(32) NOT NULL DEFAULT 'couple_manual', -- 'couple_manual' | 'vendor_prep'
  created_by        UUID REFERENCES public.users(user_id) ON DELETE SET NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS event_preparation_items_event_idx ON public.event_preparation_items(event_id);
CREATE INDEX IF NOT EXISTS event_preparation_items_due_idx ON public.event_preparation_items(due_date);

ALTER TABLE public.event_preparation_items ENABLE ROW LEVEL SECURITY;

-- Couple: full CRUD on their own event's items (incl. deleting vendor-added).
DROP POLICY IF EXISTS event_prep_items_couple_all ON public.event_preparation_items;
CREATE POLICY event_prep_items_couple_all ON public.event_preparation_items
  FOR ALL TO authenticated
  USING (event_id IN (SELECT public.current_couple_event_ids()))
  WITH CHECK (event_id IN (SELECT public.current_couple_event_ids()));

-- Vendor: SELECT items on events they're booked on (accepted thread) or that they authored.
DROP POLICY IF EXISTS event_prep_items_vendor_read ON public.event_preparation_items;
CREATE POLICY event_prep_items_vendor_read ON public.event_preparation_items
  FOR SELECT TO authenticated
  USING (
    vendor_profile_id IN (SELECT public.current_vendor_ids())
    OR event_id IN (
      SELECT event_id FROM public.chat_threads
      WHERE vendor_profile_id IN (SELECT public.current_vendor_ids())
        AND inquiry_status = 'accepted'
    )
  );

-- Vendor: INSERT only for events they have an ACCEPTED thread on, stamping their own vendor_profile_id.
DROP POLICY IF EXISTS event_prep_items_vendor_insert ON public.event_preparation_items;
CREATE POLICY event_prep_items_vendor_insert ON public.event_preparation_items
  FOR INSERT TO authenticated
  WITH CHECK (
    vendor_profile_id IN (SELECT public.current_vendor_ids())
    AND event_id IN (
      SELECT event_id FROM public.chat_threads
      WHERE vendor_profile_id IN (SELECT public.current_vendor_ids())
        AND inquiry_status = 'accepted'
    )
  );

-- Vendor: UPDATE/DELETE only their OWN added items.
DROP POLICY IF EXISTS event_prep_items_vendor_update ON public.event_preparation_items;
CREATE POLICY event_prep_items_vendor_update ON public.event_preparation_items
  FOR UPDATE TO authenticated
  USING (vendor_profile_id IN (SELECT public.current_vendor_ids()))
  WITH CHECK (vendor_profile_id IN (SELECT public.current_vendor_ids()));
DROP POLICY IF EXISTS event_prep_items_vendor_delete ON public.event_preparation_items;
CREATE POLICY event_prep_items_vendor_delete ON public.event_preparation_items
  FOR DELETE TO authenticated
  USING (vendor_profile_id IN (SELECT public.current_vendor_ids()));

COMMIT;
