-- emcee_questionnaire
-- Created via `pnpm migration:new`. Prefix auto-allocated to sort AFTER every
-- existing migration. KEEP THIS MIGRATION IDEMPOTENT (it may be re-applied).
-- ═══════════════════════════════════════════════════════════════════════════
-- THE EMCEE'S QUESTIONS — what only the couple can tell him, above all how to
-- SAY their names. (Register row DAY-7.)
--
-- Spec: corpus `Emcee_Script_System_BUILD_SPEC_2026-07-29.md` § 8 ("The
-- questionnaire — specified so it is not designed twice"). Owner, 2026-07-27:
-- "stays per wedding. but his questionaire can be saved as his template. to use
-- for succeeding customers."
--
-- ── WHY IT EXISTS ─────────────────────────────────────────────────────────
-- His hardest job is announcing ~30 principal sponsors by full name, and a
-- booked vendor CANNOT read `guests`. So he asks, and the names — spelled the
-- way they are said — arrive as something the couple deliberately typed. No new
-- personal-information surface: the roster stays closed to him.
--
-- ── THE SPLIT (third instance of a shipped house pattern) ─────────────────
--     vendor_songs       ↔ event_song_picks
--     vendor_activities  ↔ event_activity_picks
--     vendor_questions   ↔ event_question_answers      ← this migration
-- The QUESTION SET is his craft and travels with him; it has NO event_id, and
-- that absence is what stops a past couple's details riding to the next
-- wedding. The ANSWERS belong to one event and die with it.
--
-- ── WHO READS AN ANSWER ───────────────────────────────────────────────────
--   • the couple (they wrote it) — `current_couple_event_ids()`, NOT the
--     member-wide `current_event_ids()`: a guest must never read "what the
--     emcee must not say" (see couple-host-policy-scope.db.test.ts T1).
--   • the emcee who ASKED it, while booked on that event — both conditions,
--     so a booked caterer cannot read the host's answers, and a host whose
--     booking lapses stops reading them.
--   • NOT the coordinator. The owner allowed that only "if the coordinators
--     gets an approval to see it" (spec § 11 Q4); the approval does not exist
--     yet, so the lane is absent rather than guessed. Adding it later is one
--     policy; revoking a read already given is not.
-- ═══════════════════════════════════════════════════════════════════════════

BEGIN;

-- ── 1 · vendor_questions — his reusable question set ──────────────────────

CREATE TABLE IF NOT EXISTS public.vendor_questions (
  question_id       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_profile_id UUID NOT NULL
                    REFERENCES public.vendor_profiles(vendor_profile_id) ON DELETE CASCADE,
  -- What the couple reads and answers.
  prompt            TEXT NOT NULL CHECK (length(btrim(prompt)) BETWEEN 1 AND 200),
  -- Optional hint under the box ("e.g. Nyoy = NYO-ee").
  hint              TEXT CHECK (hint IS NULL OR length(btrim(hint)) <= 200),
  -- FALSE = kept (past couples' answers still resolve) but no longer asked.
  -- Retire, never delete — a delete would cascade a past couple's answer away.
  is_asked          BOOLEAN NOT NULL DEFAULT TRUE,
  display_order     INTEGER NOT NULL DEFAULT 0,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS vendor_questions_vendor_idx
  ON public.vendor_questions (vendor_profile_id, display_order);

ALTER TABLE public.vendor_questions ENABLE ROW LEVEL SECURITY;

-- Signed-in read, same reasoning as vendor_activities: the couple answering is
-- signed in, and a question ("How do you say your names?") holds nothing about
-- any couple. No anon lane — not a public surface.
DROP POLICY IF EXISTS vendor_questions_signed_in_select ON public.vendor_questions;
CREATE POLICY vendor_questions_signed_in_select
  ON public.vendor_questions FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS vendor_questions_owner_write ON public.vendor_questions;
CREATE POLICY vendor_questions_owner_write
  ON public.vendor_questions FOR ALL
  TO authenticated
  USING (
    vendor_profile_id IN (SELECT public.current_vendor_ids())
    OR public.is_admin()
  )
  WITH CHECK (
    vendor_profile_id IN (SELECT public.current_vendor_ids())
    OR public.is_admin()
  );

COMMENT ON TABLE public.vendor_questions IS
  'A host/MC''s reusable questions for the couple (pronunciations, honorifics, what not to say). Travels with the vendor; has no event_id by design. Answers live in event_question_answers. Spec: Emcee_Script_System_BUILD_SPEC § 8.';

-- ── 2 · event_question_answers — what THIS couple told him ────────────────

CREATE TABLE IF NOT EXISTS public.event_question_answers (
  event_id       UUID NOT NULL
                 REFERENCES public.events(event_id) ON DELETE CASCADE,
  question_id    UUID NOT NULL
                 REFERENCES public.vendor_questions(question_id) ON DELETE CASCADE,
  answer         TEXT NOT NULL CHECK (length(btrim(answer)) BETWEEN 1 AND 2000),
  -- An ACTOR stamp (who last typed it), so SET NULL on erasure — the answer is
  -- about the wedding and survives its typist's account.
  answered_by    UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (event_id, question_id)
);

CREATE INDEX IF NOT EXISTS event_question_answers_question_idx
  ON public.event_question_answers (question_id);

ALTER TABLE public.event_question_answers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS event_question_answers_host_select ON public.event_question_answers;
CREATE POLICY event_question_answers_host_select
  ON public.event_question_answers FOR SELECT
  TO authenticated
  USING (
    event_id IN (SELECT public.current_couple_event_ids())
    OR public.is_admin()
  );

DROP POLICY IF EXISTS event_question_answers_host_write ON public.event_question_answers;
CREATE POLICY event_question_answers_host_write
  ON public.event_question_answers FOR ALL
  TO authenticated
  USING (
    event_id IN (SELECT public.current_couple_event_ids())
  )
  WITH CHECK (
    event_id IN (SELECT public.current_couple_event_ids())
  );

-- The lane the song desk had to retrofit, built in from the start (spec § 8):
-- booked on the event AND the question is his own.
DROP POLICY IF EXISTS event_question_answers_booked_vendor_select ON public.event_question_answers;
CREATE POLICY event_question_answers_booked_vendor_select
  ON public.event_question_answers FOR SELECT
  TO authenticated
  USING (
    event_id IN (SELECT public.current_vendor_booked_event_ids())
    AND question_id IN (
      SELECT q.question_id
      FROM public.vendor_questions q
      WHERE q.vendor_profile_id IN (SELECT public.current_vendor_ids())
    )
  );

COMMENT ON TABLE public.event_question_answers IS
  'The couple''s answers to their host''s questions, per event. Read by the couple and by the asking vendor while booked; not by coordinators (approval not built, spec § 11 Q4). Dies with the event.';

-- ── 3 · Close the default-open grant (mandatory — see 368-table exposure) ──

REVOKE ALL ON public.vendor_questions FROM anon, authenticated;
REVOKE ALL ON public.event_question_answers FROM anon, authenticated;

-- No DELETE on the question set: retire, never delete (a delete would cascade
-- a past couple's answer away). The couple's answers keep DELETE — emptying a
-- box clears that answer.
GRANT SELECT, INSERT, UPDATE ON public.vendor_questions TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.event_question_answers TO authenticated;

COMMIT;
