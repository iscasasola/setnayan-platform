-- ============================================================================
-- 20260604080000_event_manual_vendors_table.sql
--
-- Manual-vendor primitive · host-managed contacts reusable across planning
-- categories. Per CLAUDE.md 2026-05-22 owner directive:
--
--   "When we add a vendor for the card, can we show a drop down of all
--    manually added vendors, so we can choose them as well, and have an
--    option to add a new one if not there? Manual input must have Photo,
--    Vendor Name, Contact Person, Contact Number."
--
-- BEFORE THIS MIGRATION:
--   - The home-page "+ Add" CTA called `addCustomVendor()` (server action
--     in vendors/actions.ts), which inserted a fresh row into
--     `event_vendors` with just `vendor_name` as freeform text. Adding the
--     same person to two categories (e.g. Tito Marcel as both Coordinator
--     AND Host/MC) required typing the name twice — each row was isolated
--     and edits didn't propagate.
--
-- AFTER THIS MIGRATION:
--   - Hosts can create a manual vendor ONCE with photo + business name +
--     contact person + contact number, then reuse that vendor across N
--     planning categories. Each category gets its own `event_vendors` row
--     (so per-category status, total cost, deposit tracking all stay
--     independent) but they all share the same `manual_vendor_id` →
--     editing the manual vendor row (e.g. updating the contact number)
--     propagates everywhere it's been attached.
--
-- SCHEMA:
--   - New table `event_manual_vendors` — one row per manual vendor per
--     event. 4 required fields per owner directive.
--   - New column `event_vendors.manual_vendor_id` (nullable · FK) — links
--     an event_vendors row to a manual vendor when one exists. NULL for:
--       (a) Marketplace-linked picks (has marketplace_vendor_id instead).
--       (b) Pre-2026-05-22 freeform rows (typed name, no contact info).
--       (c) Off-platform vendors the host hasn't bothered to flesh out yet.
--
-- RLS POLICY:
--   - Hosts (event_moderators rows · not removed_at) can manage all rows
--     on their events. Pattern mirrors event_sponsors RLS in
--     20260604040000 — includes admin override + legacy event_members
--     'couple' fallback so V1 events with only the legacy host row still
--     work without an event_moderators backfill.
--
-- ON DELETE CASCADE on the event link — when an event is hard-deleted by
-- support (per CLAUDE.md 2026-05-15 event-lifecycle rule + 2026-05-20
-- amendment unlocking self-delete when no confirmed vendors), the manual
-- vendor rows go with it (they have no value outside their event scope).
--
-- ON DELETE SET NULL on event_vendors.manual_vendor_id — if the host
-- deletes a manual vendor row but the linked event_vendors rows are still
-- in use across other categories, the event_vendors row survives with
-- `manual_vendor_id = NULL`. Matches the source_venue_directory_id /
-- service_id patterns. Host can re-attach if they want.
--
-- PHOTO STORAGE:
--   - photo_r2_key stores the R2 OBJECT KEY (not URL). Bucket =
--     setnayan-media (per R2_BUCKETS.media). Path prefix
--     `manual-vendors/{event_id}/` so per-event photos stay grouped.
--   - Render path: r2PublicUrl(R2_BUCKETS.media, photo_r2_key) at the
--     dashboard fetch layer (mirrors service_primary_photo_url
--     resolution in 20260604070000).
--   - NULL when host skipped the photo upload at create-time.
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- 1. event_manual_vendors table
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.event_manual_vendors (
  manual_vendor_id    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id            UUID NOT NULL REFERENCES public.events(event_id) ON DELETE CASCADE,

  -- 4 required fields per owner directive 2026-05-22. CHECK constraints
  -- prevent whitespace-only inserts; the form layer should also reject
  -- these but the DB stays defensive.
  business_name       TEXT NOT NULL CHECK (length(trim(business_name)) > 0),
  contact_person      TEXT NOT NULL CHECK (length(trim(contact_person)) > 0),
  contact_number      TEXT NOT NULL CHECK (length(trim(contact_number)) > 0),

  -- Optional photo — R2 key, not URL. NULL when host skipped upload.
  photo_r2_key        TEXT,

  -- Audit trail. NULL-able created_by_user_id because admin-created rows
  -- on behalf of a host (future scope) wouldn't have a user_id.
  created_by_user_id  UUID REFERENCES auth.users(id),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS event_manual_vendors_event_idx
  ON public.event_manual_vendors(event_id);

ALTER TABLE public.event_manual_vendors ENABLE ROW LEVEL SECURITY;

-- ----------------------------------------------------------------------------
-- 2. RLS policies — hosts can manage; admins can read
-- ----------------------------------------------------------------------------

-- Hosts (event_moderators OR legacy event_members couple) can SELECT,
-- INSERT, UPDATE, DELETE on rows for their events. Pattern follows
-- event_sponsors_host_all in 20260604040000.
DROP POLICY IF EXISTS event_manual_vendors_host_all ON public.event_manual_vendors;
CREATE POLICY event_manual_vendors_host_all ON public.event_manual_vendors
  FOR ALL TO authenticated
  USING (
    event_id IN (
      SELECT event_id FROM public.event_moderators
      WHERE user_id = auth.uid()
        AND accepted_at IS NOT NULL
        AND removed_at IS NULL
    )
    OR event_id IN (
      SELECT event_id FROM public.event_members
      WHERE user_id = auth.uid() AND member_type = 'couple'
    )
    OR public.is_admin()
  )
  WITH CHECK (
    event_id IN (
      SELECT event_id FROM public.event_moderators
      WHERE user_id = auth.uid()
        AND accepted_at IS NOT NULL
        AND removed_at IS NULL
    )
    OR event_id IN (
      SELECT event_id FROM public.event_members
      WHERE user_id = auth.uid() AND member_type = 'couple'
    )
    OR public.is_admin()
  );

-- ----------------------------------------------------------------------------
-- 3. updated_at trigger
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.tg_event_manual_vendors_set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS event_manual_vendors_set_updated_at
  ON public.event_manual_vendors;
CREATE TRIGGER event_manual_vendors_set_updated_at
  BEFORE UPDATE ON public.event_manual_vendors
  FOR EACH ROW
  EXECUTE FUNCTION public.tg_event_manual_vendors_set_updated_at();

COMMENT ON TABLE public.event_manual_vendors IS
  'Host-managed manual vendor contacts (Tito Marcel as Coordinator + Host/MC, family helpers, off-platform suppliers). Reusable across N planning categories — each category attach creates a fresh event_vendors row linked via manual_vendor_id, so per-category status stays independent but contact info edits propagate. Per CLAUDE.md 2026-05-22 owner directive.';

COMMENT ON COLUMN public.event_manual_vendors.photo_r2_key IS
  'R2 object key (NOT URL). Bucket = setnayan-media. Path prefix manual-vendors/{event_id}/. Render via r2PublicUrl at fetch layer.';

-- ----------------------------------------------------------------------------
-- 4. event_vendors.manual_vendor_id link column
-- ----------------------------------------------------------------------------

-- NULL-able link. event_vendors rows fall into 3 buckets after this lands:
--   1. marketplace_vendor_id set  → real vendor_profiles row (richest data)
--   2. manual_vendor_id set       → manual vendor (Photo + Name + Person + Phone)
--   3. both NULL                  → freeform pre-2026-05-22 / off-platform row
-- The three are NOT mutually exclusive at the DB level (a marketplace
-- vendor could also be wrapped as a manual contact for personal-touch
-- contact-person tracking), but in practice the UI only creates one or
-- the other path per insert.
ALTER TABLE public.event_vendors
  ADD COLUMN IF NOT EXISTS manual_vendor_id UUID
    REFERENCES public.event_manual_vendors(manual_vendor_id)
    ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS event_vendors_manual_vendor_idx
  ON public.event_vendors (manual_vendor_id)
  WHERE manual_vendor_id IS NOT NULL;

COMMENT ON COLUMN public.event_vendors.manual_vendor_id IS
  'Links to an event_manual_vendors row when the host attached a manual vendor to this category (one manual vendor can be attached across N categories, each as its own event_vendors row). NULL for marketplace-linked picks (use marketplace_vendor_id instead) and pre-2026-05-22 freeform rows. ON DELETE SET NULL — deleting the manual vendor preserves the event_vendors row.';

COMMIT;
