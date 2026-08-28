-- the_answer_window_is_48_hours
-- ============================================================================
-- THE SUPPLIER HAS 48 HOURS TO ANSWER A BOOKING REQUEST — owner ruling,
-- 2026-08-28, given in one word when the question was put to him.
--
-- ── WHAT WAS ACTUALLY SHIPPED, READ OUT OF THE LIVE OBJECT ─────────────────
-- The 2026-06-02 lock has always said 48 hours. The code never matched it:
-- `pg_get_functiondef(guard_event_vendor_lock_handshake)` in production carried
-- `INTERVAL '7 days'`, and `nudge_stale_lock_requests` defaulted to `p_days = 5`.
-- The spec and the machine had disagreed since the handshake was written, and
-- the machine is what a supplier lives under. This migration makes the machine
-- the spec.
--
-- ── THE REMINDER HAD TO MOVE, OR IT WOULD HAVE DIED SILENTLY ───────────────
-- 🔴 THIS IS THE POINT OF THIS MIGRATION THAT IS NOT THE OWNER'S SENTENCE.
-- `nudge_stale_lock_requests` fires at `lock_requested_at + p_days` AND requires
-- `lock_request_expires_at > NOW()`. With the window cut to 48 hours, a day-5
-- reminder is 72 hours PAST the deadline, so that WHERE clause could never be
-- satisfied: the nudge would have gone on running, matching nothing, reporting
-- success, forever. Changing the window without changing the reminder does not
-- break the reminder loudly — it makes it vanish. The default moves to 1 day.
--
-- ⚠ AND EVEN AT 24 HOURS THE REMINDER IS NOT GUARANTEED, which is a property of
-- a cron-free sweep and is stated here rather than left to be discovered. The
-- sweep is traffic-driven (`maybeRunLockRequestExpiry`, fired from the admin and
-- vendor-dashboard layouts) with a 20-hour floor between passes. On a regular
-- cadence a pass always falls in the 24 hours between the reminder and the
-- deadline (48 − 24 = 24 > 20). If page traffic goes quiet for more than a day —
-- which is exactly today's state, pre-launch — a request can close having never
-- warned anybody. No threshold fixes that; only a real schedule does, and this
-- project is deliberately cron-free.
--
-- ── SAFE BY ARITHMETIC ─────────────────────────────────────────────────────
-- Production has NEVER held a lock request: 0 pending, 0 rows with any
-- `lock_request_state`, 0 ever stamped with a deadline, 0 ever nudged (measured
-- 2026-08-28). Nothing is in flight to strand, and nobody's promise is shortened
-- retroactively — the deadline is MATERIALIZED at the moment of asking, so a row
-- stamped under the old rule would keep the seven days it was given. The
-- handshake itself is still behind `NEXT_PUBLIC_LOCK_HANDSHAKE_ENABLED`, so
-- nothing creates a pending row until the owner presses that.
--
-- ⛔ WHAT THIS DOES NOT TOUCH: `CLOSED_WINDOW_GRACE_DAYS` in
-- apps/web/lib/answers-desk.ts is ALSO 7 and is a DIFFERENT NUMBER — how long a
-- lapsed ask stays visible as a closed line on the Answers Desk, so that a row
-- which simply vanished does not read as one you answered. Two sevens, two
-- meanings; only one of them is the window.
--
-- BARE migration (no BEGIN/COMMIT): CREATE OR REPLACE FUNCTION is self-contained,
-- idempotent and re-run safe.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1 · The window itself. The body below is the SHIPPED function with one
--     interval changed — copied from 20271143289546 rather than retyped, so a
--     re-typed near-copy cannot quietly drop one of its forgery guards.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.guard_event_vendor_lock_handshake()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $guard$
BEGIN
  -- ⚠ INSERT IS GUARDED TOO, AND THAT IS THE WHOLE POINT.
  -- event_vendors_couple_write is FOR ALL with no column list, so a couple's own
  -- client could INSERT a row BORN 'agreed' and manufacture a vendor's consent.
  -- On INSERT there is no OLD row, so the test differs in shape but not intent:
  -- a NEW row may not arrive already carrying the vendor's answer.
  IF current_user IN ('authenticated', 'anon') THEN
    IF TG_OP = 'INSERT' THEN
      IF NEW.lock_agreed_at IS NOT NULL
         OR NEW.lock_declined_at IS NOT NULL
         OR NEW.lock_decline_reason IS NOT NULL
         OR NEW.lock_answered_by_user_id IS NOT NULL
         OR NEW.lock_request_nudged_at IS NOT NULL
         OR NEW.lock_request_state IN ('agreed', 'declined', 'expired')
      THEN
        RAISE EXCEPTION
          'a booking cannot be created already carrying the vendor''s lock answer'
          USING ERRCODE = '42501';
      END IF;

    ELSIF TG_OP = 'UPDATE' THEN
      IF NEW.lock_agreed_at           IS DISTINCT FROM OLD.lock_agreed_at
         OR NEW.lock_declined_at      IS DISTINCT FROM OLD.lock_declined_at
         OR NEW.lock_decline_reason   IS DISTINCT FROM OLD.lock_decline_reason
         OR NEW.lock_answered_by_user_id
                                      IS DISTINCT FROM OLD.lock_answered_by_user_id
         OR NEW.lock_request_nudged_at
                                      IS DISTINCT FROM OLD.lock_request_nudged_at
      THEN
        RAISE EXCEPTION
          'the vendor''s lock answer is vendor-set only (via vendor_agree_to_lock / vendor_decline_lock)'
          USING ERRCODE = '42501';
      END IF;

      -- The state machine itself: a couple may open (pending) or withdraw
      -- (cancelled) their own request, but may not declare the vendor's verdict.
      IF NEW.lock_request_state IS DISTINCT FROM OLD.lock_request_state
         AND NEW.lock_request_state IN ('agreed', 'declined', 'expired')
      THEN
        RAISE EXCEPTION
          'lock_request_state ''%'' is set only by the vendor lock-handshake RPCs',
          NEW.lock_request_state
          USING ERRCODE = '42501';
      END IF;

      -- COHERENCE (see the header): no self-booking while a request is live.
      IF OLD.lock_request_state = 'pending'
         AND NEW.status IN ('contracted', 'deposit_paid', 'delivered', 'complete')
         AND OLD.status NOT IN ('contracted', 'deposit_paid', 'delivered', 'complete')
      THEN
        RAISE EXCEPTION
          'this booking has a live lock request — the vendor''s answer books it (vendor_agree_to_lock), or withdraw the request first'
          USING ERRCODE = '42501';
      END IF;
    END IF;
  END IF;

  -- Materialize the 48-HOUR deadline the moment a row becomes pending, so the
  -- TTL is stored ONCE here rather than hand-typed into every reader. Fires on
  -- INSERT too. Keyed on the TRANSITION (was not pending, is now) so a later
  -- touch of an already-pending row never silently extends the vendor's window —
  -- and so a SECOND ask does not inherit the dead deadline of the first.
  --
  -- ⚖ 48 HOURS IS THE OWNER'S RULING (2026-08-28), asked and answered in one
  -- word. It restores the 2026-06-02 lock's own figure, which the shipped code
  -- had never matched: this line said `INTERVAL '7 days'`, read out of the live
  -- object rather than from a migration.
  --
  -- 🔑 THIS IS THE ONLY PLACE THE WINDOW IS DECIDED. Every screen that states it
  -- reads `LOCK_ANSWER_WINDOW_HOURS` in apps/web/lib/lock-request-state.ts, and
  -- `the-answer-window-is-48-hours.db.test.ts` fails if that constant and this
  -- interval ever disagree — because a rule the database enforces and a sentence
  -- the product prints are two copies of one number, and two copies drift.
  IF NEW.lock_request_state = 'pending'
     AND (TG_OP = 'INSERT' OR OLD.lock_request_state IS DISTINCT FROM 'pending')
  THEN
    NEW.lock_request_expires_at :=
      COALESCE(NEW.lock_requested_at, NOW()) + INTERVAL '48 hours';
    -- ⚠ THE NUDGE STAMP RESETS HERE, BESIDE THE DEADLINE, ON PURPOSE.
    -- nudge_stale_lock_requests selects on IS NULL. Without this line the stamp
    -- survives the round that set it, and every re-ask on the same booking is
    -- permanently un-nudgeable — the reminder would hold for exactly one round
    -- per booking and fail silently thereafter.
    NEW.lock_request_nudged_at := NULL;
  END IF;

  RETURN NEW;
