-- A timed challenge lasts 30 minutes, or an hour, or two — the couple picks.
--
-- Prefix allocated by `pnpm migration:new`. Idempotent throughout.
--
-- ═══════════════════════════════════════════════════════════════════════════
-- ⚠ THIS SUPERSEDES YESTERDAY'S "NO DURATION COLUMN" — DELIBERATELY, BY THE
--   OWNER, AND THE OLD RULE'S REASONING IS WHY THIS ONE IS SAFE
-- ═══════════════════════════════════════════════════════════════════════════
-- The 2026-09-01 ruling said: no duration column, and NO DEFAULT DURATION
-- NUMBER — "the design does not need one, so none is invented". It also said,
-- in the same breath, that a duration "may be added later WITHOUT REDOING THE
-- SCHEMA, since `armed_at` is already the anchor it would need." That is what
-- happens here, and nothing about the clock's shape changes.
--
-- 🔑 THE OLD RULE WAS NEVER "DURATIONS ARE WRONG". It was the `DEFAULT_CAPTURE_MIX`
-- rule — *don't guess a number that governs something*. The number was missing
-- because nobody had chosen it, and inventing one would have had an engineer
-- deciding how long a wedding's prompt hangs on the wall. It is not missing any
-- more: the owner chose it (2026-09-01, later the same day). 30 · 60 · 120,
-- defaulting to 30. A number with a source is the opposite of a guess.
--
-- ═══════════════════════════════════════════════════════════════════════════
-- 🔑 "ONE CHALLENGE, BUT THE OTHER CHALLENGES MAY STILL BE THERE"
-- ═══════════════════════════════════════════════════════════════════════════
-- Owner, 2026-09-01, and it is the sentence most likely to be mis-implemented
-- by whoever reads only the function names in this file.
--
-- ⛔ ARMING A CHALLENGE TAKES NOTHING AWAY FROM A GUEST. The board is what a
-- guest may do; the TIMED challenge is what the room is being asked *right
-- now*. A guest whose timed challenge has just expired still has every other
-- challenge on their board, exactly as before, and may still answer the expired
-- one — expiry closes the PROMPT, never the shutter, and never the board.
--
-- ⚠ SO `papic_challenge_is_open()` DOES NOT MEAN "MAY A GUEST DO THIS". It
-- means "is this the timed challenge currently running". Nothing that decides
-- what a guest is *given* may call it — that is `papic_guest_missions`, which
-- this migration does not touch and must not. A db test arms a challenge, runs
-- its clock out, and asserts the guest's board is BYTE-IDENTICAL throughout;
-- that test, not this comment, is what actually holds the line.

BEGIN;

-- ═══════════════════════════════════════════════════════════════════════════
-- 1 · HOW LONG THIS ARMING RUNS FOR
-- ═══════════════════════════════════════════════════════════════════════════
-- NOT NULL DEFAULT 30, so there is no third state to reason about: every
-- arming has a length, and a raw write that forgets one gets the owner's
-- default rather than a NULL that some reader would have to invent a meaning
-- for. The CHECK is the set the owner named — a fourth value is a decision, and
-- it should fail here rather than appear quietly on a wall.
ALTER TABLE public.papic_missions
  ADD COLUMN IF NOT EXISTS armed_duration_minutes SMALLINT NOT NULL DEFAULT 30;

ALTER TABLE public.papic_missions
  DROP CONSTRAINT IF EXISTS papic_missions_armed_duration_choices;
ALTER TABLE public.papic_missions
  ADD CONSTRAINT papic_missions_armed_duration_choices
  CHECK (armed_duration_minutes IN (30, 60, 120));

COMMENT ON COLUMN public.papic_missions.armed_duration_minutes IS
  'How long this challenge runs once ARMED — 30 (default), 60 or 120 minutes, the couple''s pick (owner 2026-09-01). Meaningful only while armed; on an un-armed row it is simply the length it WOULD run for. Not a countdown and not an end instant: the end is derived by papic_challenge_ends_at(), which also takes the next arming and the capture window into account.';

