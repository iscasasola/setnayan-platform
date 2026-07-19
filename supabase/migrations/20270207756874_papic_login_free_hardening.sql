-- ============================================================================
-- Papic · login-free seat claim — DB hardening
-- (2026-06-21 · ships WITH the NEXT_PUBLIC_PAPIC_SEAT_ANON_ENABLED flag, OFF
--  by default; these changes are safe + strictly-tighter regardless of the flag)
-- ============================================================================
--
-- Login-free seat claim lets a friend become a paparazzo without an account:
-- claimPapicSeat mints a Supabase NATIVE anonymous session (a real auth.uid())
-- so every existing claimer-keyed RLS policy/RPC keeps working unchanged. Two
-- pre-existing gaps the adversarial security review surfaced are closed here,
-- because lowering claim friction (any leaked link → a free anon identity)
-- raises the cost of leaving them open:
--
--   1. CROSS-EVENT WRITE — papic_photos_claimer_own's WITH CHECK validated only
--      that the seat belongs to the caller (claimer = auth.uid(), not revoked);
--      it did NOT require papic_photos.event_id = the seat's event_id. A caller
--      who bypassed the server action and inserted directly via PostgREST could
--      set paparazzi_seat_id to their own seat but event_id to ANY other event,
--      poisoning the victim event's gallery. Adding the event_id equality clause
--      binds every claimer insert to its own seat's event. The server action
--      always sets event_id = seat.event_id, so no legitimate write is affected.
--
--   2. REISSUE DID NOT RESET PER-SEAT CAPS — a reissued seat is the SAME row, so
--      a new (anon) claimer inherited the old claimer's photo count + sampler
--      cap (e.g. a reissued free-sampler seat could arrive already-exhausted).
--      `superseded_at` lets reissue mark a prior claimer's captures so they're
--      excluded from the per-seat count + sampler cap WITHOUT deleting them —
--      every photo still belongs to the event and still reaches the couple's
--      gallery (untagged-/superseded-still-delivered). NULL = current claimer's.
--
-- Idempotent. No data backfill (superseded_at defaults NULL = unchanged today).
-- ============================================================================

BEGIN;

-- ---- 2. Reissue cap-reset marker -------------------------------------------

ALTER TABLE public.papic_photos
  ADD COLUMN IF NOT EXISTS superseded_at TIMESTAMPTZ;

COMMENT ON COLUMN public.papic_photos.superseded_at IS
  'Set when the seat was reissued to a new claimer AFTER this photo was taken. '
  'Excludes the row from the new claimer''s per-seat count + sampler cap; the '
  'photo still belongs to the event and still appears in the couple gallery.';

-- Partial index — the hot read is "this seat''s CURRENT (non-superseded) shots".
CREATE INDEX IF NOT EXISTS papic_photos_seat_current_idx
  ON public.papic_photos(paparazzi_seat_id)
  WHERE superseded_at IS NULL;

-- ---- 1. Cross-event write fix (event_id bound to the seat) ------------------

DROP POLICY IF EXISTS papic_photos_claimer_own ON public.papic_photos;
CREATE POLICY papic_photos_claimer_own ON public.papic_photos
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.paparazzi_seats ps
      WHERE ps.seat_id = papic_photos.paparazzi_seat_id
        AND ps.claimer_user_id = auth.uid()
        AND ps.event_id = papic_photos.event_id
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.paparazzi_seats ps
      WHERE ps.seat_id = papic_photos.paparazzi_seat_id
        AND ps.claimer_user_id = auth.uid()
        AND ps.revoked_at IS NULL
        AND ps.event_id = papic_photos.event_id
    )
  );

COMMIT;
