-- ============================================================================
-- 20260604070000_vendor_services_primary_photo_and_event_link.sql
--
-- Refinement on PR #341 (Finalized vendor card) per CLAUDE.md 2026-05-22
-- owner directive: the locked-vendor avatar / photo display order on the
-- FinalizedChipStrip + LockedCard variants must be:
--
--   PRIORITY 1: vendor_services.primary_photo_r2_key  ← service photo
--   PRIORITY 2: vendor_profiles.logo_url               ← vendor logo (PR #341)
--   PRIORITY 3: initials placeholder                   ← terracotta circle
--
-- PR #341 ships with priority 2 + 3 only. This migration unlocks the new
-- priority 1 by giving us (a) somewhere to STORE the service's primary
-- photo, and (b) a way to LINK an event_vendors row to the specific
-- service the host booked, so we know which photo to render when multiple
-- services exist for the same vendor.
--
-- Both columns are nullable + non-breaking:
--   - vendor_services rows without a primary_photo_r2_key fall through
--     to vendor_profiles.logo_url at render time.
--   - event_vendors rows without a service_id fall through to the
--     vendor's overall logo (PR #341's existing behavior). Off-platform
--     custom rows where the host typed the vendor name themselves stay
--     unaffected — they don't have a marketplace_vendor_id either, so
--     they go straight to the initials placeholder.
--
-- The FK on event_vendors.service_id is ON DELETE SET NULL so retiring
-- or replacing a service preserves the couple's saved row (matches the
-- existing source_venue_directory_id pattern at 20260530000000).
-- ============================================================================

BEGIN;

-- vendor_services.primary_photo_r2_key
-- R2 object key (not URL — call publicUrlFor / r2PublicUrl at render).
-- Keys typically live under the setnayan-media bucket prefixed by the
-- vendor_profile_id so per-vendor service photos stay grouped.
ALTER TABLE public.vendor_services
  ADD COLUMN IF NOT EXISTS primary_photo_r2_key TEXT;

COMMENT ON COLUMN public.vendor_services.primary_photo_r2_key IS
  'R2 object key for the canonical photo of this service (e.g., bridal-makeup-trial.jpg). Rendered as the first-priority avatar on FinalizedChipStrip + LockedCard. NULL falls back to vendor_profiles.logo_url, then initials.';

-- event_vendors.service_id
-- Links a couple's saved vendor row to the specific vendor_services
-- entry they booked. NULL for off-platform custom rows + for legacy
-- rows from before this column shipped. Per [[feedback_setnayan_orphan_prevention]]
-- the SELECT path treats NULL as "use vendor_profiles.logo_url instead"
-- — no orphan UI, no orphan SQL row.
ALTER TABLE public.event_vendors
  ADD COLUMN IF NOT EXISTS service_id UUID
    REFERENCES public.vendor_services(vendor_service_id)
    ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS event_vendors_service_id_idx
  ON public.event_vendors (service_id)
  WHERE service_id IS NOT NULL;

COMMENT ON COLUMN public.event_vendors.service_id IS
  'Links to the specific vendor_services row the host booked. NULL for off-platform / custom rows and pre-2026-05-22 rows. ON DELETE SET NULL so retiring a service preserves the couple''s saved row.';

COMMIT;