-- ═══════════════════════════════════════════════════════════════════════════
-- 2 · THE ONE PLACE AN END INSTANT IS COMPUTED
-- ═══════════════════════════════════════════════════════════════════════════
-- Split out of `papic_challenge_is_open` rather than added to it, because a
-- screen now needs the INSTANT (to count down to) as well as the VERDICT. Two
-- functions each doing their own LEAST() is precisely the drift this whole
-- build exists to prevent — so the verdict is defined in terms of the instant,
-- and the instant is computed exactly once, here.
--
-- 🔴 THREE THINGS CAN END A TIMED CHALLENGE, AND THE EARLIEST WINS:
--   1 · its own timer      — armed_at + the couple's 30/60/120
--   2 · the next arming    — closed_at, written by papic_arm_challenge
--   3 · the capture window — events.papic_window_end, the ruled backstop
--
-- ⚠ (3) STILL FALLS BACK TO THE END OF THE EVENT DAY. `papic_window_end` is
-- NULLABLE and NULL means "legacy single-day, anchored to event_date" — not
-- "no end". Unchanged from the original clock; restated because it is the term
-- most likely to be dropped by someone simplifying this function.
--
-- 🔑 AND NOW THERE IS ALWAYS AN END. Term (1) cannot be NULL, because the
-- duration cannot be. The old clock's "a celebration with no date keeps its
-- armed challenge open forever" case is gone — not by adding a guess, but
-- because the owner supplied the number that closes it.
CREATE OR REPLACE FUNCTION public.papic_challenge_ends_at(
  p_mission_id UUID
) RETURNS TIMESTAMPTZ
LANGUAGE plpgsql
STABLE
SET search_path = public
AS $$
DECLARE
  v_armed      TIMESTAMPTZ;
  v_closed     TIMESTAMPTZ;
  v_minutes    SMALLINT;
  v_window_end TIMESTAMPTZ;
  v_event_date DATE;
  v_tz         TEXT;
  v_ends       TIMESTAMPTZ;
BEGIN
  IF p_mission_id IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT m.armed_at, m.closed_at, m.armed_duration_minutes,
         e.papic_window_end, e.event_date, e.timezone
    INTO v_armed, v_closed, v_minutes,
         v_window_end, v_event_date, v_tz
    FROM public.papic_missions m
    JOIN public.events e ON e.event_id = m.event_id
   WHERE m.mission_id = p_mission_id;

  -- Never armed: no beginning, so no end. NULL is "this has no clock", which is
  -- a different fact from "its clock has run out" and callers must not confuse
  -- them — `papic_challenge_is_open` refuses an un-armed challenge on the
  -- armed_at test, before it ever asks this.
  IF NOT FOUND OR v_armed IS NULL THEN
    RETURN NULL;
  END IF;

  -- 1 · its own timer.
  v_ends := v_armed + make_interval(mins => COALESCE(v_minutes, 30)::int);

  -- 2 · superseded by the next arming.
  IF v_closed IS NOT NULL THEN
    v_ends := LEAST(v_ends, v_closed);
  END IF;

  -- 3 · the celebration's capture window (or the end of the event day).
  DECLARE
    v_window TIMESTAMPTZ := COALESCE(
      v_window_end,
      CASE WHEN v_event_date IS NOT NULL
        THEN ((v_event_date + 1)::timestamp AT TIME ZONE COALESCE(v_tz, 'Asia/Manila'))
      END
    );
  BEGIN
    IF v_window IS NOT NULL THEN
      v_ends := LEAST(v_ends, v_window);
    END IF;
  END;

  RETURN v_ends;
END;
$$;

COMMENT ON FUNCTION public.papic_challenge_ends_at(UUID) IS
  'When this timed challenge stops being the one being asked — the EARLIEST of '
  'its own timer (armed_at + armed_duration_minutes), the next arming '
  '(closed_at), and the celebration''s capture window (events.papic_window_end, '
  'falling back to the end of the event day). NULL means NEVER ARMED — no '
  'clock at all — which is NOT the same as "expired". The single place this '
  'instant is computed: papic_challenge_is_open() and papic_armed_challenge() '
  'both read it rather than each doing their own LEAST().';

