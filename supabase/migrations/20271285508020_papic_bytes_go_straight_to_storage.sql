-- ============================================================================
-- PAPIC: THE BYTES GO STRAIGHT TO STORAGE (save first, send later — strategy B)
-- ============================================================================
--
-- MEASURED (production, 2026-10-23): POST /api/papic/guest-capture with a 6 MB
-- body answers 413 FUNCTION_PAYLOAD_TOO_LARGE from Vercel before our code runs —
-- Vercel functions refuse request bodies over 4.5 MB. A 10-second guest clip is
-- designed at ~12.5 MB, so every normal clip failed. The supplier lane
-- (/api/vendor/papic-capture) had the same shape.
--
-- The phone now PUTs each piece of a shot (thumbnail, display copy, original;
-- poster, web copy, raw clip) DIRECT to R2 on a presigned URL our server mints
-- after checking the session, the window and the credits — and then makes a
-- small record call with no file bytes at all.
--
-- Two additive pieces:
--
--   1. public.papic_upload_intents — every key we sign, and whether a row ever
--      came to point at it. A PUT that lands and is never recorded (the phone
--      died, the credits ran out between the PUT and the record) is otherwise an
--      object nothing references, forever. The sweep (lib/papic-upload-sweep.ts)
--      deletes those once the phone's own queue could no longer send them (its
--      TTL is 7 days; the sweep waits 8). SERVICE-ROLE ONLY: no policy, no grant.
--
--   2. vendor_papic_captures.client_capture_id — the supplier camera's shutter id,
--      UNIQUE per supplier, so a replayed record lands once and is counted once
--      (the guest table got the same column in 20271272777206).
--
-- Never applied to production by a session — the pipeline pushes this file.
-- ============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS public.papic_upload_intents (
  intent_id          BIGSERIAL PRIMARY KEY,
  lane               TEXT        NOT NULL,
  event_id           UUID        NOT NULL REFERENCES public.events(event_id) ON DELETE CASCADE,
  -- guest_id (guest lane) or vendor_profile_id (vendor lane).
  owner_id           UUID        NOT NULL,
  client_capture_id  UUID        NOT NULL,
  tier               TEXT        NOT NULL,
  r2_ref             TEXT        NOT NULL,
  size_bytes         BIGINT      NOT NULL,
  content_type       TEXT        NOT NULL,
  signed_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- Set when a capture row came to point at this object (record / attach).
  settled_at         TIMESTAMPTZ,
  CONSTRAINT papic_upload_intents_lane_chk CHECK (lane IN ('guest', 'vendor')),
  CONSTRAINT papic_upload_intents_tier_chk CHECK (
    tier IN ('thumb', 'tile', 'display', 'original', 'poster', 'clip_web', 'clip_raw')
  ),
  CONSTRAINT papic_upload_intents_size_chk CHECK (size_bytes > 0 AND size_bytes <= 40000000),
  CONSTRAINT papic_upload_intents_ref_chk CHECK (r2_ref ~ '^r2://[a-z0-9-]+/papic/'),
  CONSTRAINT papic_upload_intents_ref_uniq UNIQUE (r2_ref)
);

ALTER TABLE public.papic_upload_intents ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.papic_upload_intents FROM PUBLIC, anon, authenticated;
REVOKE ALL ON SEQUENCE public.papic_upload_intents_intent_id_seq FROM PUBLIC, anon, authenticated;

CREATE INDEX IF NOT EXISTS papic_upload_intents_unsettled_idx
  ON public.papic_upload_intents (signed_at)
  WHERE settled_at IS NULL;

CREATE INDEX IF NOT EXISTS papic_upload_intents_capture_idx
  ON public.papic_upload_intents (owner_id, client_capture_id);

COMMENT ON TABLE public.papic_upload_intents IS
  'Every R2 key the Papic capture routes presigned for a phone (one row per capture tier). settled_at is set when a capture row came to point at the object. Unsettled rows older than the phone queue''s TTL are swept: the object is deleted (after checking no row references it) and the row removed. Service-role only (lib/papic-upload-intents.server.ts, lib/papic-upload-sweep.ts).';

ALTER TABLE public.vendor_papic_captures
  ADD COLUMN IF NOT EXISTS client_capture_id UUID;

COMMENT ON COLUMN public.vendor_papic_captures.client_capture_id IS
  'The id the supplier''s phone minted at the shutter and sends unchanged on every retry and from its offline queue. UNIQUE per supplier: one shutter is one row and one spend (20271285508020). NULL on rows recorded before it existed.';

CREATE UNIQUE INDEX IF NOT EXISTS vendor_papic_captures_client_capture_uniq
  ON public.vendor_papic_captures (vendor_profile_id, client_capture_id)
  WHERE client_capture_id IS NOT NULL;

COMMIT;
