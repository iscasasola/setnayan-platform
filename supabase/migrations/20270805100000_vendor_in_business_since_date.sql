-- ============================================================================
-- 20270805100000_vendor_in_business_since_date.sql
--
-- Adds a precise founding DATE to vendor_profiles so an EXISTING shop's business
-- ANNIVERSARY (and, in its first year, its MONTHSARY) fires on its exact day —
-- not the day it joined Setnayan (owner 2026-07-13: "when they have a business
-- recorded with us as to when they started … they will also have reminders
-- about their business monthsary and anniversary").
--
-- The year-only `in_business_since_year` stays as the completeness/publish field
-- and the fallback; this optional full date supersedes it for the milestone
-- derivation in lib/vendor-milestone.ts when present.
--
-- Nullable, no backfill. vendor_profiles RLS already governs the row, so no
-- policy change is needed. Read defensively (a guarded select) so the app never
-- 42703s during the migration apply-lag window.
-- ============================================================================
ALTER TABLE public.vendor_profiles
  ADD COLUMN IF NOT EXISTS in_business_since_date date;

COMMENT ON COLUMN public.vendor_profiles.in_business_since_date IS
  'Optional precise date the business started (month/day/year). Drives the exact business monthsary/anniversary day in lib/vendor-milestone.ts; year-only in_business_since_year is the fallback + the completeness field. Added 2026-07-13.';
