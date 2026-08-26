-- ============================================================================
-- A PHOTO CANNOT BE MINTED WITHOUT PASSING THE METER
-- ============================================================================
--
-- 🚨 THE HOLE, LIVE IN PROD UNTIL THIS MIGRATION.
--
-- `recordSeatCapture` (app/papic/actions.ts) is where a Papic capture is
-- weighed: a per-camera burst limiter, the 10-second clip cap, the capture
-- window, the paid-order gate, the "this celebration is put away" gate, the
-- RA 10173 geo control, and — the one the business rests on — the atomic
-- credit reservation (`papic_reserve_capture_split`). Its own docblock calls
-- the reserve "the AUTHORITATIVE, race-safe gate".
--
-- It was not a gate. It was a suggestion.
--
-- The row it finally writes went in through the CLAIMER'S OWN SESSION, and
-- `authenticated` holds INSERT on the table. So the same person could skip the
-- function entirely and POST to /rest/v1/papic_photos with the public anon key,
-- creating photo rows without spending one credit, without a length check,
-- outside the capture window, on an unpaid camera, on a celebration that has
-- been put away, carrying geolocation on an event whose privacy control is off.
--
-- 🔑 AND THE GRANT DID NOT SHOW UP WHERE ANYBODY WOULD LOOK FOR IT.
-- `information_schema.role_table_grants` reports NO INSERT on this table for
-- `authenticated` — the privilege is held at COLUMN level, on all 39 grantable
-- columns. A table-level audit reads clean. This project has already paid for
-- this exact blind spot once: the samahan grant sweep reported 25 tables and
-- measured 9 only after it was taught to count column grants.
--
-- 🔑 THE APP LAYER IS NEVER THE CONTROL. lib/supabase/client.ts ships a browser
-- client, the anon key is public by construction, and PostgREST serves every
-- public table. "Our server action always meters correctly" is not a defence —
-- it is a description of the path we hope people take.
--
-- ⚖ WHO COULD DO IT, AND WHY IT GOT WORSE THIS WEEK. Until 2026-08-26 a claimer
-- was a friend handed a camera. Then the Uploads camera shipped and the COUPLE
-- claims a seat of their own — so every host on the platform acquired the
-- ability to mint their own credits. The feature is right; it just walked past
-- an open door nobody had noticed, which is the usual way these are found.
--
-- ── WHAT CHANGES ─────────────────────────────────────────────────────────────
--
-- 1. INSERT is revoked from `authenticated` and `anon`. A TABLE-level revoke is
--    what drops the COLUMN grants — revoking column by column would leave any
--    column added later granted, and the next migration to add one would
--    silently re-open this.
--
-- 2. `papic_photos_claimer_own` was PERMISSIVE FOR ALL, so it also declared an
--    INSERT arm. With the grant gone that arm is unreachable, but a policy that
--    still SAYS insert is admitted is how a future reader concludes the door is
--    open and writes code through it. It is replaced by three policies — SELECT,
--    UPDATE, DELETE — carrying the SAME predicates it had. This mirrors what
--    `20271168890783_one_door_into_papic_photos` did to the couple's FOR ALL
--    policy a day earlier; the two halves of the table now read alike.
--
--    ⚠ THE PREDICATES ARE COPIED, NOT IMPROVED. The old USING clause did NOT
--    ask whether the seat was revoked (only WITH CHECK did), so a revoked
--    claimer can still read and delete what they shot. That may or may not be
--    right — it is not this migration's question, and quietly answering it here
--    would hide a behaviour change inside a security fix.
--
-- 3. Captures keep working, unchanged, because `recordSeatCapture` now writes
--    its row with the service role. Every gate listed at the top runs first, in
--    that function, and it is now the ONLY way a seat capture can exist.
--
-- ── WHAT THIS DOES *NOT* DO, STATED SO NOBODY READS MORE INTO IT ─────────────
--
-- ⛔ The reservation and the insert are still TWO steps, not one transaction.
-- The credits are booked, then the row is written, and an insert failure
-- unwinds the booking in application code (abortReleaseDedicated /
-- abortReleasePool). A process that dies between the two leaks the credits it
-- reserved — the couple is charged for a photo that does not exist. That is a
-- LEAK, and it errs against us rather than against the meter, which is the
-- correct direction to fail while it stands. The real repair is a
-- SECURITY DEFINER record function that reserves and inserts under one
-- transaction, which also deletes the unwind code outright. It is not in this
-- migration because moving eight app-side gates into SQL on the live camera
-- path is a rewrite, and this hole should not wait for it.
--
-- 🔑 AND THAT REPAIR IS NOT A NEW IDEA — IT ALREADY SHIPS, ON THE OTHER HALF OF
-- THIS SAME FEATURE. `papic_record_guest_capture` is SECURITY DEFINER and does
-- the whole thing in one function: resolve the guest, check the event owns the
-- service, check the uploader is not blocked, check terms were accepted, check
-- the unlock pass, reserve from the pool, insert. That is why `anon` needs no
-- INSERT grant and has never had one. The SEAT path is the odd one out, not the
-- normal one. Whoever picks this up: copy the guest function's shape.
--
-- 🔒 Do not "simplify" this by handing the INSERT grant back and relying on a
-- WITH CHECK. A policy cannot count credits.
--
-- ⚠ Prod today: 14 papic_photos rows, all legitimate. Nothing is being
-- retro-fixed here — this closes a door, it does not clean up after anyone.
-- ============================================================================

-- 1 ── the grant. Table-level, so every column goes with it.
REVOKE INSERT ON TABLE public.papic_photos FROM authenticated;
REVOKE INSERT ON TABLE public.papic_photos FROM anon;

-- 2 ── the policy. FOR ALL → three verbs, same predicates.
DROP POLICY IF EXISTS papic_photos_claimer_own ON public.papic_photos;

CREATE POLICY papic_photos_claimer_read ON public.papic_photos
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.paparazzi_seats ps
      WHERE ps.seat_id = papic_photos.paparazzi_seat_id
        AND ps.claimer_user_id = auth.uid()
        AND ps.event_id = papic_photos.event_id
    )
  );

CREATE POLICY papic_photos_claimer_update ON public.papic_photos
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.paparazzi_seats ps
      WHERE ps.seat_id = papic_photos.paparazzi_seat_id
        AND ps.claimer_user_id = auth.uid()
        AND ps.event_id = papic_photos.event_id
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.paparazzi_seats ps
      WHERE ps.seat_id = papic_photos.paparazzi_seat_id
        AND ps.claimer_user_id = auth.uid()
        AND ps.revoked_at IS NULL
        AND ps.event_id = papic_photos.event_id
    )
  );

CREATE POLICY papic_photos_claimer_delete ON public.papic_photos
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.paparazzi_seats ps
      WHERE ps.seat_id = papic_photos.paparazzi_seat_id
        AND ps.claimer_user_id = auth.uid()
        AND ps.event_id = papic_photos.event_id
    )
  );

COMMENT ON TABLE public.papic_photos IS
  'Papic captures. INSERT is service-role only (2026-08-26): every seat capture '
  'is metered by recordSeatCapture and every guest capture by '
  'papic_record_guest_capture, and neither gate can be expressed as a policy '
  'because a policy cannot count credits. Do not grant INSERT back. Claimers '
  'keep SELECT/UPDATE/DELETE on their own seat''s rows; the couple keeps '
  'SELECT/UPDATE/DELETE on their own event''s.';
