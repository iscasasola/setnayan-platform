-- Face tagging is OFF by default — the couple opts in.
--
-- ⚖ DPO ruling 2026-10-23 (corpus DECISION_LOG, "OWNER ANSWERS ON THE BUILD
-- TRACKER"): *"face tagging OFF by default, opt-in"* — superseding the
-- 2026-10-01 "on by default, they can always turn it off" row.
--
-- ── A FLAG FLIP, NOT NEW SCHEMA ─────────────────────────────────────────────
-- The couple's own switch already exists: `face_tagging_declined_by_couple`,
-- read by `resolveFaceMode` as the LAST word (it can only ever say no). Until
-- now it defaulted to FALSE, so every event with Papic active ran face tagging
-- unless the couple found the switch. Defaulting it to TRUE makes "off" the
-- state nobody chose, and the couple's "Turn it on" (setCoupleFaceTaggingDeclined
-- with declined=0) the opt-in. The resolver is unchanged.
--
-- ── EXISTING EVENTS ─────────────────────────────────────────────────────────
-- An event where NO guest has ever enrolled a face has relied on nothing — it
-- is set to off, exactly like a new event. An event with any enrolment keeps
-- its current answer: someone there has already said yes, and switching the
-- event off would erase their selfie (the off-switch erases), which is the
-- couple's call to make, not a migration's.
--
-- Idempotent: SET DEFAULT is repeatable; the UPDATE only touches rows still at
-- the old default with no enrolment.

ALTER TABLE public.events
  ALTER COLUMN face_tagging_declined_by_couple SET DEFAULT true;

UPDATE public.events e
   SET face_tagging_declined_by_couple = true
 WHERE e.face_tagging_declined_by_couple = false
   AND NOT EXISTS (
     SELECT 1 FROM public.guest_face_enrollments g WHERE g.event_id = e.event_id
   );

COMMENT ON COLUMN public.events.face_tagging_declined_by_couple IS
  'Face tagging is OFF for this event unless the couple turns it on (DPO ruling '
  '2026-10-23: off by default, opt-in). TRUE (the default) = off; FALSE = the '
  'couple opted in. NARROWS ONLY in the resolver: the effective mode is on only '
  'when this is FALSE and Papic is active or an admin set mode_a. Written by '
  'setCoupleFaceTaggingDeclined (service-role, membership-checked) because '
  'events UPDATE is column-privileged and row-level.';