-- ═══════════════════════════════════════════════════════════════════════════
-- 3 · THE VERDICT — now defined in terms of the instant
-- ═══════════════════════════════════════════════════════════════════════════
-- ⛔ READ THE HEADER BEFORE CALLING THIS. It answers "is this the TIMED
-- challenge currently running", NEVER "may a guest do this challenge". The
-- board is unaffected by arming and by expiry; what a guest is given is
-- `papic_guest_missions` and nothing here.
CREATE OR REPLACE FUNCTION public.papic_challenge_is_open(
  p_mission_id UUID
) RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SET search_path = public
AS $$
DECLARE
  v_armed    TIMESTAMPTZ;
  v_active   BOOLEAN;
  v_approved BOOLEAN;
  v_ends     TIMESTAMPTZ;
BEGIN
  IF p_mission_id IS NULL THEN
    RETURN FALSE;
  END IF;

  SELECT m.armed_at, m.is_active, m.approved
    INTO v_armed, v_active, v_approved
    FROM public.papic_missions m
   WHERE m.mission_id = p_mission_id;

  -- (a) no such challenge, or it has never been armed.
  IF NOT FOUND OR v_armed IS NULL THEN
    RETURN FALSE;
  END IF;

  -- (b) it reaches no guest at all — the couple hid it, or a vendor's copy is
  -- still awaiting approval. A prompt nobody can see is not the one being
  -- asked, whatever its clock says.
  IF NOT (COALESCE(v_active, FALSE) AND COALESCE(v_approved, FALSE)) THEN
    RETURN FALSE;
  END IF;

  -- (c) its clock has run out — by its own timer, by the next arming, or by the
  -- capture window. All three live in papic_challenge_ends_at; this function
  -- deliberately re-derives none of them.
  v_ends := public.papic_challenge_ends_at(p_mission_id);
  IF v_ends IS NOT NULL AND NOW() >= v_ends THEN
    RETURN FALSE;
  END IF;

  RETURN TRUE;
END;
$$;

COMMENT ON FUNCTION public.papic_challenge_is_open(UUID) IS
  'Is this the TIMED Papic challenge being asked RIGHT NOW? ⛔ NOT "may a guest '
  'do this challenge" — arming and expiry change nothing about a guest''s '
  'board (owner 2026-09-01: "one challenge, but the other challenges may still '
  'be there"); that is papic_guest_missions. FALSE in three ways: never armed; '
  'hidden from guests; or its clock has run out — the clock being '
  'papic_challenge_ends_at(), which this does not re-derive. 🔴 Closes the '
  'prompt, never the shutter: no capture path may call this.';

-- ═══════════════════════════════════════════════════════════════════════════
-- 4 · THE EVENT-SHAPED READ — now carries the instant a screen counts down to
-- ═══════════════════════════════════════════════════════════════════════════
-- `expires_at` is returned rather than a "minutes remaining" integer on
-- purpose: a number computed here is stale by the time it is painted, and a
-- countdown built from it would drift from the verdict. An instant is a fact.
--
-- 🔑 DROPPED FIRST, LIKE THE ARM FUNCTION BELOW — and for a different reason
-- worth writing down: `CREATE OR REPLACE` cannot widen the row type of a
-- set-returning function ("cannot change return type of existing function"),
-- so adding the two new output columns REQUIRES the drop. The grants at the
-- bottom of this file are re-asserted for exactly this reason: a dropped
-- function loses its privileges and comes back with Postgres' default
-- EXECUTE-to-PUBLIC.
DROP FUNCTION IF EXISTS public.papic_armed_challenge(UUID);

CREATE OR REPLACE FUNCTION public.papic_armed_challenge(
  p_event_id UUID
) RETURNS TABLE (
  mission_id       UUID,
  prompt           TEXT,
  armed_at         TIMESTAMPTZ,
  source           TEXT,
  capture_kind     TEXT,
  board_slot       SMALLINT,
  duration_minutes SMALLINT,
  expires_at       TIMESTAMPTZ
)
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT m.mission_id, m.prompt, m.armed_at, m.source, m.capture_kind,
         m.board_slot, m.armed_duration_minutes,
         public.papic_challenge_ends_at(m.mission_id)
    FROM public.papic_missions m
   WHERE m.event_id = p_event_id
     AND m.armed_at IS NOT NULL
     AND public.papic_challenge_is_open(m.mission_id)
   ORDER BY m.armed_at DESC
   LIMIT 1;
$$;

