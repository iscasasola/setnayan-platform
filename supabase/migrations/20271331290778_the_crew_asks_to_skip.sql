-- the_crew_asks_to_skip
-- Created via `pnpm migration:new`. Idempotent.
--
-- 🗓 A CREW MEMBER MAY ASK TO SKIP A PART (owner 2026-11-05, on the open question left by 20271308380805 —
-- DECISION_LOG "A CREW MEMBER MAY ASK TO SKIP"): *"yes they can request"*.
--
--   1 · `event_schedule_suggestions.kind` gains 'skip' — a request that a part be skipped (run_state 'skipped'),
--       answered through the ONE accept path (`lib/schedule-suggestion-decide.server.ts`), which skips it exactly as the
--       floor's own Skip does (`changeTheSchedule`, the skip-lock trigger of 20271308380805, the shift notices).
--   2 · only the crew door files one: a RESTRICTIVE insert policy keeps 'skip' out of every other insert path (the
--       pattern of the Where request, 20271308641275).
--   3 · `crew_request_schedule_skip` — the crew Member's phone asks; gates = `crew_schedule_door`. A part a LOCKED
--       supplier is on is refused with the lock's own line (HINT 'supplier_part_locked') — the phone says that line and
--       offers no ask. One open skip ask per part: asking again answers 0 (already waiting), never a second row.
--
-- RLS: no new table. The function is SECURITY DEFINER, EXECUTE to authenticated only.

BEGIN;

-- ── 1 · the kind ────────────────────────────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.event_schedule_suggestions DROP CONSTRAINT IF EXISTS event_schedule_suggestions_kind_check;
ALTER TABLE public.event_schedule_suggestions
  ADD CONSTRAINT event_schedule_suggestions_kind_check CHECK (kind IN ('adjust', 'new', 'remove', 'hours', 'where', 'skip'));

-- One open skip ask per part.
CREATE UNIQUE INDEX IF NOT EXISTS event_schedule_suggestions_one_open_skip
  ON public.event_schedule_suggestions (block_id)
  WHERE kind = 'skip' AND status = 'open';

-- ── 2 · only the crew door writes a skip ask ────────────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS schedule_suggestions_skip_only_by_the_crew_door ON public.event_schedule_suggestions;
CREATE POLICY schedule_suggestions_skip_only_by_the_crew_door
  ON public.event_schedule_suggestions AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (kind <> 'skip');

-- ── 3 · the crew Member asks ────────────────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.crew_request_schedule_skip(
  p_event_id UUID,
  p_block_id UUID
)
RETURNS INTEGER
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_door  TEXT;
  v_block RECORD;
  v_lock  RECORD;
  v_shop  UUID;
  v_name  TEXT;
  v_n     INTEGER;
BEGIN
  v_door := public.crew_schedule_door(p_event_id);
  IF v_door IS DISTINCT FROM 'ok' THEN
    RAISE EXCEPTION '%', coalesce(v_door, 'no_crew_pass') USING ERRCODE = '42501';
  END IF;

  -- Fenced as the crew phone reads the schedule, and only a part that has not started (the floor's own Skip rule).
  SELECT b.block_id, b.event_id, b.label, b.responsible_vendor_ids
    INTO v_block
    FROM public.event_schedule_blocks b
   WHERE b.event_id = p_event_id
     AND b.block_id = p_block_id
     AND b.time_tba = false
     AND b.visibility <> 'coordinator_only'
     AND b.run_state::text = 'upcoming';
  IF v_block.block_id IS NULL THEN
    RAISE EXCEPTION 'nothing_changed' USING ERRCODE = 'P0002';
  END IF;

  -- 🔒 A locked supplier's part: the lock's own line, and no ask (the skip itself would be refused the same way).
  FOR v_lock IN
    SELECT * FROM public.schedule_locked_shops(p_event_id, coalesce(v_block.responsible_vendor_ids, '{}'::uuid[]))
  LOOP
    RAISE EXCEPTION '% isn''t taking changes. Send them a request instead.', v_lock.shop
      USING ERRCODE = 'P0001', HINT = 'supplier_part_locked';
  END LOOP;

  -- Already waiting: nothing new.
  IF EXISTS (
    SELECT 1 FROM public.event_schedule_suggestions s
     WHERE s.block_id = p_block_id AND s.kind = 'skip' AND s.status = 'open'
  ) THEN
    RETURN 0;
  END IF;

  SELECT p.vendor_profile_id, btrim(p.display_name) || ' · ' || coalesce(nullif(btrim(vp.business_name), ''), 'crew')
    INTO v_shop, v_name
    FROM public.vendor_crew_passes p
    JOIN public.vendor_profiles vp ON vp.vendor_profile_id = p.vendor_profile_id
   WHERE p.event_id = p_event_id AND p.crew_user_id = auth.uid() AND p.status = 'allowed'
   LIMIT 1;

  INSERT INTO public.event_schedule_suggestions
    (event_id, block_id, vendor_profile_id, suggested_by_user_id, suggested_by_name, kind, direction, note, status)
  VALUES
    (p_event_id, p_block_id, v_shop, auth.uid(), v_name, 'skip', 'to_host',
     left('Crew on the day: skip ' || coalesce(nullif(btrim(v_block.label), ''), 'this part') || '.', 1000), 'open')
  ON CONFLICT DO NOTHING;
  GET DIAGNOSTICS v_n = ROW_COUNT;
  RETURN v_n;
END;
$$;
REVOKE ALL ON FUNCTION public.crew_request_schedule_skip(UUID, UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.crew_request_schedule_skip(UUID, UUID) TO authenticated;

COMMENT ON FUNCTION public.crew_request_schedule_skip(UUID, UUID) IS
  'A crew MEMBER asks to skip a part (owner 2026-11-05: "yes they can request"). Files one open '
  'event_schedule_suggestions row, kind ''skip'' — never writes the schedule; the coordinator (on the floor) or the hosts '
  'answer it through the one accept path. Gates = crew_schedule_door; a locked supplier''s part is refused with the '
  'lock''s line; one open ask per part (0 = already waiting). 20271331290778.';

COMMIT;
