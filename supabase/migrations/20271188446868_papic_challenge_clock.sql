-- A Papic challenge gets a concept of time.
--
-- Build order item 4a (`WHATS_NEXT_Papic_Build_Order_2026-08-29.md` § 4).
-- Prefix allocated by `pnpm migration:new`. Idempotent: ADD COLUMN IF NOT
-- EXISTS / CREATE INDEX IF NOT EXISTS / CREATE OR REPLACE FUNCTION.
--
-- ═══════════════════════════════════════════════════════════════════════════
-- WHAT WAS MISSING, MEASURED 2026-08-31 AND AGAIN 2026-09-01
-- ═══════════════════════════════════════════════════════════════════════════
-- A challenge had NO concept of time anywhere: no window, no countdown, no
-- expiry. The 500-challenge library ships, the per-event board ships
-- (`ensure_papic_board` writes `board_slot`), the completion board ships
-- (`papic_mission_completions`, MATERIALIZE-ONCE / NEVER-DELETE) — and a
-- challenge, once on the board, stayed exactly as live at 3am as it was during
-- the first dance.
--
-- 🛑 `papic_challenge_expires_at` IS NOT THIS CLOCK AND NEVER WAS. It lives on
-- `vendor_profiles` (20271181420277) and is a SHOP'S 28-day SUBSCRIPTION
-- EXPIRY — whether a supplier may run a Papic Challenge at all. Reading that
-- column name without reading its table is how this item gets reported as
-- already done. It answers "may this shop sell one?"; this migration answers
-- "is this prompt the one being asked right now?".
--
-- ═══════════════════════════════════════════════════════════════════════════
-- THE RULING — owner, 2026-09-01 (DECISION_LOG.md)
-- ═══════════════════════════════════════════════════════════════════════════
-- The window is RELATIVE. It opens when the challenge is ARMED — never at a
-- wall-clock time somebody typed in advance. ONE challenge is live at a time
-- per celebration; arming the next CLOSES the previous; and the last one closes
-- when the capture window ends (`events.papic_window_end`, which already ships).
--
-- ⚠ NO DURATION COLUMN AND NO DEFAULT DURATION NUMBER. The design does not need
-- one, so none is invented — the 2026-08-31 `DEFAULT_CAPTURE_MIX` rule ("don't
-- guess") applies with full force to a number that would decide when a
-- celebration's prompt stops being asked. A per-challenge auto-close can be
-- added later without redoing any of this, because `armed_at` is already the
-- anchor such a thing would hang off.
--
-- 🔴 EXPIRY CLOSES THE PROMPT, NEVER THE SHUTTER. A guest is NEVER refused a
-- photo for lateness. Nothing on the capture path may consult this clock:
-- `papic_record_guest_capture`, `papic_record_seat_capture`,
-- `papic_complete_mission` and the presign probe are all untouched here, and
-- they must stay untouched. A closed challenge merely stops being THE armed
-- one — the shot is still taken, still counted, still theirs.
--
-- ═══════════════════════════════════════════════════════════════════════════
-- 🔑 TWO DIFFERENT THINGS ARE CALLED "ARMED" — DO NOT CONFLATE THEM
-- ═══════════════════════════════════════════════════════════════════════════
-- 1 · THE GUEST'S "Start" (`papic-challenge-panel.tsx`, SELECT → COMMENCE →
--     RETAKE, owner 2026-07-23). One guest, one phone, React `useState`,
--     never persisted anywhere. It means "the next shutter press on THIS
--     handset attaches to THIS mission". It has no clock and needs none.
-- 2 · THIS. The CELEBRATION's armed challenge — one per event, in the
--     database, what the room is being asked right now.
--
-- Measured before building: (2) did not exist in any form. `grep -rn armed
-- supabase/migrations/*.sql` returns only credit-pool language, and
-- `papic_challenge_pending` is a NOTIFICATION TYPE ("Papic Challenge to
-- approve"), not an arming mechanism. So the celebration-level act is created
-- here, and the guest-side one is deliberately left alone.
--
-- ═══════════════════════════════════════════════════════════════════════════
-- WHY COLUMNS ON `papic_missions` AND NOT A NEW TABLE
-- ═══════════════════════════════════════════════════════════════════════════
-- RULE 0.3 — a flag beats new schema. The clock belongs on the row that holds
-- the prompt, and putting it there buys the guarantee that matters most: a
-- PARTIAL UNIQUE INDEX on `event_id` makes "one live at a time per
-- celebration" something the DATABASE REFUSES TO BREAK, rather than a
-- convention every writer has to remember. A side table could hold two open
-- arms for one event and no constraint would notice.
--
-- RLS: none is added, and that is the correct answer rather than an omission.
-- `papic_missions` already carries Pattern B (per-event, `event_members`-scoped)
-- as `papic_missions_member_all`, declared FOR ALL with no column scoping, so
-- these columns are governed by it the moment they exist. The § 5 mapping row
-- for this table is unchanged.

BEGIN;

-- ═══════════════════════════════════════════════════════════════════════════
-- 1 · THE ANCHOR
-- ═══════════════════════════════════════════════════════════════════════════
ALTER TABLE public.papic_missions
  ADD COLUMN IF NOT EXISTS armed_at  TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS closed_at TIMESTAMPTZ;

COMMENT ON COLUMN public.papic_missions.armed_at IS
  'When this challenge was ARMED for the whole celebration (owner 2026-09-01) — the moment its relative window opened. NULL = never armed. NOT the guest-side "Start" in papic-challenge-panel.tsx, which is per-phone React state and is never persisted. NOT vendor_profiles.papic_challenge_expires_at, which is a shop subscription.';

COMMENT ON COLUMN public.papic_missions.closed_at IS
  'When a LATER arming superseded this one. NULL while this is the event''s open challenge. Only ever written by papic_arm_challenge(). A challenge can also be closed WITHOUT this column moving — the capture window passing, or the couple hiding it — which is why openness is decided by papic_challenge_is_open() and never by reading closed_at directly.';

-- closed_at is meaningless without an arming, and cannot precede it.
ALTER TABLE public.papic_missions
  DROP CONSTRAINT IF EXISTS papic_missions_close_follows_arm;
ALTER TABLE public.papic_missions
  ADD CONSTRAINT papic_missions_close_follows_arm
  CHECK (closed_at IS NULL OR (armed_at IS NOT NULL AND closed_at >= armed_at));

-- ═══════════════════════════════════════════════════════════════════════════
-- 2 · ONE AT A TIME, ENFORCED BY THE DATABASE
-- ═══════════════════════════════════════════════════════════════════════════
-- The owner's "one challenge live at a time per celebration" as a constraint
-- rather than a habit. Two sessions arming simultaneously is the case this is
-- for: without it, both succeed and the wall and the guest's phone can name
-- DIFFERENT challenges as the live one — precisely the drift item 3 spent six
-- sessions removing from the spend ceiling.
CREATE UNIQUE INDEX IF NOT EXISTS papic_missions_one_armed_per_event
  ON public.papic_missions (event_id)
  WHERE armed_at IS NOT NULL AND closed_at IS NULL;

COMMENT ON INDEX public.papic_missions_one_armed_per_event IS
  'One armed challenge per celebration (owner 2026-09-01). Partial: a closed arming keeps its armed_at as history and does not occupy the slot.';

-- ═══════════════════════════════════════════════════════════════════════════
-- 3 · THE RESOLVER — THE ONE PLACE THIS QUESTION IS ANSWERED
-- ═══════════════════════════════════════════════════════════════════════════
-- Modelled on `papic_guest_spend_ceiling()`: derived at READ time, never
-- stamped, and deliberately the SINGLE body that decides. Every input moves on
-- its own — the couple arms another challenge, the capture window is edited,
-- the couple hides a prompt — so a stored "is live" flag would be stale the
-- moment any of the three changed and would need a sweep nobody would write.
--
-- 🔴 FOUR WAYS A CHALLENGE IS NOT OPEN, AND THEY ARE NOT INTERCHANGEABLE:
--   a) it was never armed          — armed_at IS NULL
--   b) a later arming closed it    — closed_at has passed
--   c) the couple hid it           — is_active / approved went false. A prompt
--      no guest can see is not "live" by any honest reading, and leaving this
--      out would let the wall project a challenge that reaches nobody.
--   d) the celebration's capture window ended — the ruled backstop for the LAST
--      challenge, which nothing else will ever close.
--
-- ⚠ (d) FALLS BACK THE SAME WAY `papic_guest_spend_ceiling` DOES, and for the
-- same reason: `events.papic_window_end` is NULLABLE (NULL = legacy single-day,
-- anchored to event_date), so a NULL there is not "no end" — it is "the end of
-- the event day". The authoritative window lives in lib/papic-window.ts and
-- this does not try to reproduce it; it only needs the moment the day is over.
--
-- 🔒 SECURITY INVOKER, DELIBERATELY — every function in this migration is.
-- `papic_missions` carries Pattern B, so a caller who is not on the event sees
-- no row and gets FALSE. SECURITY DEFINER here would hand any signed-in account
-- another celebration's live prompt for the price of guessing an event id, and
-- would buy nothing: the wall reads server-side (service_role bypasses RLS) and
-- the couple's own screens read as members. Called from INSIDE a DEFINER RPC it
-- still runs with that RPC's privileges, so the guest-facing path composes.
--
-- ⚠ AND WHEN THERE IS NO DATE AT ALL, IT STAYS OPEN. A celebration with an
-- undecided date (events.event_date IS NULL — a real, shipped state) has no end
-- that could have passed. Closing on that would be inventing an expiry from an
-- absence, which is the failure this whole build order is about. An armed
-- challenge on a dateless event is closed by the next arming, like any other.
CREATE OR REPLACE FUNCTION public.papic_challenge_is_open(
  p_mission_id UUID
) RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SET search_path = public
AS $$
DECLARE
  v_armed      TIMESTAMPTZ;
  v_closed     TIMESTAMPTZ;
  v_active     BOOLEAN;
  v_approved   BOOLEAN;
  v_window_end TIMESTAMPTZ;
  v_event_date DATE;
  v_tz         TEXT;
  v_ends       TIMESTAMPTZ;
