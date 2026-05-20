-- ============================================================================
-- 20260521000000_iteration_0043_wedding_type_picker.sql
--
-- Iteration 0043 — Wedding-Type Picker (Ceremony × Venue × Sub-type)
-- Spec corpus: 0043_wedding_type_picker/0043_wedding_type_picker.md
--
-- Two-axis picker captured on event creation: ceremony_type + venue_setting,
-- with conditional ceremony_sub_type (for Muslim / Cultural) and
-- secondary_ceremony_type (for Mixed interfaith). Downstream filters
-- (catering faith tags, marketplace defaults, Concierge branching) read these
-- columns to surface the right vendors and copy.
--
-- V1.1 visible faiths: catholic + civil active. INC / Christian / Muslim /
-- Cultural ship as "Coming Soon" cards that capture interest via
-- couple_wedding_type_notify_signups. wedding_type_launch_status is the
-- admin-toggled per-region visibility table so a faith can flip to active
-- once vendor density crosses the threshold.
--
-- Idempotent. Defaults of catholic + banquet_hall reflect the PH baseline so
-- existing events backfill cleanly with no owner action.
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- 1. events ALTER — add ceremony_type, venue_setting, sub-type, mixed flag
-- ----------------------------------------------------------------------------

ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS ceremony_type TEXT NOT NULL DEFAULT 'catholic',
  ADD COLUMN IF NOT EXISTS venue_setting TEXT NOT NULL DEFAULT 'banquet_hall',
  ADD COLUMN IF NOT EXISTS ceremony_sub_type TEXT,
  ADD COLUMN IF NOT EXISTS is_mixed_ceremony BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS secondary_ceremony_type TEXT;

-- Enum-style CHECK constraints. Re-create idempotently.
ALTER TABLE public.events DROP CONSTRAINT IF EXISTS events_ceremony_type_check;
ALTER TABLE public.events
  ADD CONSTRAINT events_ceremony_type_check
  CHECK (ceremony_type IN ('catholic','civil','inc','christian','muslim','cultural','mixed'));

ALTER TABLE public.events DROP CONSTRAINT IF EXISTS events_venue_setting_check;
ALTER TABLE public.events
  ADD CONSTRAINT events_venue_setting_check
  CHECK (venue_setting IN ('banquet_hall','garden','beach','destination','heritage','outdoor_tent','civil_registrar'));

ALTER TABLE public.events DROP CONSTRAINT IF EXISTS events_secondary_ceremony_check;
ALTER TABLE public.events
  ADD CONSTRAINT events_secondary_ceremony_check
  CHECK (
    secondary_ceremony_type IS NULL
    OR secondary_ceremony_type IN ('catholic','civil','inc','christian','muslim','cultural')
  );

-- Conditional integrity: sub-type required for muslim/cultural; secondary
-- required when is_mixed_ceremony = TRUE. Spec § Schema.
ALTER TABLE public.events DROP CONSTRAINT IF EXISTS events_sub_type_required_when_muslim_or_cultural;
ALTER TABLE public.events
  ADD CONSTRAINT events_sub_type_required_when_muslim_or_cultural
  CHECK (
    ceremony_type NOT IN ('muslim','cultural')
    OR ceremony_sub_type IS NOT NULL
  );

ALTER TABLE public.events DROP CONSTRAINT IF EXISTS events_secondary_required_when_mixed;
ALTER TABLE public.events
  ADD CONSTRAINT events_secondary_required_when_mixed
  CHECK (
    is_mixed_ceremony = FALSE
    OR secondary_ceremony_type IS NOT NULL
  );

CREATE INDEX IF NOT EXISTS events_ceremony_type_idx
  ON public.events (ceremony_type);
CREATE INDEX IF NOT EXISTS events_venue_setting_idx
  ON public.events (venue_setting);

-- ----------------------------------------------------------------------------
-- 2. vendor_profiles ALTER — compatibility tags
--
-- Per spec § Vendor compatibility tags. Defaults reflect the broad PH
-- baseline (catholic + civil + christian on the ceremony axis; banquet_hall +
-- garden + heritage on the venue axis). Vendors who serve INC, Muslim,
-- Cultural, beach, destination, outdoor_tent, or civil_registrar must
-- explicitly opt in during onboarding — this protects couples from
-- accidentally seeing incompatible vendors (e.g., an alcohol-served caterer
-- surfaced to an INC couple).
-- ----------------------------------------------------------------------------

ALTER TABLE public.vendor_profiles
  ADD COLUMN IF NOT EXISTS compatible_ceremony_types TEXT[]
    NOT NULL DEFAULT ARRAY['catholic','civil','christian']::TEXT[],
  ADD COLUMN IF NOT EXISTS compatible_venue_settings TEXT[]
    NOT NULL DEFAULT ARRAY['banquet_hall','garden','heritage']::TEXT[];

CREATE INDEX IF NOT EXISTS vendor_profiles_ceremony_compat_idx
  ON public.vendor_profiles USING GIN (compatible_ceremony_types);
