-- alaala_guest_clip_showcase
-- Created via `pnpm migration:new`. Prefix auto-allocated to sort AFTER every
-- existing migration. KEEP THIS MIGRATION IDEMPOTENT (it may be re-applied):
--   • CREATE TABLE IF NOT EXISTS …   (+ ALTER TABLE … ENABLE ROW LEVEL SECURITY in the SAME migration)
--   • ALTER TABLE … ADD COLUMN IF NOT EXISTS …
--   • CREATE INDEX IF NOT EXISTS …
--   • CREATE OR REPLACE FUNCTION …
--   • DROP POLICY IF EXISTS … ; CREATE POLICY …   (policies have no IF NOT EXISTS)

-- ============================================================================
-- 0012 Papic → Alaala — OPTION A: GUEST-RECORDED 5s CLIPS feed the memory orb.
-- ============================================================================
--
-- The Alaala "living memory" orb on the brand /our-story manifesto crossfades
-- real Papic clips. The owner-locked rule (memory
-- project_setnayan_alaala_orb_video_consent): a clip surfaces on a PUBLIC
-- showcase ONLY when BOTH gates are true —
--   • consent_to_public            — the GUEST opted in (cleanest consent: the
--                                    guest who RECORDED the clip is the one who
--                                    appears in / owns it).
--   • couple_approved_for_showcase — the COUPLE picked the clip for the orb.
--
-- Until now the orb fed off papic_photos (the paparazzi/SEAT capture table),
-- which has NO consent producer — a seat clip is shot BY the photographer, not
-- the guest who appears in it, so its consent_to_public could never be set by
-- the person it depicts. Option A (owner-chosen) switches the producer to the
-- GUEST self-capture path: papic_guest_captures, where the guest both records
-- AND consents to their OWN clip. That's the cleanest consent chain.
--
-- papic_guest_captures was PHOTO-ONLY (the guest camera shot JPEGs; #2062 added
-- consent_to_public but no clip support). This migration adds the clip columns
-- that path needs — media_type, duration_ms, poster_r2_key (the NSFW-screen
-- proxy frame, mirroring papic_photos), and the couple-approval gate — and
-- threads media_type/duration/poster through the quota-enforcing
-- papic_record_guest_capture RPC.
--
-- DEFENSIVE / SELF-CONTAINED: #2062 (20270215631984, adds consent_to_public +
-- the 3-arg RPC) is NOT yet applied to prod (ledger drift). So this migration
-- re-adds consent_to_public IF NOT EXISTS and re-creates the RPC with the full
-- param set, so applying THIS migration alone brings prod fully correct even if
-- #2062 never ran. Additive + idempotent; no RLS change — the new columns ride
-- papic_guest_captures' existing policies (couple read via event membership,
-- admin full, the public showcase reads via the admin/service client like every
-- other anonymous recap surface). Both gates default FALSE so the orb keeps its
-- locked cold-start (empty → CSS-gradient skin) until the first consented +
-- approved guest clip lands.

ALTER TABLE public.papic_guest_captures
  ADD COLUMN IF NOT EXISTS consent_to_public            boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS couple_approved_for_showcase boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS media_type                   text    NOT NULL DEFAULT 'photo',
  ADD COLUMN IF NOT EXISTS duration_ms                  int,
  ADD COLUMN IF NOT EXISTS poster_r2_key                text;

-- media_type domain guard — photo (the default) | clip. Added separately +
-- guarded so re-applying never errors on the already-present constraint.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.papic_guest_captures'::regclass
      AND conname = 'papic_guest_captures_media_type_chk'
  ) THEN
    ALTER TABLE public.papic_guest_captures
      ADD CONSTRAINT papic_guest_captures_media_type_chk
      CHECK (media_type IN ('photo', 'clip'));
  END IF;
END$$;

COMMENT ON COLUMN public.papic_guest_captures.consent_to_public IS
  'GUEST consent gate for the public Alaala showcase orb, set at capture time from the Papic Guest camera opt-in. TRUE once the guest who CAPTURED this media opted in to public sharing of their own recordings. One of two gates (with couple_approved_for_showcase) — BOTH required before media surfaces on any public showcase. Defaults FALSE (RA 10173: explicit opt-in, never pre-checked).';

