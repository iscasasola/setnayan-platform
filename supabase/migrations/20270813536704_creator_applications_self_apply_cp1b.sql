-- ============================================================================
-- 20270813536704_creator_applications_self_apply_cp1b.sql
-- Creator "Adventure Chapter" — self-apply → admin-approve onboarding (CP-1b).
--
-- Spec: ~/Documents/Claude/Projects/Setnayan/
--         Creator_Adventure_Chapter_Build_Plan_2026-07-16.md  (phase CP-1
--         "admin-granted for now; self-apply→approve a follow-up" — this is
--         that follow-up)
--       + Creator_Program_Council_Verdict_2026-07-15.md
--
-- Foundation (PR #3304 / 20270813337233_...cp1): `users.is_creator BOOLEAN
-- DEFAULT FALSE` (access flag, NOT a SKU — creators are FREE) + the creator
-- dashboard. That migration granted creator access ADMIN-ONLY. This one adds
-- the self-serve pipe:
--
--   a non-creator files a creator_applications row (pending) → an admin reviews
--   it in /admin/creator-applications → Approve flips users.is_creator = TRUE +
--   stamps the row approved; Reject stamps it rejected with a note.
--
-- The is_creator grant stays admin-only: NOTHING here writes is_creator, no
-- trigger derives it from a row's status. The ONLY grant path is the admin
-- server action (is_admin()-gated, service-role write) — plus a direct admin
-- DB grant. A user filing/reading their own application row can never make
-- themselves a creator.
--
-- RLS (canonical patterns ONLY — 02_Specifications/RLS_Policy_Pattern.md):
--   • Pattern A — per-user private data: the applicant owns (reads + writes)
--     their own application rows via user_id = auth.uid().
--   • Setnayan admin override — is_admin() full access (Pattern A convention),
--     the read side of the admin queue + the approve/reject writes.
--   No public-read policy: an application is private to its author + admins,
--   so anon/authenticated-other SELECT is intentionally NOT granted.
--
-- Idempotent.
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- creator_applications
--   One row per creator-program application. public_id prefix S89C- (C =
--   Creator family, shared with creator_chapters — the letter is a namespace
--   hint, the 10-char body is random, so reuse is fine and adds no new ID kind).
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.creator_applications (
  id             BIGSERIAL PRIMARY KEY,
  application_id UUID NOT NULL UNIQUE DEFAULT gen_random_uuid(),
  public_id      TEXT NOT NULL UNIQUE DEFAULT public.generate_public_id('C'),

  -- The applicant. Matches Pattern A's user_id = auth.uid() shape.
  user_id        UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  status         TEXT NOT NULL DEFAULT 'pending'
                   CHECK (status IN ('pending', 'approved', 'rejected')),

  -- The applicant's short pitch + their platform links (why they're a creator,
  -- what they make, where their work lives). Free text — surfaced to the admin
  -- reviewer only.
  pitch          TEXT NOT NULL,
  links          TEXT,

  -- Review audit trail. reviewed_by is the admin who actioned it; note is the
  -- admin's rationale (required on reject, optional on approve).
  applied_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  reviewed_at    TIMESTAMPTZ,
  reviewed_by    UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  note           TEXT
);

-- Admin queue read path: pending first, oldest first.
CREATE INDEX IF NOT EXISTS creator_applications_status_idx
  ON public.creator_applications(status, applied_at);
CREATE INDEX IF NOT EXISTS creator_applications_user_id_idx
  ON public.creator_applications(user_id);

-- At most ONE open (pending) application per user — a resubmit after a
-- rejection is allowed (rejected rows don't count), but no double-filing.
CREATE UNIQUE INDEX IF NOT EXISTS creator_applications_one_pending_per_user
  ON public.creator_applications(user_id)
  WHERE status = 'pending';

ALTER TABLE public.creator_applications ENABLE ROW LEVEL SECURITY;

-- Pattern A — the applicant reads + writes their OWN application rows.
DROP POLICY IF EXISTS applicant_owns_application ON public.creator_applications;
CREATE POLICY applicant_owns_application ON public.creator_applications
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Setnayan admin override (read the queue + approve/reject writes).
DROP POLICY IF EXISTS admin_full_access_creator_applications ON public.creator_applications;
CREATE POLICY admin_full_access_creator_applications ON public.creator_applications
  FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

COMMIT;
