-- 20271028166046_fix_inactive_pool_booking_bypass_and_ig_oauth_delete_block.sql
--
-- TWO CONFIRMED DEFECTS, found 2026-08-01 by the vendor-operations schema sweep
-- and each re-verified by hand before this migration was written.
--
-- ╔════════════════════════════════════════════════════════════════════════╗
-- ║ 1 · DEACTIVATING A POOL DID NOT STOP BOOKINGS — IT STOPPED THE CHECKS.  ║
-- ╚════════════════════════════════════════════════════════════════════════╝
-- `acquire_schedule_pools()` validates in a loop and then inserts in one
-- statement, and the two disagreed about which pools they were talking about:
--
--     -- the loop (closure · locked · whitelist · capacity)
--     FROM public.vendor_schedule_pools
--      WHERE pool_id = ANY (p_pool_ids)
--        AND is_active                     ← inactive pools SKIPPED here
--
--     -- the insert, a few lines later
--     FROM public.vendor_schedule_pools sp
--      WHERE sp.pool_id = ANY (p_pool_ids) ← …and INCLUDED here
--
-- So an inactive pool was never closure-checked, never lock-checked, never
-- capacity-checked — and still received a booking row. Switching a pool off
-- silently promoted it from "closed" to "unlimited and unvalidated", which is
-- the exact inverse of what the switch is for.
--
-- ⚠ LATENT, NOT LIVE. `SELECT count(*) FROM vendor_schedule_pools WHERE NOT
-- is_active` returns 0 today, so nothing has been mis-booked. The defect arms
-- itself the first time anyone deactivates a pool — which is precisely when an
-- operator believes they have closed it.
--
-- THE FIX is one predicate on the INSERT so both halves quantify over the same
-- set. Deliberately NOT a wider refactor: the loop is the shipped, reviewed
-- concurrency design (deterministic FOR UPDATE ordering to avoid deadlock), and
-- the bug is only that the write forgot the filter the read applied.
--
-- ⚠ THIS MIGRATION REDEFINES THE FUNCTION BODY. What follows is the live
-- definition reproduced verbatim from prod plus that one predicate, so from
-- here on THIS file is the definition — a future change must be made against
-- it, not against 20261126000000.
--
-- ╔════════════════════════════════════════════════════════════════════════╗
-- ║ 2 · THREE LEFTOVER OAUTH ROWS WERE BLOCKING ACCOUNT DELETION.          ║
-- ╚════════════════════════════════════════════════════════════════════════╝
-- `vendor_ig_oauth_state.initiated_by` referenced `auth.users(id)` with NO
-- ON DELETE clause, so it defaulted to NO ACTION — i.e. REFUSE. Any user with a
-- pending Instagram handshake could not be deleted at all.
--
-- Three such rows exist right now, all for the owner's own account, from a
-- connect attempt on 2026-07-05 that never produced a connection. The table has
-- no expiry column and nothing sweeps it, so those rows are permanent.
--
-- This is a contributing cause of the already-known "admin Delete user is
-- broken" report, which had been attributed to other NO ACTION foreign keys.
--
-- THE FIX is ON DELETE CASCADE. Correct on the merits, not just convenient:
-- the row is ephemeral CSRF/PKCE handshake state that is meaningless without
-- the user who started it. There is nothing to preserve and nothing to orphan.
--
-- ⚠ NO ROWS ARE DELETED HERE. The three stale rows stay exactly where they are;
-- they simply stop blocking. Cleaning them up (and giving the table the
-- expires_at + sweep it never had) is a separate change with its own decision
-- to make — this migration only removes the block.
--
-- IDEMPOTENT — safe to re-run.