COMMENT ON FUNCTION public.papic_armed_challenge(UUID) IS
  'The celebration''s currently-armed TIMED challenge, or no rows — plus the '
  'instant it expires, so a screen can count down without owning the rule. '
  'Openness is delegated wholesale to papic_challenge_is_open() and the instant '
  'to papic_challenge_ends_at(); this decides nothing. Returns the prompt '
  'UNRESOLVED ({who}/{host}/{hosts}/{event} intact). ⛔ The OTHER challenges on '
  'the board are unaffected and stay available to guests.';

-- ═══════════════════════════════════════════════════════════════════════════
-- 5 · ARMING NOW CARRIES THE COUPLE'S PICK
-- ═══════════════════════════════════════════════════════════════════════════
-- 🔑 DROPPED AND RECREATED RATHER THAN OVERLOADED. `CREATE OR REPLACE` with an
-- extra parameter does not replace the one-argument function — it creates a
-- SECOND one beside it, and this codebase would then have two ways to arm a
-- challenge, one of which silently ignores the duration. The DEFAULT keeps
-- every existing one-argument call site working, including the server action
-- that names its arguments.
DROP FUNCTION IF EXISTS public.papic_arm_challenge(UUID);

CREATE OR REPLACE FUNCTION public.papic_arm_challenge(
  p_mission_id       UUID,
  p_duration_minutes SMALLINT DEFAULT 30
) RETURNS TIMESTAMPTZ
LANGUAGE plpgsql
VOLATILE
SET search_path = public
AS $$
DECLARE
  v_event_id UUID;
  v_now      TIMESTAMPTZ := NOW();
  v_minutes  SMALLINT;
  v_armed    TIMESTAMPTZ;
BEGIN
  IF p_mission_id IS NULL THEN
    RETURN NULL;
  END IF;

  -- An unrecognised length falls back to the owner's default rather than
  -- raising: a coordinator mid-reception should get 30 minutes, not an error
  -- page. A value that reaches the column anyway is still refused by the CHECK.
  v_minutes := CASE WHEN p_duration_minutes IN (30, 60, 120)
                    THEN p_duration_minutes ELSE 30::SMALLINT END;

  -- RLS applies to this read too: a caller who cannot see the mission gets
  -- NULL and changes nothing.
  SELECT m.event_id INTO v_event_id
    FROM public.papic_missions m
   WHERE m.mission_id = p_mission_id;
  IF v_event_id IS NULL THEN
    RETURN NULL;
  END IF;

  UPDATE public.papic_missions
     SET closed_at = v_now, updated_at = v_now
   WHERE event_id = v_event_id
     AND armed_at IS NOT NULL
     AND closed_at IS NULL;

  UPDATE public.papic_missions
     SET armed_at = v_now, closed_at = NULL,
         armed_duration_minutes = v_minutes, updated_at = v_now
   WHERE mission_id = p_mission_id
   RETURNING armed_at INTO v_armed;

  RETURN v_armed;
END;
$$;

COMMENT ON FUNCTION public.papic_arm_challenge(UUID, SMALLINT) IS
  'Arm one TIMED challenge for the whole celebration for 30 (default), 60 or '
  '120 minutes, closing whichever was armed before it — the two halves of one '
  'act, in one transaction (owner 2026-09-01). Returns the new armed_at, or '
  'NULL if the caller cannot see the mission. SECURITY INVOKER: authorisation '
  'is papic_missions_member_all (Pattern B) and nothing else. An unrecognised '
  'length falls back to 30 rather than raising. ⛔ Takes nothing off any '
  'guest''s board — the other challenges stay exactly as they were.';

-- ═══════════════════════════════════════════════════════════════════════════
-- 6 · GRANTS — the anon surface still does not grow
-- ═══════════════════════════════════════════════════════════════════════════
-- Re-asserted on every function, not only the new one: a CREATE OR REPLACE
-- re-applies Postgres' default EXECUTE-to-PUBLIC, and `anon-rpc-surface`
-- exists because exactly that silently re-opened seven functions once.
REVOKE ALL ON FUNCTION public.papic_challenge_ends_at(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.papic_challenge_ends_at(UUID) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.papic_challenge_is_open(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.papic_challenge_is_open(UUID) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.papic_armed_challenge(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.papic_armed_challenge(UUID) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.papic_arm_challenge(UUID, SMALLINT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.papic_arm_challenge(UUID, SMALLINT) TO authenticated, service_role;

COMMIT;
