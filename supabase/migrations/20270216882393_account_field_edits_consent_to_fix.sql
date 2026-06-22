-- ============================================================================
-- 20270216882393_account_field_edits_consent_to_fix.sql
--
-- Admin Account-Access Model — the CONSENT-TO-FIX workflow table (design §4).
-- Backs the in-takeover correction path added in Phase 3b: instead of an admin
-- silently editing a couple's own field while acting as them, the admin
-- PROPOSES a correction, which is queued here with status='awaiting_user' and
-- lands ONLY after the target approves it (or an enforcement basis is recorded).
--
-- Stacks on the Phase-3 takeover scaffold (admin_takeover_sessions /
-- admin_audit_log.takeover_session_id). The act-as surface
-- (app/admin/users/takeover-actions.ts → proposeActAsFieldFix) inserts rows
-- here; the target's /dashboard/account-access page (Phase 3d, extended) reads
-- + approves/declines them.
--
-- FLAG-GATED: no row is ever inserted while the takeover master switch is OFF —
-- proposeActAsFieldFix asserts the flag first. This migration is additive +
-- idempotent and ships with the same flag-gated review as the rest of Phase 3.
-- NOT applied to prod by the author.
--
-- RLS:
--   • Admins (public.is_admin()) read all rows + insert proposals (the
--     service-role client used by the action bypasses RLS, but the policies
--     keep the table coherent for any authenticated admin read).
--   • The TARGET user reads their OWN rows (right-to-know) and may flip an
--     OWN 'awaiting_user' row to 'approved' or 'declined' — never touch
--     another user's row, never alter who/what/before/after, never self-apply.
--     APPLYING an approved edit to the live users row is a separate
--     service-role step (not granted to the user here).
--
-- Idempotent: CREATE TABLE IF NOT EXISTS, inline CHECKs, CREATE INDEX IF NOT
-- EXISTS, DROP/CREATE POLICY.
-- ============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS public.account_field_edits (
  edit_id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  public_id            TEXT UNIQUE NOT NULL DEFAULT public.generate_public_id('F'),

  -- Whose field is being corrected, and which admin proposed it.
  target_user_id       UUID NOT NULL REFERENCES public.users(user_id) ON DELETE CASCADE,
  proposed_by_admin_id UUID NOT NULL REFERENCES public.users(user_id) ON DELETE SET NULL,

  -- Which field + the before/after (JSONB so non-text fields can be carried
  -- later; today the act-as surface only proposes display_name).
  field_key            TEXT NOT NULL CHECK (char_length(field_key) BETWEEN 1 AND 120),
  before_value         JSONB,
  after_value          JSONB,

  -- Lawful basis for the change (design §3). 'user_consent' is the default
  -- act-as path; 'enforcement' is for documented rule-enforcement; the user
  -- approval gate applies to user_consent.
  basis                TEXT NOT NULL DEFAULT 'user_consent'
                         CHECK (basis IN ('user_consent', 'enforcement', 'user_requested')),

  status               TEXT NOT NULL DEFAULT 'awaiting_user'
                         CHECK (status IN ('awaiting_user', 'approved', 'declined', 'applied', 'expired')),

  -- Optional link to the takeover session the proposal was made inside, so the
  -- change report + the user Privacy page can attribute it. ON DELETE SET NULL
  -- because sessions are not deleted in normal operation, but we never want a
  -- proposal row to vanish with one.
  takeover_session_id  UUID REFERENCES public.admin_takeover_sessions(session_id) ON DELETE SET NULL,

  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resolved_at          TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS account_field_edits_target_idx
  ON public.account_field_edits(target_user_id);
CREATE INDEX IF NOT EXISTS account_field_edits_awaiting_idx
  ON public.account_field_edits(target_user_id)
  WHERE status = 'awaiting_user';
CREATE INDEX IF NOT EXISTS account_field_edits_session_idx
  ON public.account_field_edits(takeover_session_id)
  WHERE takeover_session_id IS NOT NULL;

COMMENT ON TABLE public.account_field_edits IS
  'Consent-to-fix workflow (Admin_Account_Access_Model_2026-06-22 §4). An admin proposes a correction to one of a user''s own fields (status=awaiting_user); it lands only after the user approves (basis=user_consent) or with a recorded enforcement basis. Populated by the Phase 3b act-as surface; gated OFF until the takeover flag is enabled.';

ALTER TABLE public.account_field_edits ENABLE ROW LEVEL SECURITY;

-- Admin read + insert (the established admin pattern; the action uses the
-- service-role client, these keep the table coherent for admin reads).
DROP POLICY IF EXISTS account_field_edits_admin_read    ON public.account_field_edits;
DROP POLICY IF EXISTS account_field_edits_admin_insert  ON public.account_field_edits;
DROP POLICY IF EXISTS account_field_edits_target_read   ON public.account_field_edits;
DROP POLICY IF EXISTS account_field_edits_target_decide ON public.account_field_edits;

CREATE POLICY account_field_edits_admin_read
  ON public.account_field_edits FOR SELECT
  TO authenticated
  USING (public.is_admin());

CREATE POLICY account_field_edits_admin_insert
  ON public.account_field_edits FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin());

-- Target reads their OWN proposals (RA 10173 right-to-know).
CREATE POLICY account_field_edits_target_read
  ON public.account_field_edits FOR SELECT
  TO authenticated
  USING (target_user_id = auth.uid());

-- Target APPROVES/DECLINES an OWN awaiting proposal. USING fences the row to
-- their own, still-awaiting rows; WITH CHECK constrains the result to a
-- decided (approved/declined) row that is STILL theirs — so this policy can
-- only ever record the user's decision, never self-apply ('applied' excluded),
-- never reopen, never touch another user's row.
CREATE POLICY account_field_edits_target_decide
  ON public.account_field_edits FOR UPDATE
  TO authenticated
  USING (target_user_id = auth.uid() AND status = 'awaiting_user')
  WITH CHECK (
    target_user_id = auth.uid()
    AND status IN ('approved', 'declined')
  );

-- Tamper-freeze on the IMMUTABLE consent-record columns. RLS WITH CHECK cannot
-- reference OLD values, so a user-decide UPDATE could otherwise rewrite the
-- proposed value (field_key / before_value / after_value / basis /
-- proposed_by_admin_id) while flipping status to 'approved' — and a future
-- service-role apply step that trusted the row would then write a value the
-- USER chose, not the admin. This trigger FREEZES those columns on every
-- UPDATE: any change to them aborts. The admin proposes via INSERT (not
-- subject to this); the user may only move status + resolved_at.
CREATE OR REPLACE FUNCTION public.account_field_edits_freeze_proposal()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.field_key            IS DISTINCT FROM OLD.field_key
     OR NEW.before_value      IS DISTINCT FROM OLD.before_value
     OR NEW.after_value       IS DISTINCT FROM OLD.after_value
     OR NEW.basis             IS DISTINCT FROM OLD.basis
     OR NEW.target_user_id    IS DISTINCT FROM OLD.target_user_id
     OR NEW.proposed_by_admin_id IS DISTINCT FROM OLD.proposed_by_admin_id
     OR NEW.takeover_session_id  IS DISTINCT FROM OLD.takeover_session_id
  THEN
    RAISE EXCEPTION 'account_field_edits: the proposed correction is immutable; an UPDATE may only change status/resolved_at.';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS account_field_edits_freeze ON public.account_field_edits;
CREATE TRIGGER account_field_edits_freeze
  BEFORE UPDATE ON public.account_field_edits
  FOR EACH ROW
  EXECUTE FUNCTION public.account_field_edits_freeze_proposal();

COMMIT;
