-- a_supplier_locks_their_part
-- Created via `pnpm migration:new`. KEEP THIS MIGRATION IDEMPOTENT (it may be re-applied).
--
-- 🔒 CHANGE LOCK — THE SUPPLIER LOCKS THEIR PART; A HOST'S LATER CHANGE IS REFUSED (supplier gate audit D7, 2026-11-02;
-- DECISION_LOG 2026-11-02 "A SUPPLIER'S SCHEDULE BASICS FOR THIS WEEK" (7)). Owner, verbatim: *"change lock (means the
-- supplier cannot accept changes anymore)."* — "a host's later change to a locked part is refused or must be asked as a
-- request, never silently applied."
--
-- 🔑 EXTEND, DO NOT REBUILD. The lock is the stronger sibling of "Confirm my times" (G6): ONE more column on the same
-- per-(event × shop) row, `event_supplier_schedule_marks` (20271300619930), written by the same door,
-- `supplier_mark_schedule`, which gains 'lock' and 'unlock'. No new table.
--
-- ── WHAT A LOCK COVERS ─────────────────────────────────────────────────────────────────────────────────────────────────
-- The moments (and chapters) whose `responsible_vendor_ids` hold one of that shop's BOOKED rows, plus that shop's crew
-- lines (`event_schedule_tasks.vendor_id`). A cancelled or archived booking locks nothing.
--
-- ── WHERE IT IS ENFORCED: HERE, NOT ONLY IN THE APP ────────────────────────────────────────────────────────────────────
-- BEFORE UPDATE / DELETE on `event_schedule_blocks`, BEFORE INSERT / UPDATE / DELETE on `event_schedule_tasks` — so no
-- door (an action, `move_schedule_chapter`, `set_supplier_where`, a raw PostgREST write) can change a locked part. The
-- refusal is the host's calm line itself: "<shop> isn't taking changes. Send them a request instead." (HINT
-- supplier_part_locked) — host words, never "lock" (a couple reads "book", never "lock").
-- What still passes — each by a DATA signature, never a session flag a caller could set:
--   · a change that does not touch the supplier's part: shown to guests (`is_public`), the order, the invitation, the
--     prep visibility; and adding or removing a DIFFERENT supplier on a shared moment (only the locked shop's own
--     presence in `responsible_vendor_ids` is theirs);
--   · the supplier's OWN request being applied (the one accept path, `lib/schedule-suggestion-decide.server.ts`): an open
--     `event_schedule_suggestions` row from the locked shop on that block, and the write is exactly what it proposed —
--     so "the supplier's own Suggest still works" and a host cannot ride it to change anything else;
--   · the event's DATE moving (`move_event_schedule_with_date`): every block shifts by exactly (live date − the day the
--     schedule stands on) whole days, nothing else — the day itself moved, not their part (audit note 8's default);
--   · the event being deleted (a cascade): there is nothing left to protect.
-- Running late (`bulkRetimeScheduleBlocks` with the shift notice): the owner ruled it DOES pass a lock (DECISION_LOG
-- 2026-11-03 (2)) — added by 20271303571970 through one door, `running_late_shift_schedule`, a pure shift only.
--
-- ── WHO LOCKS AND UNLOCKS ──────────────────────────────────────────────────────────────────────────────────────────────
-- Only the supplier (`supplier_mark_schedule`, booked on the event, own org) — any time, not only the final week (owner
-- call, audit note 10, flagged). An admin unlocks through the service role. The host can only ask.
--
-- Held by apps/web/tests/db/a-locked-part-refuses-the-host.db.test.ts.

BEGIN;

-- ── 1 · the lock ─────────────────────────────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.event_supplier_schedule_marks
  ADD COLUMN IF NOT EXISTS locked_at TIMESTAMPTZ;

COMMENT ON COLUMN public.event_supplier_schedule_marks.locked_at IS
  'CHANGE LOCK: when the supplier locked their part of this event (NULL = unlocked). While set, a host or coordinator '
  'change to a moment naming this shop, or to its crew lines, is refused by the database. Written only by '
  'supplier_mark_schedule(''lock''|''unlock''). 20271303409352.';

-- ── 2 · the one door gains 'lock' and 'unlock' (reproduced from 20271300619930, the two branches added) ────────────────
CREATE OR REPLACE FUNCTION public.supplier_mark_schedule(p_event_id UUID, p_mark TEXT)
RETURNS TIMESTAMPTZ
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_vp    UUID;
  v_day   DATE;
  v_today DATE := (NOW() AT TIME ZONE 'Asia/Manila')::date;
  v_now   TIMESTAMPTZ := NOW();
BEGIN
  IF p_mark NOT IN ('seen', 'confirm', 'lock', 'unlock') THEN
    RAISE EXCEPTION 'Unknown mark.' USING ERRCODE = '22023';
  END IF;
  IF p_event_id IS NULL OR p_event_id NOT IN (SELECT public.current_vendor_booked_event_ids()) THEN
    RAISE EXCEPTION 'Only a supplier booked on this event can do that.' USING ERRCODE = '42501';
  END IF;

  -- The caller's own supplier org on this event (the booked one; owner or team member).
  SELECT ev.marketplace_vendor_id INTO v_vp
    FROM public.event_vendors ev
   WHERE ev.event_id = p_event_id
     AND ev.status IN ('contracted', 'deposit_paid', 'delivered', 'complete')
     AND ev.marketplace_vendor_id IN (SELECT public.current_vendor_profile_ids())
   ORDER BY ev.created_at
   LIMIT 1;
  IF v_vp IS NULL THEN
    RAISE EXCEPTION 'Only a supplier booked on this event can do that.' USING ERRCODE = '42501';
  END IF;

  -- 🔒 Lock / unlock: only `locked_at` moves; Seen and Confirm are left as they were.
  IF p_mark IN ('lock', 'unlock') THEN
    INSERT INTO public.event_supplier_schedule_marks AS m (event_id, vendor_profile_id, locked_at)
    VALUES (p_event_id, v_vp, CASE WHEN p_mark = 'lock' THEN v_now END)
    ON CONFLICT (event_id, vendor_profile_id) DO UPDATE
       SET locked_at = CASE WHEN p_mark = 'lock' THEN v_now END;
    RETURN v_now;
  END IF;

  IF p_mark = 'confirm' THEN
    SELECT e.event_date INTO v_day FROM public.events e WHERE e.event_id = p_event_id;
    IF v_day IS NULL OR v_today < v_day - 7 OR v_today > v_day THEN
      RAISE EXCEPTION 'Confirm my times opens one week before the event.' USING ERRCODE = '22023';
    END IF;
  END IF;

  INSERT INTO public.event_supplier_schedule_marks AS m (event_id, vendor_profile_id, seen_at, confirmed_at)
  VALUES (p_event_id, v_vp, v_now, CASE WHEN p_mark = 'confirm' THEN v_now END)
  ON CONFLICT (event_id, vendor_profile_id) DO UPDATE
     SET seen_at      = v_now,
         confirmed_at = CASE WHEN p_mark = 'confirm' THEN v_now ELSE m.confirmed_at END;

  RETURN v_now;
END;
$$;
REVOKE ALL ON FUNCTION public.supplier_mark_schedule(UUID, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.supplier_mark_schedule(UUID, TEXT) TO authenticated;

COMMENT ON FUNCTION public.supplier_mark_schedule(UUID, TEXT) IS
  'A booked supplier presses Seen (''seen''), Confirm my times (''confirm'', the final week only — the seven days up '
  'to the event day, Manila calendar), or locks / unlocks their part (''lock'' | ''unlock'', any time). Writes '
  'event_supplier_schedule_marks for the caller''s own org. 20271300619930 · lock 20271303409352.';

-- ── 3 · which locked shops a set of this event's supplier rows belongs to ──────────────────────────────────────────────
-- Internal: read only by the two triggers below (SECURITY DEFINER — a host cannot read the marks of a shop by itself).
CREATE OR REPLACE FUNCTION public.schedule_locked_shops(p_event_id UUID, p_vendor_ids UUID[])
RETURNS TABLE (vendor_profile_id UUID, shop TEXT)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT DISTINCT m.vendor_profile_id,
         coalesce(nullif(btrim(vp.business_name), ''), nullif(btrim(ev.vendor_name), ''), 'the supplier') AS shop
    FROM public.event_vendors ev
    JOIN public.event_supplier_schedule_marks m
      ON m.event_id = ev.event_id AND m.vendor_profile_id = ev.marketplace_vendor_id
    LEFT JOIN public.vendor_profiles vp ON vp.vendor_profile_id = m.vendor_profile_id
   WHERE ev.event_id = p_event_id
     AND ev.vendor_id = ANY (coalesce(p_vendor_ids, '{}'::uuid[]))
     AND m.locked_at IS NOT NULL
     AND ev.status IN ('contracted', 'deposit_paid', 'delivered', 'complete')
     AND ev.archived_at IS NULL;
$$;
REVOKE ALL ON FUNCTION public.schedule_locked_shops(UUID, UUID[]) FROM PUBLIC, anon, authenticated;

-- ── 4 · a moment: refused while a shop on it is locked ─────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.event_schedule_blocks_part_lock()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_old_ids UUID[] := coalesce(OLD.responsible_vendor_ids, '{}'::uuid[]);
  v_new_ids UUID[];
  v_fields  BOOLEAN;
  v_rest    BOOLEAN;
  v_ids     UUID[];
  v_days    INTEGER;
  v_shop    RECORD;
BEGIN
  IF TG_OP = 'DELETE' THEN
    -- The event itself is being deleted (a cascade): nothing is left to protect.
    IF NOT EXISTS (SELECT 1 FROM public.events e WHERE e.event_id = OLD.event_id) THEN
      RETURN OLD;
    END IF;
    v_ids := v_old_ids;
  ELSE
    v_new_ids := coalesce(NEW.responsible_vendor_ids, '{}'::uuid[]);
    -- The supplier's part: when, where, what, and inside which chapter. NOT is_public, sort_order, on_invitation,
    -- visibility, audience or the photo settings — none of those changes what the supplier does.
    v_fields := (OLD.label, OLD.start_at, OLD.end_at, OLD.time_tba, OLD.location, OLD.spot, OLD.notes, OLD.block_type,
                 OLD.ingress_minutes_before, OLD.egress_minutes_after, OLD.call_lead_minutes, OLD.parent_block_id, OLD.event_id)
       IS DISTINCT FROM
                (NEW.label, NEW.start_at, NEW.end_at, NEW.time_tba, NEW.location, NEW.spot, NEW.notes, NEW.block_type,
                 NEW.ingress_minutes_before, NEW.egress_minutes_after, NEW.call_lead_minutes, NEW.parent_block_id, NEW.event_id);
    IF v_fields THEN
      -- Every shop on the moment, before or after.
      v_ids := v_old_ids || v_new_ids;
    ELSE
      -- Only the shops put on or taken off: another supplier's presence is not a locked shop's part.
      v_ids := ARRAY(SELECT x FROM unnest(v_old_ids) x WHERE NOT (x = ANY (v_new_ids))
                     UNION SELECT y FROM unnest(v_new_ids) y WHERE NOT (y = ANY (v_old_ids)));
    END IF;
  END IF;
  IF cardinality(v_ids) = 0 THEN
    RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
  END IF;

  FOR v_shop IN SELECT * FROM public.schedule_locked_shops(OLD.event_id, v_ids) LOOP
    IF TG_OP = 'DELETE' THEN
      -- The supplier's own "remove this", being applied.
      CONTINUE WHEN EXISTS (
        SELECT 1 FROM public.event_schedule_suggestions s
         WHERE s.block_id = OLD.block_id AND s.vendor_profile_id = v_shop.vendor_profile_id
           AND s.status = 'open' AND s.kind = 'remove');
    ELSE
      -- Everything that is not the four fields a request may propose stays exactly as it was.
      v_rest := (OLD.time_tba, OLD.spot, OLD.notes, OLD.block_type, OLD.ingress_minutes_before, OLD.egress_minutes_after,
                 OLD.call_lead_minutes, OLD.parent_block_id, OLD.event_id, v_old_ids)
         IS NOT DISTINCT FROM
                (NEW.time_tba, NEW.spot, NEW.notes, NEW.block_type, NEW.ingress_minutes_before, NEW.egress_minutes_after,
                 NEW.call_lead_minutes, NEW.parent_block_id, NEW.event_id, v_new_ids);
      -- The supplier's own request, being applied: exactly what it proposed, nothing else.
      CONTINUE WHEN v_rest AND EXISTS (
        SELECT 1 FROM public.event_schedule_suggestions s
         WHERE s.block_id = OLD.block_id AND s.vendor_profile_id = v_shop.vendor_profile_id
           AND s.status = 'open' AND s.kind = 'adjust'
           AND NEW.start_at IS NOT DISTINCT FROM coalesce(s.proposed_start_at, OLD.start_at)
           AND NEW.end_at   IS NOT DISTINCT FROM coalesce(s.proposed_end_at, OLD.end_at)
           AND NEW.location IS NOT DISTINCT FROM coalesce(s.proposed_location, OLD.location)
           AND NEW.label    IS NOT DISTINCT FROM coalesce(s.proposed_label, OLD.label));
      -- The event's date moved: the whole day shifts by exactly (live date − the day the schedule stands on).
      SELECT e.event_date - a.anchor_day INTO v_days
        FROM public.events e
        JOIN public.event_schedule_day_anchor a ON a.event_id = e.event_id
       WHERE e.event_id = OLD.event_id;
      CONTINUE WHEN v_rest AND coalesce(v_days, 0) <> 0
        AND NEW.label IS NOT DISTINCT FROM OLD.label
        AND NEW.location IS NOT DISTINCT FROM OLD.location
        AND NEW.start_at IS NOT DISTINCT FROM OLD.start_at + make_interval(hours => 24 * v_days)
        AND NEW.end_at   IS NOT DISTINCT FROM OLD.end_at   + make_interval(hours => 24 * v_days);
    END IF;
    RAISE EXCEPTION '% isn''t taking changes. Send them a request instead.', v_shop.shop
      USING ERRCODE = 'P0001', HINT = 'supplier_part_locked';
  END LOOP;

  RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END;
$$;
REVOKE ALL ON FUNCTION public.event_schedule_blocks_part_lock() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS event_schedule_blocks_part_lock ON public.event_schedule_blocks;
CREATE TRIGGER event_schedule_blocks_part_lock
  BEFORE UPDATE OR DELETE ON public.event_schedule_blocks
  FOR EACH ROW EXECUTE FUNCTION public.event_schedule_blocks_part_lock();

-- ── 5 · a crew line: the locked shop's own lines are refused ───────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.event_schedule_tasks_part_lock()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_block UUID;
  v_event UUID;
  v_ids   UUID[];
  v_shop  RECORD;
BEGIN
  IF TG_OP = 'INSERT' THEN
    v_block := NEW.block_id;
    v_ids := array_remove(ARRAY[NEW.vendor_id], NULL);
  ELSIF TG_OP = 'DELETE' THEN
    v_block := OLD.block_id;
    v_ids := array_remove(ARRAY[OLD.vendor_id], NULL);
  ELSE
    -- Nothing a supplier works to moved (the order only): let it through.
    IF (OLD.block_id, OLD.vendor_id, OLD.crew, OLD.what, OLD.call_at, OLD.place)
       IS NOT DISTINCT FROM (NEW.block_id, NEW.vendor_id, NEW.crew, NEW.what, NEW.call_at, NEW.place) THEN
      RETURN NEW;
    END IF;
    v_block := OLD.block_id;
    v_ids := array_remove(ARRAY[OLD.vendor_id, NEW.vendor_id], NULL);
  END IF;
  IF cardinality(v_ids) = 0 THEN
    RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
  END IF;

  SELECT b.event_id INTO v_event FROM public.event_schedule_blocks b WHERE b.block_id = v_block;
  -- The moment (or the event) is being deleted: a cascade, already decided above.
  IF v_event IS NULL THEN
    RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
  END IF;

  FOR v_shop IN SELECT * FROM public.schedule_locked_shops(v_event, v_ids) LOOP
    -- The supplier's own request naming their crew, being applied.
    CONTINUE WHEN EXISTS (
      SELECT 1 FROM public.event_schedule_suggestions s
       WHERE s.vendor_profile_id = v_shop.vendor_profile_id AND s.status = 'open'
         AND s.proposed_crew IS NOT NULL
         AND (s.block_id = v_block OR (s.kind = 'new' AND s.event_id = v_event)));
    RAISE EXCEPTION '% isn''t taking changes. Send them a request instead.', v_shop.shop
      USING ERRCODE = 'P0001', HINT = 'supplier_part_locked';
  END LOOP;

  RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END;
$$;
REVOKE ALL ON FUNCTION public.event_schedule_tasks_part_lock() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS event_schedule_tasks_part_lock ON public.event_schedule_tasks;
CREATE TRIGGER event_schedule_tasks_part_lock
  BEFORE INSERT OR UPDATE OR DELETE ON public.event_schedule_tasks
  FOR EACH ROW EXECUTE FUNCTION public.event_schedule_tasks_part_lock();

COMMIT;
