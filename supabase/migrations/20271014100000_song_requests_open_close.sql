-- ============================================================================
-- THE REQUESTS WINDOW — the act opens and closes it.
--
-- Owner, 2026-07-27: "the band will open or close accepting requests."
--
-- A band does not want requests during the ceremony, during their break, or
-- after last call. The window is theirs to open, and it is the difference
-- between a tool and a nuisance.
--
-- ── NO NEW TABLE, NO NEW POLICY ────────────────────────────────────────────
--
-- `vendor_dayof_configs` is ALREADY the sparse per-(vendor × event) day-of
-- config — the row the module configurator writes when a vendor turns tools on
-- and off for one booking. An absent row means "code defaults", so a vendor who
-- never configures anything costs zero writes. A requests window is exactly
-- that kind of per-booking preference, so it is one column on that row rather
-- than a table of its own.
--
-- And because the vendor already holds INSERT/UPDATE/SELECT on their own row
-- (`vendor_dayof_configs_vendor_*`, keyed on `current_vendor_profile_ids()`),
-- the act can flip this with NO new policy. Nothing about who may open the
-- window had to be invented.
--
-- ── CLOSED IS THE DEFAULT, AND THAT IS THE POINT ───────────────────────────
--
-- `DEFAULT FALSE`. A band that never touches the toggle never receives a
-- request — the feature cannot arrive unannounced at someone's gig. Opening is
-- a deliberate act by the people on stage. This also means the whole guest-
-- request path is inert on every existing booking the moment this ships, which
-- is the honest way to add a public write path.
--
-- ── ANY OPEN ACT OPENS THE ROOM ────────────────────────────────────────────
--
-- The request pool is per-EVENT (one inbox, `UNIQUE (event_id, song_id)`), but
-- the toggle is per-(vendor × event) because it belongs to the act. With two
-- acts booked, the room is open if EITHER is accepting — a guest should not
-- have to know which band is on stage to ask for a song, and the act that is
-- closed simply never accepts what it does not want to play.
-- ============================================================================

BEGIN;

ALTER TABLE public.vendor_dayof_configs
  ADD COLUMN IF NOT EXISTS song_requests_open BOOLEAN NOT NULL DEFAULT FALSE;

-- ── Pre-existing exposure, found by adding the column above and NOT created ──
-- ── by it. Closing it because we are here. ──────────────────────────────────
--
-- The exposure baseline shows `tpriv public.vendor_dayof_configs|anon SIUD`
-- and every EXISTING column already reading `anon=SIU`. The table never got the
-- explicit REVOKE that every relation in `public` needs (ALTER DEFAULT
-- PRIVILEGES grants arwdDxtm to anon AND authenticated — the root cause of the
-- 368-table exposure), so the new column merely inherited what was already
-- there.
--
-- Not exploitable today: all four policies on this table are TO authenticated,
-- so an anon caller holds the GRANT but no policy admits a single row. It is
-- the shape that becomes a hole the day someone adds a permissive policy — so
-- it should not survive a migration that is already touching this table.
--
-- DELETE goes too, from BOTH roles: there is no DELETE policy on this table, so
-- the privilege backs nothing. A vendor turning a module off UPDATEs their row.
--
-- This is a NARROWING. The freeze allows it without ceremony and it cannot fail
-- CI; nothing that works today loses anything.
REVOKE ALL ON TABLE public.vendor_dayof_configs FROM anon;
REVOKE DELETE ON TABLE public.vendor_dayof_configs FROM authenticated;

COMMENT ON COLUMN public.vendor_dayof_configs.song_requests_open IS
  'The act''s requests window for this booking (owner 2026-07-27: "the band will open or close accepting requests"). FALSE by default — a band that never opens it never receives a request. Read by guest_submit_song_request / open_submit_song_request via song_requests_open_for_event().';

-- Partial index: the open-window probe only ever asks for TRUE rows, and the
-- overwhelming majority will be FALSE.
CREATE INDEX IF NOT EXISTS vendor_dayof_configs_requests_open_idx
  ON public.vendor_dayof_configs (event_id)
  WHERE song_requests_open;

-- ── The gate both lanes consult ────────────────────────────────────────────
-- SECURITY DEFINER because the CALLER is a guest with no account and therefore
-- no read on vendor_dayof_configs. It returns one boolean and leaks nothing
-- else — not which act is open, not how many are booked.
CREATE OR REPLACE FUNCTION public.song_requests_open_for_event(p_event_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL SECURITY DEFINER STABLE SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.vendor_dayof_configs c
    WHERE c.event_id = p_event_id AND c.song_requests_open
  );
$$;

REVOKE ALL ON FUNCTION public.song_requests_open_for_event(UUID)
  FROM PUBLIC, anon, authenticated;

-- ── Both submit lanes now refuse a closed room ─────────────────────────────
-- Re-declared in full (CREATE OR REPLACE) rather than patched, so the shipped
-- body is readable in one place instead of reconstructed across two migrations.

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

  -- The window first: a closed room is a closed room, and saying so before any
  -- other check means a guest is never told "you are blocked" or "slow down"
  -- about a room that was not taking requests anyway.
  IF NOT public.song_requests_open_for_event(v_event) THEN
    RAISE EXCEPTION 'songreq:closed';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.guest_message_blocks b
    WHERE b.event_id = v_event AND b.guest_id = p_guest_id AND b.revoked_at IS NULL
  ) THEN RAISE EXCEPTION 'songreq:blocked'; END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended('songreq:g:' || p_guest_id::text, 0));

  SELECT count(*) INTO v_recent FROM public.event_song_requests r
    WHERE r.guest_id = p_guest_id AND r.created_at > NOW() - INTERVAL '1 hour';
  IF v_recent >= 5 THEN RAISE EXCEPTION 'songreq:rate_limited'; END IF;

  v_song := public.resolve_song_id(p_title, p_artist);

  RETURN QUERY
    INSERT INTO public.event_song_requests
      (event_id, song_id, origin, guest_id, requester_name)
    VALUES
      (v_event, v_song, 'guest', p_guest_id, nullif(btrim(coalesce(p_requester_name,'')), ''))
    ON CONFLICT (event_id, song_id) DO NOTHING
    RETURNING *;
END;
$$;

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

  SELECT e.event_id INTO v_event FROM public.events e
    WHERE e.master_qr_token = p_master_qr_token;
  IF v_event IS NULL THEN RAISE EXCEPTION 'songreq:unknown_event'; END IF;

  IF NOT public.song_requests_open_for_event(v_event) THEN
    RAISE EXCEPTION 'songreq:closed';
  END IF;

  PERFORM pg_advisory_xact_lock(
    hashtextextended('songreq:o:' || v_event::text || ':' || p_anon_key, 0));

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

REVOKE ALL ON FUNCTION public.guest_submit_song_request(UUID, TEXT, TEXT, TEXT)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.open_submit_song_request(TEXT, TEXT, TEXT, TEXT, TEXT)
  FROM PUBLIC, anon, authenticated;

COMMIT;
