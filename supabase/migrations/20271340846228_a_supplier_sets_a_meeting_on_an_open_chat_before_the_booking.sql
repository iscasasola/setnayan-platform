-- ============================================================================
-- A SUPPLIER SETS A MEETING ON AN OPEN CHAT — before the booking.
--
-- Owner, 12 Nov 2026 (on the TEST SetnaProd walk): "Tried testing the decision
-- and other (+) tools cannot add schedule" · "It is not synching properly with
-- schedules". Asked whether a supplier may set a meeting (an ocular visit, a
-- tasting) BEFORE the couple books: "Yes, before booking".
--
-- What was measured: the supplier's (+) offers Meeting on every OPEN (accepted)
-- chat, and `createScheduleRequestFromChat` accepts any accepted thread — but
-- `event_appointments_vendor_insert` (20270713200000) only admitted events the
-- supplier is BOOKED on. On an open, unbooked chat the insert was refused by
-- RLS and the card vanished. The couple could already propose on an unbooked
-- chat (their policy is event membership), and the supplier could not answer
-- it either: `event_appointments_vendor_update` had the same booked-only gate.
--
-- The rule now, for the supplier side of ONE row:
--   · their own profile (unchanged: current_vendor_profile_ids()), AND
--   · either booked on the event (unchanged), OR the row is tied to an OPEN
--     chat — `thread_id` names an `accepted` chat_threads row between THIS
--     event and THIS supplier profile. A row with no thread_id, a pending or
--     declined chat, or another supplier's chat admits nothing new.
-- Reads are unchanged (the vendor read policy is already own-profile only).
--
-- Guard: apps/web/tests/db/a-supplier-sets-a-meeting-on-an-open-chat.db.test.ts
-- ============================================================================

DROP POLICY IF EXISTS event_appointments_vendor_insert ON public.event_appointments;
CREATE POLICY event_appointments_vendor_insert
  ON public.event_appointments FOR INSERT TO authenticated
  WITH CHECK (
    vendor_profile_id IN (SELECT public.current_vendor_profile_ids())
    AND (
      event_id IN (SELECT public.current_vendor_booked_event_ids())
      OR EXISTS (
        SELECT 1
          FROM public.chat_threads t
         WHERE t.thread_id = event_appointments.thread_id
           AND t.event_id = event_appointments.event_id
           AND t.vendor_profile_id = event_appointments.vendor_profile_id
           AND t.inquiry_status = 'accepted'
      )
    )
  );

DROP POLICY IF EXISTS event_appointments_vendor_update ON public.event_appointments;
CREATE POLICY event_appointments_vendor_update
  ON public.event_appointments FOR UPDATE TO authenticated
  USING (
    vendor_profile_id IN (SELECT public.current_vendor_profile_ids())
    AND (
      event_id IN (SELECT public.current_vendor_booked_event_ids())
      OR EXISTS (
        SELECT 1
          FROM public.chat_threads t
         WHERE t.thread_id = event_appointments.thread_id
           AND t.event_id = event_appointments.event_id
           AND t.vendor_profile_id = event_appointments.vendor_profile_id
           AND t.inquiry_status = 'accepted'
      )
    )
  )
  WITH CHECK (
    vendor_profile_id IN (SELECT public.current_vendor_profile_ids())
    AND (
      event_id IN (SELECT public.current_vendor_booked_event_ids())
      OR EXISTS (
        SELECT 1
          FROM public.chat_threads t
         WHERE t.thread_id = event_appointments.thread_id
           AND t.event_id = event_appointments.event_id
           AND t.vendor_profile_id = event_appointments.vendor_profile_id
           AND t.inquiry_status = 'accepted'
      )
    )
  );
