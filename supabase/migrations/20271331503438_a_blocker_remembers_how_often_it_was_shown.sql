-- a_blocker_remembers_how_often_it_was_shown
-- Created via `pnpm migration:new`. KEEP THIS MIGRATION IDEMPOTENT.
-- ════════════════════════════════════════════════════════════════════════════
-- SUPPLIER BUILD 3 · LANE B — owner 2026-11-09 (00-BUILD-3-PLAN ⏳ line;
-- FINAL RULINGS fe5de540 "Blockers"):
--   ⚖ "Return to chat in N" holds 5 s on the first show, 30 s on the second,
--     60 s on the third and every time after — "counted per unanswered
--     blocker" and "stored server side, so a reload or a second device does
--     not reset it". Action buttons are never held (app side).
--
-- One row per PERSON per blocker: the host and the supplier each meet their
-- own blockers, and one person's count must not shorten another's hold.
-- A blocker is (thread, kind, subject_key) — the six kinds of the ruling; the
-- subject is the thing it is about (the booking, the fee, the change, the
-- quote …) as text, because not every subject is keyed by a uuid.
--
-- Written ONLY by chat_blocker_shown(), which counts one more show and returns
-- the new count; the app maps 1 → 5 s, 2 → 30 s, ≥ 3 → 60 s. A person may
-- read their own counts; nobody writes them directly (so a count cannot be
-- reset from the browser to skip the hold).
-- ════════════════════════════════════════════════════════════════════════════

BEGIN;

CREATE TABLE IF NOT EXISTS public.chat_blocker_shows (
  user_id        UUID NOT NULL REFERENCES public.users(user_id) ON DELETE CASCADE,
  thread_id      UUID NOT NULL REFERENCES public.chat_threads(thread_id) ON DELETE CASCADE,
  blocker_kind   TEXT NOT NULL,
  subject_key    TEXT NOT NULL,
  shown_count    INTEGER NOT NULL DEFAULT 0,
  first_shown_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_shown_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, thread_id, blocker_kind, subject_key),
  CONSTRAINT chat_blocker_shows_kind_check CHECK (blocker_kind IN (
    'booking_ask',          -- a host's request to book, unanswered
    'booking_fee_overdue',  -- the booking fee is overdue
    'coordinator_agree',    -- the coordinator's Agree at proof
    'change_approval',      -- a change awaiting approval within 7 days
    'call_time_unset',      -- no call time within 7 days
    'quote_expired'         -- an unaccepted quotation past Valid until (supplier side)
  )),
  CONSTRAINT chat_blocker_shows_subject_is_short CHECK (char_length(subject_key) BETWEEN 1 AND 100),
  CONSTRAINT chat_blocker_shows_count_check CHECK (shown_count >= 0)
);

CREATE INDEX IF NOT EXISTS chat_blocker_shows_thread_idx
  ON public.chat_blocker_shows (thread_id);

ALTER TABLE public.chat_blocker_shows ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.chat_blocker_shows FROM anon;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.chat_blocker_shows FROM authenticated;
GRANT SELECT ON public.chat_blocker_shows TO authenticated;

DROP POLICY IF EXISTS chat_blocker_shows_own_read ON public.chat_blocker_shows;
CREATE POLICY chat_blocker_shows_own_read
  ON public.chat_blocker_shows FOR SELECT
  TO authenticated
  USING (user_id = (SELECT auth.uid()) OR (SELECT public.is_admin()));

COMMENT ON TABLE public.chat_blocker_shows IS
  'How many times ONE person has been shown ONE unanswered chat blocker (owner 2026-11-09): the "Return to chat in N" hold is 5 s / 30 s / 60 s by this count, kept server side so a reload or another device does not reset it. Written only by chat_blocker_shown(). Migration 20271331503438.';

-- Count one more show; returns the new count (1 = the first show).
-- NULL = the caller is not in this conversation (or not signed in, or the
-- kind/subject is not one) — the app then holds for the longest time rather
-- than the shortest.
CREATE OR REPLACE FUNCTION public.chat_blocker_shown(
  p_thread_id UUID, p_kind TEXT, p_subject_key TEXT)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid   UUID := auth.uid();
  v_shop  UUID;
  v_count INTEGER;
BEGIN
  IF v_uid IS NULL OR p_subject_key IS NULL
     OR char_length(p_subject_key) NOT BETWEEN 1 AND 100
     OR p_kind NOT IN ('booking_ask', 'booking_fee_overdue', 'coordinator_agree',
                       'change_approval', 'call_time_unset', 'quote_expired') THEN
    RETURN NULL;
  END IF;
  SELECT t.vendor_profile_id INTO v_shop FROM public.chat_threads t WHERE t.thread_id = p_thread_id;
  IF v_shop IS NULL THEN
    RETURN NULL;
  END IF;
  -- In the conversation: a host member or coordinator, or the shop's team.
  IF NOT (p_thread_id IN (SELECT public.current_thread_ids())
          OR v_shop IN (SELECT public.current_vendor_profile_ids())
          OR v_shop IN (SELECT public.current_vendor_ids())) THEN
    RETURN NULL;
  END IF;

  INSERT INTO public.chat_blocker_shows AS s
         (user_id, thread_id, blocker_kind, subject_key, shown_count)
  VALUES (v_uid, p_thread_id, p_kind, p_subject_key, 1)
  ON CONFLICT (user_id, thread_id, blocker_kind, subject_key)
  DO UPDATE SET shown_count = s.shown_count + 1, last_shown_at = NOW()
  RETURNING s.shown_count INTO v_count;
  RETURN v_count;
END;
$$;
REVOKE ALL ON FUNCTION public.chat_blocker_shown(UUID, TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.chat_blocker_shown(UUID, TEXT, TEXT) TO authenticated;

COMMENT ON FUNCTION public.chat_blocker_shown(UUID, TEXT, TEXT) IS
  'One more show of one blocker to the caller; returns the new count (1, 2, 3 …) for the 5 s / 30 s / 60 s hold, or NULL when the caller is not in this conversation. Migration 20271331503438.';

COMMIT;
