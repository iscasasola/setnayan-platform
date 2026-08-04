-- ============================================================================
-- GUEST SONG REQUESTS — a guest asks for a song; the act ACCEPTS it.
--
-- Owner, 2026-07-27: "they will mark accept if they play. (so a bar can use us
-- everyday to document their event and the band play and the guest can request
-- a song via app as well)".
--
-- ACCEPT IS THE SETLIST. This is why there is no ordering table and no
-- position column. The act taps Accept; the accepted rows, in the order they
-- were accepted, ARE the set they are playing. One action, one table.
--
-- ── TWO LANES, BECAUSE A BAR HAS NO GUEST LIST (owner-chosen 2026-07-27) ────
--
--   origin='guest' — a wedding. The requester is a real row in `guests`, the
--                    same identity `guest_submit_column` already trusts.
--   origin='open'  — a bar / gala night. A stranger walks in and scans the
--                    venue's master QR. There is no guest list to be on, so
--                    identity is the TOKEN THEY SCANNED plus an opaque
--                    per-device key used only for rate-limiting.
--
-- Both lanes land in this one table so the act reads ONE inbox.
--
-- ── WHY NO INSERT POLICY (the shipped pattern, not a new idea) ─────────────
--
-- `guest_columns` says it outright: "NO INSERT policy — guest authoring goes
-- ONLY through the service-role submit RPC (zero-account guests have no
-- auth.uid())." A requester on either lane may have no account at all, so
-- there is no `auth.uid()` for a policy to test. The write path is therefore
-- two SECURITY DEFINER RPCs that validate the claim themselves, and both are
-- REVOKEd from PUBLIC/anon/authenticated so only the service role can call
-- them. An open INSERT policy on a public route is the exact shape of the
-- 2026-07-26 findings; there is deliberately no such policy here.
--
-- ── NOT event_day_requests ─────────────────────────────────────────────────
--
-- `event_day_requests` (20271013100000) is the COORDINATOR's floor-ops inbox:
-- origins couple/vendor/host/coordinator, kinds issue/status_update, free-text
-- body. It has no guest lane and no song. Different audience, different
-- payload — so this is its own table rather than a `kind` bolted onto that
-- stream. The shape here deliberately mirrors it (one stream, lanes, a status
-- a reader triages) so the two read alike.
-- ============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS public.event_song_requests (
  request_id   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id     UUID   NOT NULL REFERENCES public.events(event_id) ON DELETE CASCADE,
  song_id      BIGINT NOT NULL REFERENCES public.songs(song_id)   ON DELETE CASCADE,

  -- Which lane this came in on.
  origin       TEXT   NOT NULL CHECK (origin IN ('guest', 'open')),

  -- Wedding lane: the real guest. NULL on the open lane.
  guest_id     UUID REFERENCES public.guests(guest_id) ON DELETE SET NULL,

  -- Open lane: an opaque per-device key (hashed client-side; never a phone
  -- number, never an IP). Used ONLY to rate-limit and to let the act mute one
  -- abusive device. NULL on the wedding lane.
  anon_key     TEXT CHECK (anon_key IS NULL OR char_length(anon_key) BETWEEN 16 AND 128),

  -- Optional "— from Maria", shown to the act. Never required: a request is
  -- not an identity claim, and a bar walk-in should not have to name themselves
  -- to ask for a song.
  requester_name TEXT CHECK (requester_name IS NULL OR char_length(btrim(requester_name)) BETWEEN 1 AND 40),

  -- pending → accepted (we'll play it) | declined. No 'played': the owner's
  -- model is that ACCEPT means they play it, so a second state would be a
  -- distinction the act has to maintain for no one's benefit.
  status       TEXT NOT NULL DEFAULT 'pending'
               CHECK (status IN ('pending', 'accepted', 'declined')),

  decided_by_vendor_profile_id UUID REFERENCES public.vendor_profiles(vendor_profile_id) ON DELETE SET NULL,
  decided_at   TIMESTAMPTZ,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Each lane must carry its own identity, and only its own.
  CONSTRAINT event_song_requests_lane_identity CHECK (
    (origin = 'guest' AND guest_id IS NOT NULL AND anon_key IS NULL)
    OR
    (origin = 'open'  AND anon_key IS NOT NULL AND guest_id IS NULL)
  ),
  -- A decision and its timestamp travel together.
  CONSTRAINT event_song_requests_decided_together CHECK (
    (status = 'pending' AND decided_at IS NULL)
    OR
    (status <> 'pending' AND decided_at IS NOT NULL)
  )
);

-- The act's inbox read: this event, newest first.
CREATE INDEX IF NOT EXISTS event_song_requests_event_idx
  ON public.event_song_requests (event_id, status, created_at DESC);
-- The rate-limit probes.
CREATE INDEX IF NOT EXISTS event_song_requests_guest_idx
  ON public.event_song_requests (guest_id, created_at DESC) WHERE guest_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS event_song_requests_anon_idx
  ON public.event_song_requests (event_id, anon_key, created_at DESC) WHERE anon_key IS NOT NULL;
-- One live request per song per event: a room of 200 asking for the same song
-- should be ONE row the act decides once, not 200 rows they scroll past.
CREATE UNIQUE INDEX IF NOT EXISTS event_song_requests_one_per_song
  ON public.event_song_requests (event_id, song_id);

ALTER TABLE public.event_song_requests ENABLE ROW LEVEL SECURITY;

-- Every new relation in `public` ships OPEN (ALTER DEFAULT PRIVILEGES grants
-- arwdDxtm to anon AND authenticated) — the root cause of the 368-table
-- exposure. Close it before granting anything back.
REVOKE ALL ON TABLE public.event_song_requests FROM PUBLIC, anon, authenticated;
GRANT SELECT, UPDATE ON TABLE public.event_song_requests TO authenticated;

-- ── READ: the act who is booked, and the host. ─────────────────────────────
-- Same booked-vendor helper as event_song_picks_booked_vendor_read and
-- event_schedule_blocks_booked_vendor_read — one definition of "booked".
DROP POLICY IF EXISTS event_song_requests_read ON public.event_song_requests;
CREATE POLICY event_song_requests_read
  ON public.event_song_requests FOR SELECT
  TO authenticated
  USING (
    event_id IN (SELECT public.current_vendor_booked_event_ids())
    OR event_id IN (SELECT public.current_event_ids())
    OR public.is_admin()
  );

-- ── ACCEPT / DECLINE: the same audience. ───────────────────────────────────
-- The act decides — that is the whole feature — and the host can override in
-- their own room. WITH CHECK repeats the predicate so a row cannot be moved to
-- another event on the way through.
DROP POLICY IF EXISTS event_song_requests_decide ON public.event_song_requests;
CREATE POLICY event_song_requests_decide
  ON public.event_song_requests FOR UPDATE
  TO authenticated
  USING (
    event_id IN (SELECT public.current_vendor_booked_event_ids())
    OR event_id IN (SELECT public.current_event_ids())
    OR public.is_admin()
  )
  WITH CHECK (
    event_id IN (SELECT public.current_vendor_booked_event_ids())
    OR event_id IN (SELECT public.current_event_ids())
    OR public.is_admin()
  );

-- NO INSERT POLICY, NO DELETE POLICY — deliberate. Writes come only from the
-- two RPCs below; nothing is ever hard-deleted from a floor record.

-- ── Shared helper: resolve a typed title/artist to a master song. ──────────
-- Mirrors findOrCreateSongId() in lib/songs.ts, including its normalized_key
-- (lower(btrim(title)) || '|' || lower(btrim(artist))) and its race re-select.
-- source='couple' is the honest label for a guest-typed song and is inside the
-- songs.source CHECK ('seed','vendor','couple','admin').
CREATE OR REPLACE FUNCTION public.resolve_song_id(p_title TEXT, p_artist TEXT)
RETURNS BIGINT
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_title  TEXT := btrim(coalesce(p_title, ''));
  v_artist TEXT := btrim(coalesce(p_artist, ''));
  v_key    TEXT;
  v_id     BIGINT;
BEGIN
  IF char_length(v_title) < 1 OR char_length(v_title) > 200 THEN
    RAISE EXCEPTION 'songreq:invalid_title';
  END IF;
  IF char_length(v_artist) > 200 THEN
    RAISE EXCEPTION 'songreq:invalid_artist';
  END IF;

  v_key := lower(v_title) || '|' || lower(v_artist);

  SELECT s.song_id INTO v_id FROM public.songs s WHERE s.normalized_key = v_key;
  IF v_id IS NOT NULL THEN RETURN v_id; END IF;

  INSERT INTO public.songs (title, artist, source)
  VALUES (v_title, v_artist, 'couple')
  ON CONFLICT (normalized_key) DO NOTHING
  RETURNING song_id INTO v_id;

  IF v_id IS NULL THEN  -- lost the race
    SELECT s.song_id INTO v_id FROM public.songs s WHERE s.normalized_key = v_key;
  END IF;
  RETURN v_id;
END;
$$;

-- ── LANE 1 · the wedding guest (mirrors guest_submit_column) ───────────────
CREATE OR REPLACE FUNCTION public.guest_submit_song_request(
  p_guest_id UUID,
  p_title    TEXT,
  p_artist   TEXT DEFAULT '',
  p_requester_name TEXT DEFAULT NULL
)
RETURNS SETOF public.event_song_requests
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_event UUID;
  v_song  BIGINT;
  v_recent INT;
BEGIN
  SELECT g.event_id INTO v_event FROM public.guests g
    WHERE g.guest_id = p_guest_id AND g.deleted_at IS NULL;
  IF v_event IS NULL THEN RAISE EXCEPTION 'songreq:unknown_guest'; END IF;

  -- The SHARED block lever — one lever silences a hostile guest everywhere
  -- (guest_columns + Kwento already honour it; a song request must too, or the
  -- lever has a hole).
  IF EXISTS (
    SELECT 1 FROM public.guest_message_blocks b
    WHERE b.event_id = v_event AND b.guest_id = p_guest_id AND b.revoked_at IS NULL
  ) THEN RAISE EXCEPTION 'songreq:blocked'; END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended('songreq:g:' || p_guest_id::text, 0));

  -- Rate cap: 5 in a rolling hour. Generous for a real guest, useless for a
  -- spammer, and it counts the guest's OWN rows so one loud table cannot mute
  -- the room.
  SELECT count(*) INTO v_recent FROM public.event_song_requests r
    WHERE r.guest_id = p_guest_id AND r.created_at > NOW() - INTERVAL '1 hour';
  IF v_recent >= 5 THEN RAISE EXCEPTION 'songreq:rate_limited'; END IF;

  v_song := public.resolve_song_id(p_title, p_artist);

  RETURN QUERY
    INSERT INTO public.event_song_requests
      (event_id, song_id, origin, guest_id, requester_name)
    VALUES
      (v_event, v_song, 'guest', p_guest_id, nullif(btrim(coalesce(p_requester_name,'')), ''))
    -- Someone already asked for this song: not an error to the guest, and not
    -- a second row for the act. Return the existing row untouched.
    ON CONFLICT (event_id, song_id) DO NOTHING
    RETURNING *;