-- ── 1 · The booking gate: make the write quantify over the read's set ───────
CREATE OR REPLACE FUNCTION public.acquire_schedule_pools(
  p_event_id uuid,
  p_event_vendor_id uuid,
  p_pool_ids uuid[]
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_date      DATE;
  v_precision TEXT;
  v_pool      RECORD;
  v_used      INT;
  v_closed    BOOLEAN;
  v_locked    BOOLEAN;
  v_whitelist BOOLEAN;
BEGIN
  IF p_event_id NOT IN (SELECT public.current_couple_event_ids()) THEN
    RETURN jsonb_build_object('status', 'not_authorized');
  END IF;

  IF p_pool_ids IS NULL OR array_length(p_pool_ids, 1) IS NULL THEN
    RETURN jsonb_build_object('status', 'no_pools');
  END IF;

  SELECT event_date, event_date_precision
    INTO v_date, v_precision
    FROM public.events
   WHERE event_id = p_event_id;

  -- Eventual-consistency doctrine: no day-precise date → degrade OPEN
  -- (the atomic gate engages the moment the couple locks a real day).
  IF v_date IS NULL OR v_precision IS DISTINCT FROM 'day' THEN
    RETURN jsonb_build_object('status', 'no_date');
  END IF;

  -- Lock every pool row, DETERMINISTIC ORDER (pool_id) so two concurrent
  -- bundles spanning overlapping pool sets can never deadlock.
  FOR v_pool IN
    SELECT pool_id, pool_label, daily_booking_capacity, vendor_profile_id
      FROM public.vendor_schedule_pools
     WHERE pool_id = ANY (p_pool_ids)
       AND is_active
     ORDER BY pool_id
       FOR UPDATE
  LOOP
    -- (a) Closure blocks: a manual/synced block overlapping the date, either
    --     scoped to this pool or org-wide (pool_id IS NULL), closes the date
    --     outright regardless of capacity.
    SELECT EXISTS (
      SELECT 1 FROM public.vendor_calendar_blocks b
       WHERE b.vendor_profile_id = v_pool.vendor_profile_id
         AND b.block_source IN ('manual', 'synced_calendar')
         AND (b.pool_id = v_pool.pool_id OR b.pool_id IS NULL)
         AND (b.blocked_at    AT TIME ZONE 'Asia/Manila')::date <= v_date
         AND (b.blocked_until AT TIME ZONE 'Asia/Manila')::date >= v_date
    ) INTO v_closed;
    IF v_closed THEN
      RETURN jsonb_build_object('status', 'blocked', 'pool_id', v_pool.pool_id);
    END IF;

    -- (a2) NET-NEW: an explicit vendor-set day state (pool-scoped or org-wide).
    --      locked  → hard hold, cannot book (like a closure).
    --      whitelist → approve-first, the acquire is HELD for vendor review.
    SELECT
      bool_or(ds.day_state = 'locked'),
      bool_or(ds.day_state = 'whitelist')
      INTO v_locked, v_whitelist
      FROM public.vendor_calendar_day_states ds
     WHERE ds.vendor_profile_id = v_pool.vendor_profile_id
       AND ds.state_date = v_date
       AND (ds.pool_id = v_pool.pool_id OR ds.pool_id IS NULL);
    IF COALESCE(v_locked, FALSE) THEN
      RETURN jsonb_build_object('status', 'locked', 'pool_id', v_pool.pool_id);
    END IF;
    IF COALESCE(v_whitelist, FALSE) THEN
      RETURN jsonb_build_object('status', 'whitelist', 'pool_id', v_pool.pool_id);
    END IF;

    -- (b) Occupancy = live app reservations (other booking rows) +
    --     external-client jobs on this pool overlapping the date.
    SELECT
      (SELECT count(*) FROM public.vendor_schedule_pool_bookings pb
        WHERE pb.pool_id = v_pool.pool_id
          AND pb.booked_date = v_date
          AND pb.released_at IS NULL
          AND pb.event_vendor_id <> p_event_vendor_id)
      +
      (SELECT count(*) FROM public.vendor_calendar_blocks b
        WHERE b.pool_id = v_pool.pool_id
          AND b.block_source = 'external_client'
          AND (b.blocked_at    AT TIME ZONE 'Asia/Manila')::date <= v_date
          AND (b.blocked_until AT TIME ZONE 'Asia/Manila')::date >= v_date)
    INTO v_used;

    IF v_used >= v_pool.daily_booking_capacity THEN
      RETURN jsonb_build_object(
        'status', 'full',
        'pool_id', v_pool.pool_id,
        'pool_label', v_pool.pool_label);
    END IF;
  END LOOP;

  -- All pools clear under held locks → consume every one. Idempotent on
  -- re-acquire via the live-uniqueness partial index.
  --
  -- ⚠ THE `AND sp.is_active` BELOW IS THE FIX (2026-08-01). Without it this
  -- INSERT quantified over a WIDER set than the validation loop above, so an
  -- inactive pool skipped every gate and still got a row. The two halves must
  -- always name the same set; if a future change adds a predicate to the loop,
  -- it belongs here too.
  INSERT INTO public.vendor_schedule_pool_bookings
    (pool_id, vendor_profile_id, event_vendor_id, event_id, booked_date)
  SELECT sp.pool_id, sp.vendor_profile_id, p_event_vendor_id, p_event_id, v_date
    FROM public.vendor_schedule_pools sp
   WHERE sp.pool_id = ANY (p_pool_ids)
     AND sp.is_active
  ON CONFLICT (pool_id, event_vendor_id) WHERE released_at IS NULL
  DO NOTHING;

  RETURN jsonb_build_object(
    'status', 'ok',
    'pool_ids', to_jsonb(p_pool_ids),
    'booked_date', v_date);
END;
$function$;

-- ── 2 · Stop pending Instagram handshakes from blocking account deletion ────
-- Drop-and-recreate: a FK's ON DELETE action cannot be ALTERed in place.
ALTER TABLE public.vendor_ig_oauth_state
  DROP CONSTRAINT IF EXISTS vendor_ig_oauth_state_initiated_by_fkey;

ALTER TABLE public.vendor_ig_oauth_state
  ADD CONSTRAINT vendor_ig_oauth_state_initiated_by_fkey
  FOREIGN KEY (initiated_by) REFERENCES auth.users(id) ON DELETE CASCADE;

COMMENT ON COLUMN public.vendor_ig_oauth_state.initiated_by IS
  'Ephemeral OAuth handshake state. ON DELETE CASCADE since 2026-08-01: previously NO ACTION, which refused to delete any user holding a pending handshake. The table still has no expires_at and no sweeper — stale rows accumulate.';
