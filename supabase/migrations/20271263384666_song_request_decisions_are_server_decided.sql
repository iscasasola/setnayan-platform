-- ============================================================================
-- WHO DECIDED A SONG REQUEST IS SET BY THE SERVER, NEVER BY THE CALLER.
--
-- ── THE HOLE (measured in production, read-only, 2026-10-04) ───────────────
-- `authenticated` held table-level UPDATE on `event_song_requests` (granted at
-- birth, 20271014090000), and the only UPDATE policy was
--
--   event_song_requests_decide  USING / WITH CHECK
--     (event_id IN (SELECT current_event_ids()) OR is_admin())
--
-- `current_event_ids()` is `SELECT event_id FROM event_members WHERE user_id =
-- auth.uid()` with NO member_type filter (its own COMMENT says so) — so it
-- admits EVERY member of the event: the couple, a coordinator, a vendor member
-- AND AN ORDINARY INVITED GUEST with an account. Any of them could PATCH any
-- request on that event straight through PostgREST and write ANY value into
-- `status`, `decided_by_vendor_profile_id` and `decided_at` — e.g. claim that
-- a supplier accepted or declined a request it never saw, or back-date it.
-- RLS is row-level, never value-level: no policy can stop a member choosing
-- the VALUE. #6316 closed the same forge on the guest-delete Undo; this is the
-- direct-API door.
--
-- ── WHO LEGITIMATELY WRITES THIS TABLE (call-site audit, 2026-10-04) ───────
--   • decideActSongRequest (apps/web/app/vendor-dashboard/on-the-day/actions.ts)
--       the ONLY decision writer. Session → own vendor profile → booked →
--       holds `song_desk` (the paywall, in TypeScript by the PR #3876 ruling)
--       → service_role. It never used `authenticated`'s UPDATE.
--   • guest_submit_song_request / open_submit_song_request — SECURITY DEFINER
--       INSERTs, service_role only. Unaffected.
--   • release_deleted_guest_song_requests / restore_deleted_guests (#6316) —
--       SECURITY DEFINER, own their writes. Unaffected.
--   • the FK `guest_id ON DELETE SET NULL` — a referential action, run as the
--       table owner. Unaffected.
-- NO session-client path updates this table. The policy's "the host can
-- override in their own room" leg (20271014090000) was never built into any
-- surface, so nothing legitimate loses anything below.
--
-- ── THE FIX ────────────────────────────────────────────────────────────────
--   1. REVOKE UPDATE (table AND every column) from authenticated, and from
--      PUBLIC/anon for completeness. No column-level re-grant: there is no
--      session-client writer to re-grant for.
--   2. DROP the `_decide` policy. Inert without the grant — dropped anyway so a
--      future reflexive re-GRANT updates ZERO rows instead of silently
--      reopening this exact hole.
--   3. ONE writer of the decision columns: `decide_song_request(...)`,
--      SECURITY DEFINER, pinned search_path, EXECUTE for service_role ONLY.
--      • `decided_at` is the database clock (now()) — there is no parameter
--        for it, so no caller can choose it.
--      • the decision vocabulary is checked FAIL-CLOSED (coalesce: a NULL
--        decision is refused, not passed through as "not refused").
--      • the attributed shop must hold a booking-shaped row ON THIS EVENT (an
--        unreleased schedule-pool booking, or an unarchived event_vendors row
--        naming it) — fail-closed. This is a BACKSTOP, deliberately a superset
--        of `fetchVendorRoomEvents`' three arms, so it can never refuse a
--        decision the TypeScript gate admitted; it only refuses attribution
--        to a shop with no connection to the event at all.
--      • `event_id` is re-asserted beside the primary key, so a request from
--        another event cannot be decided by id alone.
--      • zero rows touched RAISES — never a silent success.
--
-- ⚠ WHY THE FUNCTION IS NOT CALLABLE BY `authenticated`. The right to decide
-- is "booked AND paid for song_desk", and the paid half lives in TypeScript
-- (`resolveVendorSpecializationAccessForVendor` folds in the admin free window
-- and the mid-event lapse; a SQL copy would drift, and a drifting paywall
-- fails open — PR #3876, restated in 20271020224218). A browser-callable RPC
-- could only check "booked", which would hand every UNPAID booked band the
-- decide half of the inbox. So the vendor profile is resolved by the server
-- action from the caller's own session (`fetchOwnVendorProfile(user.id)`),
-- the action takes no profile argument from the browser, and only the
-- service role may call this.
-- ============================================================================

BEGIN;

-- ── 1 · no browser role may UPDATE the table, at any granularity ──────────
REVOKE UPDATE ON TABLE public.event_song_requests FROM PUBLIC, anon, authenticated;
REVOKE UPDATE (status, decided_by_vendor_profile_id, decided_at, guest_id, anon_key,
               requester_name, origin, song_id, event_id, request_id, created_at)
  ON TABLE public.event_song_requests FROM PUBLIC, anon, authenticated;

-- ── 2 · and no UPDATE policy left for a re-grant to resurrect ─────────────
DROP POLICY IF EXISTS event_song_requests_decide ON public.event_song_requests;

-- ── 3 · the one writer of a decision ──────────────────────────────────────
CREATE OR REPLACE FUNCTION public.decide_song_request(
  p_event_id          UUID,
  p_request_id        UUID,
  p_decision          TEXT,
  p_vendor_profile_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_touched INTEGER;
BEGIN
  -- coalesce: `NULL IN (...)` is NULL, and plpgsql's IF reads NULL as "not
  -- refused". A missing decision must be a refusal.
  IF NOT coalesce(p_decision IN ('accepted', 'declined'), false) THEN
    RAISE EXCEPTION 'songreq:bad_decision' USING ERRCODE = '22023';
  END IF;

  -- The attributed shop must be on this event at all (backstop — see header).
  -- coalesce for the same reason: a NULL profile makes both EXISTS false, but
  -- the wrapper keeps the refusal explicit if this is ever rewritten.
  IF NOT coalesce(
       p_vendor_profile_id IS NOT NULL AND p_event_id IS NOT NULL AND (
         EXISTS (
           SELECT 1 FROM public.vendor_schedule_pool_bookings b
            WHERE b.vendor_profile_id = p_vendor_profile_id
              AND b.event_id = p_event_id
              AND b.released_at IS NULL
         )
         OR EXISTS (
           SELECT 1 FROM public.event_vendors ev
            WHERE ev.marketplace_vendor_id = p_vendor_profile_id
              AND ev.event_id = p_event_id
              AND ev.archived_at IS NULL
         )
       ),
       false) THEN
    RAISE EXCEPTION 'songreq:not_on_event' USING ERRCODE = '42501';
  END IF;

  UPDATE public.event_song_requests r
     SET status                       = p_decision,
         decided_by_vendor_profile_id = p_vendor_profile_id,
         decided_at                   = now()
   WHERE r.request_id = p_request_id
     AND r.event_id   = p_event_id;
  GET DIAGNOSTICS v_touched = ROW_COUNT;

  IF v_touched = 0 THEN
    RAISE EXCEPTION 'songreq:not_found' USING ERRCODE = 'P0002';
  END IF;
  RETURN TRUE;
END;
$$;

REVOKE ALL ON FUNCTION public.decide_song_request(UUID, UUID, TEXT, UUID)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.decide_song_request(UUID, UUID, TEXT, UUID) TO service_role;

COMMENT ON FUNCTION public.decide_song_request(UUID, UUID, TEXT, UUID) IS
  'The ONLY writer of a song-request decision (status, decided_by_vendor_profile_id, '
  'decided_at). service_role only: called by decideActSongRequest after the song_desk '
  'paywall gate, with the vendor profile resolved from the caller''s own session. '
  'decided_at is now(); the shop must be on the event. 2026-10-04.';

-- ── Post-conditions · assert the catalog, not the statements ──────────────
DO $$
DECLARE
  v_col TEXT;
BEGIN
  IF has_table_privilege('authenticated', 'public.event_song_requests', 'UPDATE') THEN
    RAISE EXCEPTION 'authenticated still holds table UPDATE on event_song_requests';
  END IF;
  FOREACH v_col IN ARRAY ARRAY['status', 'decided_by_vendor_profile_id', 'decided_at'] LOOP
    IF has_column_privilege('authenticated', 'public.event_song_requests', v_col, 'UPDATE') THEN
      RAISE EXCEPTION 'authenticated can still UPDATE event_song_requests.%', v_col;
    END IF;
  END LOOP;
  IF EXISTS (SELECT 1 FROM pg_policies
              WHERE schemaname = 'public' AND tablename = 'event_song_requests'
                AND cmd IN ('UPDATE', 'ALL')) THEN
    RAISE EXCEPTION 'event_song_requests still carries an UPDATE policy';
  END IF;
  IF has_function_privilege('authenticated', 'public.decide_song_request(uuid, uuid, text, uuid)', 'EXECUTE')
     OR has_function_privilege('anon', 'public.decide_song_request(uuid, uuid, text, uuid)', 'EXECUTE') THEN
    RAISE EXCEPTION 'decide_song_request is callable by a browser role';
  END IF;
END $$;

COMMIT;
