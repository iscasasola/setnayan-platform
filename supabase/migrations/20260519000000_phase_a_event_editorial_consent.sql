-- ============================================================================
-- 20260519000000_phase_a_event_editorial_consent.sql
--
-- Phase A scaffolding for the Event Editorial system per CLAUDE.md decision-log
-- rows 426 + 428 (2026-05-19): captures the couple's onboarding-time consent to
-- have their event landing page (0002 Phase 4) included in the public
-- /weddings showcase index 30 days after the event.
--
-- Ships:
--   (1) public.users.public_summary_consent_at TIMESTAMPTZ NULL
--       — set to NOW() at signup when the consent checkbox is checked.
--       NULL = no consent recorded; couple can still opt in later from
--       /dashboard/{eventId}/privacy (Phase B surface).
--
-- Idempotent (ADD COLUMN IF NOT EXISTS).
-- No backfill: existing users default to NULL (pre-launch, so no production
-- users exist yet; legacy rows can be migrated when Phase B ships the
-- in-dashboard consent toggle).
-- ============================================================================

BEGIN;

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS public_summary_consent_at TIMESTAMPTZ NULL;

COMMENT ON COLUMN public.users.public_summary_consent_at IS
  'When the couple consented (at signup or later via /dashboard/{eventId}/privacy) to having their event landing page (0002 Phase 4) included in the public /weddings showcase index 30 days after the event date. NULL = no consent recorded. Per CLAUDE.md decision-log rows 426 + 428 (2026-05-19) + the 8 RA 10173 safe-harbor guardrails (onboarding checkbox + T+30d grace window + T+27d reminder email + one-click opt-out + pseudonymization + private-always fields + curated photos + right-to-redact). Engineering note: vendors don''t use this column (vendors have no public-event surface); only customers/couples write to it.';

COMMIT;
