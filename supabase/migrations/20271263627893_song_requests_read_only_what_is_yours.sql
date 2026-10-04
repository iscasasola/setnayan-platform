-- ============================================================================
-- A SONG REQUEST IS READ BY THE PEOPLE IT IS FOR — and nobody reads anon_key.
-- Created via `pnpm migration:new`. Idempotent (DROP POLICY IF EXISTS /
-- REVOKE / GRANT).
--
-- ── THE HOLE (measured in production, read-only, 2026-10-04) ───────────────
--   event_song_requests_read  SELECT  TO authenticated
--     USING (event_id IN (SELECT current_event_ids()) OR is_admin())
--   + table-level SELECT for `authenticated` (every column, anon_key included)
--
-- `current_event_ids()` returns EVERY `event_members` row of the caller with no
-- member_type filter (its own COMMENT says so; 20271015300000 named this very
-- table as one of the policies still written against it). So an ordinary
-- invited guest with an account could read, straight through PostgREST, every
-- request on the event: who asked for what (`guest_id`, `requester_name`) and
-- every walk-in's `anon_key`.
--
-- ── WHAT anon_key IS (so what leaking it costs) ────────────────────────────
-- An opaque per-device key on the bar/walk-in lane (origin='open'), written
-- only by `open_submit_song_request` (service_role only; no app caller today).
-- It AUTHORISES NOTHING — the scanned master QR token is the authorisation on
-- that lane; the key is only the rate-limit bucket (3/hour/device/event) and
-- the handle "mute one abusive device" would use. Leaking it therefore does
-- not let anyone act AS the device, but it is a stable pseudonymous device
-- identifier: it links one phone's requests across events, and whoever holds
-- it could exhaust or get muted that device's bucket the day the open lane
-- gains a caller. Its owner is a device with NO account, so there is no
-- session that is "its owner" — no browser role has a reason to read it.
--
-- ── WHO LEGITIMATELY READS THIS TABLE (call-site audit, 2026-10-04) ────────
--   • the HOSTS (couple) — dashboard/[eventId]/guests/page.tsx search, session
--     client: `guest_id, songs(title, artist)`. Keeps all rows.
--   • a DELEGATE whose host left The Day (`schedule`) at View or Edit — the
--     same rule `event_song_picks_host_select` uses since 20271262573732
--     (People with access, #6315): a coordinator member AND
--     moderator_area_level(event_id,'schedule') IS NOT NULL. The guests page
--     search degrades gracefully for a delegate with The Day Off (no song
--     words; it already logs and continues on a refused read).
--   • a GUEST reading THEIR OWN requests — `guest_id IN current_user_guest_ids()`
--     (event_members.guest_id; event_members INSERT/UPDATE is couple/admin
--     only, so a guest cannot point their membership at someone else's row).
--     No shipped screen reads this yet; it is the only guest-shaped read the
--     table can safely offer, so it is the one it offers.
--   • ADMIN — is_admin().
--   • the PAID song-desk act — fetchActSongRequests, service_role after the
--     song_desk gate (RLS cannot ask "paid"; 20271020224218). Unaffected.
--   • interconnect probe `song-requests-audience` — service_role. Unaffected.
--   • submit / decide / release / restore RPCs — SECURITY DEFINER. Unaffected.
--
-- ── THE FIX ────────────────────────────────────────────────────────────────
--   1. The read policy admits exactly the four readers above — no
--      `current_event_ids()` leg.
--   2. `authenticated` loses table-level SELECT and gets SELECT back on every
--      column EXCEPT anon_key. RLS is row-level, never value-level: a column
--      no browser may see has to be closed by privilege. A column added later
--      is closed until somebody grants it on purpose.
-- ============================================================================

BEGIN;

-- ── 1 · the rows: hosts all · delegate per The Day · a guest their own ────
DROP POLICY IF EXISTS event_song_requests_read ON public.event_song_requests;
CREATE POLICY event_song_requests_read
  ON public.event_song_requests FOR SELECT
  TO authenticated
  USING (
    -- The hosts. Their access has never depended on a grant.
    event_id IN (SELECT public.current_couple_event_ids())
    -- A delegate, only where the host left The Day at View or Edit — the
    -- exact rule of event_song_picks_host_select (20271262573732).
    OR (
      event_id IN (SELECT public.current_couple_or_coordinator_event_ids())
      AND public.moderator_area_level(event_id, 'schedule') IS NOT NULL
    )
    -- A guest, only the requests they made.
    OR guest_id IN (SELECT public.current_user_guest_ids())
    OR public.is_admin()
  );

COMMENT ON POLICY event_song_requests_read ON public.event_song_requests IS
  'Hosts read every request on their event; a delegate reads them only where '
  'the host left The Day (schedule) at View/Edit; a guest reads only their own '
  '(guest_id via event_members); admin oversees. Never current_event_ids() — '
  'that admits every guest member (2026-10-04). The paid act reads through '
  'service_role after the song_desk gate. anon_key is closed by column '
  'privilege, not by this policy.';

-- ── 2 · the columns: anon_key is readable by no browser role ──────────────
REVOKE SELECT ON TABLE public.event_song_requests FROM PUBLIC, anon, authenticated;
REVOKE SELECT (anon_key) ON TABLE public.event_song_requests FROM PUBLIC, anon, authenticated;
GRANT SELECT (request_id, event_id, song_id, origin, guest_id, requester_name,
              status, decided_by_vendor_profile_id, decided_at, created_at)
  ON TABLE public.event_song_requests TO authenticated;

-- ── Post-conditions · assert the catalog, not the statements ──────────────
DO $$
DECLARE
  v_qual TEXT;
BEGIN
  IF has_table_privilege('authenticated', 'public.event_song_requests', 'SELECT') THEN
    RAISE EXCEPTION 'authenticated still holds table-level SELECT on event_song_requests';
  END IF;
  IF has_column_privilege('authenticated', 'public.event_song_requests', 'anon_key', 'SELECT')
     OR has_column_privilege('anon', 'public.event_song_requests', 'anon_key', 'SELECT') THEN
    RAISE EXCEPTION 'a browser role can still read event_song_requests.anon_key';
  END IF;
  IF NOT has_column_privilege('authenticated', 'public.event_song_requests', 'guest_id', 'SELECT') THEN
    RAISE EXCEPTION 'the hosts lost the guest_id read their guest-list search needs';
  END IF;
  SELECT qual INTO v_qual FROM pg_policies
   WHERE schemaname = 'public' AND tablename = 'event_song_requests'
     AND policyname = 'event_song_requests_read';
  IF v_qual IS NULL OR strpos(v_qual, 'current_event_ids()') > 0 THEN
    RAISE EXCEPTION 'event_song_requests_read still admits every event member';
  END IF;
END $$;

COMMIT;