BEGIN
  IF p_mission_id IS NULL THEN
    RETURN FALSE;
  END IF;

  SELECT m.armed_at, m.closed_at, m.is_active, m.approved,
         e.papic_window_end, e.event_date, e.timezone
    INTO v_armed, v_closed, v_active, v_approved,
         v_window_end, v_event_date, v_tz
    FROM public.papic_missions m
    JOIN public.events e ON e.event_id = m.event_id
   WHERE m.mission_id = p_mission_id;

  -- (a) no such challenge, or it has never been armed.
  IF NOT FOUND OR v_armed IS NULL THEN
    RETURN FALSE;
  END IF;

  -- (b) a later arming closed it.
  IF v_closed IS NOT NULL AND v_closed <= NOW() THEN
    RETURN FALSE;
  END IF;

  -- (c) it reaches no guest.
  IF NOT (COALESCE(v_active, FALSE) AND COALESCE(v_approved, FALSE)) THEN
    RETURN FALSE;
  END IF;

  -- (d) the celebration's capture window has ended.
  v_ends := COALESCE(
    v_window_end,
    CASE WHEN v_event_date IS NOT NULL
      THEN ((v_event_date + 1)::timestamp AT TIME ZONE COALESCE(v_tz, 'Asia/Manila'))
    END
  );
  IF v_ends IS NOT NULL AND NOW() >= v_ends THEN
    RETURN FALSE;
  END IF;

  RETURN TRUE;
