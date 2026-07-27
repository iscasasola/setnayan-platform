-- ============================================================================
-- The remaining SIX couple/host policies — narrowed. Guests are out.
--
-- OWNER RULINGS 2026-07-27, verbatim:
--   Q "May a guest see the couple's vendor appointments?"      → "no"
--   Q "May a guest see or change the couple's song picks?"     → "no"
--   Q "Who may answer an access request?"                      → the owner asked
--     what an access request even is; on inspection the question answers itself
--     (see below), so it is settled by the schema rather than by a ruling.
--
-- Completes 20271015300000, which fixed ten of sixteen and pinned these six in a
-- shrink-only KNOWN_BROAD list because their non-admin call sites made the safe
-- shape unclear. Reading the FULL policy set on each table resolved that: every
-- one of these tables ALREADY has a separate vendor/requester policy, so the
-- couple/host policy never had to carry those roles in the first place.
--
--   event_appointments        · event_appointments_vendor_read/_update/_insert
--   event_song_picks          · event_song_picks_booked_vendor_read
--   booking_handovers         · booking_handovers_vendor_read/_insert
--   event_access_requests     · event_access_requests_own_read/_own_withdraw
--                               /_own_insert
--
-- WHICH HELPER, AND WHY
-- ---------------------
-- `current_couple_or_coordinator_event_ids()` — member_type IN ('couple',
-- 'coordinator') — is used for the READ surfaces. It excludes guests (the
-- ruling) while keeping the invited coordinator, who is a first-class planning
-- role here; `event_appointments_couple_insert` and `_couple_update` already
-- use exactly this helper, so the read now matches its own siblings instead of
-- being broader than the writes beside it.
--
-- `current_couple_event_ids()` — couple only — is used for the two
-- event_access_requests policies. That table is a coordinator ASKING the couple
-- to share an area (seat plan, schedule); a row confers no access by itself,
-- and the grant lives in `event_moderators.permissions_json`. So the answer must
-- be the couple's alone: with the member-wide predicate a coordinator could
-- APPROVE THEIR OWN REQUEST, and any guest could approve it for them. The
-- requester keeps their own view through `_own_read` and can still retract
-- through `_own_withdraw`, so narrowing costs the asker nothing.
-- ============================================================================

-- ── event_appointments — vendor meetings/calls on the couple's calendar ─────
DROP POLICY IF EXISTS event_appointments_couple_read ON public.event_appointments;
CREATE POLICY event_appointments_couple_read ON public.event_appointments
  FOR SELECT TO authenticated
  USING (
    event_id IN (SELECT public.current_couple_or_coordinator_event_ids())
    OR public.is_admin()
  );

-- ── event_song_picks — the couple's playlist ───────────────────────────────
-- The booked band/DJ keeps its own read via event_song_picks_booked_vendor_read
-- (migration 20271013090000), so this policy carries the planning side only.
DROP POLICY IF EXISTS event_song_picks_host_select ON public.event_song_picks;
CREATE POLICY event_song_picks_host_select ON public.event_song_picks
  FOR SELECT TO authenticated
  USING (
    event_id IN (SELECT public.current_couple_or_coordinator_event_ids())
    OR public.is_admin()
  );

DROP POLICY IF EXISTS event_song_picks_host_write ON public.event_song_picks;
CREATE POLICY event_song_picks_host_write ON public.event_song_picks
  FOR ALL TO authenticated
  USING (
    event_id IN (SELECT public.current_couple_or_coordinator_event_ids())
    OR public.is_admin()
  )
  WITH CHECK (
    event_id IN (SELECT public.current_couple_or_coordinator_event_ids())
    OR public.is_admin()
  );

-- ── booking_handovers — what a vendor hands over at completion ──────────────
DROP POLICY IF EXISTS booking_handovers_couple_read ON public.booking_handovers;
CREATE POLICY booking_handovers_couple_read ON public.booking_handovers
  FOR SELECT TO authenticated
  USING (
    event_id IN (SELECT public.current_couple_or_coordinator_event_ids())
    OR public.is_admin()
  );

-- ── event_access_requests — the coordinator's ask; the COUPLE's answer ──────
-- Couple only, deliberately: see the helper note above.
DROP POLICY IF EXISTS event_access_requests_host_read ON public.event_access_requests;
CREATE POLICY event_access_requests_host_read ON public.event_access_requests
  FOR SELECT TO authenticated
  USING (event_id IN (SELECT public.current_couple_event_ids()) OR public.is_admin());

DROP POLICY IF EXISTS event_access_requests_host_answer ON public.event_access_requests;
CREATE POLICY event_access_requests_host_answer ON public.event_access_requests
  FOR UPDATE TO authenticated
  USING (event_id IN (SELECT public.current_couple_event_ids()));
