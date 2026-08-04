-- ============================================================================
-- acquire_schedule_pools — admit the VENDOR and ADMIN callers
-- Explore_Replan_BUILD_SPEC_2026-07-27.md §12.2 step 3 (⛔ the hard blocker)
--
-- WHY THIS MIGRATION EXISTS
-- The lock handshake was ruled on 2026-07-27: the couple's lock is a REQUEST,
-- and the schedule is actually reserved at the moment the VENDOR accepts the
-- payment. PR-I therefore fires `acquire_schedule_pools` from
-- `vendorAcknowledgeDeposit` — a VENDOR-authenticated call.
--
-- But this function opens with:
--
--     IF p_event_id NOT IN (SELECT public.current_couple_event_ids()) THEN
--       RETURN jsonb_build_object('status', 'not_authorized');
--
-- The vendor is not a couple member on that event, and `service_role` has no
-- `auth.uid()` either — BOTH resolve to the empty set. And every existing
-- caller swallows `not_authorized` as degrade-open (`vendors/actions.ts:325`,
-- `:3780`, both commented "can't happen past the RLS-gated reads above").
--
-- So without this change the acquire at acknowledge is a GUARANTEED SILENT
-- NO-OP: the vendor accepts the payment, the app reports the date locked, and
-- no `vendor_schedule_pool_bookings` row is ever written. The date stays
-- sellable to the next couple. That failure is invisible from every surface.
--
-- WHAT CHANGES: exactly the authorization line. Every other statement —
-- deterministic-order FOR UPDATE, the closure/locked/whitelist precedence, the
-- occupancy count, the `AND sp.is_active` INSERT fix from 2026-08-01 — is
-- reproduced VERBATIM from the live prod function body (read out of
-- `pg_get_functiondef` on 2026-08-04, not from the migration file: the
-- migration text and the schema have diverged before, and `20271028166046`'s
-- `is_active` fix lives only in the deployed body).
--
-- WHO MAY NOW CALL IT
--   · the couple on that event                 (unchanged)
--   · the booked VENDOR for that event_vendor  (NEW — the handshake caller)
--   · a platform admin                         (NEW — support/repair)
-- `current_vendor_event_vendor_ids()` resolves the exact `event_vendors.vendor_id`
-- set the caller's marketplace profile is booked on, so a vendor can only ever
-- acquire against THEIR OWN booking row — not another vendor's, and not an
-- arbitrary event.
--
-- ⚠ AFTER DISPATCHING: verify the FUNCTION BODY in prod, not
-- `schema_migrations` — the ledger has reported APPLIED while the object never
-- changed. The proof query is in the PR body.
-- ============================================================================

BEGIN;

CREATE OR REPLACE FUNCTION public.acquire_schedule_pools(
  p_event_id        UUID,
  p_event_vendor_id UUID,
  p_pool_ids        UUID[]
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_date      DATE;
  v_precision TEXT;
  v_pool      RECORD;
  v_used      INT;
  v_closed    BOOLEAN;
  v_locked    BOOLEAN;
  v_whitelist BOOLEAN;
BEGIN
  -- ── Authorization (WIDENED 2026-08-04 · PR-I) ──────────────────────────
  -- Three principals, each proving ownership of a DIFFERENT side of the same
  -- booking. A caller who is none of them is still refused, exactly as before.
  IF p_event_id NOT IN (SELECT public.current_couple_event_ids())
     AND p_event_vendor_id NOT IN (SELECT public.current_vendor_event_vendor_ids())
     AND NOT public.is_admin() THEN
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

    -- (a2) An explicit vendor-set day state (pool-scoped or org-wide).
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
$$;

-- CREATE OR REPLACE preserves existing ACLs, but re-issue them explicitly so
-- this migration is self-describing and a future replay cannot widen the grant
-- by omission (the default-ACL trap: new objects in `public` ship OPEN).
REVOKE ALL ON FUNCTION public.acquire_schedule_pools(UUID, UUID, UUID[]) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.acquire_schedule_pools(UUID, UUID, UUID[]) FROM anon;
GRANT EXECUTE ON FUNCTION public.acquire_schedule_pools(UUID, UUID, UUID[]) TO authenticated;

COMMENT ON FUNCTION public.acquire_schedule_pools(UUID, UUID, UUID[]) IS
  'Multi-pool all-or-nothing atomic acquire (owner 2026-06-12). Honors vendor-set day states — precedence closure-block → LOCKED (hard hold) → WHITELIST (approve-first hold) → capacity. Deterministic-order FOR UPDATE on every pool row; degrades open without a day-precise date. AUTH (widened 2026-08-04, PR-I): the couple on the event, OR the booked vendor for that event_vendor (current_vendor_event_vendor_ids), OR an admin — because the lock handshake reserves the schedule at VENDOR payment-acceptance, and a vendor-authenticated call previously returned not_authorized, which every caller swallows as degrade-open.';

COMMIT;
