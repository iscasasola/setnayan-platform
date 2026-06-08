-- ============================================================================
-- 20260925001000_vendor_services_daily_capacity.sql
-- Vendor tier feature #2 — per-service daily booking capacity.
-- Canonical: Vendor_Tier_Capability_Matrix_2026-06-07.md ("Slot per day" =
-- vendor-declared daily booking capacity per service; owner 2026-06-07).
--
-- A vendor declares how many of a service they can serve per day (e.g. a
-- photobooth vendor with 2 booths → 2). The tier caps the MAX declarable
-- (slotsPerDay: FREE 0 · VERIFIED 1 · PRO 3 · ENTERPRISE ∞ — enforced app-side
-- on create/update). `finalizeVendor` then blocks a booking once that service
-- already has `daily_capacity` confirmed bookings on the wedding's date.
--
-- NULL = unset → no per-service daily cap (the vendor-level soft-hold gate +
-- tier slot allowance still apply). Enterprise time-bound slots (#3) layer a
-- separate time-of-day model on top later.
-- ============================================================================

ALTER TABLE public.vendor_services
  ADD COLUMN IF NOT EXISTS daily_capacity INT
    CHECK (daily_capacity IS NULL OR daily_capacity > 0);

COMMENT ON COLUMN public.vendor_services.daily_capacity IS
  'Vendor-declared max bookings/day for this service (tier feature #2). NULL = unset. The tier caps the max declarable (slotsPerDay); finalizeVendor enforces same-date confirmed-booking count < daily_capacity.';
