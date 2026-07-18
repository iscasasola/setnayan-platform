-- ============================================================================
-- 20270802348062_godparents_ninong_ninang_edges.sql
--
-- Ninong / ninang (godparent) edges on a dependent (date-anchor · Phase 3 ·
-- family graph · COUNSEL-GATED, flag-off). A guardian records their child's
-- godparents (name + email + role) so they can be reminded of the godchild's
-- upcoming birthday and, later, send an e-gift.
--
-- ⚠ Involves a THIRD PARTY's contact (godparent email) + a MINOR (via the
-- dependent). Two-sided consent posture: the guardian adds the edge (consenting
-- to share the child's birthday); the godparent gets an opt-OUT
-- (reminders_enabled + RFC 8058 unsubscribe). Gated app-side behind
-- dependentPeopleEnabled() — the table stays EMPTY in prod until the DPO clears
-- counsel + flips the flag. Merging stores nothing.
--
-- RLS: owner-scoped (owner_user_id = auth.uid()) + admin. Idempotent.
-- ============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS public.godparents (
  id                BIGSERIAL PRIMARY KEY,
  godparent_id      UUID NOT NULL UNIQUE DEFAULT gen_random_uuid(),
  public_id         TEXT NOT NULL UNIQUE DEFAULT public.generate_public_id('G'),
  dependent_id      UUID NOT NULL REFERENCES public.dependents(dependent_id) ON DELETE CASCADE,
  owner_user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  godparent_name    TEXT NOT NULL,
  godparent_email   TEXT,
  role              TEXT,
  reminders_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT godparents_role_check CHECK (role IS NULL OR role IN ('ninong', 'ninang'))
);

CREATE INDEX IF NOT EXISTS godparents_owner_idx ON public.godparents(owner_user_id);
CREATE INDEX IF NOT EXISTS godparents_dependent_idx ON public.godparents(dependent_id);

ALTER TABLE public.godparents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS godparents_owner_all ON public.godparents;
CREATE POLICY godparents_owner_all
  ON public.godparents
  FOR ALL
  TO authenticated
  USING (owner_user_id = auth.uid() OR public.is_admin())
  WITH CHECK (owner_user_id = auth.uid() OR public.is_admin());

COMMENT ON TABLE public.godparents IS
  'Ninong/ninang edges on a dependent (Phase 3 family graph, COUNSEL-GATED). Guardian-created; third-party godparent email + a minor. Gated app-side behind dependentPeopleEnabled() until DPO clearance.';

COMMIT;
