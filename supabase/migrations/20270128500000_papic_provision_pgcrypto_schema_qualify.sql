-- Fix: "Start my 3 free seats" (and the paid 5-seat provision) silently no-op'd.
--
-- Root cause — pgcrypto schema resolution under a pinned search_path.
-- Both papic_provision_sampler() (migration 20270103000000) and
-- papic_provision_seats() (migration 20260718000000) mint each seat's
-- claim_qr_token with `encode(gen_random_bytes(18), 'hex')`. gen_random_bytes
-- ships with the pgcrypto extension, which Supabase installs in the
-- `extensions` schema — NOT `public`. Both functions are declared
-- `SET search_path = public`, which DROPS `extensions` from the resolver
-- (the DB session default is `"$user", public, extensions`, which is why
-- the same call works in an ad-hoc query but not inside the function). So
-- every invocation threw `42883: function gen_random_bytes(integer) does not
-- exist`, the server action redirected to `?seat_error=…`, and the sampler
-- empty-state card re-rendered without surfacing it — the button looked dead.
--
-- Fix: schema-qualify the call as `extensions.gen_random_bytes(18)`. Every
-- other reference in both functions is already schema-qualified
-- (public.event_members, public.is_admin(), auth.uid()), so this is the only
-- unqualified symbol that needed the `extensions` schema. The pinned
-- `SET search_path = public` is preserved (defence-in-depth); we qualify the
-- one symbol rather than widening the path.
--
-- CREATE OR REPLACE only — no data change, fully idempotent, safe to re-apply.

BEGIN;

-- 1. Free sampler — 3 seats at seat_index 101..103 (mirror of 20270103000000).
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
      VALUES (p_event_id, 100 + i, 'PAPIC_SEATS_FREE', encode(extensions.gen_random_bytes(18), 'hex'), TRUE)
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

-- 2. Paid pack — 5 seats at seat_index 1..5 (mirror of 20260718000000).
CREATE OR REPLACE FUNCTION public.papic_provision_seats(
  p_event_id UUID
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_is_couple  BOOLEAN;
  v_owns       BOOLEAN;
  v_seat_count CONSTANT INTEGER := 5;
  i            INTEGER;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'papic_provision_seats: not authenticated'
      USING ERRCODE = '28000';
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.event_members em
    WHERE em.event_id = p_event_id
      AND em.user_id = auth.uid()
      AND em.member_type = 'couple'
  ) INTO v_is_couple;

  IF NOT (v_is_couple OR public.is_admin()) THEN
    RAISE EXCEPTION 'papic_provision_seats: caller is not a couple on this event'
      USING ERRCODE = '42501';
  END IF;

  v_owns := public.papic_event_owns_service(p_event_id, 'PAPIC_SEATS');
  IF NOT v_owns THEN
    RAISE EXCEPTION 'papic_provision_seats: event does not own PAPIC_SEATS'
      USING ERRCODE = '42501';
  END IF;

  -- Insert any missing seat_index 1..5. Each new row gets a fresh claim token.
  -- ON CONFLICT (event_id, seat_index) DO NOTHING keeps already-provisioned /
  -- claimed seats untouched.
  FOR i IN 1..v_seat_count LOOP
    INSERT INTO public.paparazzi_seats (event_id, seat_index, sku_code, claim_qr_token)
    VALUES (
      p_event_id,
      i,
      'PAPIC_SEATS',
      encode(extensions.gen_random_bytes(18), 'hex')
    )
    ON CONFLICT (event_id, seat_index) DO NOTHING;
  END LOOP;

  RETURN (
    SELECT COUNT(*)::INTEGER
    FROM public.paparazzi_seats
    WHERE event_id = p_event_id
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.papic_provision_seats(UUID) TO authenticated;

COMMIT;
