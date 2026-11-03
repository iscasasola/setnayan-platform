-- a_task_can_carry_a_contact
-- Created via `pnpm migration:new`. Prefix auto-allocated to sort AFTER every
-- existing migration. KEEP THIS MIGRATION IDEMPOTENT (it may be re-applied).
--
-- 📇 A TASK CAN CARRY A CONTACT — A NAME AND A PHONE (owner 2026-11-02, DECISION_LOG "SCHEDULE FITS THE COORDINATOR'S
-- TIMELINE AS WRITTEN: 4 ADDITIONS" (3)). A real coordinator's timeline writes "Bridal car — driver Mang Ben, 0917 …"
-- on the moment the car leaves. The driver is not a supplier and not a guest: today the task's who is words
-- (`who_label`) and there is nowhere to put how to reach them.
--
-- 🔐 WHY ITS OWN TABLE AND NOT TWO COLUMNS ON THE TASK. A phone number is shown ONLY to the host and that moment's crew.
-- `event_schedule_tasks` is read by EVERY booked supplier on the event (their own lines and everyone else's, greyed —
-- plan §3), so a column there would hand the driver's phone to the florist. RLS is per row, never per column; so the
-- contact is one row per task in a table whose read is narrower:
--
--   couple            — read + write  (current_couple_event_ids)
--   coordinator/helper — write with Edit on the Schedule, read with any level (current_moderator_area_levels)
--   booked supplier   — READ ONLY, and only on a moment they are ON: tagged to one of their bookings
--                       (`responsible_vendor_ids`) or holding a line of theirs (a task with their `vendor_id`) — and
--                       never on a block the coordinator has staged for themselves.
--   a guest           — through their own "Your schedule" (the server's read of the moments they have a task on);
--                       `anon` and every other signed-in account hold NOTHING here.
--
-- `event_id` and `block_id` are DERIVED from the task by a trigger (never trusted from the client), so a contact can
-- never point across two events or float off its moment. Deleting the task deletes its contact (CASCADE).
--
-- Held by apps/web/tests/db/a-task-can-carry-a-contact.db.test.ts.

BEGIN;

CREATE TABLE IF NOT EXISTS public.event_schedule_task_contacts (
  task_id     UUID PRIMARY KEY REFERENCES public.event_schedule_tasks(task_id) ON DELETE CASCADE,
  -- Both derived from the task by the trigger below — whatever a client sends is replaced.
  event_id    UUID NOT NULL REFERENCES public.events(event_id) ON DELETE CASCADE,
  block_id    UUID NOT NULL REFERENCES public.event_schedule_blocks(block_id) ON DELETE CASCADE,
  name        TEXT NOT NULL CHECK (char_length(btrim(name)) BETWEEN 1 AND 80),
  -- As written ("0917 123 4567", "+63 917 123 4567", "(02) 8123-4567"): digits and the usual marks, 7–40 long.
  phone       TEXT NOT NULL CHECK (char_length(btrim(phone)) BETWEEN 7 AND 40 AND phone ~ '^[0-9+()./ -]+$'),
  created_by  UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.event_schedule_task_contacts ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS event_schedule_task_contacts_event_idx ON public.event_schedule_task_contacts (event_id);
CREATE INDEX IF NOT EXISTS event_schedule_task_contacts_block_idx ON public.event_schedule_task_contacts (block_id);

COMMENT ON TABLE public.event_schedule_task_contacts IS
  'A task''s contact (owner 2026-11-02, 4 additions (3)): a name and a phone for someone who is not a supplier — the '
  'bridal-car driver. Shown only to the host, the coordinator and that moment''s crew: the couple and schedule-Edit '
  'helpers write; a booked supplier reads only on a moment they are on; anon reads nothing. 20271303218631.';

-- The event and the moment come from the task. SECURITY DEFINER only to LOOK UP the task of a row the caller may be
-- writing — it writes nothing but NEW, and RLS still decides the write.
CREATE OR REPLACE FUNCTION public.event_schedule_task_contacts_from_task()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_event UUID;
  v_block UUID;
BEGIN
  SELECT t.event_id, t.block_id INTO v_event, v_block FROM public.event_schedule_tasks t WHERE t.task_id = NEW.task_id;
  IF v_event IS NULL THEN
    RAISE EXCEPTION 'That task is not on the schedule.' USING ERRCODE = '23503';
  END IF;
  NEW.event_id := v_event;
  NEW.block_id := v_block;
  NEW.name := btrim(NEW.name);
  NEW.phone := btrim(NEW.phone);
  IF TG_OP = 'UPDATE' THEN
    NEW.updated_at := NOW();
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.event_schedule_task_contacts_from_task() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS event_schedule_task_contacts_from_task ON public.event_schedule_task_contacts;
CREATE TRIGGER event_schedule_task_contacts_from_task
  BEFORE INSERT OR UPDATE ON public.event_schedule_task_contacts
  FOR EACH ROW EXECUTE FUNCTION public.event_schedule_task_contacts_from_task();

-- Grants: the browser's signed-in role only; anon holds nothing.
REVOKE ALL ON TABLE public.event_schedule_task_contacts FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.event_schedule_task_contacts TO authenticated;
GRANT ALL ON TABLE public.event_schedule_task_contacts TO service_role;

DROP POLICY IF EXISTS event_schedule_task_contacts_couple_write ON public.event_schedule_task_contacts;
CREATE POLICY event_schedule_task_contacts_couple_write
  ON public.event_schedule_task_contacts FOR ALL
  TO authenticated
  USING (event_id IN (SELECT public.current_couple_event_ids()))
  WITH CHECK (event_id IN (SELECT public.current_couple_event_ids()));

DROP POLICY IF EXISTS event_schedule_task_contacts_moderator_write ON public.event_schedule_task_contacts;
CREATE POLICY event_schedule_task_contacts_moderator_write
  ON public.event_schedule_task_contacts FOR ALL
  TO authenticated
  USING (event_id IN (SELECT l.event_id FROM public.current_moderator_area_levels('schedule') l WHERE l.level = 'edit'))
  WITH CHECK (event_id IN (SELECT l.event_id FROM public.current_moderator_area_levels('schedule') l WHERE l.level = 'edit'));

DROP POLICY IF EXISTS event_schedule_task_contacts_moderator_read ON public.event_schedule_task_contacts;
CREATE POLICY event_schedule_task_contacts_moderator_read
  ON public.event_schedule_task_contacts FOR SELECT
  TO authenticated
  USING (event_id IN (SELECT l.event_id FROM public.current_moderator_area_levels('schedule') l WHERE l.level IS NOT NULL));

-- A booked supplier reads a contact only on a moment they are ON — never another supplier's moment.
DROP POLICY IF EXISTS event_schedule_task_contacts_crew_read ON public.event_schedule_task_contacts;
CREATE POLICY event_schedule_task_contacts_crew_read
  ON public.event_schedule_task_contacts FOR SELECT
  TO authenticated
  USING (
    event_id IN (SELECT public.current_vendor_booked_event_ids())
    AND EXISTS (
      SELECT 1 FROM public.event_schedule_blocks b
      WHERE b.block_id = event_schedule_task_contacts.block_id
        AND b.visibility <> 'coordinator_only'
        AND (
          b.responsible_vendor_ids && ARRAY(SELECT public.current_vendor_event_vendor_ids())
          OR EXISTS (
            SELECT 1 FROM public.event_schedule_tasks t
            WHERE t.block_id = b.block_id
              AND t.vendor_id IN (SELECT public.current_vendor_event_vendor_ids())
          )
        )
    )
  );

-- The fence must really be there: RLS on, anon without a grant, no policy for anon.
DO $$
BEGIN
  IF NOT (SELECT relrowsecurity FROM pg_class WHERE oid = 'public.event_schedule_task_contacts'::regclass) THEN
    RAISE EXCEPTION 'event_schedule_task_contacts must have RLS on';
  END IF;
  IF has_table_privilege('anon', 'public.event_schedule_task_contacts', 'SELECT') THEN
    RAISE EXCEPTION 'anon must not read event_schedule_task_contacts';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'event_schedule_task_contacts'
             AND 'anon' = ANY (roles)) THEN
    RAISE EXCEPTION 'no policy on event_schedule_task_contacts may name anon';
  END IF;
END;
$$;

COMMIT;
