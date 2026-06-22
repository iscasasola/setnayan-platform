-- ============================================================================
-- 20270215789793_admin_takeover_sessions_phase3.sql
--
-- Admin Account-Access Model — PHASE 3 (account takeover / "complete bypass").
-- Governance SCAFFOLD ONLY. Ships FLAG-GATED OFF — prod is byte-identical until
-- the owner flips platform_settings.admin_takeover_enabled (or the
-- ADMIN_TAKEOVER_ENABLED env var) post-review. No live impersonation /
-- session-swap is wired by this migration; it lays the two-admin-gated,
-- notified, change-reported, fully-audited governance substrate.
--
-- Design doc: Admin_Account_Access_Model_2026-06-22.md §4 (data model), §5
-- (takeover security), §10 ("Phase 3 takeover hardening LAST, owner review
-- before prod").
--
-- This migration makes FOUR additive, idempotent changes:
--
--   1. platform_settings.admin_takeover_enabled — the master OFF switch.
--      Tri-state, mirrors setnayan_ai_paywall_enabled exactly:
--        • NULL  → defer to the ADMIN_TAKEOVER_ENABLED env var (default source).
--        • TRUE  → takeover capability ENABLED  (DB overrides env).
--        • FALSE → takeover capability DISABLED (DB overrides env).
--      DEFAULT NULL + no env var set ⇒ resolves to FALSE ⇒ OFF. The resolver
--      lib/admin-takeover-config.ts reads this DB-first, env-fallback.
--
--   2. admin_approval_requests action_type CHECK gains 'start_account_takeover'.
--      A takeover cannot BEGIN without a second admin approving a request of
--      this type (four-eyes, reusing the existing primitive + its CHECK +
--      .neq('initiated_by') atomic-claim guarantee).
--
--   3. admin_takeover_sessions — the scoped session record. Two-admin to start
--      (FK to the approved approval request), user-notified, audited, with a
--      ~8h safety auto-expiry BACKSTOP (a hard cap; the session runs until the
--      admin ends it, the backstop only fires if they forget).
--
--   4. admin_audit_log.takeover_session_id — every in-session admin action is
--      tagged with the session id (design §4 / §5.3).
--
-- RLS: admin-read on the new table (public.is_admin()); writes go through the
-- service-role client after the app-level requireAdmin() guard (the established
-- pattern, e.g. admin_approval_requests). Append-only-ish: only the end-session
-- transition updates a row (ended_at / ended_by), gated in app code.
--
-- Idempotent: CREATE TABLE IF NOT EXISTS, ADD COLUMN IF NOT EXISTS, named-
-- constraint DROP/ADD, DROP/CREATE POLICY.
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- 1. Master OFF switch on the world-readable platform_settings singleton.
--    Tri-state feature toggle (not a credential), mirrors
--    setnayan_ai_paywall_enabled (20270209911535_ai_paywall_flag_db_toggle.sql).
-- ----------------------------------------------------------------------------

ALTER TABLE public.platform_settings
  ADD COLUMN IF NOT EXISTS admin_takeover_enabled BOOLEAN;

COMMENT ON COLUMN public.platform_settings.admin_takeover_enabled IS
  'Admin account-takeover (Phase 3) master switch. Tri-state: NULL = defer to the ADMIN_TAKEOVER_ENABLED env var (which itself defaults OFF); TRUE = takeover enabled; FALSE = takeover disabled. The single highest-risk admin power — ships OFF (NULL + env unset). Owner flips it only after review.';

-- ----------------------------------------------------------------------------
-- 2. Allow 'start_account_takeover' as an admin_approval_requests action_type.
--    The takeover-start flow reuses the four-eyes queue: one admin initiates a
--    request with this type + the target user + a required reason; a DIFFERENT
--    admin approves before the session can begin. Drop + recreate the named
--    CHECK (Postgres requires it for named constraints), keeping every existing
--    value so no in-flight request is invalidated.
-- ----------------------------------------------------------------------------

ALTER TABLE public.admin_approval_requests
  DROP CONSTRAINT IF EXISTS admin_approval_requests_action_type_check;

ALTER TABLE public.admin_approval_requests
  ADD CONSTRAINT admin_approval_requests_action_type_check
  CHECK (action_type IN (
    'grant_internal_account',
    'grant_team_pool',
    'promote_to_admin',
    'approve_vendor_partnership',
    'start_account_takeover'
  ));

-- ----------------------------------------------------------------------------
-- 3. Scoped takeover sessions.
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.admin_takeover_sessions (
  session_id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  public_id           TEXT UNIQUE NOT NULL DEFAULT public.generate_public_id('T'),

  -- Whose account is being accessed, and which admin is acting.
  target_user_id      UUID NOT NULL REFERENCES public.users(user_id) ON DELETE CASCADE,
  admin_user_id       UUID NOT NULL REFERENCES public.users(user_id) ON DELETE CASCADE,

  -- Second admin who approved the start (four-eyes). Captured for the record
  -- even though the FK below points at the approval request itself.
  approved_by         UUID REFERENCES public.users(user_id) ON DELETE SET NULL,

  -- The two-admin handshake that authorized this session. NOT NULL: a session
  -- can never exist without an approved request behind it.
  approval_request_id UUID NOT NULL
                        REFERENCES public.admin_approval_requests(approval_id) ON DELETE RESTRICT,

  -- Required justification (must-fix: reason required before entry).
  reason              TEXT NOT NULL CHECK (char_length(reason) BETWEEN 3 AND 2000),

  started_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ended_at            TIMESTAMPTZ,
  -- Who/what ended it: the acting admin, the user force-ending from their
  -- Privacy page (future wiring), or the safety backstop sweep.
  ended_by            TEXT CHECK (ended_by IN ('admin', 'user_force_end', 'backstop')),

  -- Safety auto-expiry HARD CAP. The session runs until the admin ends it; this
  -- is the backstop so a forgotten session can't stay open indefinitely (~8h).
  expires_at          TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '8 hours'),

  -- ended ⇒ ended_at + ended_by both set (consistency).
  CONSTRAINT admin_takeover_end_consistent
    CHECK ((ended_at IS NULL AND ended_by IS NULL)
        OR (ended_at IS NOT NULL AND ended_by IS NOT NULL)),
  -- An admin can never take over their own account.
  CONSTRAINT admin_takeover_no_self
    CHECK (admin_user_id <> target_user_id)
);

