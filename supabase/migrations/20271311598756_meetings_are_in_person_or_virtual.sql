-- meetings_are_in_person_or_virtual
-- Created via `pnpm migration:new`.
--
-- MEETINGS ARE IN-PERSON OR VIRTUAL — NO CALLS INSIDE SETNAYAN.
-- Owner 2026-10-28 (DECISION_LOG "CHAT APPROVED — MESSENGER LOOK, ONE ＋, NO
-- CALLS"): "remove both voice and video call". Follow-up approved 2026-11-04:
-- a meeting is In-person or Virtual, and a Virtual meeting happens on the
-- proposer's own Google Meet / Zoom / Messenger / Viber / phone.
--
-- DATA ONLY — no schema change. The app keeps storing a Virtual meeting as
-- kind 'video' (the existing CHECK allows it); its app + link live in the
-- existing `event_appointments.location` column (lib/virtual-meeting.ts).
--
--   1 · Every catalog preset whose default was a voice call now defaults to
--       Virtual ('video').
--   2 · The universal "Voice call" preset is no longer offered (is_active =
--       false, the column every reader already filters on). Not deleted: old
--       appointments of type 'voice_call' still resolve their label from it
--       wherever a reader does not filter is_active.
--
-- Existing event_appointments rows are NOT rewritten: an old 'voice' row reads
-- as Virtual in the app (`meetingModeOf`). Idempotent — both UPDATEs are no-ops
-- on a second run.

BEGIN;

UPDATE public.appointment_type_catalog
   SET default_mode = 'video'
 WHERE default_mode = 'voice';

UPDATE public.appointment_type_catalog
   SET is_active = false
 WHERE type = 'voice_call'
   AND label = 'Voice call'
   AND is_active;

COMMIT;
