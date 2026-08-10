-- papic_story_challenges
--
-- Adds STORY challenges to the Papic challenge library — questions that ask a
-- guest to SAY something about the couple, not to go photograph something.
-- Owner 2026-08-10, verbatim: "we just want to add those new challenges" +
-- "We want a 10 second story." The four questions below are the owner's own
-- wording, unedited apart from the side token and the time.
--
-- All 40 shipped challenges are ERRANDS ("catch the kiss", "get the cake before
-- it's gone"). Not one asks how you met them, or what you would tell them.
--
-- ⚠ ANSWERED IN TEN SECONDS, AND THE PROMPT SAYS SO. A challenge is completed
-- by the guest's NEXT capture (SELECT → COMMENCE → RETAKE), and a Papic clip is
-- hard-capped at 10 000 ms — an OWNER LOCK (2026-07-22 · §0) mirrored in the
-- client, the route and the RPC. There is no text-answer completion path and
-- this migration does not invent one. Every prompt therefore names the ten
-- seconds out loud; that is not decoration, it is what stops a guest starting a
-- two-minute answer the recorder will cut off while telling them they
-- succeeded. Do not add a story prompt here that needs longer.
--
-- 🚨 WHY THE RANK WIDENING IS LOAD-BEARING, NOT TIDYING.
-- Adding library rows ALONE would have been INVISIBLE. The board is 20 slots;
-- the Setnayan lane backfills `ORDER BY priority_rank NULLS LAST, library_id`
-- over 40 existing rows, so a new row with a NULL rank sorts dead last and can
-- never be reached. And NOTHING ELSE SURFACES THE LIBRARY: no application code
-- reads papic_challenge_library at all (only ensure_papic_board does, inside
-- the database), and the couple's manager screen lets them AUTHOR free text and
-- hide/show what is already on their board — it has no library picker. A row
-- added without a rank is a row no human can ever reach: the same shape as the
-- face-mode column that had zero writers for seven weeks.
-- So the rank range widens 1..10 → 1..20 and the four stories take 11..14,
-- landing directly after the §9.4 Top-10 heroes.
--
-- WHAT THIS COSTS, STATED PLAINLY: the board is 20 slots and it was already
-- full. On an event with no couple picks and no booked vendors the Setnayan
-- lane fills all 20, so four guaranteed stories DISPLACE the four lowest-
-- ordered unranked errands. The board becomes 10 heroes + 4 stories + 6
-- errands. Nothing is deleted — the displaced rows stay active and return the
-- moment a couple pick or a vendor mission takes a slot. Reordering is an
-- UPDATE of these four ranks; no machinery changes.
--
-- KEEP THIS MIGRATION IDEMPOTENT (it may be re-applied).

BEGIN;

-- ── 1) Widen the two ranges the new rows need ───────────────────────────────
-- Constraint names read from PROD (pg_constraint), not guessed: a DROP ... IF
-- EXISTS on a wrong name is a silent no-op, the old 1..40 CHECK survives, and
-- the INSERT below fails. Verified 2026-08-10:
--   papic_challenge_library_library_id_check    CHECK (library_id >= 1 AND <= 40)
--   papic_challenge_library_priority_rank_check CHECK (priority_rank >= 1 AND <= 10)
--
-- library_id 1..40 → 1..99. The 40 was the size of the seed, not a rule. Ids of
-- shipped rows stay put — never renumber one: papic_missions.library_id points
-- at them and a couple's veto tombstone is keyed on it.
ALTER TABLE public.papic_challenge_library
  DROP CONSTRAINT IF EXISTS papic_challenge_library_library_id_check;
ALTER TABLE public.papic_challenge_library
  ADD CONSTRAINT papic_challenge_library_library_id_check
  CHECK (library_id BETWEEN 1 AND 99);

-- priority_rank 1..10 → 1..20. STILL UNIQUE — a rank is a board position, and
-- two rows claiming one turns a "guaranteed" slot into a coin flip.
ALTER TABLE public.papic_challenge_library
  DROP CONSTRAINT IF EXISTS papic_challenge_library_priority_rank_check;