END;
$guard$;

COMMENT ON FUNCTION public.guard_event_vendor_lock_handshake() IS
  'BEFORE INSERT OR UPDATE guard on event_vendors. (1) Rejects any authenticated/anon write to the VENDOR''s lock answer (lock_agreed_at, lock_declined_at, lock_decline_reason, lock_answered_by_user_id, lock_request_nudged_at) or any direct flip of lock_request_state to agreed/declined/expired. (2) COHERENCE, not forgery-proofing: refuses a move INTO a confirmed status while lock_request_state = ''pending''. This is NOT a forgery guard and must not be described as one: the shipped machine deliberately lets a couple write ''cancelled'', so cancel-then-book walks past it. (3) Materializes lock_request_expires_at = requested_at + 48 HOURS -- owner ruling 2026-08-28, restoring the 2026-06-02 lock''s own figure, which the code had never matched (it was 7 days) -- and resets lock_request_nudged_at, on every transition into pending, so a second ask gets a fresh deadline and a fresh reminder. THE WINDOW IS DECIDED HERE AND NOWHERE ELSE; apps/web/lib/lock-request-state.ts mirrors it as LOCK_ANSWER_WINDOW_HOURS for the copy, and a db test fails if the two disagree.';

COMMENT ON COLUMN public.event_vendors.lock_request_expires_at IS
  'The MATERIALIZED deadline for a pending lock request: lock_requested_at + 48 hours, stamped by guard_event_vendor_lock_handshake on every transition INTO pending (owner 2026-08-28; it was 7 days). Materialized rather than recomputed so the number shown to a supplier is the number enforced, and so a row stamped under an older rule keeps the window it was actually given.';

