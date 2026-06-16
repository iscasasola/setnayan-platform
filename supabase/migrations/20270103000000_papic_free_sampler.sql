-- Free Papic sampler — a couple can TRY Papic free so they experience the
-- tag→gallery loop, then convert to the paid pass.
--
-- Owner-locked 2026-06-16: 3 free guest seats, each capped at 8 photos + 2 clips
-- (the 5-sec clip cap still applies), 1 sampler per event. NEVER Drive-gated.
-- Sampler photos are kept 30 days on Setnayan; connecting Google Drive (the
-- couple's own copy) or upgrading to paid Papic makes them permanent. The 5-year
-- retention rule applies ONLY to the paid/delivered gallery, never the sampler.
--
-- This reuses the WHOLE existing pipeline (paparazzi_seats + papic_photos +
-- claim/capture/tag, migrations 20260520015000 + 20260718000000). It only adds:
--   (1) an is_free_sampler flag on seats,
--   (2) a nullable expires_at on photos (NULL = permanent),
--   (3) a couple-gated, idempotent, one-per-event provisioning RPC.
-- Caps + the 30-day stamp + read-time expiry filtering live in the app
-- (recordSeatCapture / the gallery reads); deletion of expired bytes is
-- cron-free (opportunistic sweep + optional R2 lifecycle on the sampler prefix).

BEGIN;

-- 1. Mark sampler seats. Paid/normal seats stay FALSE, so caps + retention only
--    ever touch the free sampler.
ALTER TABLE public.paparazzi_seats
  ADD COLUMN IF NOT EXISTS is_free_sampler BOOLEAN NOT NULL DEFAULT FALSE;

-- 2. Per-photo expiry. NULL = permanent (every paid/normal capture). The sampler
--    stamps NOW() + 30 days. Partial index keeps the sweep/filter cheap.
ALTER TABLE public.papic_photos
  ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS papic_photos_expires_at_idx
  ON public.papic_photos (expires_at)
  WHERE expires_at IS NOT NULL;

-- 3. Provision the 3 free sampler seats for an event. Couple- (or admin-) gated,
--    idempotent, ONE sampler per event. Sampler seats live in their own
--    seat_index range (101..103) so they never collide with the paid pass's
--    1..5 (UNIQUE(event_id, seat_index)). No paid-ownership check — it's free;
--    we only skip re-provisioning if a sampler already exists. Mirrors the paid
--    papic_provision_seats() RPC (migration 20260718000000).
CREATE OR REPLACE FUNCTION public.papic_provision_sampler(
  p_event_id UUID
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_is_couple BOOLEAN;
  v_existing  INTEGER;
  i           INTEGER;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'papic_provision_sampler: not authenticated' USING ERRCODE = '28000';
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.event_members em
    WHERE em.event_id = p_event_id
      AND em.user_id = auth.uid()
      AND em.member_type = 'couple'
  ) INTO v_is_couple;

  IF NOT (v_is_couple OR public.is_admin()) THEN
    RAISE EXCEPTION 'papic_provision_sampler: not a couple on this event' USING ERRCODE = '42501';
  END IF;

  -- One-per-event: if sampler seats already exist, just return the count.
  SELECT COUNT(*) INTO v_existing
  FROM public.paparazzi_seats
  WHERE event_id = p_event_id AND is_free_sampler = TRUE;

  IF v_existing = 0 THEN
    FOR i IN 1..3 LOOP
      INSERT INTO public.paparazzi_seats (event_id, seat_index, sku_code, claim_qr_token, is_free_sampler)
      VALUES (p_event_id, 100 + i, 'PAPIC_SEATS_FREE', encode(gen_random_bytes(18), 'hex'), TRUE)
      ON CONFLICT (event_id, seat_index) DO NOTHING;
    END LOOP;
  END IF;

  RETURN (
    SELECT COUNT(*)::INTEGER
    FROM public.paparazzi_seats
    WHERE event_id = p_event_id AND is_free_sampler = TRUE
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.papic_provision_sampler(UUID) TO authenticated;

COMMIT;
