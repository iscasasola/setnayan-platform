-- ============================================================================
-- 20260528000000_admin_owned_unclaimed_vendor_profiles.sql
--
-- Extend `vendor_profiles` to support ADMIN-OWNED UNCLAIMED vendors
-- (2026-05-21 owner direction): admin pre-creates a vendor profile that
-- exists in marketplace, but no auth.users account is tied to it until
-- the real vendor signs up via the claim token.
--
-- Schema changes:
--   • `user_id` becomes nullable. UNIQUE on user_id is preserved — Postgres
--     does not consider NULLs equal, so multiple unclaimed rows are allowed.
--   • New column `created_by_admin_user_id` for audit (who pre-created the row).
--   • Admin RLS additions so /admin tools can read/write unclaimed rows.
--   • Index on `created_by_admin_user_id` filtered to unclaimed rows so the
--     /admin/vendors page can list "Pending claim" rows cheaply.
--
-- All additive + backwards-compatible. Existing rows have user_id set, so
-- the regular `user_id = auth.uid()` RLS paths keep working untouched.
--
-- After this migration:
--   • createAdminVendorInvite inserts a vendor_profiles row (user_id=NULL,
--     created_by_admin_user_id=admin) AND links the invite to it via
--     vendor_invites.claimed_vendor_profile_id.
--   • On claim, the finalize page UPDATEs the row's user_id to the
--     claimant. created_by_admin_user_id stays for audit.
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- 1. user_id → nullable
-- ----------------------------------------------------------------------------

ALTER TABLE public.vendor_profiles
  ALTER COLUMN user_id DROP NOT NULL;

COMMENT ON COLUMN public.vendor_profiles.user_id IS
  'Owning auth user. NULL = admin-pre-created and not yet claimed by a '
  'real vendor (see created_by_admin_user_id for audit). The claim flow '
  '(/vendor/claim/[token]/finalize) UPDATEs this column from NULL to the '
  'claimant''s user_id atomically.';

-- ----------------------------------------------------------------------------
-- 2. created_by_admin_user_id (audit)
-- ----------------------------------------------------------------------------

ALTER TABLE public.vendor_profiles
  ADD COLUMN IF NOT EXISTS created_by_admin_user_id UUID
    REFERENCES public.users(user_id) ON DELETE SET NULL;

COMMENT ON COLUMN public.vendor_profiles.created_by_admin_user_id IS
  'Admin who pre-created this vendor profile via /admin/vendors invite '
  'flow. NULL for regular vendor self-signup. Survives the claim — kept '
  'as audit trail of who staged the profile.';

CREATE INDEX IF NOT EXISTS vendor_profiles_unclaimed_idx
  ON public.vendor_profiles(created_by_admin_user_id, created_at DESC)
  WHERE user_id IS NULL;

-- ----------------------------------------------------------------------------
-- 3. Admin RLS — read + write unclaimed rows
-- ----------------------------------------------------------------------------

DROP POLICY IF EXISTS vendor_profiles_admin_unclaimed_read ON public.vendor_profiles;
CREATE POLICY vendor_profiles_admin_unclaimed_read
  ON public.vendor_profiles FOR SELECT
  TO authenticated
  USING (user_id IS NULL AND public.is_admin());

DROP POLICY IF EXISTS vendor_profiles_admin_unclaimed_write ON public.vendor_profiles;
CREATE POLICY vendor_profiles_admin_unclaimed_write
  ON public.vendor_profiles FOR ALL
  TO authenticated
  USING (user_id IS NULL AND public.is_admin())
  WITH CHECK (public.is_admin());

COMMIT;
