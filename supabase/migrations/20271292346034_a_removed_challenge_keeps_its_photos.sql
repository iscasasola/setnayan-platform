-- A REMOVED CHALLENGE KEEPS ITS PHOTOS.
--
-- Prefix allocated by `pnpm migration:new`. Idempotent throughout.
--
-- ═══════════════════════════════════════════════════════════════════════════
-- THE OWNER'S ASK, 2026-10-26 (DECISION_LOG "PAPIC CHALLENGES: A LIVE SWITCH AND AN ✕")
-- ═══════════════════════════════════════════════════════════════════════════
-- Verbatim: *"challenges will have a toggle to make that challenge live and
-- happening on the app. but it also needs a (X) to remove that challenge. if the
-- challenge is removed and someone did the challenge, the photo and challenge is
-- saved but anything after, you do not have the challenge"*.
--
-- Until now the ✕ (`deleteCoupleChallengeAction`) was a hard DELETE, and
-- `papic_mission_completions.mission_id` is `ON DELETE CASCADE` — so removing a
-- challenge a guest had already answered threw away the link between the photo
-- and the question it answered. The photo survived (the capture is its own row);
-- its challenge tag did not.
--
-- ═══════════════════════════════════════════════════════════════════════════
-- WHY A TIMESTAMP BESIDE `is_active`, AND NOT A NEW STATE MACHINE (RULE 0.3)
-- ═══════════════════════════════════════════════════════════════════════════
-- `is_active = false` ALREADY means "no guest may see or answer this": the
-- guest board (`papic_guest_missions`), the completion (`papic_complete_mission`)
-- and arming (`papic_arm_challenge`) all filter `m.is_active`, and the Setnayan
-- fill treats an inactive row as a veto tombstone (`ensure_papic_board`). So a
-- removal is `is_active = false` PLUS `removed_at` — no SQL function changes,
-- because every guest path is already closed by the flag it reads.
--
-- `removed_at` answers the one question `is_active` cannot: the host's own list.
-- The switch (`is_active`) is PAUSED-AND-STILL-LISTED; `removed_at` is GONE from
-- the host's list too, for good. The row stays, so every completion keeps its
-- mission and Memories keeps the challenge's name on the photos already taken.
--
-- 🔒 THE CHECK BELOW IS THE BACKSTOP: a removed challenge can never be live
-- again. The switch's action also scopes to `removed_at IS NULL`; this makes a
-- stale tab, a hand-built POST or a future writer that forgets it fail loudly
-- rather than quietly putting a removed challenge back on every guest's board.
--
-- (2026-10-27 — the ✕ was dropped from the screen: a challenge is never removed by hand now, it is REPLACED — "choose a
-- challenge or turn that challenge off". `removed_at` is what a replaced challenge carries; the rest above holds.)
--
-- RLS: unchanged. `papic_missions_member_all` (couple / coordinator / admin)
-- already governs who may UPDATE this table; a new column inherits it, and the
-- table's grants are table-level (anon was revoked in 20271030569442).

BEGIN;

ALTER TABLE public.papic_missions
  ADD COLUMN IF NOT EXISTS removed_at TIMESTAMPTZ;

COMMENT ON COLUMN public.papic_missions.removed_at IS
  'When the host removed this challenge (the ✕, owner 2026-10-26). NULL = listed. A removed challenge is also is_active = false (CHECK papic_missions_removed_is_off), so no guest path offers it; the row is kept so completions and Memories keep the challenge on photos already taken.';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'papic_missions_removed_is_off'
      AND conrelid = 'public.papic_missions'::regclass
  ) THEN
    ALTER TABLE public.papic_missions
      ADD CONSTRAINT papic_missions_removed_is_off
      CHECK (removed_at IS NULL OR is_active = false);
  END IF;
END $$;

-- ═══════════════════════════════════════════════════════════════════════════
-- TEN SLOTS: AN OFF CHALLENGE STAYS IN ITS SLOT (owner 2026-10-27)
-- ═══════════════════════════════════════════════════════════════════════════
-- Verbatim: *"so in papic challenge, there will be 10 challenges the can make. choose a challenge or turn that
-- challenge off. turning 1 off will become 9 of 10 challenges. it stays there, but just off."*
--
-- `ensure_papic_board` used to refill the board whenever a row went inactive — switching one off handed the couple an
-- eleventh challenge they never chose. The one change below: the Setnayan fill's target also subtracts the rows that
-- are OFF (approved, not active, not removed), so an off challenge keeps its slot. Everything else in the function is
-- the shipped body of 20271159146115 verbatim (auth, lock, lanes, slotting). Same signature, so the GRANT from
-- 20271173829027 stands. 🔒 `a-removed-challenge-keeps-its-photos.db.test.ts` (off keeps the slot; sabotage).

