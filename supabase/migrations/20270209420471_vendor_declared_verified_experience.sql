-- ============================================================================
-- Vendor declared + DTI-verified experience (service-card trust signal, 2026-06-20)
-- ============================================================================
--
-- WHY: at launch the Setnayan-native experience signals are ~0 (finalized
-- booking count, "eyeing this date") — so a real, established vendor looks brand
-- new. Owner ruling: let vendors DECLARE their experience (years in business +
-- approx weddings done) and VERIFY the years against the DTI registration date
-- already collected in the verification flow, so the card shows a credible,
-- trustworthy experience badge on day one. Verified = a trust check; unverified
-- = shown but marked self-reported.
--
-- Four additive nullable columns on vendor_profiles (idempotent ADD IF NOT EXISTS):
--   in_business_since_year — the year the business started (vendor-declared).
--   weddings_done_approx    — approximate lifetime weddings (vendor-declared).
--   experience_verified_at  — stamped by an admin when the declared year is
--                             confirmed against the DTI doc (NULL = self-reported).
--   experience_verified_by  — the admin who confirmed it (audit; no FK to keep
--                             this purely additive).
-- ============================================================================

BEGIN;

ALTER TABLE public.vendor_profiles
  ADD COLUMN IF NOT EXISTS in_business_since_year SMALLINT
    CHECK (in_business_since_year IS NULL OR (in_business_since_year >= 1900 AND in_business_since_year <= 2100));

ALTER TABLE public.vendor_profiles
  ADD COLUMN IF NOT EXISTS weddings_done_approx INTEGER
    CHECK (weddings_done_approx IS NULL OR weddings_done_approx >= 0);

ALTER TABLE public.vendor_profiles
  ADD COLUMN IF NOT EXISTS experience_verified_at TIMESTAMPTZ;

ALTER TABLE public.vendor_profiles
  ADD COLUMN IF NOT EXISTS experience_verified_by UUID;

COMMIT;
