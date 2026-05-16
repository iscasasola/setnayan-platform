-- ============================================================================
-- 20260515000000_vendor_public_visibility.sql
-- Decision 6 (locked 2026-05-15) — Vendor public_visibility state machine.
--
-- Adds a four-state ENUM controlling how the marketplace surfaces a vendor
-- profile. New default is 'coming_soon': registered-but-unverified vendors
-- now appear publicly with a muted "Coming soon" badge (read-only preview,
-- no booking CTA) instead of being hidden until admin verification flips
-- them to 'verified'.
--
-- States (per 0022 § 2.1c):
--   • hidden       — admin suspension / voluntary withdrawal · not surfaced
--   • coming_soon  — default at registration · publicly listed, read-only
--   • verified     — admin-approved via /admin/verify · fully bookable
--   • archived     — terminal · removed from browse · FK integrity preserved
--
-- Cross-references:
--   • 0022_vendor_dashboard § 2.1 + § 2.1c
--   • 0006_vendors_management § DIY-mode filter popup (Verified-only toggle)
--   • CLAUDE.md decision log 2026-05-15 row "Vendor public-visibility …"
--
-- Coexistence note: the existing `vendor_profiles.is_published` column is
-- preserved untouched. The new `public_visibility` supersedes it logically
-- (verified ≈ is_published=true, others ≈ is_published=false); cleanup is a
-- separate task. Read paths SHOULD prefer public_visibility going forward.
--
-- Audit log: a lightweight admin_audit_log table is created here (does not
-- exist in the schema yet — V1 placeholder so the state machine can write
-- transitions today). The richer 0023 admin_audit_log spec lands later.
--
-- Idempotent.
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- 1. ENUM type
-- ----------------------------------------------------------------------------

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type WHERE typname = 'vendor_public_visibility'
  ) THEN
    CREATE TYPE public.vendor_public_visibility AS ENUM (
      'hidden',
      'coming_soon',
      'verified',
      'archived'
    );
  END IF;
END$$;

-- ----------------------------------------------------------------------------
-- 2. Column on vendor_profiles (this codebase's "vendors" table)
--
-- Default 'coming_soon' so new vendors land publicly-listed-but-not-bookable.
-- Existing rows backfill from is_published: a vendor that was already
-- published is preserved as 'verified' so we don't pull live listings
-- offline on deploy.
-- ----------------------------------------------------------------------------

ALTER TABLE public.vendor_profiles
  ADD COLUMN IF NOT EXISTS public_visibility public.vendor_public_visibility
    NOT NULL DEFAULT 'coming_soon';

-- Backfill — preserve current public state. Run only on rows we haven't
-- already migrated (default-only rows still equal 'coming_soon').
UPDATE public.vendor_profiles
   SET public_visibility = 'verified'
 WHERE is_published = TRUE
   AND public_visibility = 'coming_soon';

CREATE INDEX IF NOT EXISTS vendor_profiles_public_visibility_idx
  ON public.vendor_profiles(public_visibility);

-- ----------------------------------------------------------------------------
-- 3. admin_audit_log — minimal V1 table for state-transition records
--
-- The 0023 admin console iteration will own the canonical schema for this
-- table; we create the columns we need today (action, target, before/after,
-- actor, reason) idempotently so the canonical migration can `ALTER` without
-- conflict. RLS: anon cannot read; admins read everything; nobody writes
-- directly (all writes via service-role from admin actions).
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.admin_audit_log (
  audit_log_id    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  action          TEXT NOT NULL,
  target_table    TEXT,
  target_id       TEXT,
  before_json     JSONB,
  after_json      JSONB,
  reason          TEXT,
  actor_user_id   UUID REFERENCES public.users(user_id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS admin_audit_log_action_idx
  ON public.admin_audit_log(action);
CREATE INDEX IF NOT EXISTS admin_audit_log_target_idx
  ON public.admin_audit_log(target_table, target_id);
CREATE INDEX IF NOT EXISTS admin_audit_log_created_at_idx
  ON public.admin_audit_log(created_at DESC);

ALTER TABLE public.admin_audit_log ENABLE ROW LEVEL SECURITY;

-- Admins can read; nobody writes (writes go through service-role).
DROP POLICY IF EXISTS admin_audit_log_admin_read ON public.admin_audit_log;
CREATE POLICY admin_audit_log_admin_read
  ON public.admin_audit_log FOR SELECT
  TO authenticated
  USING (public.is_admin());

COMMIT;