CREATE OR REPLACE FUNCTION public.ensure_papic_board(p_event_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_couple_used INTEGER;
  v_vendor_used INTEGER;
  v_target      INTEGER;
  v_slotted     INTEGER;
  v_event_type  TEXT;
  v_off         INTEGER;
  v_fill        INTEGER;
BEGIN
  -- Auth: the event's couple or coordinator, an admin, or service_role (server).
  -- NOT anon.
  --
  -- ⚠ The single-line form of this comment failed the secret scan. gitleaks'
  -- generic-api-key rule read the slash-joined role list as one high-entropy
  -- token and reported a leak at this line — in a COMMENT, with no credential
  -- anywhere near it. Split rather than suppressed: an inline `gitleaks:allow`
  -- would silence the rule here permanently, and a suppression marker on a line
  -- that never held a secret is a marker nobody can later evaluate.
  IF auth.uid() IS NOT NULL
     AND NOT public.is_admin()
     AND NOT EXISTS (
       SELECT 1 FROM public.event_members em
       WHERE em.event_id = p_event_id AND em.user_id = auth.uid()
         AND em.member_type IN ('couple','coordinator')
     ) THEN
    RAISE EXCEPTION 'not authorized to build the Papic board for event %', p_event_id;
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext('papic_board:' || p_event_id::text));

  -- Was ensure_papic_auto_missions(...), whose 2026-08-01 NULL-session refusal
  -- aborted this whole function on the guest path — the only path that ever
  -- calls it — leaving every event with no board at all. We have authorized
  -- above; call the step, not the public door.
  PERFORM public.papic_generate_booth_missions_unchecked(p_event_id);

  -- What kind of celebration is this? Read once; both lanes use it.
  SELECT e.event_type INTO v_event_type
  FROM public.events e WHERE e.event_id = p_event_id;

  -- ── LANE SIZES — THE COUPLE'S CEILING IS THE WHOLE BOARD MINUS WHAT IS SOLD
  -- Owner, 2026-08-21: "the need to have a real screen to pick their challenges
  -- UP TO 20 CHALLENGES." The couple lane was capped at 10, so a couple who
  -- chose twenty got ten, silently, with the other ten queued behind a wall
  -- they were never shown.
  --
  -- ⚠ THE VENDOR LANE IS MEASURED FIRST, AND THAT IS DELIBERATE. A booth
  -- mission is something a supplier PAID for. If the couple's cap were flat,
  -- the arithmetic would go NEGATIVE the moment one existed and the slot
  -- allocator would try to place more rows than there are seats. Worse than the
  -- maths: a paid placement would vanish the moment the couple added one more
  -- of their own, with nothing anywhere saying so.
  SELECT LEAST(COUNT(*), 2) INTO v_vendor_used
  FROM public.papic_missions m
  WHERE m.event_id = p_event_id AND m.source IN ('vendor','auto') AND m.is_active AND m.approved
    AND m.vendor_id IN (
      SELECT ev.vendor_id FROM public.event_vendors ev
      WHERE ev.event_id = p_event_id
        AND ev.status IN ('contracted','deposit_paid','delivered','complete')
    );

  SELECT LEAST(COUNT(*), 10 - v_vendor_used) INTO v_couple_used
  FROM public.papic_missions m
  WHERE m.event_id = p_event_id AND m.source = 'couple' AND m.is_active AND m.approved;

  -- >= 0 by construction, never negative. It CAN be zero — a couple who picks
  -- the whole board gets exactly their own choices, which is the point of the
  -- screen.
  -- 🎚 AN "OFF" CHALLENGE KEEPS ITS SLOT (owner 2026-10-27: "turning 1 off will become 9 of 10 challenges. it stays
  -- there, but just off."). A couple or Setnayan row switched off (approved, not active, NOT removed) still holds one of
  -- the ten, so the fill below does not hand the board a replacement for it. A REPLACED row (`removed_at` set) holds
  -- nothing — its replacement is a live row of its own.
  SELECT COUNT(*) INTO v_off
  FROM public.papic_missions m
  WHERE m.event_id = p_event_id AND m.source IN ('couple','setnayan')
    AND m.approved AND NOT m.is_active AND m.removed_at IS NULL;

  v_target := 10 - v_couple_used - v_vendor_used;
  -- The FILL (new Setnayan rows) leaves the off slots alone; the SLOTTING below still seats every live row it did.
  v_fill := GREATEST(0, v_target - v_off);

  -- Materialize the Setnayan fills: top-ranked library items NOT taken by a
  -- couple pick, NOT vetoed (an inactive setnayan tombstone), and only rows
  -- whose scope admits this event type. Idempotent via the partial unique.
  -- Existing active setnayan rows conflict -> DO NOTHING (kept, never
  -- re-created).
  --
  -- 🔑 THE `capture_kind <> 'pabati' OR p_pabati_active` CLAUSE IS GONE FROM
  -- HERE AND FROM THE SLOT QUERY BELOW. That was the only per-row entitlement
  -- gate in the library, and it is what made a greeting a paid thing.
  IF v_fill > 0 THEN
    INSERT INTO public.papic_missions
      (event_id, mission_type, source, prompt, library_id, capture_kind, approved, is_active)
    SELECT src.event_id, src.mission_type, 'setnayan', src.prompt, src.library_id, src.capture_kind, true, true
    FROM (
      SELECT p_event_id AS event_id, l.mission_type, l.prompt, l.library_id, l.capture_kind
      FROM public.papic_challenge_library l
      WHERE l.is_active
        AND l.mission_type <> 'face_verified'
        AND (l.event_types IS NULL OR v_event_type = ANY (l.event_types))
        AND NOT EXISTS (  -- taken by a couple pick
          SELECT 1 FROM public.papic_missions cm
          WHERE cm.event_id = p_event_id AND cm.source = 'couple'
            AND cm.is_active AND cm.approved AND cm.library_id = l.library_id)
        AND NOT EXISTS (  -- vetoed tombstone (couple hid this hero)
          SELECT 1 FROM public.papic_missions vm
          WHERE vm.event_id = p_event_id AND vm.source = 'setnayan'
            AND vm.library_id = l.library_id AND NOT vm.is_active)
      ORDER BY l.priority_rank NULLS LAST, l.library_id
      LIMIT v_fill
    ) src
    ON CONFLICT (event_id, library_id) WHERE source = 'setnayan' DO NOTHING;
  END IF;

  -- Reset the board, then reassign board_slot deterministically across the three lanes.
  UPDATE public.papic_missions
    SET board_slot = NULL, updated_at = NOW()
  WHERE event_id = p_event_id AND board_slot IS NOT NULL;

  WITH cand AS (
    -- couple lane (slots first): active/approved couple rows by created_at, id.
    SELECT m.mission_id, 0 AS lane,
           row_number() OVER (ORDER BY m.created_at, m.id) AS lane_rank
    FROM public.papic_missions m
    WHERE m.event_id = p_event_id AND m.source = 'couple' AND m.is_active AND m.approved
    UNION ALL
    -- vendor lane: PAID (source='vendor', approved) before FREE booth (source='auto'); booked vendors only.
    SELECT m.mission_id, 1 AS lane,
           row_number() OVER (
             ORDER BY CASE WHEN m.source = 'vendor' THEN 0 ELSE 1 END, m.created_at, m.id
           ) AS lane_rank
    FROM public.papic_missions m
    WHERE m.event_id = p_event_id AND m.source IN ('vendor','auto') AND m.is_active AND m.approved
      AND m.vendor_id IN (
        SELECT ev.vendor_id FROM public.event_vendors ev
        WHERE ev.event_id = p_event_id
          AND ev.status IN ('contracted','deposit_paid','delivered','complete'))
    UNION ALL
    -- setnayan lane: by priority_rank then library order; exclude couple-taken,
    -- and anything whose scope does not admit this event type.
    SELECT m.mission_id, 2 AS lane,
           row_number() OVER (ORDER BY l.priority_rank NULLS LAST, l.library_id) AS lane_rank
    FROM public.papic_missions m
    JOIN public.papic_challenge_library l ON l.library_id = m.library_id
    WHERE m.event_id = p_event_id AND m.source = 'setnayan' AND m.is_active AND m.approved
      AND l.is_active
      AND (l.event_types IS NULL OR v_event_type = ANY (l.event_types))
      AND NOT EXISTS (  -- dedup: a couple pick of the same library item wins the slot
        SELECT 1 FROM public.papic_missions cm
        WHERE cm.event_id = p_event_id AND cm.source = 'couple'
          AND cm.is_active AND cm.approved AND cm.library_id = m.library_id)
  ),
  capped AS (
    SELECT mission_id, lane, lane_rank FROM cand
    WHERE (lane = 0 AND lane_rank <= v_couple_used)
       OR (lane = 1 AND lane_rank <= v_vendor_used)
       OR (lane = 2 AND lane_rank <= v_target)
  ),
  slotted AS (
    SELECT mission_id, row_number() OVER (ORDER BY lane, lane_rank) AS slot
    FROM capped
  )
  UPDATE public.papic_missions m
    SET board_slot = s.slot, updated_at = NOW()
  FROM slotted s
  WHERE m.mission_id = s.mission_id;

  GET DIAGNOSTICS v_slotted = ROW_COUNT;
  RETURN v_slotted;
END;
$function$;


COMMIT;
