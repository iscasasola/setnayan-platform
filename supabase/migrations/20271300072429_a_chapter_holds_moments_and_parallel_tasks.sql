-- a_chapter_holds_moments_and_parallel_tasks
-- Created via `pnpm migration:new`. Prefix auto-allocated to sort AFTER every
-- existing migration. KEEP THIS MIGRATION IDEMPOTENT (it may be re-applied).
--
-- 📖 SCHEDULE AND CHAPTERS — STEP 2: THE SCHEMA (owner 2026-11-01, DECISION_LOG "SCHEDULE AND CHAPTERS — THE PLAN" ·
-- "SCHEDULE PLAN §9: EIGHT OPEN ITEMS RULED" · "THE BLOW BY BLOW FROM THE REAL RUN OF SHOW"; corpus
-- SCHEDULE_CHAPTERS_BUILD_PLAN_2026-11-01.md §2, §3, §3c, §7).
--
-- 🔑 EXTEND, DO NOT REBUILD (plan §7). There is NO chapter table and NO `event_parts` table:
--   · a CHAPTER is a TOP-LEVEL `event_schedule_blocks` row (parent_block_id IS NULL);
--   · a MOMENT is its child (parent_block_id = the chapter), the two-level tree the owner ruled 2026-05-24.
--   `event_parts` was planned in the 31 Oct plan and never built: measured on origin/main 2026-11-01, zero migrations
--   and zero code name it. Chapters-as-blocks make it unnecessary — it is NOT created here.
--
-- ── 1 · WHAT A CHAPTER CARRIES (new columns, read on TOP-LEVEL rows) ─────────────────────────────────────────────────
--   name · time · venue  — the columns that already exist: `label`, `start_at`/`end_at`, `location`
--                          (blank `location` = "Venue TBA"; the RSVP still sends, plan §3 TBA).
--   spot                 — "Exact spot" (owner: *"Room or floor only applies to hotels. Sometimes event places or
--                          sometimes it is a beachside."*): bridal suite · 2F holding room · ballroom · foyer.
--                          On a MOMENT it is the moment's room, the default place of every task in it (§3c #2).
--   ingress_minutes_before / egress_minutes_after
--                        — "Ingress from" / "Egress until" (owner: *"not placing a time means no ingress and same no
--                          value on egress means no egress"*): NULL = none. Stored as MINUTES FROM THE CHAPTER'S START,
--                          never as a second clock: every writer that moves a block (Running late, the date move
--                          `move_event_schedule_with_date`, the coordinator's advance) moves `start_at` only, and the
--                          window must move with its chapter (the approved prototype moves both by the same delta).
--                          Minutes also cross midnight with no special case (§3c #3): Reception 6 PM, egress until
--                          1 AM next day = 420 after; ingress from 12:00 AM = 1080 before.
--   call_lead_minutes    — 0 · 15 · 30 · 45 · 60 before a person's first task, default 60 (owner: *"Call time can be
--                          set from 0-60 minutes before their first task."*).
--   on_invitation        — guests reply to this chapter (owner: *"Rsvp will depend on what chapters we make."*).
--                          Default OFF: no existing block lands on an invitation by this migration. Nothing reads it
--                          for guests yet (Step 5).
--   photo_who / photo_when
--                        — who sees its photos (People in this chapter · Only people tagged · Everybody) and when
--                          (Right away · After the event). Stored only; nothing enforces them yet (Step 7, the server
--                          check on every photo URL). Defaults are the approved prototype's.
--
-- ── 2 · WHAT A MOMENT CARRIES (new columns, read on CHILD rows) ──────────────────────────────────────────────────────
--   is_optional          — the "if kept" mark (§3c #6: father's reveal, bouquet & garter).
--   travel_from / travel_to
--                        — a travel moment (§3c #4: Seda → Church). `travel_to` set = a travel moment; a from without a
--                          to is refused.
--
-- ── 3 · A MOMENT HOLDS PARALLEL TASKS (§3c #1, #2, #5) — `event_schedule_tasks` ──────────────────────────────────────
-- One row per person, supplier or crew: WHO + WHAT they do then (+ optional call time, + optional place). Exactly ONE
-- "who" per row:
--   · vendor_id  — a supplier booked on the event (`event_vendors.vendor_id`, the id `responsible_vendor_ids` already
--                  carries), with an optional `crew` ("Team A") — the owner's *"Jubert Team A bride · Team B groom"*.
--                  Rule 0: what exists for crews was measured first — `vendor_team_members.team_label` (shop staff
--                  accounts, not per event) and `vendor_crew_passes` (event-day phones, one per PERSON). Neither is a
--                  named team of a supplier on one event, so a crew is a name on the task; a person on a crew joins
--                  later (Step 6) without changing this row.
--   · guest_id   — one person on the guest list (the bride, a bridesmaid);
--   · group_id   — a guest group (Bridesmaids, Bride's family);
--   · role       — a role word (`guests.role`, e.g. 'bridesmaid');
--   · who_label  — anyone else, in words ("Seda banquet captain").
-- `place` NULL = the moment's own room (`spot`, else its `location`) — resolved at READ, never copied, so moving the
-- moment's room moves every task that follows it. A CLASH (the same person or crew in two places at once) is
-- COMPUTED (lib/schedule-chapters.ts `findTaskClashes`), never blocked: overlaps are normal (§3c #5).
--
-- 🔐 RLS at CREATE TABLE, the same five doors as the blocks themselves (canonical helpers only, once per query):
--   couple            — read + write  (current_couple_event_ids)
--   coordinator/helper — write with Edit on the Schedule, read with any level (current_moderator_area_levels)
--   booked supplier   — READ ONLY, and only tasks on a block not staged for the coordinator
--                       (current_vendor_booked_event_ids). A supplier's own changes still go through
--                       event_schedule_suggestions and the host's approval (3 Oct ruling, unchanged).
--   anon / a guest    — NOTHING. Supplier times and crew calls never reach a guest (plan §11c). `anon` holds no grant
--                       at all on the table.
-- `event_id` is DERIVED from the block by a trigger (never trusted from the client), and a who on another event is
-- refused, so a row can never point across two events.
--
-- 📷 ROOM FOR PAPIC BY CHAPTER (DECISION_LOG 2026-11-01 "PAPIC BY CHAPTER MOVES UP"): a chapter is a stable
-- `block_id`, so its capture window (start · end · who may shoot) attaches to it in the next step without touching
-- anything here. Nothing about Papic is built in this file.
--
-- 🗑 Deleting a chapter: its moments go (parent_block_id CASCADE, unchanged) and their tasks go (block_id CASCADE).
-- No photo row references a block today, so a chapter delete removes no photo — they stay under Unsorted (ruled 1 Nov).
--
-- Held by apps/web/tests/db/a-chapter-holds-moments-and-parallel-tasks.db.test.ts.

BEGIN;

-- ── 1 + 2 · the block gains its chapter and moment fields ─────────────────────────────────────────────────────────

ALTER TABLE public.event_schedule_blocks
  ADD COLUMN IF NOT EXISTS spot                   TEXT,
  ADD COLUMN IF NOT EXISTS ingress_minutes_before INTEGER,
  ADD COLUMN IF NOT EXISTS egress_minutes_after   INTEGER,
  ADD COLUMN IF NOT EXISTS call_lead_minutes      SMALLINT NOT NULL DEFAULT 60,
  ADD COLUMN IF NOT EXISTS on_invitation          BOOLEAN  NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS photo_who              TEXT     NOT NULL DEFAULT 'chapter',
  ADD COLUMN IF NOT EXISTS photo_when             TEXT     NOT NULL DEFAULT 'right_away',
  ADD COLUMN IF NOT EXISTS is_optional            BOOLEAN  NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS travel_from            TEXT,
  ADD COLUMN IF NOT EXISTS travel_to              TEXT;

ALTER TABLE public.event_schedule_blocks
  DROP CONSTRAINT IF EXISTS event_schedule_blocks_spot_check,
  DROP CONSTRAINT IF EXISTS event_schedule_blocks_ingress_check,
  DROP CONSTRAINT IF EXISTS event_schedule_blocks_egress_check,
  DROP CONSTRAINT IF EXISTS event_schedule_blocks_call_lead_check,
  DROP CONSTRAINT IF EXISTS event_schedule_blocks_photo_who_check,
  DROP CONSTRAINT IF EXISTS event_schedule_blocks_photo_when_check,
  DROP CONSTRAINT IF EXISTS event_schedule_blocks_travel_check;

ALTER TABLE public.event_schedule_blocks
  ADD CONSTRAINT event_schedule_blocks_spot_check
    CHECK (spot IS NULL OR char_length(btrim(spot)) BETWEEN 1 AND 120),
  -- Up to a whole day before the start (ingress from 6 PM the night before a 6 PM chapter).
  ADD CONSTRAINT event_schedule_blocks_ingress_check
    CHECK (ingress_minutes_before IS NULL OR ingress_minutes_before BETWEEN 0 AND 1440),
  -- Up to two days after the start (a long reception whose egress runs past the next midnight).
  ADD CONSTRAINT event_schedule_blocks_egress_check
    CHECK (egress_minutes_after IS NULL OR egress_minutes_after BETWEEN 0 AND 2880),
  ADD CONSTRAINT event_schedule_blocks_call_lead_check
    CHECK (call_lead_minutes IN (0, 15, 30, 45, 60)),
  ADD CONSTRAINT event_schedule_blocks_photo_who_check
    CHECK (photo_who IN ('chapter', 'tagged', 'everybody')),
  ADD CONSTRAINT event_schedule_blocks_photo_when_check
    CHECK (photo_when IN ('right_away', 'after_event')),
  -- A travel moment names where it goes; a "from" alone is not one.
  ADD CONSTRAINT event_schedule_blocks_travel_check
    CHECK (
      (travel_to IS NULL AND travel_from IS NULL)
      OR (travel_to IS NOT NULL AND char_length(btrim(travel_to)) BETWEEN 1 AND 120
          AND (travel_from IS NULL OR char_length(btrim(travel_from)) BETWEEN 1 AND 120))
    );

COMMENT ON COLUMN public.event_schedule_blocks.spot IS
  'Exact spot inside the venue (bridal suite, 2F holding room, ballroom). On a moment: the default place of its tasks. 20271300072429.';
COMMENT ON COLUMN public.event_schedule_blocks.ingress_minutes_before IS
  'Chapter (top-level) only: Ingress from = start_at minus these minutes. NULL = no ingress. Moves with start_at. 20271300072429.';
COMMENT ON COLUMN public.event_schedule_blocks.egress_minutes_after IS
  'Chapter (top-level) only: Egress until = start_at plus these minutes (may cross midnight). NULL = no egress. 20271300072429.';
COMMENT ON COLUMN public.event_schedule_blocks.call_lead_minutes IS
  'Chapter (top-level) only: call time, minutes before a person''s first task (0/15/30/45/60). 20271300072429.';
COMMENT ON COLUMN public.event_schedule_blocks.on_invitation IS
  'Chapter (top-level) only: guests reply to it. Default off; read for guests from Step 5. 20271300072429.';
COMMENT ON COLUMN public.event_schedule_blocks.photo_who IS
  'Chapter (top-level) only: who sees its photos — chapter (people in it) · tagged · everybody. Not enforced yet (Step 7). 20271300072429.';
COMMENT ON COLUMN public.event_schedule_blocks.photo_when IS
  'Chapter (top-level) only: when its photos show — right_away · after_event. Not enforced yet (Step 7). 20271300072429.';
COMMENT ON COLUMN public.event_schedule_blocks.is_optional IS
  'Moment: the "if kept" mark (father''s reveal, bouquet & garter). 20271300072429.';
COMMENT ON COLUMN public.event_schedule_blocks.travel_to IS
  'Moment: set = a travel moment, from travel_from (or where the last moment was) to here. 20271300072429.';

-- ── 2b · MOVING A CHAPTER MOVES ITS MOMENTS — in ONE statement (plan §3 "Time moves") ─────────────────────────────
-- The chapter and every moment in it shift by the same amount, all or nothing (the 2026-10-04 lesson of the date
-- move: one UPDATE per block left half-moved days). SECURITY INVOKER: it is the caller's own UPDATE, so RLS decides
-- exactly as for a hand edit — a caller who may not edit the schedule moves nothing and is told 0. The shift is whole
-- seconds on a UTC column holding the venue's wall clock (`make_interval(secs => …)`), never a day interval, which
-- would follow the session's time zone. Ingress and egress are minutes from the start, so they come along.
CREATE OR REPLACE FUNCTION public.move_schedule_chapter(p_block_id UUID, p_start_at TIMESTAMPTZ)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_from  TIMESTAMPTZ;
  v_shift INTERVAL;
  v_moved INTEGER;
BEGIN
  SELECT start_at INTO v_from
    FROM public.event_schedule_blocks
   WHERE block_id = p_block_id AND parent_block_id IS NULL;
  IF v_from IS NULL OR p_start_at IS NULL THEN
    RETURN 0;
  END IF;
  v_shift := make_interval(secs => EXTRACT(EPOCH FROM (p_start_at - v_from)));
  UPDATE public.event_schedule_blocks b
     SET start_at   = b.start_at + v_shift,
         end_at     = b.end_at + v_shift,
         updated_at = NOW()
   WHERE b.block_id = p_block_id OR b.parent_block_id = p_block_id;
  GET DIAGNOSTICS v_moved = ROW_COUNT;
  RETURN v_moved;
END;
$$;
REVOKE ALL ON FUNCTION public.move_schedule_chapter(UUID, TIMESTAMPTZ) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.move_schedule_chapter(UUID, TIMESTAMPTZ) TO authenticated;

-- ── 3 · the parallel tasks of a moment ───────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.event_schedule_tasks (
  task_id     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Derived from the block by the trigger below — whatever a client sends is replaced.
  event_id    UUID NOT NULL REFERENCES public.events(event_id) ON DELETE CASCADE,
  block_id    UUID NOT NULL REFERENCES public.event_schedule_blocks(block_id) ON DELETE CASCADE,
  -- WHO — exactly one of the five (CHECK below).
  vendor_id   UUID REFERENCES public.event_vendors(vendor_id) ON DELETE CASCADE,
  crew        TEXT CHECK (crew IS NULL OR char_length(btrim(crew)) BETWEEN 1 AND 60),
  guest_id    UUID REFERENCES public.guests(guest_id) ON DELETE CASCADE,
  group_id    UUID REFERENCES public.guest_groups(group_id) ON DELETE CASCADE,
  role        TEXT CHECK (role IS NULL OR char_length(btrim(role)) BETWEEN 1 AND 60),
  who_label   TEXT CHECK (who_label IS NULL OR char_length(btrim(who_label)) BETWEEN 1 AND 120),
  -- WHAT they do then.
  what        TEXT NOT NULL CHECK (char_length(btrim(what)) BETWEEN 1 AND 500),
  -- Optional: their own call (a wall clock, stored like start_at) and their own place (NULL = the moment's room).
  call_at     TIMESTAMPTZ,
  place       TEXT CHECK (place IS NULL OR char_length(btrim(place)) BETWEEN 1 AND 120),
  sort_order  INTEGER NOT NULL DEFAULT 0,
  created_by  UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT event_schedule_tasks_one_who
    CHECK (num_nonnulls(vendor_id, guest_id, group_id, role, who_label) = 1),
  -- A crew is a team OF a supplier.
  CONSTRAINT event_schedule_tasks_crew_needs_supplier
    CHECK (crew IS NULL OR vendor_id IS NOT NULL)
);

ALTER TABLE public.event_schedule_tasks ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS event_schedule_tasks_block_idx  ON public.event_schedule_tasks (block_id, sort_order);
CREATE INDEX IF NOT EXISTS event_schedule_tasks_event_idx  ON public.event_schedule_tasks (event_id);
CREATE INDEX IF NOT EXISTS event_schedule_tasks_vendor_idx ON public.event_schedule_tasks (vendor_id) WHERE vendor_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS event_schedule_tasks_guest_idx  ON public.event_schedule_tasks (guest_id)  WHERE guest_id  IS NOT NULL;
CREATE INDEX IF NOT EXISTS event_schedule_tasks_group_idx  ON public.event_schedule_tasks (group_id)  WHERE group_id  IS NOT NULL;

COMMENT ON TABLE public.event_schedule_tasks IS
  'A moment''s parallel tasks (owner 2026-11-01, the real run of show): one row per person, supplier or crew — who + '
  'what they do then, optional call time and place (NULL = the moment''s room). Clashes are computed, never blocked. '
  'Couple and schedule-Edit helpers write; booked suppliers read; guests and anon read nothing. 20271300072429.';

-- The event comes from the block; a who on another event is refused. SECURITY DEFINER only to LOOK UP the event of a
-- row the caller may not read (a booking, a guest) — it writes nothing but NEW, and RLS still decides the write.
CREATE OR REPLACE FUNCTION public.event_schedule_tasks_same_event()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_event UUID;
BEGIN
  SELECT b.event_id INTO v_event FROM public.event_schedule_blocks b WHERE b.block_id = NEW.block_id;
  IF v_event IS NULL THEN
    RAISE EXCEPTION 'That moment is not on the schedule.' USING ERRCODE = '23503';
  END IF;
  NEW.event_id := v_event;
  IF NEW.vendor_id IS NOT NULL
     AND NOT EXISTS (SELECT 1 FROM public.event_vendors v WHERE v.vendor_id = NEW.vendor_id AND v.event_id = v_event) THEN
    RAISE EXCEPTION 'That supplier is not on this event.' USING ERRCODE = '23514';
  END IF;
  IF NEW.guest_id IS NOT NULL
     AND NOT EXISTS (SELECT 1 FROM public.guests g WHERE g.guest_id = NEW.guest_id AND g.event_id = v_event) THEN
    RAISE EXCEPTION 'That person is not on this event.' USING ERRCODE = '23514';
  END IF;
  IF NEW.group_id IS NOT NULL
     AND NOT EXISTS (SELECT 1 FROM public.guest_groups gg WHERE gg.group_id = NEW.group_id AND gg.event_id = v_event) THEN
    RAISE EXCEPTION 'That group is not on this event.' USING ERRCODE = '23514';
  END IF;
  IF TG_OP = 'UPDATE' THEN
    NEW.updated_at := NOW();
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.event_schedule_tasks_same_event() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS event_schedule_tasks_same_event ON public.event_schedule_tasks;
CREATE TRIGGER event_schedule_tasks_same_event
  BEFORE INSERT OR UPDATE ON public.event_schedule_tasks
  FOR EACH ROW EXECUTE FUNCTION public.event_schedule_tasks_same_event();

-- Grants: the browser's signed-in role only; anon holds nothing.
REVOKE ALL ON TABLE public.event_schedule_tasks FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.event_schedule_tasks TO authenticated;
GRANT ALL ON TABLE public.event_schedule_tasks TO service_role;

DROP POLICY IF EXISTS event_schedule_tasks_couple_write ON public.event_schedule_tasks;
CREATE POLICY event_schedule_tasks_couple_write
  ON public.event_schedule_tasks FOR ALL
  TO authenticated
  USING (event_id IN (SELECT public.current_couple_event_ids()))
  WITH CHECK (event_id IN (SELECT public.current_couple_event_ids()));

DROP POLICY IF EXISTS event_schedule_tasks_moderator_write ON public.event_schedule_tasks;
CREATE POLICY event_schedule_tasks_moderator_write
  ON public.event_schedule_tasks FOR ALL
  TO authenticated
  USING (event_id IN (SELECT l.event_id FROM public.current_moderator_area_levels('schedule') l WHERE l.level = 'edit'))
  WITH CHECK (event_id IN (SELECT l.event_id FROM public.current_moderator_area_levels('schedule') l WHERE l.level = 'edit'));

DROP POLICY IF EXISTS event_schedule_tasks_moderator_read ON public.event_schedule_tasks;
CREATE POLICY event_schedule_tasks_moderator_read
  ON public.event_schedule_tasks FOR SELECT
  TO authenticated
  USING (event_id IN (SELECT l.event_id FROM public.current_moderator_area_levels('schedule') l WHERE l.level IS NOT NULL));

-- A booked supplier reads the event's tasks (their own, and everyone else's greyed — plan §3), never on a block the
-- coordinator has staged for themselves.
DROP POLICY IF EXISTS event_schedule_tasks_booked_vendor_read ON public.event_schedule_tasks;
CREATE POLICY event_schedule_tasks_booked_vendor_read
  ON public.event_schedule_tasks FOR SELECT
  TO authenticated
  USING (
    event_id IN (SELECT public.current_vendor_booked_event_ids())
    AND EXISTS (
      SELECT 1 FROM public.event_schedule_blocks b
      WHERE b.block_id = event_schedule_tasks.block_id
        AND b.visibility <> 'coordinator_only'
    )
  );

-- The fence must really be there: RLS on, anon without a grant, no policy for anon.
DO $$
BEGIN
  IF NOT (SELECT relrowsecurity FROM pg_class WHERE oid = 'public.event_schedule_tasks'::regclass) THEN
    RAISE EXCEPTION 'event_schedule_tasks must have RLS on';
  END IF;
  IF has_table_privilege('anon', 'public.event_schedule_tasks', 'SELECT') THEN
    RAISE EXCEPTION 'anon must not read event_schedule_tasks';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'event_schedule_tasks'
             AND 'anon' = ANY (roles)) THEN
    RAISE EXCEPTION 'no policy on event_schedule_tasks may name anon';
  END IF;
END;
$$;

COMMIT;