-- One approved handshake → at most one started session: a UNIQUE index on
-- approval_request_id stops a single approval from being replayed into multiple
-- concurrent sessions.
CREATE UNIQUE INDEX IF NOT EXISTS admin_takeover_sessions_approval_uq
  ON public.admin_takeover_sessions(approval_request_id);

-- At most ONE open (not-yet-ended) session per target user at a time.
CREATE UNIQUE INDEX IF NOT EXISTS admin_takeover_sessions_one_open_per_target
  ON public.admin_takeover_sessions(target_user_id)
  WHERE ended_at IS NULL;

CREATE INDEX IF NOT EXISTS admin_takeover_sessions_admin_idx
  ON public.admin_takeover_sessions(admin_user_id);
CREATE INDEX IF NOT EXISTS admin_takeover_sessions_target_idx
  ON public.admin_takeover_sessions(target_user_id);
CREATE INDEX IF NOT EXISTS admin_takeover_sessions_open_idx
  ON public.admin_takeover_sessions(expires_at)
  WHERE ended_at IS NULL;

COMMENT ON TABLE public.admin_takeover_sessions IS
  'Phase 3 admin account-takeover sessions (Admin_Account_Access_Model_2026-06-22 §4/§5). Two-admin to START (approval_request_id → an approved admin_approval_requests row, action_type=start_account_takeover), user-notified on start, change-reported on end, every in-session action tagged in admin_audit_log.takeover_session_id. Runs until the admin ends it; expires_at is the ~8h safety backstop hard cap. SCAFFOLD — gated OFF by platform_settings.admin_takeover_enabled until owner review.';

ALTER TABLE public.admin_takeover_sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS admin_takeover_sessions_admin_read   ON public.admin_takeover_sessions;
DROP POLICY IF EXISTS admin_takeover_sessions_admin_insert ON public.admin_takeover_sessions;
DROP POLICY IF EXISTS admin_takeover_sessions_admin_update ON public.admin_takeover_sessions;

CREATE POLICY admin_takeover_sessions_admin_read
  ON public.admin_takeover_sessions FOR SELECT
  TO authenticated
  USING (public.is_admin());

CREATE POLICY admin_takeover_sessions_admin_insert
  ON public.admin_takeover_sessions FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin());

CREATE POLICY admin_takeover_sessions_admin_update
  ON public.admin_takeover_sessions FOR UPDATE
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- ----------------------------------------------------------------------------
-- 4. Tag every in-session admin action with the takeover session id.
-- ----------------------------------------------------------------------------

ALTER TABLE public.admin_audit_log
  ADD COLUMN IF NOT EXISTS takeover_session_id UUID;

CREATE INDEX IF NOT EXISTS admin_audit_log_takeover_session_idx
  ON public.admin_audit_log(takeover_session_id)
  WHERE takeover_session_id IS NOT NULL;

COMMENT ON COLUMN public.admin_audit_log.takeover_session_id IS
  'When an admin action happens inside a Phase 3 takeover session, this carries the admin_takeover_sessions.session_id so the change report + the user Privacy page can reconstruct exactly what was done during the session.';

COMMIT;
