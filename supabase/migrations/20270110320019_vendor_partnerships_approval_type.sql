-- ============================================================================
-- 20270110320018_vendor_partnerships_approval_type.sql
--
-- Extends admin_approval_requests to support the vendor-partnerships HQ
-- verification queue (PR #11 of the vendor-quality series).
--
-- Changes:
--   1. Drops + recreates the action_type CHECK to add the new value
--      'approve_vendor_partnership'.
--   2. Adds a nullable target_id TEXT column (for non-user targets — vendor
--      partnership bigserial PKs are stored here as text). target_user_id
--      stays for the existing user-escalation actions.
--
-- The approve_vendor_partnership flow:
--   • First admin clicks Approve → INSERT into admin_approval_requests with
--     action_type='approve_vendor_partnership', target_id=partnership row id
--   • Second DIFFERENT admin clicks Confirm → atomic UPDATE claim + execute
--     (sets vendor_partnerships.admin_verified=true).
--   • Four-eyes guarantee: CHECK (decided_by <> initiated_by) + .neq() in app.
-- ============================================================================

-- 1. Add target_id column (nullable; for non-user targets)
ALTER TABLE public.admin_approval_requests
  ADD COLUMN IF NOT EXISTS target_id TEXT;

-- 2. Drop the old CHECK constraint on action_type and recreate it with the
--    new value. (PostgreSQL requires dropping + re-adding named constraints.)
ALTER TABLE public.admin_approval_requests
  DROP CONSTRAINT IF EXISTS admin_approval_requests_action_type_check;

ALTER TABLE public.admin_approval_requests
  ADD CONSTRAINT admin_approval_requests_action_type_check
  CHECK (action_type IN (
    'grant_internal_account',
    'grant_team_pool',
    'promote_to_admin',
    'approve_vendor_partnership'
  ));

-- Index on target_id for fast queue look-ups
CREATE INDEX IF NOT EXISTS admin_approval_requests_target_id_idx
  ON public.admin_approval_requests (target_id)
  WHERE target_id IS NOT NULL;
