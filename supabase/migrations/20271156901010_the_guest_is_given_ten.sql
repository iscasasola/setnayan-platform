-- THE GUEST IS GIVEN TEN.
--
-- Owner, 2026-08-21: *"we keep the 600+ challenges but the user only picks 10."*
--
-- 🔑 TWO DIFFERENT NUMBERS, AND THIS CHANGES ONLY ONE OF THEM. The LIBRARY is
-- 631 challenges and stays 631 — that is what a couple chooses FROM, and the
-- picker with its search and twelve themes is untouched. What changes is how
-- many any one GUEST is handed on the night: 20 → 10.
--
-- Said in the same breath as putting challenge answers into the couple's story.
-- The two go together: once an answer is something a person will read back
-- later, twenty asks is a chore list and ten is an invitation. Ten also spends
-- half as much of the shared shot pool per guest.
--
-- ⚠ THE VENDOR SHARE MOVES WITH IT, AND THAT IS NOT AN INDEPENDENT DECISION.
-- The vendor lane was 5 of 20 — a quarter. Halving the board and leaving it at
-- 5 would silently sell HALF of every guest's challenges. It becomes 2 of 10:
-- the same quarter share, arithmetically. Nobody chose a new proportion here.
-- Production holds ZERO booth sponsorships, so this changes nothing for anyone
-- today; it stops a commercial change happening by omission tomorrow.
--
-- Everything else is reproduced from the body applied by 20271155952591 — read
-- out of that file and patched, never retyped from memory, which is how a
-- CREATE OR REPLACE quietly reverts a fix nobody remembered was in there.

-- ── THE RUNNING ORDER FOR A BOARD OF TEN ───────────────────────────────────
-- Generated from apps/web/lib/papic-challenge-pool.ts. 20 ranked rows.
--
-- 🚨 WITHOUT THIS, HALVING THE BOARD WOULD HAVE EMPTIED THE OWNER'S OWN COLUMN.
-- Ranks 1-10 were all photo errands and every story sat at 11-16, so a 10-slot
-- board would have placed NOT ONE story and NOT ONE greeting by default - and
-- the story/editorial column that challenge answers are supposed to fill would
-- have been permanently empty on every event. The empty-rail failure, caused by
-- the change that was meant to feed it.
--
-- 🔑 TWO TENS, AND THE SECOND ONE COSTS NO NEW MECHANISM.
--   1-10  a WEDDING's default: six doing, three telling, one greeting.
--  11-20  ANY event's default. Every rank 1-10 row is wedding-scoped, so at a
--         birthday they are filtered out and 11-20 become the lowest SURVIVING
--         ranks - which the existing `ORDER BY priority_rank NULLS LAST,
--         library_id` then places first. Before this, a birthday's default ten
--         was whatever had the lowest ids: ten selfies in a row.
--
-- ⚠ EVERY RANK IS CLEARED BEFORE ANY IS SET. `priority_rank` is UNIQUE, so
-- reassigning overlapping ranks in one UPDATE collides mid-statement on a row
-- that has not been moved yet. Two statements, deliberately.
UPDATE public.papic_challenge_library SET priority_rank = NULL WHERE priority_rank IS NOT NULL;

UPDATE public.papic_challenge_library l
   SET priority_rank = v.rank
  FROM (VALUES
  (1, 1),
  (41, 2),
  (4, 3),
  (2, 4),
  (40, 5),
  (53, 6),
  (18, 7),
  (22, 8),
  (42, 9),
  (6, 10),
  (300, 11),
  (450, 12),
  (600, 13),
  (700, 14),
  (100, 15),
  (800, 16),
  (900, 17),
  (1001, 18),
  (1100, 19),
  (452, 20)
  ) AS v(library_id, rank)
 WHERE l.library_id = v.library_id;

CREATE OR REPLACE FUNCTION public.ensure_papic_board(p_event_id uuid, p_pabati_active boolean DEFAULT false)
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

  -- ⬇ THE ONE-LINE FIX. Was ensure_papic_auto_missions(...), whose 2026-08-01
  -- NULL-session refusal aborted this whole function on the guest path — the
  -- only path that ever calls it — leaving every event with no board at all.
  -- We have authorized above; call the step, not the public door.
  PERFORM public.papic_generate_booth_missions_unchecked(p_event_id);

  -- What kind of celebration is this? Read once; both lanes use it.
  SELECT e.event_type INTO v_event_type
  FROM public.events e WHERE e.event_id = p_event_id;

  -- ── LANE SIZES — THE COUPLE'S CEILING IS NOW THE WHOLE BOARD ─────────────
  -- Owner, 2026-08-21: "the need to have a real screen to pick their challenges
  -- UP TO 20 CHALLENGES." The couple lane was capped at 10, so a couple who
  -- chose twenty got ten, silently, with the other ten queued behind a wall
  -- they were never shown.
  --
  -- ⚠ THE VENDOR LANE IS MEASURED FIRST, AND THAT IS DELIBERATE. A booth
  -- mission is something a supplier PAID for. If the couple's cap were a flat
  -- 20, the arithmetic would go NEGATIVE the moment one existed
  -- (20 - 20 - 5 = -5) and the slot allocator would try to place 25 rows in 20
  -- seats. Worse than the maths: a paid placement would vanish the moment the
  -- couple added a twentieth of their own, with nothing anywhere saying so.
  --
  -- So the couple's ceiling is "the whole board, minus whatever is already
  -- sold". Today that is exactly 20 — production holds ZERO booth
  -- sponsorships — and it degrades honestly rather than silently if one is ever
  -- bought. The screen shows the number, so the couple is never refused by a
  -- limit they cannot see.
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

  -- >= 0 by construction now, never negative. It CAN be zero — a couple who
  -- picks all twenty gets a board of exactly their own choices, which is the
  -- point of the screen.
  v_target := 10 - v_couple_used - v_vendor_used;

  -- Materialize the Setnayan fills: top-ranked library items NOT taken by a couple pick, NOT vetoed
  -- (an inactive setnayan tombstone), Pabati only if the SKU is active, and only rows whose scope
  -- admits this event type. Idempotent via the partial unique. Existing active setnayan rows
  -- conflict -> DO NOTHING (kept, never re-created).
  IF v_target > 0 THEN
    INSERT INTO public.papic_missions
      (event_id, mission_type, source, prompt, library_id, capture_kind, approved, is_active)
    SELECT src.event_id, src.mission_type, 'setnayan', src.prompt, src.library_id, src.capture_kind, true, true
    FROM (
      SELECT p_event_id AS event_id, l.mission_type, l.prompt, l.library_id, l.capture_kind
      FROM public.papic_challenge_library l
      WHERE l.is_active
        AND l.mission_type <> 'face_verified'
        AND (l.capture_kind <> 'pabati' OR p_pabati_active)
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
      LIMIT v_target
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
    -- setnayan lane: by priority_rank then library order; exclude Pabati-if-inactive, couple-taken,
    -- and anything whose scope does not admit this event type.
    SELECT m.mission_id, 2 AS lane,
           row_number() OVER (ORDER BY l.priority_rank NULLS LAST, l.library_id) AS lane_rank
    FROM public.papic_missions m
    JOIN public.papic_challenge_library l ON l.library_id = m.library_id
    WHERE m.event_id = p_event_id AND m.source = 'setnayan' AND m.is_active AND m.approved
      AND l.is_active
      AND (l.capture_kind <> 'pabati' OR p_pabati_active)
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
