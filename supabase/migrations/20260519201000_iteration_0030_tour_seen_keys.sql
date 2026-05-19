-- ============================================================================
-- 20260519201000_iteration_0030_tour_seen_keys.sql
--   (renamed from 20260519200000_* to break a timestamp collision with
--   20260519200000_vendor_invites_foundation.sql; +1-minute offset per the
--   CI migration-timestamp-guard playbook. No DDL change — file rename only.)
-- Iteration 0030 — per-tour completion tracking.
--
-- The MVP migration (20260513180000) added a single `users.tour_completed_at`
-- timestamp. That covered the single-welcome-tour case (couple OR vendor)
-- but can't track per-surface mini-tours or per-role welcomes (admin, guest).
--
-- This migration adds `tour_seen_keys TEXT[]` so the application can:
--   • Track an arbitrary set of tour keys the user has dismissed
--   • Re-fire the welcome tour if a specific key is removed (replay UX)
--   • Add new tour keys later without schema changes
--
-- Backfill: every user with a non-null `tour_completed_at` is treated as
-- having dismissed both the couple AND vendor welcome tours. The
-- application code reconciles this so dual-role users aren't shown the
-- legacy welcome twice.
--
-- Idempotent.
-- ============================================================================

BEGIN;

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS tour_seen_keys TEXT[] NOT NULL DEFAULT '{}';

-- Backfill: copy the legacy single-flag into the new array so users who've
-- already dismissed their welcome don't see it again.
UPDATE public.users
SET tour_seen_keys = ARRAY['couple_welcome_v1', 'vendor_welcome_v1']
WHERE tour_completed_at IS NOT NULL
  AND COALESCE(array_length(tour_seen_keys, 1), 0) = 0;

COMMIT;
