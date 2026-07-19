-- ============================================================================
-- Vendor Business Profile · business owner name
-- (Vendor onboarding · required Business Profile · 2026-06-28)
-- ============================================================================
--
-- WHY: the owner's vendor-onboarding spec requires a Business Profile with a
-- distinct "Business Owner" field — the person who owns/represents the business,
-- separate from the login account. vendor_profiles had no column for it; every
-- other required field already existed (business_name, contact_phone,
-- contact_email, hq_address + hq_lat/lng, services, in_business_since_year, and
-- the verification-document flow). This adds the one missing column.
--
-- Nullable + IF NOT EXISTS: existing vendors keep rendering; the "complete your
-- Business Profile" gate (app layer) is what enforces it before a vendor can be
-- published/listed, so we never hard-break a live row with a NOT NULL backfill.
-- Idempotent so a re-run (or a later `supabase db push`) is a no-op. Already
-- applied to prod via MCP on 2026-06-28.
-- ============================================================================

alter table public.vendor_profiles
  add column if not exists business_owner_name text;
