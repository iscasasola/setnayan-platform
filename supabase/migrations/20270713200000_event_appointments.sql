-- ============================================================================
-- 20270713200000_event_appointments.sql
--
-- APPOINTMENTS BACKBONE — the two-sided vendor↔couple scheduling table
-- (corpus: Relationship_Workspace_and_Appointments_2026-07-11.md § "Appointments
-- system"; PR 11 of that build plan). ONE table that carries BOTH in-person
-- meetings (food tasting, site visit, fitting → location + Directions) AND
-- online calls (pre-shoot call, menu consult → Join via the free P2P call).
-- Generalizes the retired video-meeting feature (the old `thread_calls` idea):
-- every meeting — physical or virtual — is one appointment row.
--
-- LIFECYCLE: propose → confirm, EITHER direction. A vendor proposes from their
-- free slots, or a couple proposes from the vendor's open slots; the other side
-- confirms (status proposed → confirmed → done, or cancelled). This mirrors the
-- Suggest pattern of event_schedule_suggestions (vendors propose; couple/vendor
-- resolve) — no invented state machine.
--
-- RLS AT CREATE TIME with the canonical helpers — MIRRORS
-- event_schedule_suggestions (20261130003000) + booking_handovers
-- (20270321980372):
--   • couple / host / coordinator (event members) via current_event_ids()
--   • booked vendor org via current_vendor_booked_event_ids()
--       ∩ current_vendor_profile_ids() on write
--   • admin via is_admin()
-- No new helper functions; idempotent + re-run safe.
-- ============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS public.event_appointments (
  appointment_id     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id           uuid NOT NULL REFERENCES public.events(event_id) ON DELETE CASCADE,
  vendor_profile_id  uuid,              -- the vendor org this appointment is with
  thread_id          uuid,             -- optional link to the chat thread
  kind               text NOT NULL CHECK (kind IN ('in_person','video','voice')),
  type               text NOT NULL,    -- e.g. 'food_tasting','site_visit','fitting','consultation','custom'
  custom_label       text,             -- free-text name when type='custom'
  location           text,             -- for in_person (address / venue)
  scheduled_at       timestamptz,
  duration_min       int,
  status             text NOT NULL DEFAULT 'proposed'
                     CHECK (status IN ('proposed','confirmed','done','cancelled')),
  initiated_by       text CHECK (initiated_by IN ('vendor','couple')),
  proposed_by_user_id uuid,
  note               text,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS event_appointments_event_idx
  ON public.event_appointments (event_id, scheduled_at);
CREATE INDEX IF NOT EXISTS event_appointments_vendor_profile_idx
  ON public.event_appointments (vendor_profile_id, scheduled_at);

-- RLS AT CREATE TIME.
ALTER TABLE public.event_appointments ENABLE ROW LEVEL SECURITY;

-- Vendor: INSERT an appointment only on events they're BOOKED on, for their OWN
-- profile. Mirrors the schedule_suggestions / booking_handovers vendor-insert
-- gate (current_vendor_booked_event_ids ∩ current_vendor_profile_ids).
DROP POLICY IF EXISTS event_appointments_vendor_insert ON public.event_appointments;
CREATE POLICY event_appointments_vendor_insert
  ON public.event_appointments FOR INSERT TO authenticated
  WITH CHECK (
    event_id IN (SELECT public.current_vendor_booked_event_ids())
    AND vendor_profile_id IN (SELECT public.current_vendor_profile_ids())
  );

-- Vendor: READ their own org's appointments.
DROP POLICY IF EXISTS event_appointments_vendor_read ON public.event_appointments;
CREATE POLICY event_appointments_vendor_read
  ON public.event_appointments FOR SELECT TO authenticated
  USING (vendor_profile_id IN (SELECT public.current_vendor_profile_ids()));

-- Vendor: UPDATE their own org's appointments on events they're booked on
-- (confirm the couple's proposal, propose a new time, mark done/cancelled).
DROP POLICY IF EXISTS event_appointments_vendor_update ON public.event_appointments;
CREATE POLICY event_appointments_vendor_update
  ON public.event_appointments FOR UPDATE TO authenticated
  USING (
    vendor_profile_id IN (SELECT public.current_vendor_profile_ids())
    AND event_id IN (SELECT public.current_vendor_booked_event_ids())
  )
  WITH CHECK (
    vendor_profile_id IN (SELECT public.current_vendor_profile_ids())
    AND event_id IN (SELECT public.current_vendor_booked_event_ids())
  );

-- Couple / host / coordinator (event members) + admin: READ every appointment
-- on their events — the couple's list is the union across all booked vendors.
DROP POLICY IF EXISTS event_appointments_couple_read ON public.event_appointments;
CREATE POLICY event_appointments_couple_read
  ON public.event_appointments FOR SELECT TO authenticated
  USING (
    event_id IN (SELECT public.current_event_ids())
    OR public.is_admin()
  );

-- Couple / host / coordinator: INSERT an appointment on their own event (propose
-- from the vendor's open slots).
DROP POLICY IF EXISTS event_appointments_couple_insert ON public.event_appointments;
CREATE POLICY event_appointments_couple_insert
  ON public.event_appointments FOR INSERT TO authenticated
  WITH CHECK (event_id IN (SELECT public.current_event_ids()));

-- Couple / host / coordinator: UPDATE appointments on their own event (confirm
-- the vendor's proposal, propose a new time, cancel).
DROP POLICY IF EXISTS event_appointments_couple_update ON public.event_appointments;
CREATE POLICY event_appointments_couple_update
  ON public.event_appointments FOR UPDATE TO authenticated
  USING (event_id IN (SELECT public.current_event_ids()))
  WITH CHECK (event_id IN (SELECT public.current_event_ids()));

COMMENT ON TABLE public.event_appointments IS
  'Appointments backbone (Relationship Workspace + Appointments, PR 11): one row per vendor↔couple meeting — in_person (location + Directions) OR video/voice (Join via the free P2P call). Propose → confirm, either direction (proposed → confirmed → done | cancelled). Generalizes the retired video-meeting feature. RLS: booked vendor insert/read/update own (current_vendor_booked_event_ids ∩ current_vendor_profile_ids); couple/host/coordinator insert/read/update via current_event_ids; admin read via is_admin.';

COMMIT;