COMMENT ON COLUMN public.papic_guest_captures.couple_approved_for_showcase IS
  'COUPLE approval gate for the public Alaala showcase orb: TRUE once the couple picks this guest clip for the showcase. One of two gates (with consent_to_public) — BOTH required before media surfaces on any public showcase surface. Defaults FALSE.';

COMMENT ON COLUMN public.papic_guest_captures.media_type IS
  'photo (default · the original guest-camera JPEG path) | clip (a guest-recorded ≤5s video). Clips carry duration_ms + poster_r2_key and can feed the Alaala orb once both consent gates clear.';

COMMENT ON COLUMN public.papic_guest_captures.duration_ms IS
  'Clip length in milliseconds, clamped to the 5000ms corpus hard cap by the RPC. NULL for photos.';

COMMENT ON COLUMN public.papic_guest_captures.poster_r2_key IS
  'r2://bucket/key of the clip''s poster frame (one JPEG) — the NSFW-screen proxy (nsfwjs is image-only; we never classify the video bytes). NULL for photos.';

-- Partial index for the orb feed: clips where both gates are set, not hidden.
-- A small partial index keeps that read cheap (the predicate matches a tiny
-- minority of rows — only couple-curated, consented guest clips).
CREATE INDEX IF NOT EXISTS papic_guest_captures_alaala_showcase_idx
  ON public.papic_guest_captures (event_id, captured_at DESC)
  WHERE consent_to_public
    AND couple_approved_for_showcase
    AND media_type = 'clip'
    AND hidden_at IS NULL;

-- ---------------------------------------------------------------------------
-- papic_record_guest_capture — now records clip media (type + duration + poster)
-- alongside the existing photo path.
--
-- Keeps the existing leading params + defaults UNCHANGED so the photo path and
-- every in-flight 2-/3-arg caller is undisturbed (Postgres treats the defaulted
-- trailing args as overloads of the same name). New trailing params:
--   p_media_type    text DEFAULT 'photo'  — 'photo' | 'clip'
--   p_duration_ms   int  DEFAULT NULL     — clamped LEAST(p_duration_ms, 5000)
--   p_poster_r2_key text DEFAULT NULL     — clip's poster frame ref
-- Everything else (event resolution, ownership, advisory lock, 150-credit pool)
-- is unchanged.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.papic_record_guest_capture(
  p_guest_id          UUID,
  p_r2_object_key     TEXT DEFAULT NULL,
  p_consent_to_public BOOLEAN DEFAULT false,
  p_media_type        TEXT DEFAULT 'photo',
  p_duration_ms       INT DEFAULT NULL,
  p_poster_r2_key     TEXT DEFAULT NULL
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
  v_media    TEXT;
  v_duration INT;
BEGIN
  -- Normalize media_type → only 'photo' | 'clip'; anything else falls back to
  -- 'photo' so a malformed caller never trips the CHECK constraint.
  v_media := CASE WHEN p_media_type = 'clip' THEN 'clip' ELSE 'photo' END;

  -- Clip duration is capped at the 5000ms corpus hard lock (defense in depth —
  -- the client + route also enforce it). Photos carry no duration.
  v_duration := CASE
    WHEN v_media = 'clip' AND p_duration_ms IS NOT NULL
      THEN LEAST(GREATEST(p_duration_ms, 0), 5000)
    ELSE NULL
  END;

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

  INSERT INTO public.papic_guest_captures (
    event_id, guest_id, r2_object_key, consent_to_public,
    media_type, duration_ms, poster_r2_key
  )
  VALUES (
    v_event_id, p_guest_id, p_r2_object_key, COALESCE(p_consent_to_public, false),
    v_media, v_duration, NULLIF(btrim(COALESCE(p_poster_r2_key, '')), '')
  );

  RETURN jsonb_build_object(
    'status', 'ok',
    'total', v_credits,
    'used', v_used + 1,
    'remaining', GREATEST(0, v_credits - (v_used + 1))
  );
END;
$$;

-- Grant the full 6-arg signature (the prior 2-/3-arg grants stay valid for the
-- overloads Postgres keeps for in-flight callers).
GRANT EXECUTE ON FUNCTION public.papic_record_guest_capture(UUID, TEXT, BOOLEAN, TEXT, INT, TEXT)
  TO authenticated, anon;
