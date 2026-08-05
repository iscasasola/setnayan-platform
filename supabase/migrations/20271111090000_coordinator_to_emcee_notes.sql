-- A coordinator can send a note to the emcee — and to the emcee only.
--
-- ── WHAT THIS REPLACES, AND WHY NOT THE OBVIOUS THING ───────────────────────
-- The owner asked for coordinator → emcee messaging. The emcee cannot read
-- `coordinator_broadcasts` at all (member / moderator / admin only), so wiring
-- that up would have produced a permanently empty card — a fake door.
--
-- The obvious alternative was to grant the emcee event-member access. That was
-- REJECTED: an event member can read the couple's private notes on their own
-- schedule — "don't mention the surprise yet" — which exist precisely because
-- they are not for saying out loud. Handing a supplier the whole event to solve
-- a messaging gap trades away far more than the thing asked for.
--
-- So the message is ADDRESSED. `recipient_vendor_profile_id` names exactly one
-- supplier, and the read rule is "am I that supplier". No join against booked
-- services, no tile lookup inside a policy, and nothing else on the event
-- becomes visible. It also generalises: coordinator → any one supplier, the day
-- that is wanted, with no new policy.
--
-- ── WHO MAY WRITE ───────────────────────────────────────────────────────────
-- The event side (couple, or a moderator with schedule edit) and the booked
-- coordinator — mirroring `event_day_requests`, which is the same shape of
-- decision and already settled. A supplier CANNOT write: this is a channel TO
-- the emcee, and a supplier-to-supplier lane is a separate product question.
--
-- ── WHY NOT REUSE event_day_requests ────────────────────────────────────────
-- That stream is an INBOX the coordinator works through — every row is visible
-- to the whole event side by design. A note to the emcee has the opposite
-- shape: one named reader. Adding a recipient to that table would make every
-- existing row's audience ambiguous.

CREATE TABLE IF NOT EXISTS public.event_stage_notes (
  note_id                     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id                    uuid NOT NULL REFERENCES public.events(event_id) ON DELETE CASCADE,
  -- The one supplier who may read it. NOT NULL on purpose: a note with no
  -- recipient has no audience rule, and "everyone booked" is not a thing this
  -- table is allowed to express.
  recipient_vendor_profile_id uuid NOT NULL REFERENCES public.vendor_profiles(vendor_profile_id) ON DELETE CASCADE,
  -- NULLABLE, and it must be: the FK is ON DELETE SET NULL, which cannot fire
  -- against a NOT NULL column — erasing the sender would error instead of
  -- anonymising. This is an ACTOR stamp (who sent it), not a subject: the note
  -- is about the wedding, so it survives its author's erasure with the name
  -- removed. Matches the project's rule — CASCADE + NOT NULL means the row is
  -- ABOUT them; SET NULL means it records that they acted.
  author_user_id              uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  body                        text NOT NULL CHECK (char_length(btrim(body)) BETWEEN 1 AND 240),
  created_at                  timestamptz NOT NULL DEFAULT now(),
  -- Stamped when the emcee has seen it, so the sender knows it landed.
  read_at                     timestamptz
);

CREATE INDEX IF NOT EXISTS event_stage_notes_recipient_idx
  ON public.event_stage_notes (recipient_vendor_profile_id, created_at DESC);
CREATE INDEX IF NOT EXISTS event_stage_notes_event_idx
  ON public.event_stage_notes (event_id, created_at DESC);

ALTER TABLE public.event_stage_notes ENABLE ROW LEVEL SECURITY;
-- New tables in `public` arrive with broad default grants in this project; take
-- them away first and hand back only what the policies below are written for.
REVOKE ALL ON public.event_stage_notes FROM anon, authenticated;
GRANT SELECT, INSERT ON public.event_stage_notes TO authenticated;
GRANT UPDATE (read_at) ON public.event_stage_notes TO authenticated;

-- 1 · The addressed supplier reads their own notes. This is the whole point:
--     one named reader, and nothing else on the event opens up.
DROP POLICY IF EXISTS event_stage_notes_recipient_read ON public.event_stage_notes;
CREATE POLICY event_stage_notes_recipient_read
  ON public.event_stage_notes FOR SELECT TO authenticated
  USING (
    recipient_vendor_profile_id IN (SELECT public.current_vendor_profile_ids())
  );

-- 2 · The sending side reads what it sent (so "delivered / seen" is truthful).
DROP POLICY IF EXISTS event_stage_notes_sender_read ON public.event_stage_notes;
CREATE POLICY event_stage_notes_sender_read
  ON public.event_stage_notes FOR SELECT TO authenticated
  USING (
    event_id IN (SELECT public.current_event_ids())
    OR event_id IN (SELECT public.current_coordinator_booked_event_ids())
    OR public.moderator_area_level(event_id, 'schedule') IS NOT NULL
    OR public.is_admin()
  );

-- 3 · The event side and the booked coordinator write. `author_user_id =
--     auth.uid()` is what stops anyone filing a note under someone else's name.
DROP POLICY IF EXISTS event_stage_notes_event_insert ON public.event_stage_notes;
CREATE POLICY event_stage_notes_event_insert
  ON public.event_stage_notes FOR INSERT TO authenticated
  WITH CHECK (
    author_user_id = auth.uid()
    AND (
      event_id IN (SELECT public.current_event_ids())
      OR event_id IN (SELECT public.current_coordinator_booked_event_ids())
      OR public.moderator_area_level(event_id, 'schedule') = 'edit'
    )
  );

-- 4 · Only the addressed supplier marks it seen. The sender must not be able to
--     stamp their own note as read — that would turn a receipt into a fiction.
DROP POLICY IF EXISTS event_stage_notes_recipient_ack ON public.event_stage_notes;
CREATE POLICY event_stage_notes_recipient_ack
  ON public.event_stage_notes FOR UPDATE TO authenticated
  USING (recipient_vendor_profile_id IN (SELECT public.current_vendor_profile_ids()))
  WITH CHECK (recipient_vendor_profile_id IN (SELECT public.current_vendor_profile_ids()));

COMMENT ON TABLE public.event_stage_notes IS
  'A note from the event side (couple / coordinator) to ONE named supplier — '
  'built for the coordinator → emcee channel. Addressed rather than broadcast '
  'so the recipient reads exactly these rows and gains no other access to the '
  'event: granting the emcee event-member access was rejected because members '
  'can read the couple''s private schedule notes. Added 2026-08-05.';
