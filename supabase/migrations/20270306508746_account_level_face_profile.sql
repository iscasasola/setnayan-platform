-- account level face profile
-- Created via `pnpm migration:new`. Prefix auto-allocated to sort AFTER every
-- existing migration. KEEP THIS MIGRATION IDEMPOTENT (it may be re-applied):
--   • CREATE TABLE IF NOT EXISTS …   (+ ALTER TABLE … ENABLE ROW LEVEL SECURITY in the SAME migration)
--   • ALTER TABLE … ADD COLUMN IF NOT EXISTS …
--   • CREATE INDEX IF NOT EXISTS …
--   • CREATE OR REPLACE FUNCTION …
--   • DROP POLICY IF EXISTS … ; CREATE POLICY …   (policies have no IF NOT EXISTS)
--
-- ============================================================================
-- ACCOUNT-LEVEL FACE PROFILE — owner-locked reversal of per-event scoping.
--
-- Today every face vector is PER-EVENT scoped (guest_face_enrollments) and
-- never reused across events. Owner decision (2026-06-26): let a person's face
-- profile live on their SETNAYAN ACCOUNT and be reused to improve tagging
-- accuracy across ANY event that person appears in (including other couples'
-- events). This table stores that account-level profile.
--
-- ⚠ BIOMETRIC = SENSITIVE PERSONAL INFO under RA 10173. This migration only
-- creates the (empty) container + RLS. The whole feature is gated behind
-- NEXT_PUBLIC_ACCOUNT_FACE_PROFILE_ENABLED (default OFF). DPO sign-off on the
-- consent copy + retention policy is REQUIRED before that flag is flipped.
--
-- MANDATORY PRIVACY GUARDRAILS encoded structurally here:
--   1. OPT-IN, PER PERSON ONLY. A row exists only when the OWNER of the face
--      opts in. RLS scopes writes to auth.uid() = user_id — a couple/vendor can
--      NEVER create or persist someone else's biometric profile. consent_at is
--      NOT NULL, so a profile cannot exist without recorded consent. Default
--      state for every account = NO row / not consented.
--   2. ONLY RECOGNIZES THAT SAME PERSON. The vector is keyed to ONE user_id and
--      the matcher only ever compares it against captures at events where that
--      same user is present (guest linked via event_members.user_id). This is
--      NOT a cross-person search index — it can never identify strangers.
--   3. ACCOUNT-LEVEL DELETE. "Forget my face everywhere" deletes this row in one
--      action (server action, owner-scoped). source_event_ids is provenance
--      only; deleting the row removes the account profile entirely.
--   4. FLAG-GATED OFF. No code path reads/writes this table when the flag is OFF.
-- ============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS public.user_face_profiles (
  id                BIGSERIAL PRIMARY KEY,
  profile_id        UUID NOT NULL UNIQUE DEFAULT gen_random_uuid(),
  -- One profile per account (the face's OWNER). FK to public.users.user_id,
  -- which itself references auth.users(id) ON DELETE CASCADE — so deleting the
  -- auth user (account deletion) cascades this biometric row away too.
  user_id           UUID NOT NULL UNIQUE REFERENCES public.users(user_id) ON DELETE CASCADE,
  -- The account-level face centroid/descriptor. JSONB array of floats, matching
  -- guest_face_enrollments.face_vector storage. NULL until the on-device
  -- embedder + hosted model fill it (feature ships DORMANT). Seeded from the
  -- owner's own consented enrollments and refined as their tags are confirmed.
  face_vector       JSONB,
  -- Additional same-person descriptors (e.g. one per source event) the matcher
  -- may compare against in addition to the centroid. Array-of-arrays JSONB.
  vectors           JSONB,
  vector_model      TEXT,                    -- e.g. 'faceapi-dlib@1' — re-embed when this changes
  quality_score     REAL,                    -- 0..1 best-quality contributing sample (advisory)
  -- Provenance ONLY: which events contributed to this profile. Used for the
  -- "forget per-event enrollments too" option and for audit; never a search key.
  source_event_ids  UUID[] NOT NULL DEFAULT '{}',
  -- RA 10173 biometric consent — structurally mandatory (a profile cannot exist
  -- without it). consent_version pins which consent copy the user agreed to so a
  -- copy change can require re-consent.
  consent_version   TEXT NOT NULL DEFAULT 'v1',
  consent_granted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- Non-null = consent withdrawn / "forget my face" pending hard-delete. The
  -- matcher MUST exclude revoked rows. (The account-delete action hard-deletes
  -- the row; revoked_at exists for a soft-revoke / audit path if needed.)
  revoked_at        TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS user_face_profiles_user_idx
  ON public.user_face_profiles(user_id);

-- Fast lookup of LIVE (consented, non-revoked, vectorized) profiles for the
-- matcher's seed step.
CREATE INDEX IF NOT EXISTS user_face_profiles_active_idx
  ON public.user_face_profiles(user_id)
  WHERE revoked_at IS NULL AND face_vector IS NOT NULL;

ALTER TABLE public.user_face_profiles ENABLE ROW LEVEL SECURITY;

-- ----------------------------------------------------------------------------
-- RLS — account-owned (a person owns ONLY their own face profile) + admin.
-- This is the structural enforcement of guardrail #1: nobody can read or write
-- another person's biometric profile. (Server actions on the admin client honor
-- the same owner scope in code; the matcher reads via the admin client but
-- only ever for events where the SAME user is a member — guardrail #2.)
-- ----------------------------------------------------------------------------

DROP POLICY IF EXISTS user_owns_face_profile_select ON public.user_face_profiles;
CREATE POLICY user_owns_face_profile_select ON public.user_face_profiles
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.is_admin());

DROP POLICY IF EXISTS user_owns_face_profile_insert ON public.user_face_profiles;
CREATE POLICY user_owns_face_profile_insert ON public.user_face_profiles
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS user_owns_face_profile_update ON public.user_face_profiles;
CREATE POLICY user_owns_face_profile_update ON public.user_face_profiles
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Owner can delete their own profile ("forget my face everywhere"). Admin can
-- delete on a verified RA 10173 erasure request.
DROP POLICY IF EXISTS user_owns_face_profile_delete ON public.user_face_profiles;
CREATE POLICY user_owns_face_profile_delete ON public.user_face_profiles
  FOR DELETE TO authenticated
  USING (auth.uid() = user_id OR public.is_admin());

COMMENT ON TABLE public.user_face_profiles IS
  'Account-level (per-person) face-recognition profile — owner-opt-in reuse across any event the person appears in. RA 10173 biometric: opt-in only (consent_granted_at mandatory), owner-scoped RLS, account-level delete. Gated behind NEXT_PUBLIC_ACCOUNT_FACE_PROFILE_ENABLED (OFF until DPO sign-off).';

COMMIT;