ALTER TABLE public.papic_challenge_library
  ADD CONSTRAINT papic_challenge_library_priority_rank_check
  CHECK (priority_rank BETWEEN 1 AND 20);

COMMENT ON COLUMN public.papic_challenge_library.priority_rank IS
  'Guaranteed board position in the Setnayan lane (backfill is ORDER BY priority_rank NULLS LAST, library_id). 1..10 = the §9.4 Top-10 Must-Capture heroes (⚠ PROVISIONAL). 11..20 = guaranteed rows below them (2026-08-10: the four story challenges). NULL = NOT guaranteed, and on a 20-slot board that in practice means never shown.';

-- ── 2) The four story challenges ───────────────────────────────────────────
-- capture_kind 'clip' — the guest answers to camera and the 10s cap ends the
-- take. mission_type 'prompt' (an existing value; no constraint change).
-- category 'stories' is new and free-text by design: nothing in the app reads
-- the category column, so a new value groups them without a code change.
--
-- {who} is the SIDE TOKEN — see § 3. It is substituted per GUEST at read time,
-- never here: the board is materialized once per EVENT, so a prompt baked at
-- materialization would freeze one side's wording for everybody.
INSERT INTO public.papic_challenge_library
  (library_id, slug, category, title, prompt, capture_kind, mission_type, priority_rank)
VALUES
  (41, 'story-most-memorable', 'stories', 'Most Memorable',
   'Share a story about your most memorable experience with {who}. Ten seconds.',
   'clip', 'prompt', 11),
  (42, 'story-first-met',      'stories', 'The First Time',
   'Share a story about the first time you met {who}. Ten seconds.',
   'clip', 'prompt', 12),
  (43, 'story-crucial-part',   'stories', 'When It Mattered',
   'Share a story of an experience where {who} played a crucial part in your life. Ten seconds.',
   'clip', 'prompt', 13),
  (44, 'story-always-remember','stories', 'Always Remember',
   'Share a story of how you will always remember {who}. Ten seconds.',
   'clip', 'prompt', 14)
ON CONFLICT (slug) DO NOTHING;

-- ── 3) The prompt now adjusts to the guest's side ──────────────────────────
-- Owner 2026-08-10: "Or dedicate it to whether they are team groom/bride/both.
-- so it adjusts."
--
-- guests.side is a NOT NULL enum ('bride','groom','both'), so every guest
-- already has one and there is nothing to author and nothing to backfill.
-- A bride-side guest is asked about THE BRIDE, a groom-side guest about THE
-- GROOM, and a both-side guest about THE COUPLE.
--
-- 🔑 SUBSTITUTION BELONGS IN THE PER-GUEST READER, NOWHERE ELSE. The board
-- (papic_missions) is per EVENT — one row serves every guest — so replacing the
-- token at materialization would show one side's wording to the whole wedding.
-- This reader is the only place that knows WHICH guest is asking.
--
-- ⚠ target_role is NOT this. It carries a guest_role (entourage role) and the
-- reader already filters on it fail-closed; side has never been consulted by
-- any mission path. This adds wording, NOT a new visibility rule — every guest
-- still sees every board challenge, worded for their side.
--
-- CREATE OR REPLACE is correct here ONLY because the signature is byte-identical
-- to the live v4 (read from prod via pg_get_functiondef, 2026-08-10). Widening
-- the RETURNS TABLE would require DROP + CREATE + re-GRANT; this does not widen
-- it. The v3 fail-closed target_role guard and the v4 fail-soft no-board branch
-- are carried forward UNCHANGED — re-read them below before editing.
CREATE OR REPLACE FUNCTION public.papic_guest_missions(p_guest_id UUID)
RETURNS TABLE (
  mission_id      UUID,
  mission_type    TEXT,
  prompt          TEXT,
  vendor_id       UUID,
  vendor_name     TEXT,
  target_guest_id UUID,
  target_role     public.guest_role,
  completed       BOOLEAN,
  consent_shared  BOOLEAN,
  source          TEXT,
  capture_kind    TEXT,
  library_id      SMALLINT,
  board_slot      SMALLINT
)
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
DECLARE
  v_event_id   UUID;
  v_guest_role public.guest_role;
  v_guest_side public.guest_side;
  v_who        TEXT;
  v_has_board  BOOLEAN;