CREATE INDEX IF NOT EXISTS vendor_profiles_venue_compat_idx
  ON public.vendor_profiles USING GIN (compatible_venue_settings);

-- ----------------------------------------------------------------------------
-- 3. wedding_type_launch_status — admin-toggleable per-region visibility
--
-- Per spec § wedding_type_launch_status. V1.1 ships catholic + civil active
-- everywhere; the other four are "coming_soon" until vendor density crosses
-- the per-region threshold and an admin flips status to 'active'. The
-- current_vendor_count is intentionally NOT auto-maintained in this
-- migration — that job lands later with the vendor onboarding flow that
-- writes compatibility tags. For now admins flip status manually.
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.wedding_type_launch_status (
  ceremony_type           TEXT NOT NULL
                          CHECK (ceremony_type IN ('catholic','civil','inc','christian','muslim','cultural')),
  region                  TEXT NOT NULL,
  status                  TEXT NOT NULL DEFAULT 'coming_soon'
                          CHECK (status IN ('active','coming_soon','disabled')),
  vendor_count_threshold  INT NOT NULL DEFAULT 20,
  current_vendor_count    INT NOT NULL DEFAULT 0,
  notify_signups_count    INT NOT NULL DEFAULT 0,
  activated_at            TIMESTAMPTZ,
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (ceremony_type, region)
);

-- V1.1 launch seed. ON CONFLICT keeps the migration idempotent — re-runs
-- preserve any admin edits to status / threshold / counts.
INSERT INTO public.wedding_type_launch_status (ceremony_type, region, status, activated_at)
VALUES
  ('catholic',  'all', 'active',      NOW()),
  ('civil',     'all', 'active',      NOW()),
  ('christian', 'all', 'coming_soon', NULL),
  ('inc',       'all', 'coming_soon', NULL),
  ('muslim',    'all', 'coming_soon', NULL),
  ('cultural',  'all', 'coming_soon', NULL)
ON CONFLICT (ceremony_type, region) DO NOTHING;

ALTER TABLE public.wedding_type_launch_status ENABLE ROW LEVEL SECURITY;

-- Anyone signed in (couples, vendors, anon checking the picker) reads the
-- status to decide which cards render as "Coming Soon". Writes are
-- admin-only — the picker UI flips status via the admin console once a
-- region's vendor density warrants it.
DROP POLICY IF EXISTS wedding_type_launch_status_read_all ON public.wedding_type_launch_status;
CREATE POLICY wedding_type_launch_status_read_all
  ON public.wedding_type_launch_status FOR SELECT
  TO anon, authenticated
  USING (TRUE);

DROP POLICY IF EXISTS wedding_type_launch_status_admin_write ON public.wedding_type_launch_status;
CREATE POLICY wedding_type_launch_status_admin_write
  ON public.wedding_type_launch_status FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- ----------------------------------------------------------------------------
-- 4. couple_wedding_type_notify_signups — email capture for inactive faiths
--
-- Per spec § couple_wedding_type_notify_signups. Couples picking an inactive
-- faith can opt into a notify-on-launch email. user_id is nullable so the
-- form works pre-account; the signup is later attributed to a user via a
-- batch reconciliation job (out of scope for V1.1 base).
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.couple_wedding_type_notify_signups (
  signup_id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                UUID REFERENCES public.users(user_id) ON DELETE SET NULL,
  email                  TEXT NOT NULL,
  ceremony_type_interested TEXT NOT NULL
                         CHECK (ceremony_type_interested IN ('catholic','civil','inc','christian','muslim','cultural')),
  region                 TEXT,
  expected_wedding_date  DATE,
  notes                  TEXT,
  notified_at            TIMESTAMPTZ,
  created_at             TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS notify_signups_ceremony_type_idx
  ON public.couple_wedding_type_notify_signups (ceremony_type_interested);
CREATE INDEX IF NOT EXISTS notify_signups_email_idx
  ON public.couple_wedding_type_notify_signups (LOWER(email));

ALTER TABLE public.couple_wedding_type_notify_signups ENABLE ROW LEVEL SECURITY;

-- Anyone can submit a notify signup (form works pre-account). Reads are
-- limited to the signing-up user (when user_id matches) plus admins for
-- recruitment dashboards.
DROP POLICY IF EXISTS notify_signups_insert_any ON public.couple_wedding_type_notify_signups;
CREATE POLICY notify_signups_insert_any
  ON public.couple_wedding_type_notify_signups FOR INSERT
  TO anon, authenticated
  WITH CHECK (TRUE);

DROP POLICY IF EXISTS notify_signups_read_own_or_admin ON public.couple_wedding_type_notify_signups;
CREATE POLICY notify_signups_read_own_or_admin
  ON public.couple_wedding_type_notify_signups FOR SELECT
  TO authenticated
  USING (user_id = auth.uid() OR public.is_admin());

DROP POLICY IF EXISTS notify_signups_admin_update ON public.couple_wedding_type_notify_signups;
CREATE POLICY notify_signups_admin_update
  ON public.couple_wedding_type_notify_signups FOR UPDATE
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

COMMIT;
