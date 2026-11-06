-- questions_every_supplier
-- Created via `pnpm migration:new`. Prefix auto-allocated to sort AFTER every
-- existing migration. KEEP THIS MIGRATION IDEMPOTENT (it may be re-applied).
-- ═══════════════════════════════════════════════════════════════════════════
-- QUESTIONS FOR THE COUPLE — EVERY SUPPLIER, NOT HOSTS ONLY
-- (owner 2026-11-04, verbatim "Yes, every supplier"; DECISION_LOG row of the
-- same name.)
--
-- 20271233982952_emcee_questionnaire built the split for the host/MC:
--     vendor_questions        — the supplier's set, no event_id, travels with them
--     event_question_answers  — what one couple told them, dies with the event
-- Nothing in that schema was host-only — the gate lived in the app
-- (`findBookedHost`, the `host_mc` tile). This migration adds the ONE thing a
-- non-host needs that the schema lacked: a record that they ASKED this event,
-- from the chat's ＋ ("Questions for the couple · Your question set · they
-- answer in their event"). The ＋ row opens once the couple books them
-- (DECISION_LOG: sent "into a booked event").
--
-- ── event_question_requests — "this supplier asked this event" ────────────
-- One row per (event, supplier). It carries NO question text and NO answer:
-- the set stays in vendor_questions (still no event_id), the answers stay in
-- event_question_answers. It only records that the supplier sent their set into
-- this event, and when — which is what puts that supplier's questions in front
-- of the couple in their event, and lets that supplier read the answers the
-- couple deliberately typed for them, whatever the booking's later standing.
--
-- WHO MAY SEND: the supplier, only into an event they already have a
-- conversation with (`chat_threads`, UNIQUE (event_id, vendor_profile_id)). No
-- thread, no ask — a supplier cannot drop questions into a stranger's event.
--
-- ── the second answer-read lane ───────────────────────────────────────────
-- `event_question_answers_booked_vendor_select` (booked AND own question) is
-- kept unchanged. `event_question_answers_asked_vendor_select` adds: ASKED this
-- event AND own question. Both halves again — a supplier who asked reads the
-- answers to THEIR questions only, never another supplier's (the host's "what
-- I must not say" stays the host's).
--
-- Still no coordinator lane (spec § 11 Q4 approval not built).
-- ═══════════════════════════════════════════════════════════════════════════

BEGIN;

CREATE TABLE IF NOT EXISTS public.event_question_requests (
  event_id          UUID NOT NULL
                    REFERENCES public.events(event_id) ON DELETE CASCADE,
  vendor_profile_id UUID NOT NULL
                    REFERENCES public.vendor_profiles(vendor_profile_id) ON DELETE CASCADE,
  -- The conversation it was sent from. SET NULL: the ask outlives a thread
  -- that is later removed — the couple may already have answered.
  thread_id         UUID
                    REFERENCES public.chat_threads(thread_id) ON DELETE SET NULL,
  -- First send, and the latest re-send ("Send again" moves sent_at only).
  first_sent_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  sent_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (event_id, vendor_profile_id)
);

CREATE INDEX IF NOT EXISTS event_question_requests_vendor_idx
  ON public.event_question_requests (vendor_profile_id);

ALTER TABLE public.event_question_requests ENABLE ROW LEVEL SECURITY;

-- The supplier reads their own asks; the couple reads who asked them.
DROP POLICY IF EXISTS event_question_requests_select ON public.event_question_requests;
CREATE POLICY event_question_requests_select
  ON public.event_question_requests FOR SELECT
  TO authenticated
  USING (
    vendor_profile_id IN (SELECT public.current_vendor_ids())
    OR event_id IN (SELECT public.current_couple_event_ids())
    OR (SELECT public.is_admin())
  );

-- The supplier sends — only their own row, only into an event they talk to.
DROP POLICY IF EXISTS event_question_requests_vendor_insert ON public.event_question_requests;
CREATE POLICY event_question_requests_vendor_insert
  ON public.event_question_requests FOR INSERT
  TO authenticated
  WITH CHECK (
    vendor_profile_id IN (SELECT public.current_vendor_ids())
    AND EXISTS (
      SELECT 1 FROM public.chat_threads t
      WHERE t.event_id = event_question_requests.event_id
        AND t.vendor_profile_id = event_question_requests.vendor_profile_id
    )
  );

-- "Send again" moves sent_at on their own row.
DROP POLICY IF EXISTS event_question_requests_vendor_update ON public.event_question_requests;
CREATE POLICY event_question_requests_vendor_update
  ON public.event_question_requests FOR UPDATE
  TO authenticated
  USING (vendor_profile_id IN (SELECT public.current_vendor_ids()))
  WITH CHECK (
    vendor_profile_id IN (SELECT public.current_vendor_ids())
    AND EXISTS (
      SELECT 1 FROM public.chat_threads t
      WHERE t.event_id = event_question_requests.event_id
        AND t.vendor_profile_id = event_question_requests.vendor_profile_id
    )
  );

COMMENT ON TABLE public.event_question_requests IS
  'A supplier sent their reusable question set (vendor_questions) into one event, from the chat ＋. No question text, no answer — only who asked and when. Lets that supplier be answered and read those answers (own questions only). Owner 2026-11-04 "Yes, every supplier".';

-- The second read lane on the answers: ASKED (not only booked) AND own question.
DROP POLICY IF EXISTS event_question_answers_asked_vendor_select ON public.event_question_answers;
CREATE POLICY event_question_answers_asked_vendor_select
  ON public.event_question_answers FOR SELECT
  TO authenticated
  USING (
    event_id IN (
      SELECT r.event_id
      FROM public.event_question_requests r
      WHERE r.vendor_profile_id IN (SELECT public.current_vendor_ids())
    )
    AND question_id IN (
      SELECT q.question_id
      FROM public.vendor_questions q
      WHERE q.vendor_profile_id IN (SELECT public.current_vendor_ids())
    )
  );

COMMENT ON TABLE public.event_question_answers IS
  'The couple''s answers to a supplier''s questions, per event. Read by the couple, and by the asking supplier — own questions only — while booked or after sending the set into this event (event_question_requests). Not by coordinators (approval not built, spec § 11 Q4). Dies with the event.';

COMMENT ON TABLE public.vendor_questions IS
  'A supplier''s reusable questions for the couple (every trade since 2026-11-04; the host/MC first). Travels with the supplier; has no event_id by design. Answers live in event_question_answers. Spec: Emcee_Script_System_BUILD_SPEC § 8.';

-- Close the default-open grant (mandatory — see 368-table exposure). No DELETE:
-- an ask is not withdrawn (the couple may already have answered).
-- Column-level writes: first_sent_at is the database's (its DEFAULT), never the caller's.
REVOKE ALL ON public.event_question_requests FROM anon, authenticated;
GRANT SELECT ON public.event_question_requests TO authenticated;
GRANT INSERT (event_id, vendor_profile_id, thread_id, sent_at) ON public.event_question_requests TO authenticated;
-- The key columns are in the UPDATE list only because an upsert's DO UPDATE SET re-states every column it was given
-- (PostgREST); the UPDATE policy still pins the row to the supplier's own, in an event they talk to.
GRANT UPDATE (event_id, vendor_profile_id, thread_id, sent_at) ON public.event_question_requests TO authenticated;

COMMIT;
