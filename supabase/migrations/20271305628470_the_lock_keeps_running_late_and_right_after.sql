-- the_lock_keeps_running_late_and_right_after
-- Created via `pnpm migration:new`. Prefix auto-allocated to sort AFTER every
-- existing migration. KEEP THIS MIGRATION IDEMPOTENT (it may be re-applied):
--
-- 🔒 ONE LOCK FUNCTION, BOTH RULES (train #7210, 3 Nov). Two migrations each CREATE OR REPLACE
-- `event_schedule_blocks_part_lock()`, written without seeing each other:
--   · 20271303571970 running_late_passes_a_locked_part (#7204, LIVE) — the Running-late shift passes a locked part;
--   · 20271303690499 the_lock_knows_right_after (#7203) — `follows_block_id` is part of the lock; a request that gives
--     an untimed moment a real time may clear `time_tba` / `follows_block_id`;
--   · 20271304682748 the_lock_knows_time_as_written (#7208) — `time_shape` / `time_or_minutes` are part of the lock.
-- Applied in filename order, the second silently DROPS the first's Running-late branch (CI caught it:
-- a-locked-part-refuses-the-host.db.test.ts "RUNNING LATE moves a locked part" → "isn't taking changes").
-- This file is #7208's function (which already carries #7203's) + #7204's Running-late branch (which also requires the clock flags unchanged).
-- CREATE OR REPLACE of the function only; the trigger is unchanged. Idempotent.

BEGIN;

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
  v_clock_same BOOLEAN;
  v_clock_set  BOOLEAN;
  v_late       INTEGER;
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
                 OLD.ingress_minutes_before, OLD.egress_minutes_after, OLD.call_lead_minutes, OLD.parent_block_id, OLD.event_id,
                 OLD.follows_block_id, OLD.time_shape, OLD.time_or_minutes)
       IS DISTINCT FROM
                (NEW.label, NEW.start_at, NEW.end_at, NEW.time_tba, NEW.location, NEW.spot, NEW.notes, NEW.block_type,
                 NEW.ingress_minutes_before, NEW.egress_minutes_after, NEW.call_lead_minutes, NEW.parent_block_id, NEW.event_id,
                 NEW.follows_block_id, NEW.time_shape, NEW.time_or_minutes);
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
      v_rest := (OLD.spot, OLD.notes, OLD.block_type, OLD.ingress_minutes_before, OLD.egress_minutes_after,
                 OLD.call_lead_minutes, OLD.parent_block_id, OLD.event_id, v_old_ids, OLD.time_shape, OLD.time_or_minutes)
         IS NOT DISTINCT FROM
                (NEW.spot, NEW.notes, NEW.block_type, NEW.ingress_minutes_before, NEW.egress_minutes_after,
                 NEW.call_lead_minutes, NEW.parent_block_id, NEW.event_id, v_new_ids, NEW.time_shape, NEW.time_or_minutes);
      -- ⏭ "Time TBA" / "right after" (20271302727358) unchanged — or ended by a real time (a request's proposed start).
      v_clock_same := (OLD.time_tba, OLD.follows_block_id) IS NOT DISTINCT FROM (NEW.time_tba, NEW.follows_block_id);
      v_clock_set  := OLD.time_tba AND NOT NEW.time_tba AND NEW.follows_block_id IS NULL;
      -- The supplier's own request, being applied: exactly what it proposed, nothing else.
      CONTINUE WHEN v_rest AND EXISTS (
        SELECT 1 FROM public.event_schedule_suggestions s
         WHERE s.block_id = OLD.block_id AND s.vendor_profile_id = v_shop.vendor_profile_id
           AND s.status = 'open' AND s.kind = 'adjust'
           AND (v_clock_same OR (v_clock_set AND s.proposed_start_at IS NOT NULL))
           AND NEW.start_at IS NOT DISTINCT FROM coalesce(s.proposed_start_at, OLD.start_at)
           AND NEW.end_at   IS NOT DISTINCT FROM coalesce(s.proposed_end_at, OLD.end_at)
           AND NEW.location IS NOT DISTINCT FROM coalesce(s.proposed_location, OLD.location)
           AND NEW.label    IS NOT DISTINCT FROM coalesce(s.proposed_label, OLD.label));
      -- The event's date moved: the whole day shifts by exactly (live date − the day the schedule stands on).
      SELECT e.event_date - a.anchor_day INTO v_days
        FROM public.events e
        JOIN public.event_schedule_day_anchor a ON a.event_id = e.event_id
       WHERE e.event_id = OLD.event_id;
      CONTINUE WHEN v_rest AND v_clock_same AND coalesce(v_days, 0) <> 0
        AND NEW.label IS NOT DISTINCT FROM OLD.label
        AND NEW.location IS NOT DISTINCT FROM OLD.location
        AND NEW.start_at IS NOT DISTINCT FROM OLD.start_at + make_interval(hours => 24 * v_days)
        AND NEW.end_at   IS NOT DISTINCT FROM OLD.end_at   + make_interval(hours => 24 * v_days);
      -- 🏃 Running late (owner 2026-11-03, 20271303571970): the host's shift of the day, inside
      -- `running_late_shift_schedule` only — exactly that many minutes on start and end, the clock flags untouched.
      v_late := nullif(current_setting('app.running_late_minutes', true), '')::integer;
      CONTINUE WHEN v_rest AND v_clock_same AND v_late IS NOT NULL AND v_late <> 0
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
