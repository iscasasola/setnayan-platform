-- ============================================================================
-- 20260520010000_iteration_0012_paparazzi_seats_photos.sql
--
-- Iteration 0012 Papic — paparazzi_seats + papic_photos foundation.
--
-- Schema only — claim flow (PR 3) + capture pipeline (PR 4) + email (PR 5)
-- land in subsequent migrations / app code on top of this base. PR 1
-- (20260520000000) seeded the SKUs that drive seat creation.
--
-- Design notes:
--   • Each paparazzi pack purchase materializes N rows in paparazzi_seats
--     (3 for paparazzi_3_seats, 5 for paparazzi_5_seats, +1 per
--     paparazzi_camera_addon). The order's fulfillment step writes these
--     rows; seat_index is dense 1..N per event.
--   • claim_qr_token is the short-string-encoded UUID that the QR contains.
--     The /papic/claim/[token] public route validates it via a SECURITY
--     DEFINER RPC (added in PR 3) — paparazzi_seats RLS is strict couple-
--     only so direct table reads from the public route are blocked.
--   • Photos always land in R2 first (cheap, fast, reliable). When the
--     event's papic_storage_target='google_drive_only', a worker pushes the
--     R2 object to the couple's Drive folder in near-real-time and sets
--     drive_transferred_at. R2 stays the canonical archive for the cold-
--     tier retention window.
--   • Credit pool tracking (5K for 3-pack, 10K for 5-pack) is intentionally
--     NOT denormalized here — count(*) from papic_photos at read time is
--     fast enough for the 80% warning, and avoids drift between counter +
--     row count. The capture pipeline (PR 4) gates inserts via a server-
--     side check.
--
-- Idempotent. No drops.
-- ============================================================================

BEGIN;

-- ---- paparazzi_seats -------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.paparazzi_seats (
  id                   BIGSERIAL PRIMARY KEY,
  seat_id              UUID NOT NULL UNIQUE DEFAULT gen_random_uuid(),
  event_id             UUID NOT NULL REFERENCES public.events(event_id) ON DELETE CASCADE,
  seat_index           INTEGER NOT NULL,
  sku_code             TEXT NOT NULL,
    -- Which SKU created this seat row:
    --   'paparazzi_3_seats' | 'paparazzi_5_seats' | 'paparazzi_camera_addon'
    -- Loose-typed because future SKU codes may add seats; cart fulfillment
    -- writes whatever code applied.
  claim_qr_token       TEXT NOT NULL UNIQUE,
    -- Per-seat claim token. Friend scans QR → /papic/claim/[token] →
    -- SECURITY DEFINER RPC validates + claims. Token is regenerable if
    -- the couple wants to reissue.
  claimer_user_id      UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  claimed_at           TIMESTAMPTZ,
  revoked_at           TIMESTAMPTZ,
    -- Couple can revoke a claim and re-issue a fresh token (e.g., friend
    -- dropped out). Revoked seats stop accepting new photos via RLS.
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (event_id, seat_index)
);

CREATE INDEX IF NOT EXISTS paparazzi_seats_event_id_idx
  ON public.paparazzi_seats(event_id);
CREATE INDEX IF NOT EXISTS paparazzi_seats_claimer_user_id_idx
  ON public.paparazzi_seats(claimer_user_id)
  WHERE claimer_user_id IS NOT NULL;

