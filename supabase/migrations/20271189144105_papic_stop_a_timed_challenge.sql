-- Stopping a timed challenge, without taking it off anybody's board.
--
-- Prefix allocated by `pnpm migration:new`. Idempotent throughout.
--
-- ═══════════════════════════════════════════════════════════════════════════
-- THE GAP THIS CLOSES, AND WHY IT WAS A GAP RATHER THAN A MISSING BUTTON
-- ═══════════════════════════════════════════════════════════════════════════
-- Until now a timed challenge ended in exactly three ways: its own timer ran
-- out, somebody armed the next one, or somebody HID it. The first two are the
-- design. The third was the only way to say "we're done with that one now" —
-- and it is the wrong act wearing the right label.
--
-- 🔑 HIDING AND STOPPING ARE DIFFERENT THINGS AND THE DIFFERENCE IS THE GUEST'S
-- BOARD. `is_active = false` removes the challenge from every guest's board:
-- they can no longer answer it at all. Stopping should end the PROMPT — the
-- thing the room is being asked right now — and leave the challenge exactly
-- where it was, still answerable, like every other one they hold. Owner
-- 2026-09-01: "one challenge, but the other challenges may still be there";
-- an expired challenge is one of the others.
--
-- ⚠ SO THIS MIGRATION MUST NOT TOUCH `is_active`, AND A DB TEST ASSERTS THE
-- GUEST'S BOARD IS UNCHANGED ACROSS A STOP. Without that assertion the
-- cheapest implementation of "stop" is a one-line `is_active = false`, which
-- would pass any test that only checked the challenge stopped being live.
--
BEGIN;

-- ═══════════════════════════════════════════════════════════════════════════
-- 1 · ONE PLACE WRITES `closed_at`
-- ═══════════════════════════════════════════════════════════════════════════
-- Arming already closes whatever was open. Stopping closes whatever is open
-- and opens nothing. That is ONE act with two callers, and left as two inline
-- UPDATEs it becomes two — which is how the pair drift until one of them
-- forgets `updated_at`, or forgets that "open" means `armed_at IS NOT NULL AND
-- closed_at IS NULL` rather than just `closed_at IS NULL` (every never-armed
-- row on the event matches the second, so the sloppy version silently stamps a
-- close onto challenges that were never started).
--
-- Returns the mission it closed, or NULL if nothing was open — which is how
-- the caller tells "I stopped something" from "there was nothing to stop"
-- without asking a second question and racing with itself.
-- 🔴 `p_only_mission` IS A CORRECTNESS BOUNDARY, NOT A CONVENIENCE — and this
-- function shipped without it for about ten minutes, until a mutation test
-- showed the version it replaced was unsound.
--
-- Arming supersedes whatever is open, so it passes NULL and closes the event's
-- open arming, whatever that turns out to be. STOPPING must not: it may only
-- ever close the challenge the button was rendered for. Doing that with a
-- read-then-close — "is this the open one? then close the open one" — has a
-- window between the two statements, and under READ COMMITTED two coordinators
-- can walk straight through it: A reads the live challenge, B arms a different
-- one, A's close then matches B's BRAND-NEW challenge and kills it. Checking
-- afterwards that the wrong row was closed is not a fix; the row is already
-- closed. The predicate has to be IN the UPDATE.
CREATE OR REPLACE FUNCTION public.papic_close_open_challenge(
  p_event_id     UUID,
  p_at           TIMESTAMPTZ,
  p_only_mission UUID DEFAULT NULL
) RETURNS UUID
LANGUAGE plpgsql
VOLATILE
SET search_path = public
AS $$
DECLARE
  v_closed UUID;
BEGIN
  UPDATE public.papic_missions
     SET closed_at = p_at, updated_at = p_at
   WHERE event_id = p_event_id
     AND armed_at IS NOT NULL
     AND closed_at IS NULL
     AND (p_only_mission IS NULL OR mission_id = p_only_mission)
  RETURNING mission_id INTO v_closed;

  RETURN v_closed;
END;
$$;

COMMENT ON FUNCTION public.papic_close_open_challenge(UUID, TIMESTAMPTZ, UUID) IS
  'Closes the celebration''s currently-open arming and returns which mission '
  'that was, or NULL if none was open. The ONE place closed_at is written — '
  'papic_arm_challenge (close-then-open) and papic_stop_challenge (close only) '
  'both go through it, so the pair cannot drift. p_only_mission NARROWS the close '
  'to one challenge — NULL for arming (which supersedes whatever is open), the '
  'mission id for stopping (which must never close a challenge somebody else '
  'armed in the meantime; the predicate is in the UPDATE because a check after '
  'the fact cannot un-close a row). Never touches is_active: '
  'stopping a prompt is not hiding a challenge. ⚠ GRANTED TO authenticated '
  'BECAUSE IT HAS TO BE — its callers are SECURITY INVOKER, and a nested call '
  'still checks EXECUTE against the CALLER, so revoking this would break Stop '
  'outright. It grants nothing extra: SECURITY INVOKER means the UPDATE is '
  'filtered by papic_missions_member_all exactly as its callers are, so it can '
  'only close an arming on a celebration the caller may already write. What it '
  'skips is the STALE guard in papic_stop_challenge (which refuses to close a '
  'challenge somebody else armed after the button was rendered) — a correctness '
  'nicety, not a permission. Prefer papic_stop_challenge in product code.';

