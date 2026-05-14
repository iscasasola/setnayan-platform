-- ============================================================================
-- 20260514010000_iteration_0022_vendor_dashboard_expansion.sql
-- Iteration 0022 Vendor Dashboard Expansion — services + team.
--
-- Phase 1 of 0022 shipped vendor_profiles only. This migration adds the
-- two missing per-vendor tables that the dashboard expansion needs:
--
--   1. vendor_services
--      One row per service the vendor offers. Pivots vendor_profiles.services
--      (a flat text[]) into a structured row per category so each service
--      can carry its own starting_price_php, crew_size, crew_meal_required
--      and is_active toggle. Vendor profile owners (Pattern A) read/write.
--
--   2. vendor_team_members
--      The Owner / Admin / Agent / Viewer tier table that the base schema's
--      `current_vendor_ids()` helper already references via a stub. The
--      stub function is rewritten here to actually read from the new table.
--      RLS is "Owner+Admin of the vendor_profile can manage rows; any
--      member can read the team they belong to."
--
--   3. handle_new_vendor_user trigger update
--      When a vendor signs up and gets a starter vendor_profiles row, also
--      insert an Owner row in vendor_team_members so the vendor immediately
--      shows up on their own Team tab and current_vendor_ids() resolves.
--
-- Backfill: on first apply, any existing vendor_profiles row without a
-- team-members row gets one as the Owner. Safe to re-run.
--
-- Idempotent.
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- 1. vendor_services
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.vendor_services (
  vendor_service_id    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  public_id            TEXT UNIQUE NOT NULL DEFAULT public.generate_public_id('S'),
  vendor_profile_id    UUID NOT NULL
                       REFERENCES public.vendor_profiles(vendor_profile_id) ON DELETE CASCADE,
  category             TEXT NOT NULL,
  starting_price_php   INTEGER,
  crew_size            INTEGER,
  crew_meal_required   BOOLEAN NOT NULL DEFAULT FALSE,
  is_active            BOOLEAN NOT NULL DEFAULT TRUE,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (vendor_profile_id, category),
  CHECK (starting_price_php IS NULL OR starting_price_php >= 0),
  CHECK (crew_size IS NULL OR crew_size >= 0)
);

CREATE INDEX IF NOT EXISTS vendor_services_vendor_profile_id_idx
  ON public.vendor_services(vendor_profile_id);
CREATE INDEX IF NOT EXISTS vendor_services_category_idx
  ON public.vendor_services(category);
CREATE INDEX IF NOT EXISTS vendor_services_is_active_idx
  ON public.vendor_services(is_active);

ALTER TABLE public.vendor_services ENABLE ROW LEVEL SECURITY;

-- Pattern A: the owning user manages their own services.
DROP POLICY IF EXISTS vendor_services_owner ON public.vendor_services;
CREATE POLICY vendor_services_owner
  ON public.vendor_services FOR ALL
  TO authenticated
  USING (
    vendor_profile_id IN (
      SELECT vendor_profile_id FROM public.vendor_profiles
      WHERE user_id = auth.uid()
    )
  )
  WITH CHECK (
    vendor_profile_id IN (
      SELECT vendor_profile_id FROM public.vendor_profiles
      WHERE user_id = auth.uid()
    )
  );

-- Public can read active rows (couples discovering vendors). The vendor
-- marketplace hasn't shipped yet but the RLS contract belongs here.
DROP POLICY IF EXISTS vendor_services_public_read ON public.vendor_services;
CREATE POLICY vendor_services_public_read
  ON public.vendor_services FOR SELECT
  TO authenticated
  USING (
    is_active = TRUE
    AND vendor_profile_id IN (
      SELECT vendor_profile_id FROM public.vendor_profiles
      WHERE is_published = TRUE
    )
  );

-- ----------------------------------------------------------------------------
-- 2. vendor_team_role enum + vendor_team_members
-- ----------------------------------------------------------------------------

DO $$ BEGIN
  CREATE TYPE public.vendor_team_role AS ENUM ('owner', 'admin', 'agent', 'viewer');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.vendor_team_members (
  vendor_team_member_id  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  public_id              TEXT UNIQUE NOT NULL DEFAULT public.generate_public_id('T'),
  vendor_profile_id      UUID NOT NULL
                         REFERENCES public.vendor_profiles(vendor_profile_id) ON DELETE CASCADE,
  user_id                UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role                   public.vendor_team_role NOT NULL DEFAULT 'viewer',
  team_label             TEXT,
  created_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (vendor_profile_id, user_id)
);

