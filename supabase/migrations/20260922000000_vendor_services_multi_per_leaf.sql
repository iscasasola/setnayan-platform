-- ============================================================================
-- 20260922000000_vendor_services_multi_per_leaf.sql
-- Vendor tier feature #1 — N service listings per leaf category (cap 2/2/5/∞).
-- Canonical: Vendor_Tier_Capability_Matrix_2026-06-07.md ("Creating Package" =
-- # of service listings per leaf, owner-defined 2026-06-07).
--
-- Today `vendor_services` has UNIQUE (vendor_profile_id, category) → max 1
-- listing per leaf. Owner wants multiple distinct offerings per leaf (e.g. 5
-- photo-booth variants), capped by tier. This:
--   1. Drops that UNIQUE so a vendor can hold N rows per category.
--   2. Adds `title` so the N listings are distinguishable to couples (rows were
--      labelled by category only).
--   3. Replaces the UNIQUE's implicit index with a plain index on
--      (vendor_profile_id, category) — the create-time count cap + every
--      existing per-category lookup rely on it.
--
-- Safe: no runtime ON CONFLICT (vendor_profile_id, category) exists in app code
-- (verified); the one-time admin seed that used it has already run. Per-tier
-- count enforcement is app-layer (createVendorService).
-- ============================================================================

ALTER TABLE public.vendor_services
  DROP CONSTRAINT IF EXISTS vendor_services_vendor_profile_id_category_key;

ALTER TABLE public.vendor_services
  ADD COLUMN IF NOT EXISTS title TEXT;

COMMENT ON COLUMN public.vendor_services.title IS
  'Per-listing name so a vendor can offer multiple distinguishable services in one leaf category (e.g. "Classic Booth" vs "360 Booth"). Falls back to the category label when null.';

-- Non-unique replacement index for the implicit one the dropped UNIQUE provided.
CREATE INDEX IF NOT EXISTS vendor_services_vendor_category_idx
  ON public.vendor_services (vendor_profile_id, category);
