-- the_yes_sees_a_full_schedule
-- Created via `pnpm migration:new`. KEEP THIS MIGRATION IDEMPOTENT (it may be re-applied).
--
-- 👥 THE SUPPLIER'S YES SEES A FULL SCHEDULE (supplier-ready walk, 22 Nov 2026; controller GO for a follow-up PR).
--
-- The walk found that a supplier could say yes to a booking on a day their team schedule (a non-hall schedule pool,
-- e.g. "Crew A · 2 a day") was already full. The yes (`vendor_agree_to_lock`) never took a pool seat; only the deposit
-- (`acquire_schedule_pools`) counted the schedule, so the couple was refused at payment for a booking the supplier had
-- already agreed to. Halls were already checked before the yes (`vendor_card_halls_on`, 2026-10-14), and a closed or
-- locked day by `closedDayOfAsk` (2026-11-14). This adds the missing third: a full TEAM schedule.
--
-- ONE COUNT: `schedule_pool_taken_on(pool, day, exclude)`, the same count the deposit gate refuses on, against the
-- same `daily_booking_capacity`. ONE POOL LIST: the pools are resolved by the app's one resolver
-- (`resolvePoolIdsForService`, lib/schedule-pools.ts, the deposit's own list) and passed in. This function never
-- resolves them a second way; it only refuses a pool that is not the asked shop's own.
--
-- Read-only (STABLE). It answers names, never counts. Owner-only, like `vendor_card_halls_on`. No table, no column.

CREATE OR REPLACE FUNCTION public.vendor_card_schedules_on(p_event_vendor_id UUID, p_pool_ids UUID[])
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_vpid    UUID;
  v_service UUID;
  v_status  TEXT;
  v_style   TEXT;
  v_date    DATE;
  v_prec    TEXT;
  v_full    JSONB;
BEGIN
  SELECT ev.marketplace_vendor_id, ev.service_id, ev.status, vs.availability_style, e.event_date, e.event_date_precision
    INTO v_vpid, v_service, v_status, v_style, v_date, v_prec
    FROM public.event_vendors ev
    JOIN public.events e ON e.event_id = ev.event_id
    LEFT JOIN public.vendor_services vs ON vs.vendor_service_id = ev.service_id
   WHERE ev.vendor_id = p_event_vendor_id;

  -- Only the shop that was asked may read its own schedules' day.
  IF v_vpid IS NULL OR (v_vpid NOT IN (SELECT public.current_vendor_profile_ids()) AND NOT public.is_admin()) THEN
    RETURN jsonb_build_object('status', 'not_authorized');
  END IF;

  -- Nothing to refuse:
  --   · no day-precise date: the deposit gate degrades open the same way (`no_date`);
  --   · already booked: a booked row is not a new booking (the same rule as the yes's own daily limit);
  --   · Always available ('none'): it takes no seat (owner ruling 4);
  --   · by the piece: judged by its card's own number at the yes, never by the schedule (header 3 of 20271352068061).
  IF v_date IS NULL OR v_prec IS DISTINCT FROM 'day'
     OR v_status IN ('contracted', 'deposit_paid', 'delivered', 'complete')
     OR v_style IN ('none', 'piece')
     OR p_pool_ids IS NULL OR cardinality(p_pool_ids) = 0 THEN
    RETURN jsonb_build_object('status', 'ok', 'full', '[]'::jsonb);
  END IF;
  IF cardinality(p_pool_ids) > 20 THEN
    RAISE EXCEPTION 'too_many_pools' USING ERRCODE = '22023', HINT = 'at most 20 schedules per booking';
  END IF;

  -- The asked shop's own active TEAM schedules among those passed. Halls are answered by vendor_card_halls_on (it
  -- names the free halls to offer), so they are left out here. A pool of another shop is never read.
  SELECT COALESCE(jsonb_agg(COALESCE(NULLIF(trim(p.calendar_name), ''), p.pool_label) ORDER BY p.pool_label), '[]'::jsonb)
    INTO v_full
    FROM public.vendor_schedule_pools p
   WHERE p.pool_id = ANY (p_pool_ids)
     AND p.vendor_profile_id = v_vpid
     AND p.is_active
     AND NOT COALESCE(p.is_hall, FALSE)
     AND public.schedule_pool_taken_on(p.pool_id, v_date, p_event_vendor_id) + 1 > p.daily_booking_capacity;

  RETURN jsonb_build_object(
    'status', CASE WHEN jsonb_array_length(v_full) > 0 THEN 'schedule_full' ELSE 'ok' END,
    'full', v_full,
    'date', v_date);
END;
$$;

COMMENT ON FUNCTION public.vendor_card_schedules_on(UUID, UUID[]) IS
  'For the supplier''s yes (walk 2026-11-22): which of the booking''s TEAM schedules (non-hall pools, resolved by the app''s resolvePoolIdsForService) are already full that day, by the deposit gate''s own count (schedule_pool_taken_on vs daily_booking_capacity). Owner-only; names only.';

REVOKE ALL ON FUNCTION public.vendor_card_schedules_on(UUID, UUID[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.vendor_card_schedules_on(UUID, UUID[]) TO authenticated;

-- ── POST-CONDITIONS ─────────────────────────────────────────────────────────
DO $$
BEGIN
  IF has_function_privilege('anon', 'public.vendor_card_schedules_on(uuid, uuid[])', 'EXECUTE') THEN
    RAISE EXCEPTION 'POST-CONDITION FAILED: anon can ask whether a supplier''s schedule is full';
  END IF;
  IF position('schedule_pool_taken_on(' IN pg_get_functiondef('public.vendor_card_schedules_on(uuid, uuid[])'::regprocedure)) = 0 THEN
    RAISE EXCEPTION 'POST-CONDITION FAILED: the yes''s schedule check does not use the deposit gate''s count';
  END IF;
END $$;
