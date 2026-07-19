-- ============================================================================
-- 20270801985629_dependents_guardian_held_people.sql
--
-- The guardian-held DEPENDENT records (date-anchor model · Phase 3 · Family
-- graph). A dependent is a person a user cares for — a child (<18) or an elder
-- (>50) — whose birthdate/sex/religion the guardian stores to derive milestones
-- (1st · 7th · debut · 60th) and their rites.
--
-- ⚠ COUNSEL-GATED. This is the most sensitive data the platform holds: a CHILD's
-- birthdate + religion + sex (RA 10173 minors + §3(l) sensitive PI). The SCHEMA
-- lands here, but ALL writes are gated app-side behind `dependentPeopleEnabled()`
-- (NEXT_PUBLIC_DEPENDENT_PEOPLE, default OFF) — so the table stays EMPTY in
-- production until the DPO/counsel batched review (G1) clears it and the owner
-- flips the flag. Merging this migration stores NO data.
--
-- AGE FENCE (owner rule: birthdate storable only for <18 or >50) is enforced
-- APP-SIDE in lib/dependent-people.ts (fenceBand/isFenceEligible) + the server
-- action — a DB CHECK can't reference now() (age changes over time), so the
-- authoritative gate is code, re-checked on every write.
--
-- RLS: Pattern A (per-user). A dependent is readable/writable ONLY by its owner
-- (owner_user_id = auth.uid()) or an admin. NEVER exposed to any other user.
-- Idempotent: CREATE TABLE IF NOT EXISTS + ENABLE RLS + DROP/CREATE POLICY.
-- ============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS public.dependents (
  id                    BIGSERIAL PRIMARY KEY,
  dependent_id          UUID NOT NULL UNIQUE DEFAULT gen_random_uuid(),
  public_id             TEXT NOT NULL UNIQUE DEFAULT public.generate_public_id('D'),
  owner_user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name                  TEXT NOT NULL,
  -- Sensitive core (all guardian-consented; NULL = not provided).
  birth_date            DATE,
  sex                   TEXT,   -- 'female' | 'male' | NULL (only for the 18F/21M debut derivation)
  religion              TEXT,   -- catholic | muslim | inc | christian | other | NULL (sensitive PI)
  relationship          TEXT,   -- child | parent | grandparent | sibling | other | NULL
  -- RA 10173 durable proof-of-consent (guardian consents on the dependent's behalf).
  birth_date_consent_at TIMESTAMPTZ,
  religion_consent_at   TIMESTAMPTZ,
  -- Age-out: a <18 record hands over to the person's own account at their last
  -- debut milestone (18 F / 21 M). handed_over_at stamps the hand-over; a
  -- claimed record links to the now-adult's own account.
  handed_over_at        TIMESTAMPTZ,
  claimed_user_id       UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT dependents_sex_check CHECK (sex IS NULL OR sex IN ('female', 'male')),
  CONSTRAINT dependents_religion_check CHECK (
    religion IS NULL OR religion IN ('catholic', 'muslim', 'inc', 'christian', 'other')
  ),
  CONSTRAINT dependents_relationship_check CHECK (
    relationship IS NULL OR relationship IN ('child', 'parent', 'grandparent', 'sibling', 'other')
  )
);

CREATE INDEX IF NOT EXISTS dependents_owner_idx ON public.dependents(owner_user_id);

ALTER TABLE public.dependents ENABLE ROW LEVEL SECURITY;

-- Pattern A — owner-scoped, admin override. A dependent's sensitive data is
-- reachable ONLY by the guardian who owns the record (or an admin for support).
DROP POLICY IF EXISTS dependents_owner_all ON public.dependents;
CREATE POLICY dependents_owner_all
  ON public.dependents
  FOR ALL
  TO authenticated
  USING (owner_user_id = auth.uid() OR public.is_admin())
  WITH CHECK (owner_user_id = auth.uid() OR public.is_admin());

COMMENT ON TABLE public.dependents IS
  'Guardian-held dependent records (Phase 3 family graph, COUNSEL-GATED). A child (<18) or elder (>50) the owner plans milestones for. Writes gated app-side behind dependentPeopleEnabled() until DPO clearance. Age fence enforced in code (lib/dependent-people.ts), not a DB CHECK.';

COMMIT;