END;
$$;

-- ── LANE 2 · the bar walk-in (no guest list exists) ────────────────────────
CREATE OR REPLACE FUNCTION public.open_submit_song_request(
  p_master_qr_token TEXT,
  p_anon_key        TEXT,
  p_title           TEXT,
  p_artist          TEXT DEFAULT '',
  p_requester_name  TEXT DEFAULT NULL
)
RETURNS SETOF public.event_song_requests
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_event UUID;
  v_song  BIGINT;
  v_recent INT;
BEGIN
  IF p_anon_key IS NULL OR char_length(p_anon_key) < 16 THEN
    RAISE EXCEPTION 'songreq:invalid_key';
  END IF;

  -- The scanned token IS the authorisation: you are standing in the venue.
  -- Rotating master_qr_token (events.master_qr_token_rotated_at) instantly
  -- invalidates every printed code — the venue's kill switch.
  SELECT e.event_id INTO v_event FROM public.events e
    WHERE e.master_qr_token = p_master_qr_token;
  IF v_event IS NULL THEN RAISE EXCEPTION 'songreq:unknown_event'; END IF;

  PERFORM pg_advisory_xact_lock(
    hashtextextended('songreq:o:' || v_event::text || ':' || p_anon_key, 0));

  -- Tighter than the wedding lane: this lane is anonymous, so it is the one a
  -- stranger could abuse. 3 per device per rolling hour, per event.
  SELECT count(*) INTO v_recent FROM public.event_song_requests r
    WHERE r.event_id = v_event AND r.anon_key = p_anon_key
      AND r.created_at > NOW() - INTERVAL '1 hour';
  IF v_recent >= 3 THEN RAISE EXCEPTION 'songreq:rate_limited'; END IF;

  v_song := public.resolve_song_id(p_title, p_artist);

  RETURN QUERY
    INSERT INTO public.event_song_requests
      (event_id, song_id, origin, anon_key, requester_name)
    VALUES
      (v_event, v_song, 'open', p_anon_key, nullif(btrim(coalesce(p_requester_name,'')), ''))
    ON CONFLICT (event_id, song_id) DO NOTHING
    RETURNING *;
END;
$$;

-- Service-role only. Supabase's default privileges hand anon/authenticated
-- their OWN explicit EXECUTE entries at CREATE time, and those are NOT part of
-- PUBLIC — so the roles must be named (verified against prod 2026-07-26, when
-- five functions written with the FROM PUBLIC form were still anon-callable).
REVOKE ALL ON FUNCTION public.resolve_song_id(TEXT, TEXT)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.guest_submit_song_request(UUID, TEXT, TEXT, TEXT)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.open_submit_song_request(TEXT, TEXT, TEXT, TEXT, TEXT)
  FROM PUBLIC, anon, authenticated;

COMMENT ON TABLE public.event_song_requests IS
  'Guest song requests for one event. Two lanes: origin=guest (a real guests row, weddings) and origin=open (a walk-in who scanned the venue master QR, bars/gala nights). The act ACCEPTS a request and the accepted set IS their setlist. Writes only via guest_submit_song_request / open_submit_song_request (service-role).';

COMMIT;