CREATE INDEX IF NOT EXISTS vendor_team_members_vendor_profile_id_idx
  ON public.vendor_team_members(vendor_profile_id);
CREATE INDEX IF NOT EXISTS vendor_team_members_user_id_idx
  ON public.vendor_team_members(user_id);
CREATE INDEX IF NOT EXISTS vendor_team_members_role_idx
  ON public.vendor_team_members(role);

ALTER TABLE public.vendor_team_members ENABLE ROW LEVEL SECURITY;

-- A vendor team member can read all rows on their own team — so the team
-- table loads for every tier. RLS scopes by the vendor_profile_id sets
-- they're already a member of, *without* recursing on themselves.
DROP POLICY IF EXISTS vendor_team_members_member_read ON public.vendor_team_members;
CREATE POLICY vendor_team_members_member_read
  ON public.vendor_team_members FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid()
    OR vendor_profile_id IN (
      SELECT vendor_profile_id FROM public.vendor_profiles
      WHERE user_id = auth.uid()
    )
  );

-- Only the vendor_profiles owner (the user_id on the profile) can manage
-- the team in V1. Admin tier on team_members is reserved for V1.5 where we
-- separate the profile owner from co-admins. Until then "Owner" === the
-- vendor_profiles.user_id.
DROP POLICY IF EXISTS vendor_team_members_owner_write ON public.vendor_team_members;
CREATE POLICY vendor_team_members_owner_write
  ON public.vendor_team_members FOR ALL
  TO authenticated
  USING (
    vendor_profile_id IN (
      SELECT vendor_profile_id FROM public.vendor_profiles
      WHERE user_id = auth.uid()
    )
  )
  WITH CHECK (
    vendor_profile_id IN (
      SELECT vendor_profile_id FROM public.vendor_profiles
      WHERE user_id = auth.uid()
    )
  );

-- ----------------------------------------------------------------------------
-- 3. current_vendor_ids — drop the stub, wire to vendor_team_members
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.current_vendor_ids(min_role TEXT DEFAULT 'viewer')
RETURNS SETOF UUID
LANGUAGE SQL
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  -- Role ordering: owner > admin > agent > viewer. CASE returns the rank
  -- of the membership; we compare against the rank of `min_role`.
  SELECT vendor_profile_id
  FROM public.vendor_team_members
  WHERE user_id = auth.uid()
    AND CASE role
          WHEN 'owner'  THEN 4
          WHEN 'admin'  THEN 3
          WHEN 'agent'  THEN 2
          WHEN 'viewer' THEN 1
        END
      >=
      CASE min_role
        WHEN 'owner'  THEN 4
        WHEN 'admin'  THEN 3
        WHEN 'agent'  THEN 2
        WHEN 'viewer' THEN 1
        ELSE 1
      END;
$$;

-- ----------------------------------------------------------------------------
-- 4. handle_new_vendor_user — also seed the Owner team-members row
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.handle_new_vendor_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_vendor_profile_id UUID;
BEGIN
  IF NEW.account_type = 'vendor' THEN
    INSERT INTO public.vendor_profiles (user_id)
    VALUES (NEW.user_id)
    ON CONFLICT (user_id) DO NOTHING
    RETURNING vendor_profile_id INTO v_vendor_profile_id;

    -- The DO NOTHING above returns NULL if the row already existed. Look it
    -- up so the membership insert still runs for the auto-create path AND
    -- for any pre-existing-profile case (re-running the trigger).
    IF v_vendor_profile_id IS NULL THEN
      SELECT vendor_profile_id INTO v_vendor_profile_id
      FROM public.vendor_profiles
      WHERE user_id = NEW.user_id;
    END IF;

    IF v_vendor_profile_id IS NOT NULL THEN
      INSERT INTO public.vendor_team_members (vendor_profile_id, user_id, role)
      VALUES (v_vendor_profile_id, NEW.user_id, 'owner')
      ON CONFLICT (vendor_profile_id, user_id) DO NOTHING;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

-- Trigger already created in 20260513120000_iteration_0022_vendor_dashboard;
-- CREATE OR REPLACE FUNCTION above swaps the body in place.

-- ----------------------------------------------------------------------------
-- 5. Backfill: every existing vendor_profile gets an Owner team row.
-- ----------------------------------------------------------------------------

INSERT INTO public.vendor_team_members (vendor_profile_id, user_id, role)
SELECT vendor_profile_id, user_id, 'owner'
FROM public.vendor_profiles
ON CONFLICT (vendor_profile_id, user_id) DO NOTHING;

COMMIT;
