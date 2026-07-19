-- guest_capture_public_consent
-- Created via `pnpm migration:new`. Prefix auto-allocated to sort AFTER every
-- existing migration. KEEP THIS MIGRATION IDEMPOTENT (it may be re-applied):
--   • CREATE TABLE IF NOT EXISTS …   (+ ALTER TABLE … ENABLE ROW LEVEL SECURITY in the SAME migration)
--   • ALTER TABLE … ADD COLUMN IF NOT EXISTS …
--   • CREATE INDEX IF NOT EXISTS …
--   • CREATE OR REPLACE FUNCTION …
--   • DROP POLICY IF EXISTS … ; CREATE POLICY …   (policies have no IF NOT EXISTS)

-- ============================================================================
-- 0012 Papic → Alaala — GUEST consent gate on the guest-camera capture path.
-- ============================================================================
--
-- The Alaala memory orb (project_setnayan_alaala_orb_video_consent) surfaces a
-- Papic clip on a PUBLIC showcase ONLY when BOTH gates are true:
--   • consent_to_public            — the GUEST opted in to public sharing
--   • couple_approved_for_showcase — the COUPLE picked the clip
--
-- #2060 added BOTH columns to papic_photos (the SEAT / paparazzi capture table)
-- and shipped the couple-approval toggle. But a GUEST who shoots through the
-- Papic Guest camera writes to a DIFFERENT table — papic_guest_captures (the
-- per-guest capture ledger; see 20260718000000) — which had no consent column
-- and no guest-facing way to set one. So the guest's own captures could never
-- carry their public-sharing consent: the upstream gate had no producer.
--
-- This migration closes that gap. It mirrors papic_photos.consent_to_public
-- onto papic_guest_captures (the guest consents to THEIR OWN recordings), and
-- threads the flag through the quota-enforcing papic_record_guest_capture RPC
-- so the capture-time opt-in writes it on the row it inserts.
--
-- IMPORTANT scope note: this is the GUEST self-consent for guest-CAPTURED media
-- only. Paparazzi-seat clips are captured by the photographer, not the guest
-- who appears in them — those need a different consent model and stay out of
-- scope (papic_photos.consent_to_public there is the appearing-guest's consent,
-- a separate follow-up). Additive + idempotent; no RLS change — the new column
-- rides papic_guest_captures' existing policies.

ALTER TABLE public.papic_guest_captures
  ADD COLUMN IF NOT EXISTS consent_to_public boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.papic_guest_captures.consent_to_public IS
  'GUEST consent gate for the public Alaala showcase orb, set at capture time from the Papic Guest camera opt-in. TRUE once the guest who CAPTURED this media opted in to public sharing of their own recordings. One of two gates (with the couple-approval gate) — BOTH required before media surfaces on any public showcase. Defaults FALSE (RA 10173: explicit opt-in, never pre-checked).';

-- ---------------------------------------------------------------------------
-- papic_record_guest_capture — now carries the guest's public-share consent.
--
-- Adds a trailing p_consent_to_public BOOLEAN param (DEFAULT false → callers
-- that omit it preserve the prior opt-OUT behaviour). The flag is written onto
-- the inserted ledger row. Everything else (event resolution, ownership check,
-- per-guest advisory lock, 150-credit pool gate) is unchanged.
--
-- CREATE OR REPLACE keeps the original 2-arg signature callable too (Postgres
-- treats the defaulted 3rd arg as an overload of the same name), so an in-flight
-- 2-arg call during deploy still works and defaults consent to FALSE.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.papic_record_guest_capture(
  p_guest_id          UUID,
  p_r2_object_key     TEXT DEFAULT NULL,
  p_consent_to_public BOOLEAN DEFAULT false
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_credits CONSTANT INTEGER := 150;
  v_event_id UUID;
  v_owns     BOOLEAN;
  v_used     INTEGER;
BEGIN
  -- Resolve the guest's event. A deleted guest cannot capture.
  SELECT event_id INTO v_event_id
  FROM public.guests
  WHERE guest_id = p_guest_id
    AND deleted_at IS NULL;

  IF v_event_id IS NULL THEN
    RETURN jsonb_build_object('status', 'invalid_guest');
  END IF;

  v_owns := public.papic_event_owns_service(v_event_id, 'PAPIC_GUEST');
  IF NOT v_owns THEN
    RETURN jsonb_build_object('status', 'not_owned');
  END IF;

  -- Advisory lock keyed on the guest so two simultaneous captures from the
  -- same phone serialize through the count check. hashtextextended → bigint
  -- lock key scoped to this transaction.
  PERFORM pg_advisory_xact_lock(hashtextextended(p_guest_id::text, 0));

  SELECT COUNT(*)::INTEGER INTO v_used
  FROM public.papic_guest_captures
  WHERE guest_id = p_guest_id;

  IF v_used >= v_credits THEN
    RETURN jsonb_build_object(
      'status', 'quota_exhausted',
      'total', v_credits,
      'used', v_used,
      'remaining', 0
    );
  END IF;

  INSERT INTO public.papic_guest_captures (event_id, guest_id, r2_object_key, consent_to_public)
  VALUES (v_event_id, p_guest_id, p_r2_object_key, COALESCE(p_consent_to_public, false));

  RETURN jsonb_build_object(
    'status', 'ok',
    'total', v_credits,
    'used', v_used + 1,
    'remaining', GREATEST(0, v_credits - (v_used + 1))
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.papic_record_guest_capture(UUID, TEXT, BOOLEAN) TO authenticated, anon;
