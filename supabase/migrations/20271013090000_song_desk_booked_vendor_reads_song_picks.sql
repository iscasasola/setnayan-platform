-- ============================================================================
-- SONG DESK — let a BOOKED vendor read the couple's song requests.
--
-- THE GAP THIS CLOSES. `event_song_picks` (migration 20260731000000) is the
-- couple's chosen songs. It shipped with host-only reads:
--
--     event_song_picks_host_select  USING (event_id IN current_event_ids()
--                                          OR is_admin())
--
-- That was correct for what existed then — the picks fed the couple's own
-- onboarding and the marketplace MATCH SCORE, and the score is computed for the
-- couple, on the couple's side, never handed to a vendor. But it means the band
-- booked to PLAY those songs is the one party who cannot see them. The song desk
-- (2026-07-26 owner lock: "band/singer/orchestra's song desk — requests · set
-- list · what's-next") is unbuildable without this read, at any UI layer.
--
-- THE BOUNDARY, AND WHY IT IS THIS ONE. Copied deliberately from the shipped
-- precedent one table over — `event_schedule_blocks_booked_vendor_read`
-- (20261130003000), which grants a booked vendor the couple's full run-of-show
-- via the SECURITY DEFINER helper `current_vendor_booked_event_ids()`. That
-- helper already encodes "genuinely booked": status IN (contracted,
-- deposit_paid, delivered, complete), matched to the caller's own vendor profile
-- OR a team membership. An enquiry, a declined lead or a cancelled booking
-- reads nothing.
--
-- Same helper, same shape, same scope — so this grant cannot be wider than the
-- timeline grant a booked vendor already holds, and there is exactly one
-- definition of "booked" in the schema rather than two that can drift apart.
--
-- WHY NOT NARROW IT TO MUSIC VENDORS. Tempting — only a music act needs this —
-- but the narrowing would have to hardcode the taxonomy keys (live_band, choir,
-- orchestra, wedding_singer, dj) into SQL, where they would silently drift from
-- `MUSIC_CANONICALS` in `lib/songs.ts` the first time the taxonomy moves. The
-- gate author called out that exact drift risk when reusing MUSIC_CANONICALS
-- rather than re-listing the tiles. A policy that disagrees with the app about
-- who counts as a music act is a worse outcome than a boundary that is one
-- notch wider but has a single, stable definition — particularly when the wider
-- read is the couple's wedding playlist, shared with vendors who are already
-- trusted with the couple's full timeline, guest headcount and floor plan, and
-- which is by its nature performed publicly at the event.
--
-- SELECT ONLY. The vendor reads the couple's requests; they never edit them.
-- The couple's write policy (`event_song_picks_host_write`) is untouched, so
-- the picks stay the couple's own record. A vendor's own repertoire lives in
-- `vendor_songs`, which they already own and write.
--
-- ADDITIVE. One new SELECT policy. No table, no column, no change to any
-- existing policy, and nothing is revoked — a purely additive grant to a party
-- that previously read nothing.
-- ============================================================================

DROP POLICY IF EXISTS event_song_picks_booked_vendor_read ON public.event_song_picks;
CREATE POLICY event_song_picks_booked_vendor_read
  ON public.event_song_picks FOR SELECT
  TO authenticated
  USING (event_id IN (SELECT public.current_vendor_booked_event_ids()));

COMMENT ON POLICY event_song_picks_booked_vendor_read ON public.event_song_picks IS
  'Song desk (2026-07-27): a vendor booked on the event reads the couple''s song requests, so a music act can play against them. Mirrors event_schedule_blocks_booked_vendor_read — same current_vendor_booked_event_ids() helper, same scope. SELECT only; the couple keeps sole write.';