END;
$$;

COMMENT ON FUNCTION public.papic_challenge_is_open(UUID) IS
  'Is this Papic challenge the one being asked RIGHT NOW? The ONE place that '
  'question is decided (owner ruling 2026-09-01). FALSE in four distinct ways: '
  'never armed; closed by a later arming; hidden from guests (is_active / '
  'approved); or the celebration''s capture window has ended '
  '(events.papic_window_end, falling back to the end of the event day). '
  'Derived at read time, never stamped. 🔴 CLOSES THE PROMPT, NEVER THE '
  'SHUTTER — no capture path may call this; a guest is never refused a photo '
  'for lateness.';

-- The event-shaped question, defined IN TERMS OF the rule above so the two can
-- never disagree. `armed_at IS NOT NULL` here is candidate SELECTION (it uses
-- the partial index and states a fact, not the rule); every part of the DECISION
-- stays in papic_challenge_is_open. Restating "AND closed_at IS NULL" here is
-- exactly the copy that would drift.
CREATE OR REPLACE FUNCTION public.papic_armed_challenge(
  p_event_id UUID
) RETURNS TABLE (
  mission_id  UUID,
  prompt      TEXT,
  armed_at    TIMESTAMPTZ,
  source      TEXT,
  capture_kind TEXT,
  board_slot  SMALLINT
)
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT m.mission_id, m.prompt, m.armed_at, m.source, m.capture_kind, m.board_slot
    FROM public.papic_missions m
   WHERE m.event_id = p_event_id
     AND m.armed_at IS NOT NULL
     AND public.papic_challenge_is_open(m.mission_id)
   ORDER BY m.armed_at DESC
   LIMIT 1;
