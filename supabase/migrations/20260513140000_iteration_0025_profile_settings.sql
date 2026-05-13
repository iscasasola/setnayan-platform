-- ============================================================================
-- 20260513140000_iteration_0025_profile_settings.sql
-- Iteration 0025 Profile Settings MVP — soft-delete + marketing opt-in.
--
-- Adds:
--   • users.deleted_at — soft-delete marker. The middleware + dashboard
--     layout reject any session whose user row has deleted_at IS NOT NULL.
--   • users.marketing_opt_in — boolean for the comms section. Defaults
--     FALSE per Philippine RA 10173 opt-in baseline.
--
-- Deferred:
--   • Full notification preferences (per-channel toggles)
--   • Hard delete (RA 10173 §16) — V1 ships soft-delete only; internal
--     admins can hard-delete via Supabase dashboard until iteration 0023
--     gains a "hard delete" admin action.
--   • Face-data revocation (waits on 0012 Papic)
--
-- Idempotent.
-- ============================================================================

BEGIN;

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS marketing_opt_in BOOLEAN NOT NULL DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS users_deleted_at_idx ON public.users(deleted_at);

COMMIT;
