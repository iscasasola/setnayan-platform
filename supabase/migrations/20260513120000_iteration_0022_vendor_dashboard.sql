-- ============================================================================
-- 20260513120000_iteration_0022_vendor_dashboard.sql
-- Iteration 0022 Vendor Dashboard MVP — vendor-side accounts + profile.
--
-- The `account_type` enum already includes 'vendor' (Sprint 0). What this
-- migration adds:
--   1. `vendor_profiles` — one row per vendor user, owned via user_id.
--      Holds business name, slug, logo URL, services array, contact info.
--      Pattern A RLS (owner-only).
--   2. Updates the on_auth_user_created trigger to read
--      `raw_user_meta_data->>'account_type'` so vendor signups land with
--      the right type. The signup form posts this metadata.
--   3. A second trigger that auto-creates a starter vendor_profiles row
--      when a vendor user lands, so the dashboard never opens to a missing
--      record.
--
-- Deferred:
--   • Mandatory-logo enforcement (UI-only V1; couples don't see profiles yet)
--   • Logo upload to R2 (V1 stores a URL string)
--   • Public vendor pages at /v/[slug]
--   • Linking event_vendors (couple-side) to vendor_profiles (vendor-side)
--   • Chat identity masking (waits on 0019 communications)
--
-- Idempotent.
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- 1. vendor_profiles
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.vendor_profiles (
  vendor_profile_id  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  public_id          TEXT UNIQUE NOT NULL DEFAULT public.generate_public_id('B'),
  user_id            UUID NOT NULL UNIQUE
                     REFERENCES public.users(user_id) ON DELETE CASCADE,
  business_name      TEXT NOT NULL DEFAULT '',
  business_slug      TEXT,
  tagline            TEXT,
  logo_url           TEXT,
  services           TEXT[] NOT NULL DEFAULT '{}',
  location_city      TEXT,
  website            TEXT,
  contact_email      TEXT,
  contact_phone      TEXT,
  is_published       BOOLEAN NOT NULL DEFAULT FALSE,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Case-insensitive slug uniqueness, only when set.
CREATE UNIQUE INDEX IF NOT EXISTS vendor_profiles_business_slug_unique
  ON public.vendor_profiles (LOWER(business_slug))
  WHERE business_slug IS NOT NULL;

CREATE INDEX IF NOT EXISTS vendor_profiles_user_id_idx
  ON public.vendor_profiles(user_id);

ALTER TABLE public.vendor_profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS vendor_profiles_owner ON public.vendor_profiles;
CREATE POLICY vendor_profiles_owner
  ON public.vendor_profiles FOR ALL
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- ----------------------------------------------------------------------------
-- 2. on_auth_user_created — read account_type from user metadata
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_is_internal    BOOLEAN := FALSE;
  v_requested      TEXT;
  v_account_type   public.account_type := 'customer';
BEGIN
  -- § 10a internal accounts auto-flag. Owner email hard-coded; spouse
  -- and team members flip via the admin console (iteration 0023).
  IF NEW.email = 'iscasasolaii@gmail.com' THEN
    v_is_internal := TRUE;
  END IF;

  v_requested := NEW.raw_user_meta_data->>'account_type';
  IF v_requested IN ('customer', 'vendor') THEN
    v_account_type := v_requested::public.account_type;
  END IF;

  INSERT INTO public.users (user_id, email, account_type, is_internal)
  VALUES (NEW.id, NEW.email, v_account_type, v_is_internal)
  ON CONFLICT (user_id) DO NOTHING;

  RETURN NEW;
END;
$$;

-- The trigger itself was created in Sprint 0; CREATE OR REPLACE FUNCTION
-- above swaps the body without rebinding the trigger.

-- ----------------------------------------------------------------------------
-- 3. Auto-create vendor_profiles when a vendor user lands
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.handle_new_vendor_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.account_type = 'vendor' THEN
    INSERT INTO public.vendor_profiles (user_id)
    VALUES (NEW.user_id)
    ON CONFLICT (user_id) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_users_vendor_created ON public.users;
CREATE TRIGGER on_users_vendor_created
  AFTER INSERT ON public.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_vendor_user();

COMMIT;