$$;

COMMENT ON FUNCTION public.papic_armed_challenge(UUID) IS
  'The celebration''s currently-armed challenge, or no rows. Openness is '
  'delegated wholesale to papic_challenge_is_open() — this function selects '
  'candidates and sorts them, and decides nothing. Returns the prompt UNRESOLVED '
  '({who}/{host}/{hosts}/{event} tokens intact): per-guest resolution belongs to '
  'papic_guest_missions, and every other screen resolves with '
  'displayChallengePrompt().';

-- ═══════════════════════════════════════════════════════════════════════════
-- 4 · THE WRITE — arming, which is also the only way to close
-- ═══════════════════════════════════════════════════════════════════════════
-- SECURITY INVOKER on purpose. `papic_missions_member_all` (Pattern B) already
-- says who may write this event's missions; running as the caller means this
-- adds no new authorisation surface at all and a stranger's UPDATE simply
-- matches no rows.
--
-- 🔑 CLOSE-THEN-OPEN, IN ONE TRANSACTION, IN ONE FUNCTION. The two statements
-- are the halves of a single act: doing them in the other order trips the
-- partial unique index, and doing them from two call sites is how an event ends
-- up with none armed (or, without the index, two). Re-arming the SAME challenge
-- is deliberately allowed and re-anchors it — the first UPDATE closes it and
-- the second re-opens it with a fresh armed_at, which is what "start this one
-- again" means.
--
-- NOTE there is no separate disarm, because none was ruled and none is needed:
-- hiding a challenge (is_active = false, the eye control the couple already
-- has) closes it through the resolver, and the capture window closes the last
-- one by itself.
CREATE OR REPLACE FUNCTION public.papic_arm_challenge(
  p_mission_id UUID
) RETURNS TIMESTAMPTZ
LANGUAGE plpgsql
VOLATILE
SET search_path = public
AS $$
DECLARE
  v_event_id UUID;
  v_now      TIMESTAMPTZ := NOW();
  v_armed    TIMESTAMPTZ;
BEGIN
  IF p_mission_id IS NULL THEN
    RETURN NULL;
  END IF;

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
     SET armed_at = v_now, closed_at = NULL, updated_at = v_now
   WHERE mission_id = p_mission_id
   RETURNING armed_at INTO v_armed;

  RETURN v_armed;
END;
$$;

COMMENT ON FUNCTION public.papic_arm_challenge(UUID) IS
  'Arm one challenge for the whole celebration, closing whichever was armed '
  'before it — the two halves of one act, in one transaction (owner 2026-09-01). '
  'Returns the new armed_at, or NULL if the caller cannot see the mission. '
  'SECURITY INVOKER: authorisation is papic_missions_member_all (Pattern B) and '
  'nothing else. Re-arming the same challenge re-anchors its window.';

-- ═══════════════════════════════════════════════════════════════════════════
-- 5 · GRANTS — the anon surface does NOT grow
-- ═══════════════════════════════════════════════════════════════════════════
-- Postgres grants EXECUTE to PUBLIC by default, so silence here would quietly
-- widen the guest-facing surface `anon-rpc-surface.db.test.ts` exists to police.
-- Guests reach their challenges through papic_guest_missions (already
-- anon-granted); nothing here needs a second door.
REVOKE ALL ON FUNCTION public.papic_challenge_is_open(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.papic_challenge_is_open(UUID) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.papic_armed_challenge(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.papic_armed_challenge(UUID) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.papic_arm_challenge(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.papic_arm_challenge(UUID) TO authenticated, service_role;

COMMIT;
