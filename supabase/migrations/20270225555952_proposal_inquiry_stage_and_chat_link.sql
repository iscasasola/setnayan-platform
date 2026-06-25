-- In-chat vendor proposals — owner-authorized 2026-06-26 (unparks the
-- "BOOKED-clients-only" proposal lock so a vendor can send a priced proposal
-- during the inquiry chat, to win the booking, not only after it).
--
-- Two changes:
--   1. Relax vendor_proposals INSERT RLS: a vendor may create a (draft)
--      proposal for an event they are BOOKED on (unchanged) OR for which they
--      have an ACCEPTED chat thread (new — the inquiry-stage path). Everything
--      else (own-org gate, status='draft' freeze) is unchanged. The vendor
--      still can't read the couple's private guest data on a non-booked event;
--      the inquiry-stage proposal just carries fewer auto-filled tokens.
--   2. Add chat_messages.proposal_id so a sent proposal lands AS a card in the
--      conversation (the missing thread↔proposal link). Nullable + ON DELETE
--      SET NULL — ordinary messages keep proposal_id = NULL.

-- 1 · Relax the INSERT gate to also allow accepted-inquiry threads.
DROP POLICY IF EXISTS vendor_proposals_org_insert ON public.vendor_proposals;
CREATE POLICY vendor_proposals_org_insert
  ON public.vendor_proposals FOR INSERT TO authenticated
  WITH CHECK (
    vendor_profile_id IN (SELECT public.current_vendor_profile_ids())
    AND status = 'draft'
    AND (
      event_id IN (SELECT public.current_vendor_booked_event_ids())
      OR EXISTS (
        SELECT 1
        FROM public.chat_threads ct
        WHERE ct.event_id = vendor_proposals.event_id
          AND ct.vendor_profile_id = vendor_proposals.vendor_profile_id
          AND ct.inquiry_status = 'accepted'
      )
    )
  );

COMMENT ON TABLE public.vendor_proposals IS
  'Auto-filled vendor proposals (data-link program ③). Booked events OR accepted-inquiry threads (in-chat proposals, owner-authorized 2026-06-26); tokens resolve from already-authorized aggregates (richer when booked); snapshot frozen on send; accepting = signal, never an on-platform payment.';

-- 2 · Link a chat message to the proposal it announces (the in-thread card).
ALTER TABLE public.chat_messages
  ADD COLUMN IF NOT EXISTS proposal_id UUID
  REFERENCES public.vendor_proposals(proposal_id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS chat_messages_proposal_idx
  ON public.chat_messages(proposal_id)
  WHERE proposal_id IS NOT NULL;
