-- ============================================================================
-- Papic — face-tag consent gate (One-Pool spec §3.3–§3.5)
-- ============================================================================
-- Closes the council's biometric blocker: today embedFaces() runs on every
-- capture and a 128-d descriptor is POSTed to the server for EVERY face in
-- frame, gated only by one global env var. This migration adds the two columns
-- the gate is built on:
--
--   1. events.papic_face_mode — the per-event switch that decides whether faces
--      are embedded AT ALL. Default 'mode_b' = NO face embedding computed,
--      transmitted, or stored (the safe default — opt-outs, minors, bystanders,
--      and every generic/shared-QR event are never face-printed). Only 'mode_a'
--      (a per-guest custom-QR opt-in roster) runs the embedder. The application
--      layer ADDITIONALLY forces mode_b for christening/debut event types
--      (lib/papic-face-mode.ts), a defense that does not depend on the stored
--      value.
--
--   2. guest_face_enrollments.consent_copy_version — consent EVIDENCE. The row
--      already records THAT consent was given (consent_at NOT NULL); this
--      records WHAT disclosure copy was shown, so a wording change can force
--      re-consent and Setnayan can prove what a guest saw on a given date. The
--      account-face path already pins ACCOUNT_FACE_CONSENT_VERSION; this brings
--      the per-event path (RSVP, day-of, custom-QR) to parity.
--
-- FLAG-DARK: mode_b is the default, so no event embeds faces after this lands.
-- Real-data activation stays double-locked (NEXT_PUBLIC_FACE_MODEL_URL AND the
-- /admin/data-privacy 'face_enrollment' control) and DPO-gated per spec §7.
--
-- Idempotent. No drops. No RLS change (both are columns on existing RLS tables).
-- ============================================================================

BEGIN;

-- 1. Per-event face mode. mode_b (no embedding) is the fail-closed default.
ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS papic_face_mode TEXT
    NOT NULL DEFAULT 'mode_b'
    CHECK (papic_face_mode IN ('mode_a', 'mode_b'));

COMMENT ON COLUMN public.events.papic_face_mode IS
  'Papic face-tag mode. mode_b (DEFAULT) = no face descriptor is computed, transmitted, or stored for any capture on this event (generic/shared-QR, opt-outs, minors, bystanders never face-printed). mode_a = per-guest custom-QR opt-in roster; only then does the on-device embedder run. The app layer additionally FORCES mode_b for christening/debut event types (lib/papic-face-mode.ts). See One-Pool spec §3.4/§3.5.';

-- 2. Consent-copy version on the per-event enrollment path (consent evidence).
--    Nullable: pre-existing rows have no recorded version; new enrolls on all
--    paths (RSVP / day-of / custom-QR) stamp it (lib/papic-face-mode.ts
--    FACE_CONSENT_COPY_VERSION).
ALTER TABLE public.guest_face_enrollments
  ADD COLUMN IF NOT EXISTS consent_copy_version TEXT;

COMMENT ON COLUMN public.guest_face_enrollments.consent_copy_version IS
  'The face-consent disclosure copy version shown when this enrollment was recorded (RA 10173 informed-consent evidence). Mirrors account_face_profiles.consent_version for the per-event path. Bump lib/papic-face-mode.ts FACE_CONSENT_COPY_VERSION on material copy changes to force re-consent. NULL only on rows predating this column.';

COMMIT;
