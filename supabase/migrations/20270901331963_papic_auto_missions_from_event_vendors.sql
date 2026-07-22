-- Papic Games — Phase 2: auto-generate FREE booth missions from event_vendors.
-- Spec §3.1/§3.4: one "Get a photo at <vendor>'s booth" mission per BOOKED vendor,
-- zero authoring, free for every booked vendor. Flag-gated at the CALL SITE
-- (NEXT_PUBLIC_PAPIC_GAMES_V1) — nothing here runs until the app calls the RPC.

BEGIN;

-- Dedup: at most one auto booth mission per (booked) vendor. Partial unique index
-- so couple/vendor-authored missions and other types are unaffected.
CREATE UNIQUE INDEX IF NOT EXISTS uq_papic_missions_auto_booth
  ON public.papic_missions (vendor_id)
  WHERE source = 'auto' AND mission_type = 'vendor_booth' AND vendor_id IS NOT NULL;

-- Idempotently sync auto booth missions from the event's BOOKED vendors; returns #inserted.
-- Authorization: the caller must be a couple/coordinator of the event, an admin, or
-- service_role (server-side). Guests never generate missions (not granted to anon).
-- Race-safe via a per-event advisory xact lock + the partial unique index backstop.
CREATE OR REPLACE FUNCTION public.ensure_papic_auto_missions(p_event_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_inserted INTEGER;
BEGIN
  IF auth.uid() IS NOT NULL
     AND NOT public.is_admin()
     AND NOT EXISTS (
       SELECT 1 FROM public.event_members em
       WHERE em.event_id = p_event_id
         AND em.user_id = auth.uid()
         AND em.member_type IN ('couple', 'coordinator')
     ) THEN
    RAISE EXCEPTION 'not authorized to generate missions for event %', p_event_id;
  END IF;

  -- Serialize concurrent generation for this event so the NOT EXISTS check is race-safe.
  PERFORM pg_advisory_xact_lock(hashtext('papic_auto_missions:' || p_event_id::text));

  INSERT INTO public.papic_missions (event_id, mission_type, source, vendor_id, prompt, approved, is_active)
  SELECT ev.event_id,
         'vendor_booth',
         'auto',
         ev.vendor_id,
         -- left(...,256) caps the prompt at 15+256+8 = 279 <= the papic_missions
         -- length(prompt) <= 280 CHECK, so one pathological/uncapped vendor_name
         -- (event_vendors.vendor_name is unbounded TEXT) can't abort the whole batch.
         'Get a photo at ' || left(ev.vendor_name, 256) || '''s booth',
         true,
         true
  FROM public.event_vendors ev
  WHERE ev.event_id = p_event_id
    AND ev.status IN ('contracted', 'deposit_paid', 'delivered', 'complete')  -- "booked" (§3.3)
    AND NOT EXISTS (
      SELECT 1 FROM public.papic_missions m
      WHERE m.vendor_id = ev.vendor_id
        AND m.source = 'auto'
        AND m.mission_type = 'vendor_booth'
    );

  GET DIAGNOSTICS v_inserted = ROW_COUNT;
  RETURN v_inserted;
END;
$$;

REVOKE ALL ON FUNCTION public.ensure_papic_auto_missions(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.ensure_papic_auto_missions(UUID) TO authenticated, service_role;

COMMENT ON FUNCTION public.ensure_papic_auto_missions(UUID) IS
  'Papic Games §3.1: idempotently create a FREE vendor_booth auto mission per BOOKED event_vendor. Auth: couple/coordinator/admin/service_role. Flag-gated at the call site.';

COMMIT;
