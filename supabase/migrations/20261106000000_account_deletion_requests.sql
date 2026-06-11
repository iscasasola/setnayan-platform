-- ============================================================================
-- 20261106000000_account_deletion_requests.sql
--
-- ⚠ RE-TIMESTAMPED 2026-06-11 (was 20261105000000) — that version collided with
-- 20261105000000_defaith_food_canonicals.sql (both PRs picked the same slot and
-- merged to main). Supabase keys applied migrations by the timestamp, so the
-- de-faith one registered version 20261105000000 first and this one would be
-- SILENTLY SKIPPED forever (account_deletion_requests never created on prod).
-- Bumped to the free 20261106000000 slot so it actually applies. Content
-- unchanged + idempotent (CREATE TABLE/INDEX IF NOT EXISTS).
--
-- Self-serve account-deletion REQUEST flow (App Store guideline 5.1.1(v) +
-- Google Play data-deletion requirement). A user must be able to *initiate*
-- account deletion from inside the app — "contact support" is not acceptable.
--
-- CHOSEN DESIGN (owner-locked): "Request + admin review ≤24h". The user files
-- a deletion request in-app; it queues here; an admin approves (which runs the
-- EXISTING hard-delete / blacklist logic in apps/web/app/admin/users/actions.ts)
-- or rejects within 24h. This preserves the business guard on active events /
-- bookings / outstanding balances — an admin sees those before approving.
--
-- This iteration sits on top of the existing soft+hard delete framework
-- (users.deleted_at / users.hard_deleted_at, public.blacklisted_emails, and the
-- admin Delete/Blacklist actions). It does NOT reimplement deletion — it only
-- adds the queued request + admin review state.
--
-- SPEC anchors:
--   02_Specifications/Account_ID_Format.md   (S89X- public id — 'X' = deletion request)
--   02_Specifications/RLS_Policy_Pattern.md   (Pattern A self-row + admin override)
--   Iteration 0025 (Profile Settings · Privacy & Data, RA 10173)
--
-- RLS (enabled at CREATE TABLE time):
--   • A user may INSERT / SELECT their OWN request, and may cancel it
--     (UPDATE → status='cancelled') while it is still pending.
--   • is_admin() may SELECT all + UPDATE status (approve / reject).
--   Admin server actions reach this table via createAdminClient() (service
--   role) which bypasses RLS; the admin policies below are defense-in-depth.
-- ============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS public.account_deletion_requests (
  id            BIGSERIAL PRIMARY KEY,
  request_id    TEXT NOT NULL UNIQUE DEFAULT public.generate_public_id('X'),
  -- Reference auth.users(id) (the canonical user id used across the schema,
  -- e.g. public.users.user_id, event_members.user_id). ON DELETE CASCADE so a
  -- request row disappears when the account is actually hard-deleted on
  -- approval — no orphaned request pointing at a gone user.
  user_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status        TEXT NOT NULL DEFAULT 'pending'
                  CHECK (status IN ('pending', 'approved', 'rejected', 'cancelled')),
  -- Optional free-text reason the user gives when filing the request.
  reason        TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- Admin review metadata. reviewed_by is nullable (set on approve/reject);
  -- ON DELETE SET NULL so removing an admin account doesn't wipe the request.
  reviewed_by   UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_at   TIMESTAMPTZ,
  admin_note    TEXT
);

CREATE INDEX IF NOT EXISTS account_deletion_requests_user_id_idx
  ON public.account_deletion_requests(user_id);
CREATE INDEX IF NOT EXISTS account_deletion_requests_status_idx
  ON public.account_deletion_requests(status);

-- At most one OPEN (pending) request per user. A user can re-request after a
-- prior one was approved / rejected / cancelled, but cannot stack pendings.
CREATE UNIQUE INDEX IF NOT EXISTS account_deletion_requests_one_pending_per_user_idx
  ON public.account_deletion_requests(user_id)
  WHERE status = 'pending';

ALTER TABLE public.account_deletion_requests ENABLE ROW LEVEL SECURITY;

-- ── RLS · Pattern A (self-row) + admin override ─────────────────────────────

-- A user can read their own request rows.
DROP POLICY IF EXISTS adr_user_select_own ON public.account_deletion_requests;
CREATE POLICY adr_user_select_own ON public.account_deletion_requests
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- A user can file a request for themselves only.
DROP POLICY IF EXISTS adr_user_insert_own ON public.account_deletion_requests;
CREATE POLICY adr_user_insert_own ON public.account_deletion_requests
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

-- A user can cancel their OWN request while it is still pending. The USING
-- clause gates which rows are visible to the UPDATE (own + currently pending);
-- the WITH CHECK clause constrains the resulting row so a user can only move
-- it to 'cancelled' (not self-approve to 'approved'). reviewed_by / admin_note
-- stay admin-only because no self-update path other than cancel passes CHECK.
DROP POLICY IF EXISTS adr_user_cancel_own ON public.account_deletion_requests;
CREATE POLICY adr_user_cancel_own ON public.account_deletion_requests
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid() AND status = 'pending')
  WITH CHECK (user_id = auth.uid() AND status = 'cancelled');

-- Admins (is_admin()) can read every request.
DROP POLICY IF EXISTS adr_admin_select_all ON public.account_deletion_requests;
CREATE POLICY adr_admin_select_all ON public.account_deletion_requests
  FOR SELECT TO authenticated
  USING (public.is_admin());

-- Admins can update status (approve / reject) on any request.
DROP POLICY IF EXISTS adr_admin_update_all ON public.account_deletion_requests;
CREATE POLICY adr_admin_update_all ON public.account_deletion_requests
  FOR UPDATE TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

COMMENT ON TABLE public.account_deletion_requests IS
  'Self-serve account-deletion requests (App Store 5.1.1(v) / Google Play). Queued by the user from Profile → Privacy & data; an admin approves (runs the existing hard-delete/blacklist) or rejects within 24h. Iteration 0025.';

COMMIT;