BEGIN
  SELECT g.event_id, g.role, g.side
    INTO v_event_id, v_guest_role, v_guest_side
  FROM public.guests g
  WHERE g.guest_id = p_guest_id AND g.deleted_at IS NULL;
  IF v_event_id IS NULL THEN
    RETURN;  -- unknown / deleted guest → empty set
  END IF;

  -- The side word. ELSE covers 'both' AND any enum value added later: an
  -- unknown side falls back to "the couple", which is the one phrasing that is
  -- never wrong for anybody. Fail toward the neutral truth, never toward a
  -- guess about whose guest this is.
  v_who := CASE v_guest_side
             WHEN 'bride' THEN 'the bride'
             WHEN 'groom' THEN 'the groom'
             ELSE 'the couple'
           END;

  -- Has a board been materialized for this event? If not, FAIL-SOFT to v3
  -- behaviour (show all active/approved missions by created_at) — the flag is
  -- LIVE in prod, so this reader must not blank today's missions.
  SELECT EXISTS (
    SELECT 1 FROM public.papic_missions m
    WHERE m.event_id = v_event_id AND m.board_slot IS NOT NULL
  ) INTO v_has_board;

  RETURN QUERY
  SELECT m.mission_id, m.mission_type,
         -- The ONLY change from v4. A prompt without the token is returned
         -- byte-identical, so all 40 shipped challenges and every couple- or
         -- vendor-authored prompt are completely unaffected.
         replace(m.prompt, '{who}', v_who) AS prompt,
         m.vendor_id, ev.vendor_name,
         m.target_guest_id, m.target_role,
         (c.completion_id IS NOT NULL) AS completed,
         COALESCE(c.consent_to_share, false) AS consent_shared,
         m.source, m.capture_kind, m.library_id, m.board_slot
  FROM public.papic_missions m
  LEFT JOIN public.event_vendors ev ON ev.vendor_id = m.vendor_id
  LEFT JOIN public.papic_mission_completions c
    ON c.mission_id = m.mission_id AND c.guest_id = p_guest_id
  WHERE m.event_id = v_event_id
    AND m.is_active
    AND m.approved
    -- targeted (roster) missions show only to the targeted guest; general missions show to all.
    AND (m.target_guest_id IS NULL OR m.target_guest_id = p_guest_id)
    -- role-scoped missions show only to a guest of that role (fail-CLOSED — v3 guard carried forward).
    AND (m.target_role IS NULL OR m.target_role = v_guest_role)
    AND (
      NOT v_has_board                 -- fail-soft: no board → show all (v3 behaviour)
      OR m.board_slot IS NOT NULL     -- on the board (the live ≤20)
      OR c.completion_id IS NOT NULL  -- completed-off-board → the "Done" archive (never un-finish a guest)
    )
  ORDER BY (c.completion_id IS NOT NULL), m.board_slot NULLS LAST, m.created_at;
END;
$$;

-- Signature unchanged → the existing grants survive a CREATE OR REPLACE. Re-
-- stated anyway so this migration is self-sufficient if replayed onto a fresh
-- database (the guest path is anon-reachable via the guest-session cookie).
REVOKE ALL ON FUNCTION public.papic_guest_missions(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.papic_guest_missions(UUID) TO authenticated, anon;

COMMENT ON FUNCTION public.papic_guest_missions(UUID) IS
  'Guest-facing Papic challenge board reader. v5 (2026-08-10) substitutes the {who} side token per guest from guests.side (bride/groom → "the bride"/"the groom", anything else → "the couple"). Carries forward the v3 fail-closed target_role guard and the v4 fail-soft no-board branch unchanged.';

COMMIT;
