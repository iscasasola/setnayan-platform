-- running_late_passes_a_locked_part
-- Created via `pnpm migration:new`. KEEP THIS MIGRATION IDEMPOTENT (it may be re-applied).
--
-- 🏃 A HOST'S RUNNING-LATE SHIFT MOVES A LOCKED SUPPLIER'S MOMENTS (owner, DECISION_LOG 2026-11-03 "HOME PART 1
-- APPROVED + THREE SCHEDULE/COORDINATOR CALLS" (2), verbatim: *"A host's RUNNING-LATE shift moves a supplier's moments
-- even when that supplier has locked their times; the supplier still gets the notice."*). This closes the call
-- 20271303409352 left open ("Running late … is NOT exempt … Owner call — flagged in the PR, not decided here").
--
-- 🔑 EXTEND, DO NOT REBUILD. The change lock (20271303409352) stays exactly as it is for every other host edit: a
-- drag of one moment, a rename, a new place, a crew line, a delete — all still refused. ONE more pass in the moment
-- trigger, and ONE door that can open it:
--
--   · `running_late_shift_schedule(event, block ids, minutes)` — the Running-late sheet's write
--     (`bulkRetimeScheduleBlocks` with the shift notice). SECURITY INVOKER, so every row is still the caller's to
--     update under the shipped RLS (the couple, a coordinator who edits the day; a limited helper is refused by the
--     restrictive policies). It moves each given moment by EXACTLY the minutes, start and end, durations kept by
--     construction — it cannot rename, re-place or re-crew anything. All or nothing: one refused row rolls the whole
--     shift back (the row-by-row loop it replaces could leave half a day moved).
--   · the trigger passes a change ONLY while that function runs (`app.running_late_minutes`, transaction-local, set and
--     cleared inside it) AND only when the change is a pure shift of exactly those minutes with every other field of
--     the part untouched. 20271303409352 asked for data signatures, never a flag a caller could set: this marker is
--     not settable through the API (PostgREST sets only its own `request.*` settings), and it lives one transaction.
--
-- The supplier still hears it: `notifyScheduleShifted` tells every booked supplier the day moved, locked or not.
--
-- Held by apps/web/tests/db/a-locked-part-refuses-the-host.db.test.ts (both directions) and
-- apps/web/lib/a-locked-part-refuses-the-host.test.ts (the action's two paths).

BEGIN;

-- ── 1 · the one door ─────────────────────────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.running_late_shift_schedule(p_event_id UUID, p_block_ids UUID[], p_minutes INTEGER)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_ids   UUID[] := ARRAY(SELECT DISTINCT x FROM unnest(coalesce(p_block_ids, '{}'::uuid[])) x WHERE x IS NOT NULL);
  v_moved INTEGER;
BEGIN
  IF p_minutes IS NULL OR p_minutes = 0 OR abs(p_minutes) > 720 THEN
    RAISE EXCEPTION 'A running-late shift is a whole number of minutes, at most 12 hours either way.' USING ERRCODE = '22023';
  END IF;
  IF cardinality(v_ids) = 0 THEN
    RAISE EXCEPTION 'nothing_changed' USING ERRCODE = 'P0002';
  END IF;

  PERFORM set_config('app.running_late_minutes', p_minutes::text, true);
  UPDATE public.event_schedule_blocks b
     SET start_at   = b.start_at + make_interval(mins => p_minutes),
         end_at     = b.end_at   + make_interval(mins => p_minutes),
         updated_at = now()
   WHERE b.event_id = p_event_id
     AND b.block_id = ANY (v_ids);
  GET DIAGNOSTICS v_moved = ROW_COUNT;
  PERFORM set_config('app.running_late_minutes', '', true);

  -- A row the caller may not update (RLS) or that is gone: the whole shift is undone, never half a day.
  IF v_moved <> cardinality(v_ids) THEN
    RAISE EXCEPTION 'nothing_changed' USING ERRCODE = 'P0002';
  END IF;
  RETURN v_moved;
END;
$$;
REVOKE ALL ON FUNCTION public.running_late_shift_schedule(UUID, UUID[], INTEGER) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.running_late_shift_schedule(UUID, UUID[], INTEGER) TO authenticated, service_role;

-- ── 2 · the moment trigger: 20271303409352's, plus the running-late pass (copied unchanged otherwise) ────────────────
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
  v_late    INTEGER;
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
      -- 🏃 Running late (owner 2026-11-03): the host's shift of the day, inside `running_late_shift_schedule` only —
      -- exactly that many minutes on start and end, nothing else.
      v_late := nullif(current_setting('app.running_late_minutes', true), '')::integer;
      CONTINUE WHEN v_rest AND v_late IS NOT NULL AND v_late <> 0
        AND NEW.label IS NOT DISTINCT FROM OLD.label
        AND NEW.location IS NOT DISTINCT FROM OLD.location
        AND NEW.start_at IS NOT DISTINCT FROM OLD.start_at + make_interval(mins => v_late)
        AND NEW.end_at   IS NOT DISTINCT FROM OLD.end_at   + make_interval(mins => v_late);
    END IF;
    RAISE EXCEPTION '% isn''t taking changes. Send them a request instead.', v_shop.shop
      USING ERRCODE = 'P0001', HINT = 'supplier_part_locked';
  END LOOP;

  RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END;
$$;
REVOKE ALL ON FUNCTION public.event_schedule_blocks_part_lock() FROM PUBLIC, anon, authenticated;

COMMIT;