-- ----------------------------------------------------------------------------
-- 2 · The reminder follows the window.
--
--     🔑 CREATE OR REPLACE MAY CHANGE A DEFAULT BUT NOT A PARAMETER NAME, so
--     `p_days` stays `p_days` and simply defaults to 1. Renaming it to p_hours
--     would need a DROP, which would break the named-argument call site for the
--     length of a deploy — and `rpc-argument-names.db.test.ts` exists because a
--     PostgREST call naming an argument the function does not have is REJECTED,
--     NOT THROWN.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.nudge_stale_lock_requests(
  p_days  INTEGER DEFAULT 1,
  p_limit INTEGER DEFAULT 200
)
RETURNS TABLE (
  event_vendor_id      UUID,
  event_id             UUID,
  marketplace_vendor_id UUID,
  requested_at         TIMESTAMPTZ,
  expires_at           TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $nudge$
BEGIN
  RETURN QUERY
  WITH due AS (
    SELECT ev.vendor_id
      FROM public.event_vendors ev
     WHERE ev.lock_request_state = 'pending'
       AND ev.lock_request_nudged_at IS NULL
       AND ev.archived_at IS NULL
       AND ev.lock_requested_at IS NOT NULL
       AND ev.lock_requested_at <= NOW() - make_interval(days => p_days)
       -- ⚠ THIS LINE IS WHY THE DEFAULT HAD TO MOVE. A reminder due AFTER the
       -- deadline can never satisfy it, so the job would match nothing and
       -- report success forever.
       AND (ev.lock_request_expires_at IS NULL OR ev.lock_request_expires_at > NOW())
       AND ev.status NOT IN ('contracted', 'deposit_paid', 'delivered', 'complete')
     ORDER BY ev.lock_requested_at
     LIMIT p_limit
     FOR UPDATE SKIP LOCKED
  )
  UPDATE public.event_vendors t
     SET lock_request_nudged_at = NOW(),
         updated_at             = NOW()
    FROM due
   WHERE t.vendor_id = due.vendor_id
  RETURNING t.vendor_id, t.event_id, t.marketplace_vendor_id,
            t.lock_requested_at, t.lock_request_expires_at;
END;
$nudge$;

REVOKE ALL ON FUNCTION public.nudge_stale_lock_requests(INTEGER, INTEGER) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.nudge_stale_lock_requests(INTEGER, INTEGER) FROM anon;
REVOKE ALL ON FUNCTION public.nudge_stale_lock_requests(INTEGER, INTEGER) FROM authenticated;

COMMENT ON FUNCTION public.nudge_stale_lock_requests(INTEGER, INTEGER) IS
  'One reminder per request round to a supplier sitting on a booking ask. Fires at lock_requested_at + p_days (DEFAULT 1, owner 2026-08-28 -- it was 5, which is 72 hours past a 48-hour deadline and could therefore never satisfy this function''s own `expires_at > NOW()` clause: the job would have matched nothing and reported success forever). Selects on lock_request_nudged_at IS NULL so it fires once per round; the guard trigger clears that stamp on every transition into pending. ⚠ NOT GUARANTEED: the sweep is traffic-driven with a 20-hour floor, so if page traffic goes quiet for more than a day a request can expire unwarned. That is a property of a cron-free sweep, not of this threshold.';
