-- an_area_set_to_off_is_closed
-- Created via `pnpm migration:new`. Idempotent: every statement is
-- DROP POLICY IF EXISTS … ; CREATE POLICY … on a policy that already exists.
--
-- ── WHY (owner 2026-10-03, "People with access") ────────────────────────────
-- Access is set PER PERSON, PER AREA, as Edit · View · Off, in Event Details ›
-- People with access. "Off" has to mean the person cannot READ that part.
--
-- Measured on the replayed schema before this file: the WRITE side of every
-- area already asks `moderator_area_level(event_id, <area>) = 'edit'`, and the
-- guest list (20271166697898), the budget and the photos already gate their
-- READS on the area. Three areas did not — their read policies admitted ANY
-- accepted delegate, whatever the host had set:
--
--   seat plan  · event_tables_moderator_read · event_tables_coordinator_read ·
--                event_seat_assignments_moderator_read ·
--                event_seat_assignments_coordinator_read ·
--                event_floor_plan_moderator_read
--   The Day    · event_schedule_blocks_moderator_read ·
--                event_song_picks_host_select / _host_write (any coordinator
--                member could read AND write the couple's songs)
--   suppliers  · event_vendors_moderator_read
--
-- So turning one of them Off closed the SCREEN and left the DOOR open: these
-- tables are served over PostgREST. Each policy below asks the same question
-- its write twin already asks, one level lower (IS NOT NULL = View or Edit).
-- Policies are OR-ed, so BOTH delegate doors on a table are narrowed (the
-- `_moderator_` seat door and the `_coordinator_` member door).
--
-- ── WHAT DOES NOT CHANGE ────────────────────────────────────────────────────
--   · The hosts (`couple` members) keep their own policies, untouched.
--   · A seat with NO `areas` map (a host row minted before areas existed) keeps
--     the resolver's legacy fallback — `moderator_area_level` is not edited.
--   · A limited helper is written View on every area, so they read as before.
--   · Booked suppliers read through their own policies
--     (`*_booked_vendor_read`, `current_vendor_booked_event_ids()`), untouched.
--   · Only a delegate whose host set that area Off (or never granted it on an
--     `areas` map — the 2026-08-25 rule) loses the read. That is the point.
--
-- Proven by apps/web/tests/db/an-area-set-to-off-is-closed.db.test.ts (View
-- cannot write · Off cannot read, per area, through a real session).

-- ── Seat plan ───────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS event_tables_moderator_read ON public.event_tables;
CREATE POLICY event_tables_moderator_read ON public.event_tables
  FOR SELECT TO authenticated
  USING (public.moderator_area_level(event_id, 'seat_plan') IS NOT NULL);

DROP POLICY IF EXISTS event_tables_coordinator_read ON public.event_tables;
CREATE POLICY event_tables_coordinator_read ON public.event_tables
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.event_members em
       WHERE em.event_id = event_tables.event_id
         AND em.user_id = auth.uid()
         AND em.member_type = 'coordinator'::public.member_type
    )
    AND public.moderator_area_level(event_id, 'seat_plan') IS NOT NULL
  );

DROP POLICY IF EXISTS event_seat_assignments_moderator_read ON public.event_seat_assignments;
CREATE POLICY event_seat_assignments_moderator_read ON public.event_seat_assignments
  FOR SELECT TO authenticated
  USING (public.moderator_area_level(event_id, 'seat_plan') IS NOT NULL);

DROP POLICY IF EXISTS event_seat_assignments_coordinator_read ON public.event_seat_assignments;
CREATE POLICY event_seat_assignments_coordinator_read ON public.event_seat_assignments
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.event_members em
       WHERE em.event_id = event_seat_assignments.event_id
         AND em.user_id = auth.uid()
         AND em.member_type = 'coordinator'::public.member_type
    )
    AND public.moderator_area_level(event_id, 'seat_plan') IS NOT NULL
  );

DROP POLICY IF EXISTS event_floor_plan_moderator_read ON public.event_floor_plan;
CREATE POLICY event_floor_plan_moderator_read ON public.event_floor_plan
  FOR SELECT TO authenticated
  USING (public.moderator_area_level(event_id, 'seat_plan') IS NOT NULL);

-- ── The Day (schedule · songs) ──────────────────────────────────────────────
DROP POLICY IF EXISTS event_schedule_blocks_moderator_read ON public.event_schedule_blocks;
CREATE POLICY event_schedule_blocks_moderator_read ON public.event_schedule_blocks
  FOR SELECT TO authenticated
  USING (public.moderator_area_level(event_id, 'schedule') IS NOT NULL);

DROP POLICY IF EXISTS event_song_picks_host_select ON public.event_song_picks;
CREATE POLICY event_song_picks_host_select ON public.event_song_picks
  FOR SELECT TO authenticated
  USING (
    event_id IN (SELECT public.current_couple_event_ids())
    OR (
      event_id IN (SELECT public.current_couple_or_coordinator_event_ids())
      AND public.moderator_area_level(event_id, 'schedule') IS NOT NULL
    )
    OR public.is_admin()
  );

DROP POLICY IF EXISTS event_song_picks_host_write ON public.event_song_picks;
CREATE POLICY event_song_picks_host_write ON public.event_song_picks
  FOR ALL TO authenticated
  USING (
    event_id IN (SELECT public.current_couple_event_ids())
    OR (
      event_id IN (SELECT public.current_couple_or_coordinator_event_ids())
      AND public.moderator_area_level(event_id, 'schedule') = 'edit'
    )
    OR public.is_admin()
  )
  WITH CHECK (
    event_id IN (SELECT public.current_couple_event_ids())
    OR (
      event_id IN (SELECT public.current_couple_or_coordinator_event_ids())
      AND public.moderator_area_level(event_id, 'schedule') = 'edit'
    )
    OR public.is_admin()
  );

-- ── Suppliers ───────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS event_vendors_moderator_read ON public.event_vendors;
CREATE POLICY event_vendors_moderator_read ON public.event_vendors
  FOR SELECT TO authenticated
  USING (public.moderator_area_level(event_id, 'vendors') IS NOT NULL);