-- ---- papic_photos ----------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.papic_photos (
  id                    BIGSERIAL PRIMARY KEY,
  photo_id              UUID NOT NULL UNIQUE DEFAULT gen_random_uuid(),
  event_id              UUID NOT NULL REFERENCES public.events(event_id) ON DELETE CASCADE,
  paparazzi_seat_id     UUID NOT NULL REFERENCES public.paparazzi_seats(seat_id) ON DELETE CASCADE,
  r2_object_key         TEXT NOT NULL,
    -- Canonical R2 path, e.g. 'event-<event_id>/papic/seat-<seat_index>/<photo_id>.jpg'
  photo_type            TEXT NOT NULL DEFAULT 'photo'
    CHECK (photo_type IN ('photo', 'clip')),
  mime_type             TEXT,
  size_bytes            BIGINT,
  width_px              INTEGER,
  height_px             INTEGER,
  captured_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  geo_lat               DOUBLE PRECISION,
  geo_lon               DOUBLE PRECISION,
  device_model          TEXT,
  drive_transferred_at  TIMESTAMPTZ,
    -- NULL when storage_target='setnayan_r2' (R2 is canonical). When
    -- storage_target='google_drive_only', set by the Drive-push worker
    -- once the R2 object has been mirrored to the couple's Drive folder.
  hidden_at             TIMESTAMPTZ,
    -- Couple can hide a photo during the post-event review window.
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS papic_photos_event_id_idx
  ON public.papic_photos(event_id);
CREATE INDEX IF NOT EXISTS papic_photos_seat_id_idx
  ON public.papic_photos(paparazzi_seat_id);
CREATE INDEX IF NOT EXISTS papic_photos_captured_at_idx
  ON public.papic_photos(captured_at);
CREATE INDEX IF NOT EXISTS papic_photos_drive_transfer_pending_idx
  ON public.papic_photos(event_id)
  WHERE drive_transferred_at IS NULL;

-- ---- RLS -------------------------------------------------------------------

ALTER TABLE public.paparazzi_seats ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.papic_photos ENABLE ROW LEVEL SECURITY;

-- paparazzi_seats:
--   couple (member_type='couple') — full CRUD on their event's seats
--   claimer — read-only on their own seat (so the capture UI can show
--     seat metadata after claim)
--   admin — full CRUD
--   public anon — no direct access; claim flow goes through a SECURITY
--     DEFINER RPC (PR 3) that validates the token before any read.

DROP POLICY IF EXISTS paparazzi_seats_couple_full ON public.paparazzi_seats;
CREATE POLICY paparazzi_seats_couple_full ON public.paparazzi_seats
  TO authenticated
  USING (
    public.is_admin()
    OR EXISTS (
      SELECT 1 FROM public.event_members em
      WHERE em.event_id = paparazzi_seats.event_id
        AND em.user_id = auth.uid()
        AND em.member_type = 'couple'
    )
  )
  WITH CHECK (
    public.is_admin()
    OR EXISTS (
      SELECT 1 FROM public.event_members em
      WHERE em.event_id = paparazzi_seats.event_id
        AND em.user_id = auth.uid()
        AND em.member_type = 'couple'
    )
  );

DROP POLICY IF EXISTS paparazzi_seats_claimer_read ON public.paparazzi_seats;
CREATE POLICY paparazzi_seats_claimer_read ON public.paparazzi_seats
  FOR SELECT
  TO authenticated
  USING (claimer_user_id = auth.uid());

-- papic_photos:
--   couple — full CRUD on event photos (hide/unhide/delete during review)
--   claimer — insert + select + delete on own seat's photos; insert blocked
--     once seat is revoked
--   admin — full CRUD

DROP POLICY IF EXISTS papic_photos_couple_full ON public.papic_photos;
CREATE POLICY papic_photos_couple_full ON public.papic_photos
  TO authenticated
  USING (
    public.is_admin()
    OR EXISTS (
      SELECT 1 FROM public.event_members em
      WHERE em.event_id = papic_photos.event_id
        AND em.user_id = auth.uid()
        AND em.member_type = 'couple'
    )
  )
  WITH CHECK (
    public.is_admin()
    OR EXISTS (
      SELECT 1 FROM public.event_members em
      WHERE em.event_id = papic_photos.event_id
        AND em.user_id = auth.uid()
        AND em.member_type = 'couple'
    )
  );

DROP POLICY IF EXISTS papic_photos_claimer_own ON public.papic_photos;
CREATE POLICY papic_photos_claimer_own ON public.papic_photos
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.paparazzi_seats ps
      WHERE ps.seat_id = papic_photos.paparazzi_seat_id
        AND ps.claimer_user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.paparazzi_seats ps
      WHERE ps.seat_id = papic_photos.paparazzi_seat_id
        AND ps.claimer_user_id = auth.uid()
        AND ps.revoked_at IS NULL
    )
  );

COMMIT;
