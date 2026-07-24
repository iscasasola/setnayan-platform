-- ============================================================================
-- 20270925937630_vendor_registration_number_unique.sql
-- Vendor government registration number → UNIQUE identity (anti-farm guard).
--
-- WHY: a vendor's launch perks (e.g. the "first N bookings free" window) are
-- farmable because NOTHING about a vendor's identity is unique today —
-- business_name / contact_email / contact_phone are all free-text non-unique,
-- and the DTI / BIR-2303 / Mayor's-Permit "documents" live only as opaque R2
-- file refs inside `vendor_verification_applications.doc_uploads` JSONB with no
-- extracted, comparable number. So one person can spin up a second account,
-- re-upload the same papers, and reset the perk clock.
--
-- WHAT this migration owns (data + enforcement ONLY — capture + admin surfacing
-- are separate code concerns in the same PR):
--
--   • vendor_profiles.registration_number_raw          TEXT — exactly what the
--       vendor typed (their BIR TIN / DTI / SEC / permit number), trimmed. For
--       display + admin review. Never uniqueness-checked directly.
--   • vendor_profiles.registration_number_normalized   TEXT — the canonical
--       comparison key: UPPERCASE, all non-alphanumerics stripped. This is the
--       column the UNIQUE index guards. NULL while the vendor hasn't submitted
--       a (valid) number, so the constraint never blocks a fresh/partial shop.
--   • vendor_profiles.registration_number_needs_review BOOLEAN — set TRUE when
--       a submitted number COLLIDES with a number already held by another
--       vendor. The colliding row keeps `registration_number_normalized = NULL`
--       (so the unique index is never violated) but records the raw attempt +
--       this flag, routing the vendor into the existing manual admin
--       verification review instead of hard-blocking them.
--   • vendor_profiles.registration_number_submitted_at TIMESTAMPTZ — audit
--       stamp of the last submission attempt.
--
--   • Partial UNIQUE index on registration_number_normalized WHERE NOT NULL —
--       mirrors the existing `vendor_profiles_business_slug_unique` pattern.
--       This is the actual anti-farm enforcement: two vendors can never both
--       hold the same normalized registration number.
--   • Partial index on registration_number_needs_review WHERE TRUE — a cheap
--       filter for the admin "duplicate identity flagged" review lane.
--
-- RLS: unchanged. vendor_profiles already has RLS enabled with the
-- `vendor_profiles_owner` policy (FOR ALL, user_id = auth.uid()) plus admin /
-- service-role access. Adding columns + indexes does not alter any policy; the
-- owner policy already governs who may write these columns (a vendor writes
-- only their own row). The UNIQUE index is enforced at the storage layer
-- regardless of RLS, which is exactly why collision handling relies on the
-- constraint (SQLSTATE 23505) and not a user-scoped SELECT (which, under RLS,
-- cannot see another vendor's row anyway).
--
-- Idempotent — ADD COLUMN IF NOT EXISTS + CREATE INDEX IF NOT EXISTS. No drops,
-- no backfill (existing shops simply have NULL registration numbers until they
-- next submit).
--
-- Owner-side action after merge:
--   • supabase db push --db-url "$SUPABASE_DB_URL"
-- ============================================================================

BEGIN;

ALTER TABLE public.vendor_profiles
  ADD COLUMN IF NOT EXISTS registration_number_raw TEXT;

ALTER TABLE public.vendor_profiles
  ADD COLUMN IF NOT EXISTS registration_number_normalized TEXT;

ALTER TABLE public.vendor_profiles
  ADD COLUMN IF NOT EXISTS registration_number_needs_review BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE public.vendor_profiles
  ADD COLUMN IF NOT EXISTS registration_number_submitted_at TIMESTAMPTZ;

-- The anti-farm guard. Partial so NULLs (not-yet-submitted / collided rows)
-- never collide with each other or block registration. Mirrors the existing
-- vendor_profiles_business_slug_unique partial-unique pattern.
CREATE UNIQUE INDEX IF NOT EXISTS vendor_profiles_registration_number_unique
  ON public.vendor_profiles (registration_number_normalized)
  WHERE registration_number_normalized IS NOT NULL;

-- Admin review lane: cheaply list the vendors whose submitted number duplicated
-- an already-registered identity.
CREATE INDEX IF NOT EXISTS vendor_profiles_registration_number_needs_review_idx
  ON public.vendor_profiles (registration_number_needs_review)
  WHERE registration_number_needs_review = TRUE;

COMMIT;
