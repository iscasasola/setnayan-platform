-- ============================================================================
-- THE GUEST-DELETE UNDO RESTORES ONLY WHAT WAS DELETED, FROM WHAT THE
-- DATABASE KEPT — NEVER FROM WHAT THE BROWSER SENDS BACK.
--
-- Independent review of train b (#6314, live at 777cf8f), two defects in the
-- Undo that #6311 ("delete takes song requests and Undo restores them") shipped:
--
--   1. `restoreDeletedGuests` (apps/web/app/dashboard/[eventId]/guests/
--      groups-actions.ts) ran `UPDATE guests SET deleted_at = NULL` over every
--      id the client listed, with no `deleted_at IS NOT NULL` filter. Its
--      RETURNING list — "the guests RLS really restored" — therefore included
--      guests that were never deleted, and the song requests the client handed
--      back for them were then INSERTED WITH THE SERVICE ROLE. A host could mint
--      a song request "from" any live guest on their event.
--   2. The song requests came back from the BROWSER (the delete returned them
--      to the client, the Undo posted them back) and were written verbatim,
--      including `decided_by_vendor_profile_id` and `decided_at` — so a host
--      could forge WHICH SUPPLIER decided a request, and when.
--
-- ── THE FIX: the delete KEEPS the rows; the Undo reads them back ───────────
--   • `guest_released_song_requests` — a holding pen, service-only (RLS on, no
--     policy, every browser grant revoked). A deleted guest's requests MOVE
--     here at delete time, byte-for-byte, attribution included.
--   • `release_deleted_guest_song_requests(event, ids)` — the delete calls it.
--     It moves ONLY requests of guests that are ALREADY soft-deleted, on an
--     event the caller may write guests on.
--   • `restore_deleted_guests(event, ids)` — the Undo calls it. It un-deletes
--     ONLY guests whose `deleted_at IS NOT NULL` on that event, and puts back
--     ONLY the rows the pen holds for exactly those guests. It takes NO song
--     data from the caller at all, so there is nothing left to forge.
--
-- ── WHO MAY CALL ───────────────────────────────────────────────────────────
-- The same three writers `guests`' own RLS admits for a write
-- (`couple_writes_guest` · `guests_moderator_write` · is_admin) — read from
-- the policies, not invented: the couple of the event, a moderator holding
-- 'edit' on the guest list, or an admin. Anyone else gets an exception, never
-- a silent zero. anon may not execute either function.
-- ============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS public.guest_released_song_requests (
  request_id   UUID PRIMARY KEY,
  event_id     UUID   NOT NULL REFERENCES public.events(event_id) ON DELETE CASCADE,
  -- A hard-deleted guest takes their held requests with them.
  guest_id     UUID   NOT NULL REFERENCES public.guests(guest_id) ON DELETE CASCADE,
  song_id      BIGINT NOT NULL REFERENCES public.songs(song_id)   ON DELETE CASCADE,
  requester_name TEXT,
  status       TEXT NOT NULL CHECK (status IN ('pending', 'accepted', 'declined')),
  decided_by_vendor_profile_id UUID REFERENCES public.vendor_profiles(vendor_profile_id) ON DELETE SET NULL,
  decided_at   TIMESTAMPTZ,
  created_at   TIMESTAMPTZ NOT NULL,
  released_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS guest_released_song_requests_guest_idx
  ON public.guest_released_song_requests (event_id, guest_id);

ALTER TABLE public.guest_released_song_requests ENABLE ROW LEVEL SECURITY;
-- Every new relation in `public` ships OPEN (ALTER DEFAULT PRIVILEGES). The pen
-- is reached ONLY through the two functions below; no browser role holds it.
REVOKE ALL ON TABLE public.guest_released_song_requests FROM PUBLIC, anon, authenticated;

COMMENT ON TABLE public.guest_released_song_requests IS
  'A soft-deleted guest''s song requests, held for the delete''s Undo. Written '
  'by release_deleted_guest_song_requests, read back by restore_deleted_guests. '
  'Service-only: the Undo never takes song data from the browser (2026-10-04).';

-- ── who may write guests on this event — the guests table's own writers ────
CREATE OR REPLACE FUNCTION public._may_write_guests(p_event_id UUID)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  -- coalesce: `moderator_area_level` is NULL for a non-moderator, and
  -- `NOT (false OR NULL)` is NULL — which plpgsql's IF reads as "not refused".
  SELECT coalesce(auth.uid() IS NOT NULL AND (
    p_event_id IN (SELECT public.current_couple_event_ids())
    OR coalesce(public.moderator_area_level(p_event_id, 'guest_list') = 'edit', false)
    OR public.is_admin()
  ), false);
$$;
REVOKE ALL ON FUNCTION public._may_write_guests(UUID) FROM PUBLIC, anon, authenticated;

-- ── the delete: move a deleted guest's requests into the pen ───────────────
CREATE OR REPLACE FUNCTION public.release_deleted_guest_song_requests(
  p_event_id  UUID,
  p_guest_ids UUID[]
)
RETURNS INTEGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_moved INTEGER;
BEGIN
  IF NOT public._may_write_guests(p_event_id) THEN
    RAISE EXCEPTION 'guests:not_allowed' USING ERRCODE = '42501';
  END IF;

  WITH moved AS (
    DELETE FROM public.event_song_requests r
     USING public.guests g
     WHERE r.event_id = p_event_id
       AND r.origin = 'guest'
       AND r.guest_id = ANY (coalesce(p_guest_ids, '{}'))
       AND g.guest_id = r.guest_id
       AND g.event_id = p_event_id
       AND g.deleted_at IS NOT NULL          -- only a guest who is REALLY deleted
    RETURNING r.request_id, r.event_id, r.guest_id, r.song_id, r.requester_name,
              r.status, r.decided_by_vendor_profile_id, r.decided_at, r.created_at
  )
  INSERT INTO public.guest_released_song_requests
    (request_id, event_id, guest_id, song_id, requester_name, status,
     decided_by_vendor_profile_id, decided_at, created_at)
  SELECT request_id, event_id, guest_id, song_id, requester_name, status,
         decided_by_vendor_profile_id, decided_at, created_at
    FROM moved
  ON CONFLICT (request_id) DO NOTHING;

  GET DIAGNOSTICS v_moved = ROW_COUNT;
  RETURN v_moved;
END;
$$;
REVOKE ALL ON FUNCTION public.release_deleted_guest_song_requests(UUID, UUID[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.release_deleted_guest_song_requests(UUID, UUID[]) TO authenticated;

-- ── the Undo: un-delete ONLY deleted guests, put back ONLY what the pen holds
CREATE OR REPLACE FUNCTION public.restore_deleted_guests(
  p_event_id  UUID,
  p_guest_ids UUID[]
)
RETURNS TABLE (restored_guest_ids UUID[], songs_restored INTEGER, songs_not_restored INTEGER)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_ids  UUID[];
  v_held INTEGER;
  v_back INTEGER;
BEGIN
  IF NOT public._may_write_guests(p_event_id) THEN
    RAISE EXCEPTION 'guests:not_allowed' USING ERRCODE = '42501';
  END IF;

  -- 1 · the set to restore is decided HERE, from the table: a guest that was
  --     never deleted (or is on another event) is not touched at all.
  WITH back AS (
    UPDATE public.guests g
       SET deleted_at = NULL
     WHERE g.event_id = p_event_id
       AND g.guest_id = ANY (coalesce(p_guest_ids, '{}'))
       AND g.deleted_at IS NOT NULL
    RETURNING g.guest_id
  )
  SELECT coalesce(array_agg(guest_id), '{}') INTO v_ids FROM back;

  SELECT count(*)::int INTO v_held
    FROM public.guest_released_song_requests h
   WHERE h.event_id = p_event_id AND h.guest_id = ANY (v_ids);

  -- 2 · their song requests come back exactly as the delete stored them —
  --     status, supplier attribution and timestamps included. A song somebody
  --     else asked for during the Undo window keeps THEIR request (one per
  --     song per event), so that held row is dropped, not forced in.
  INSERT INTO public.event_song_requests
    (request_id, event_id, song_id, origin, guest_id, anon_key, requester_name,
     status, decided_by_vendor_profile_id, decided_at, created_at)
  SELECT h.request_id, h.event_id, h.song_id, 'guest', h.guest_id, NULL, h.requester_name,
         h.status, h.decided_by_vendor_profile_id, h.decided_at, h.created_at
    FROM public.guest_released_song_requests h
   WHERE h.event_id = p_event_id AND h.guest_id = ANY (v_ids)
  ON CONFLICT DO NOTHING;
  GET DIAGNOSTICS v_back = ROW_COUNT;

  DELETE FROM public.guest_released_song_requests h
   WHERE h.event_id = p_event_id AND h.guest_id = ANY (v_ids);

  restored_guest_ids := v_ids;
  songs_restored := v_back;
  songs_not_restored := v_held - v_back;
  RETURN NEXT;
END;
$$;
REVOKE ALL ON FUNCTION public.restore_deleted_guests(UUID, UUID[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.restore_deleted_guests(UUID, UUID[]) TO authenticated;

COMMENT ON FUNCTION public.restore_deleted_guests(UUID, UUID[]) IS
  'The guest-delete Undo. Un-deletes only guests that ARE soft-deleted on the '
  'event, and restores only the song requests the delete held for them '
  '(guest_released_song_requests). Takes no song data from the caller.';

COMMIT;
