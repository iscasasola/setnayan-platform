-- Booth poster T-24h FREEZE (owner directive 2026-07-21).
--
-- "finalization of their avatar is until the hour/day before the event?" —
-- resolved as: VENDOR surfaces (booth, poster, staff) freeze at T-24h; the
-- COUPLE's room structure soft-freezes with seat moves still allowed; and the
-- GUEST's own avatar NEVER freezes, because a guest's most likely moment to set
-- it is at the reception itself, scanning the QR with the room in front of them.
--
-- Only the vendor half is enforceable here — this is that half.
--
-- The freeze earns its keep twice: it stops a poster being swapped mid-reception
-- while guests are already walking the room, AND it IS the couple's review
-- window (what appears in their wedding is settled a day ahead), which is why
-- the design needs no approval queue on top of the QR-in-media guard.
--
-- Idempotent CREATE OR REPLACE of vendor_set_booth_poster — identical to its
-- first definition except the freeze check and one DECLARE. Comparison is in
-- Asia/Manila civil time, matching the schedule-pools convention. A dateless
-- event never freezes.

CREATE OR REPLACE FUNCTION public.vendor_set_booth_poster(
  p_event_id UUID,
  p_poster_ref TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_profile_ids UUID[];
  v_profile_id  UUID;
  v_ref         TEXT;
  v_event_date  DATE;
BEGIN
  SELECT ARRAY(
    SELECT vp.vendor_profile_id FROM public.vendor_profiles vp WHERE vp.user_id = auth.uid()
    UNION
    SELECT tm.vendor_profile_id FROM public.vendor_team_members tm WHERE tm.user_id = auth.uid()
  ) INTO v_profile_ids;
  IF v_profile_ids IS NULL OR COALESCE(array_length(v_profile_ids, 1), 0) = 0 THEN
    RAISE EXCEPTION 'not_a_vendor' USING ERRCODE = '42501';
  END IF;

  -- Booked on THIS event — same status set the cocktail gate uses.
  SELECT ev.marketplace_vendor_id INTO v_profile_id
  FROM public.event_vendors ev
  WHERE ev.event_id = p_event_id
    AND ev.marketplace_vendor_id = ANY (v_profile_ids)
    AND ev.status IN ('contracted', 'deposit_paid', 'delivered', 'complete')
  LIMIT 1;
  IF v_profile_id IS NULL THEN
    RAISE EXCEPTION 'not_booked' USING ERRCODE = '42501';
  END IF;

  -- T-24h FREEZE (owner 2026-07-21). Vendor-authored booth surfaces lock a day
  -- out. Two reasons, and the second is the important one:
  --   1. it stops a poster being swapped mid-reception, when guests are already
  --      walking the room and the couple could not possibly notice;
  --   2. it IS the couple's review window — what appears in their wedding is
  --      settled 24h ahead, which is why no approval queue is needed.
  -- Compared in Asia/Manila civil time (PH-first product, matching the schedule
  -- pools convention): the freeze begins at the start of the day BEFORE the
  -- event date. A dateless event never freezes.
  SELECT e.event_date INTO v_event_date FROM public.events e WHERE e.event_id = p_event_id;
  IF v_event_date IS NOT NULL
     AND (v_event_date - INTERVAL '1 day')
         <= (NOW() AT TIME ZONE 'Asia/Manila') THEN
    RAISE EXCEPTION 'booth_frozen' USING ERRCODE = '42501';
  END IF;

  v_ref := NULLIF(btrim(COALESCE(p_poster_ref, '')), '');

  IF v_ref IS NULL THEN
    DELETE FROM public.event_vendor_booth_posters
    WHERE event_id = p_event_id AND vendor_profile_id = v_profile_id;
    RETURN;
  END IF;

  IF char_length(v_ref) > 500 THEN
    RAISE EXCEPTION 'poster_ref_too_long' USING ERRCODE = '22001';
  END IF;

  INSERT INTO public.event_vendor_booth_posters
    (event_id, vendor_profile_id, poster_ref, updated_by)
  VALUES (p_event_id, v_profile_id, v_ref, auth.uid())
  ON CONFLICT (event_id, vendor_profile_id) DO UPDATE
    SET poster_ref = EXCLUDED.poster_ref,
        updated_by = EXCLUDED.updated_by,
        updated_at = NOW();
END;
$$;

REVOKE ALL ON FUNCTION public.vendor_set_booth_poster(UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.vendor_set_booth_poster(UUID, TEXT) TO authenticated;

COMMENT ON FUNCTION public.vendor_set_booth_poster(UUID, TEXT) IS
  'Set (or clear, with NULL/blank) the calling vendor''s per-event booth poster. '
  'SECURITY DEFINER; gate = caller owns/belongs to a vendor_profile AND that '
  'profile is BOOKED on the event. FROZEN from T-24h (Asia/Manila) so a poster '
  'cannot change under a couple whose guests are already walking the room — '
  'that window is also the couple''s review period.';
