-- ============================================================================
-- 20260530000000_event_vendors_venue_directory_link.sql
--
-- Adds a clean link from event_vendors (the couple's plan) back to
-- venue_directory (the V1 read-only PH venue directory) so the
-- PairedVenuePanel "Add to plan" button can save venues without
-- depending on slug-matching against the parallel unclaimed
-- vendor_profiles seed.
--
-- Why a new column instead of marketplace_vendor_id:
--   • venue_directory.slug and vendor_profiles.business_slug don't match
--     consistently across the two parallel seeds (`san-agustin-church`
--     vs `san-agustin-intramuros`, `solaire-resort-manila` vs
--     `solaire-manila`, etc.).
--   • The directory is the canonical "what venue is this" model in V1;
--     the unclaimed vendor_profile may not exist for every directory
--     entry. We don't want save-to-plan to fail when there's no match.
--   • V1.2 venue iteration will reconcile these two models and may
--     deprecate this column once everything routes through
--     vendor_profiles. Until then this link keeps the data clean.
--
-- The unique partial index prevents the same couple from accidentally
-- adding the same venue twice via this button.
-- ============================================================================

BEGIN;

ALTER TABLE public.event_vendors
  ADD COLUMN IF NOT EXISTS source_venue_directory_id UUID
    REFERENCES public.venue_directory(venue_directory_id)
    ON DELETE SET NULL;

CREATE UNIQUE INDEX IF NOT EXISTS event_vendors_unique_directory_pick_per_event
  ON public.event_vendors (event_id, source_venue_directory_id)
  WHERE source_venue_directory_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS event_vendors_source_venue_directory_id_idx
  ON public.event_vendors (source_venue_directory_id)
  WHERE source_venue_directory_id IS NOT NULL;

COMMENT ON COLUMN public.event_vendors.source_venue_directory_id IS
  'When this row was created by the PairedVenuePanel "Add to plan" button, references the directory entry. ON DELETE SET NULL so retiring a directory entry preserves the couple''s saved row.';

COMMIT;
