-- ============================================================================
-- 20270804097729_users_self_profile_sex_gender.sql
--
-- Self-profile GENDER (date-anchor model · owner 2026-07-13 "and gender").
-- Sits alongside the self religion + civil_status personalization carve-out
-- (20270732591262). Optional, REFERENCE-ONLY, never required, never shared —
-- used only to personalize the user's OWN milestones (e.g. their debut derives
-- 18th for female / 21st for male, matching the dependent `sex` the anchor
-- model already consumes). Values mirror `dependents.sex`.
--
-- RA 10173: stored with a per-field consent timestamp (stamped on first value,
-- cleared on withdrawal) exactly like religion/civil_status. Idempotent.
-- ============================================================================

BEGIN;

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS sex            TEXT,
  ADD COLUMN IF NOT EXISTS sex_consent_at TIMESTAMPTZ;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'users_sex_check'
  ) THEN
    ALTER TABLE public.users
      ADD CONSTRAINT users_sex_check CHECK (sex IS NULL OR sex IN ('female', 'male'));
  END IF;
END $$;

COMMENT ON COLUMN public.users.sex IS
  'Optional self gender (female|male) — reference-only personalization for the user''s own milestones (debut 18F/21M). Mirrors dependents.sex. Per-field consent in sex_consent_at (RA 10173).';

COMMIT;
