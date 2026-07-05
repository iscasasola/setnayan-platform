-- guests_face_recognition_excluded
-- Created via `pnpm migration:new`. Idempotent (ADD COLUMN IF NOT EXISTS).

-- ============================================================================
-- Minor safeguard for face recognition (owner-approved 2026-07-05, following
-- the face-vector DPIA finding BV-8: guests carry no age, so nothing structurally
-- stops a MINOR's face from being enrolled for auto-tagging).
--
-- This adds a host-set, per-guest EXCLUDE flag. A host (who knows which guests
-- are children) marks a guest excluded; the enrolment paths then refuse to
-- create a face vector for them, and any existing enrolment is revoked. It
-- collects NO age/birthdate — it is a host attestation, the same "don't run face
-- recognition on minors" minimization the careful industry players rely on
-- (post-2021 Meta / Apple on-device). Real age-gating stays Phase-3 counsel-first.
--
-- Enforcement lives in the enrolment server actions (app/[slug]/actions.ts RSVP
-- path + app/papic/face-enroll-actions.ts day-of); this migration only adds the
-- column. Default FALSE = no behaviour change for existing guests.
-- ============================================================================

ALTER TABLE public.guests
  ADD COLUMN IF NOT EXISTS face_recognition_excluded BOOLEAN NOT NULL DEFAULT FALSE;

COMMENT ON COLUMN public.guests.face_recognition_excluded IS
  'Host-set minor safeguard (DPIA BV-8): when TRUE, this guest is NEVER enrolled in face-recognition auto-tagging and any existing enrolment is revoked. Host attestation (typically "this guest is a minor"); collects no age data. Enforced in the enrolment server actions.';