-- Callable by `authenticated` of necessity — see the COMMENT above. `anon`
-- keeps nothing: guests never run the room.
DROP FUNCTION IF EXISTS public.papic_close_open_challenge(UUID, TIMESTAMPTZ);
REVOKE ALL ON FUNCTION public.papic_close_open_challenge(UUID, TIMESTAMPTZ, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.papic_close_open_challenge(UUID, TIMESTAMPTZ, UUID) TO authenticated, service_role;

-- ═══════════════════════════════════════════════════════════════════════════
-- 2 · STOP
-- ═══════════════════════════════════════════════════════════════════════════
-- 🔑 SCOPED TO A MISSION, NOT JUST AN EVENT, AND THAT IS THE WHOLE SAFETY OF
-- IT. Two people run a reception. The coordinator opens the challenges screen
-- while "Catch the cake" is live; the host then starts "The money dance"; the
-- coordinator, looking at a page that is now thirty seconds stale, taps Stop.
-- An event-scoped stop would kill the host's brand-new challenge. This one
-- checks that the mission the button was rendered for is still the open one,
-- and otherwise does nothing and says so by returning NULL.
--
-- SECURITY INVOKER, like arming: authorisation is `papic_missions_member_all`
-- (Pattern B — the host and the coordinator, never a guest), and a caller who
-- cannot see the mission matches no rows.
CREATE OR REPLACE FUNCTION public.papic_stop_challenge(
  p_mission_id UUID
) RETURNS TIMESTAMPTZ
LANGUAGE plpgsql
VOLATILE
SET search_path = public
AS $$
DECLARE
  v_event_id UUID;
  v_now      TIMESTAMPTZ := NOW();
  v_hit      UUID;
BEGIN
  IF p_mission_id IS NULL THEN
    RETURN NULL;
  END IF;

  -- Which celebration is this, and may this caller see it at all? RLS answers
  -- both: a guest, or a stranger, gets no row and therefore NULL.
  SELECT m.event_id INTO v_event_id
    FROM public.papic_missions m
   WHERE m.mission_id = p_mission_id;
  IF v_event_id IS NULL THEN
    RETURN NULL;
  END IF;

  -- ⚠ THERE IS DELIBERATELY NO "is it armed? is it already closed?" PRE-CHECK.
  -- An earlier draft had one, and it was worse than redundant: the UPDATE below
  -- already carries both conditions, so the pre-check changed no outcome — but
  -- it RETURNED EARLY on every stale tap, which meant the scope argument on the
  -- next line was never exercised by any test. Mutating that argument to NULL
  -- left the whole suite green while re-introducing the race this function
  -- exists to prevent. A branch that hides a guard from its own tests is not an
  -- optimisation.
  --
  -- Scoped to THIS mission, so the close can only ever land on the challenge
  -- the caller named — never on one somebody else armed in the meantime.
  v_hit := public.papic_close_open_challenge(v_event_id, v_now, p_mission_id);

  IF v_hit IS NULL THEN
    -- Nothing was open under that id: never armed, already closed, or somebody
    -- moved on first. None of these is an error worth throwing at a person
    -- standing in a reception.
    RETURN NULL;
  END IF;

  RETURN v_now;
END;
$$;

COMMENT ON FUNCTION public.papic_stop_challenge(UUID) IS
  'End a timed challenge early — the prompt stops, the challenge stays. Returns '
  'the moment it stopped, or NULL when there was nothing to stop (not armed, '
  'already closed, not visible to this caller, or a newer challenge has since '
  'been armed by somebody else — a stale Stop must never kill a live prompt it '
  'was not rendered for). ⛔ Never touches is_active: the challenge remains on '
  'every guest''s board and remains answerable. Hiding it is the separate act, '
  'and the one that DOES take it away. SECURITY INVOKER: Pattern B decides who '
  'may — the host and the coordinator, never a guest.';

REVOKE ALL ON FUNCTION public.papic_stop_challenge(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.papic_stop_challenge(UUID) TO authenticated, service_role;

-- ═══════════════════════════════════════════════════════════════════════════
-- 3 · ARMING NOW GOES THROUGH THE SAME CLOSE
-- ═══════════════════════════════════════════════════════════════════════════
-- Body identical to 20271188710305 except that the inline close is replaced by
-- the shared call. Re-stated in full rather than patched because a function is
-- replaced whole; the close is the only line that differs.
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

  v_minutes := CASE WHEN p_duration_minutes IN (30, 60, 120)
                    THEN p_duration_minutes ELSE 30::SMALLINT END;

  SELECT m.event_id INTO v_event_id
    FROM public.papic_missions m
   WHERE m.mission_id = p_mission_id;
  IF v_event_id IS NULL THEN
    RETURN NULL;
  END IF;

  -- Close-then-open, in one transaction, through the one closer.
  -- NULL scope: arming supersedes whatever is open, by design.
  PERFORM public.papic_close_open_challenge(v_event_id, v_now, NULL);

  UPDATE public.papic_missions
     SET armed_at = v_now, closed_at = NULL,
         armed_duration_minutes = v_minutes, updated_at = v_now
   WHERE mission_id = p_mission_id
   RETURNING armed_at INTO v_armed;

  RETURN v_armed;
END;
$$;

REVOKE ALL ON FUNCTION public.papic_arm_challenge(UUID, SMALLINT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.papic_arm_challenge(UUID, SMALLINT) TO authenticated, service_role;

COMMIT;
