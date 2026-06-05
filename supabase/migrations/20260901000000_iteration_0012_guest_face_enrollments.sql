-- ============================================================================
-- 20260901000000_iteration_0012_guest_face_enrollments.sql
-- Iteration 0001 / 0012 — Guest face enrollments (Papic face-rec source).
--
-- A guest's RSVP selfie is stored here as the per-event face-recognition
-- asset that Papic (0012) will later consume to auto-tag candid photos.
-- Kept separate from guests.photo_url (display) because this row:
--   - carries biometric CONSENT under RA 10173 — consent_at is NOT NULL,
--     so an enrollment cannot exist without a recorded consent timestamp;
--   - is PER-EVENT scoped — a face never matches across weddings;
--   - only ever comes from a real selfie (a Gmail avatar never enrolls).
--
-- Created now even though Papic matching is a LATER build, so nothing
-- re-migrates: face_vector / vector_model stay NULL until the Papic enroller
-- reads asset_url and fills them (and can re-embed when vector_model changes).
--
-- RLS Pattern B (event-scoped; couples write, event members read) plus a
-- guest-reads-own policy mirroring public.guests. Guest-side writes (enroll
-- at RSVP, withdraw consent) go through server actions on the ADMIN client —
-- the same trust model as submitRsvp — so no guest-JWT write policy is needed.
-- ============================================================================

BEGIN;

DO $$ BEGIN
  CREATE TYPE public.face_enrollment_source AS ENUM (
    'rsvp_selfie', 'guest_portal', 'checkin_kiosk'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.guest_face_enrollments (
  id             BIGSERIAL PRIMARY KEY,
  enrollment_id  UUID NOT NULL UNIQUE DEFAULT gen_random_uuid(),
  event_id       UUID NOT NULL REFERENCES public.events(event_id) ON DELETE CASCADE,
  guest_id       UUID NOT NULL REFERENCES public.guests(guest_id) ON DELETE CASCADE,
  asset_url      TEXT NOT NULL,                               -- r2://setnayan-media/... FULL-RES original
  source         public.face_enrollment_source NOT NULL DEFAULT 'rsvp_selfie',
  quality_score  REAL,                                        -- 0..1 from the in-browser gate (NULL if gate unavailable)
  quality_meta   JSONB NOT NULL DEFAULT '{}'::JSONB,          -- {face_count, bbox_ratio, brightness, frontal, gate_version}
  consent_at     TIMESTAMPTZ NOT NULL,                        -- RA 10173 biometric consent — structurally mandatory
  consent_source TEXT NOT NULL DEFAULT 'rsvp',
  face_vector    JSONB,                                       -- NULL until Papic computes embeddings
  vector_model   TEXT,                                        -- e.g. 'arcface-r100@1' — re-embed when this changes
  revoked_at     TIMESTAMPTZ,                                 -- non-null = consent withdrawn; matcher MUST exclude
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS guest_face_enrollments_event_idx
  ON public.guest_face_enrollments(event_id);
CREATE INDEX IF NOT EXISTS guest_face_enrollments_guest_idx
  ON public.guest_face_enrollments(guest_id);

-- At most one LIVE (non-revoked) enrollment per guest per event. Withdrawing
-- consent sets revoked_at, freeing the slot for a fresh enrollment later.
CREATE UNIQUE INDEX IF NOT EXISTS guest_face_enrollments_one_active_per_guest
  ON public.guest_face_enrollments(event_id, guest_id)
  WHERE revoked_at IS NULL;

ALTER TABLE public.guest_face_enrollments ENABLE ROW LEVEL SECURITY;

-- ----------------------------------------------------------------------------
-- RLS — Pattern B (event-scoped collaborative)
-- ----------------------------------------------------------------------------

DROP POLICY IF EXISTS event_member_can_read_face_enrollment ON public.guest_face_enrollments;
CREATE POLICY event_member_can_read_face_enrollment ON public.guest_face_enrollments
  FOR SELECT TO authenticated
  USING (event_id IN (SELECT public.current_event_ids()));

DROP POLICY IF EXISTS couple_writes_face_enrollment ON public.guest_face_enrollments;
CREATE POLICY couple_writes_face_enrollment ON public.guest_face_enrollments
  FOR ALL TO authenticated
  USING (
    event_id IN (
      SELECT event_id FROM public.event_members
      WHERE user_id = auth.uid() AND member_type = 'couple'
    )
    OR public.is_admin()
  )
  WITH CHECK (
    event_id IN (
      SELECT event_id FROM public.event_members
      WHERE user_id = auth.uid() AND member_type = 'couple'
    )
    OR public.is_admin()
  );

-- A registered guest can read their own enrollment row (mirrors
-- guest_reads_own_row on public.guests). Their writes still flow through the
-- admin-client server actions, so no guest write policy is defined.
DROP POLICY IF EXISTS guest_reads_own_face_enrollment ON public.guest_face_enrollments;
CREATE POLICY guest_reads_own_face_enrollment ON public.guest_face_enrollments
  FOR SELECT TO authenticated
  USING (
    guest_id IN (
      SELECT em.guest_id FROM public.event_members em
      WHERE em.user_id = auth.uid() AND em.guest_id IS NOT NULL
    )
  );

COMMENT ON TABLE public.guest_face_enrollments IS
  'Per-event guest face-recognition enrollment from RSVP selfies. Papic (0012) consumes asset_url to auto-tag candid photos. Biometric data under RA 10173 — consent_at mandatory, revoked_at honors withdrawal.';

COMMIT;
