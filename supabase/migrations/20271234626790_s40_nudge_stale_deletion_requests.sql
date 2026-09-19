-- s40_nudge_stale_deletion_requests
--
-- The deletion-handshake notification quartet (deletion_request_received,
-- deletion_request_nudge, deletion_request_agreed, deletion_request_declined
-- -- owner 2026-08-21, migration 20271151830396) shipped with the first,
-- third and fourth wired (apps/web/app/dashboard/[eventId]/delete-actions.ts
-- and apps/web/app/vendor-dashboard/clients/[eventId]/actions.ts). The
-- second was never wired at all -- a supplier who is asked and never answers
-- gets no reminder, and the couple's celebration stays blocked with nothing
-- prompting the supplier to look again (S26 orphan sweep, notice-no-emitter
-- class; assigned UNCLASSIFIED to S40).
--
-- Modelled directly on nudge_stale_lock_requests (20271143289546 +
-- 20271178407226) -- SAME shape, deliberately: a SECURITY DEFINER sweep RPC
-- that atomically claims due rows (FOR UPDATE SKIP LOCKED), stamps its own
-- nudge column so it fires once per ask round, and returns just enough for
-- the caller to notify. Unlike the lock handshake, a deletion ask has no
-- expiry -- it stays pending until the supplier answers or the couple
-- cancels (request_event_deletion / cancel_event_deletion_request), so this
-- migration ships the nudge half only, no matching expire function.

BEGIN;

-- ----------------------------------------------------------------------------
-- 1. event_vendors.delete_request_nudged_at -- fires once per ask round.
--    Reset by request_event_deletion on every (re-)ask, exactly like
--    lock_request_nudged_at is reset on every transition into pending.
-- ----------------------------------------------------------------------------
ALTER TABLE public.event_vendors
  ADD COLUMN IF NOT EXISTS delete_request_nudged_at TIMESTAMPTZ;

COMMENT ON COLUMN public.event_vendors.delete_request_nudged_at IS
  'Reminder stamp for a pending deletion ask (S40). Set ONLY by nudge_stale_deletion_requests, which selects on delete_request_nudged_at IS NULL so it fires once per ask round. Reset to NULL by request_event_deletion on every (re-)ask -- same shape as lock_request_nudged_at. Writes are neutralized by guard_event_vendor_delete_handshake, exactly like every other handshake column on this table (delete_request_state, delete_requested_at, delete_answered_at, ...) -- a column-level REVOKE of SELECT/INSERT/UPDATE is a documented NO-OP here (20270820292403: table-level GRANT dominates a column-level REVOKE unless the table grant is revoked and re-granted on every other column, which is the fragile approach this codebase deliberately avoids in favor of the trigger). Its exposure-surface footprint (anon=SIU authenticated=SIU) therefore matches its siblings exactly -- accepted in the baseline alongside them, not overlooked.';

-- ⚠ A brand-new column inherits the table-level GRANT by default (measured:
-- exposure-freeze.db.test.ts flagged this exact column SIU to both anon and
-- authenticated the moment it was added, and a column-level REVOKE attempt
-- here proved to be the documented no-op above). Every sibling handshake
-- column on event_vendors already carries this SAME exposure level and is
-- already in the committed baseline -- this one row extends an already-
-- accepted pattern rather than introducing a new one. Write safety is the
-- guard trigger above, not the grant; the read side is a single low-
-- sensitivity timestamp on a row whose other, more sensitive columns
-- (delete_requested_at, amounts via total_cost_php, etc.) are already at the
-- same exposure level. Baseline regenerated in this PR
-- (`pnpm --filter @setnayan/web exposure:baseline`) -- see the diff in
-- supabase/security/exposure-surface.baseline.txt.

-- ----------------------------------------------------------------------------
-- 2. Protect the new column the same way the rest of the handshake is
--    protected: CREATE OR REPLACE the existing guard trigger function to add
--    it to the UPDATE branch's protected-column list. Everything else in the
--    function is unchanged.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.guard_event_vendor_delete_handshake()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $guard$
BEGIN
  IF current_user IN ('authenticated', 'anon') THEN
    IF TG_OP = 'INSERT' THEN
      IF NEW.delete_answered_at IS NOT NULL
         OR NEW.delete_answered_by_user_id IS NOT NULL
         OR NEW.delete_decline_reason IS NOT NULL
         OR NEW.delete_request_nudged_at IS NOT NULL
         OR NEW.delete_request_state IN ('agreed', 'declined')
      THEN
        RAISE EXCEPTION
          'a booking cannot be created already carrying the supplier''s deletion answer'
          USING ERRCODE = '42501';
      END IF;

    ELSIF TG_OP = 'UPDATE' THEN
      IF NEW.delete_request_state       IS DISTINCT FROM OLD.delete_request_state
         OR NEW.delete_requested_at     IS DISTINCT FROM OLD.delete_requested_at
         OR NEW.delete_requested_by_user_id
                                        IS DISTINCT FROM OLD.delete_requested_by_user_id
         OR NEW.delete_answered_at      IS DISTINCT FROM OLD.delete_answered_at
         OR NEW.delete_answered_by_user_id
                                        IS DISTINCT FROM OLD.delete_answered_by_user_id
         OR NEW.delete_decline_reason   IS DISTINCT FROM OLD.delete_decline_reason
         OR NEW.delete_request_nudged_at
                                        IS DISTINCT FROM OLD.delete_request_nudged_at
      THEN
        RAISE EXCEPTION
          'the deletion handshake is written only by its own functions'
          USING ERRCODE = '42501';
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END $guard$;

-- ----------------------------------------------------------------------------
-- 3. request_event_deletion -- reset the nudge stamp on every (re-)ask, same
--    place the rest of the answer columns are already reset there.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.request_event_deletion(p_event_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_asked INTEGER;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.event_members m
     WHERE m.event_id = p_event_id
       AND m.user_id = auth.uid()
       AND m.member_type = 'couple'
  ) AND NOT public.is_admin() THEN
    RAISE EXCEPTION 'not_your_event' USING ERRCODE = '42501';
  END IF;

  UPDATE public.event_vendors ev
     SET delete_request_state        = 'pending',
         delete_requested_at         = now(),
         delete_requested_by_user_id = auth.uid(),
         delete_answered_at          = NULL,
         delete_answered_by_user_id  = NULL,
         delete_decline_reason       = NULL,
         delete_request_nudged_at    = NULL,
         updated_at                  = now()
   WHERE ev.event_id = p_event_id
     AND coalesce(ev.delete_request_state, '') NOT IN ('pending', 'agreed')
     AND (
       ev.status = 'deposit_paid'
       OR coalesce(ev.deposit_paid_php, 0) > 0
       OR ev.deposit_recorded_at IS NOT NULL
       OR EXISTS (
         SELECT 1 FROM public.event_vendor_payments p
          WHERE p.vendor_id = ev.vendor_id
       )
     )
     AND NOT (
       coalesce(
         (SELECT e.event_end_date FROM public.events e WHERE e.event_id = p_event_id),
         (SELECT e.event_date     FROM public.events e WHERE e.event_id = p_event_id)
       ) < (now() AT TIME ZONE 'Asia/Manila')::date
       AND (ev.completion_status IN ('confirmed','auto_confirmed')
            OR ev.status IN ('delivered','complete'))
     );

  GET DIAGNOSTICS v_asked = ROW_COUNT;
  RETURN jsonb_build_object('asked', v_asked);
END $$;

-- ----------------------------------------------------------------------------
-- 4. nudge_stale_deletion_requests -- the reminder sweep itself. Mirrors
--    nudge_stale_lock_requests's shape exactly (FOR UPDATE SKIP LOCKED claim,
--    stamp-then-return), minus the expiry half this handshake does not have.
--    DEFAULT 3 days: no owner ruling exists for this window (unlike the
--    lock's 48-hour figure, which is an explicit 2026-08-28 ruling) -- 3 days
--    is a reasonable, clearly-labelled placeholder pending one, chosen so a
--    supplier is reminded well before a couple would reasonably escalate, not
--    derived from any money or legal figure.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.nudge_stale_deletion_requests(
  p_days  INTEGER DEFAULT 3,
  p_limit INTEGER DEFAULT 200
)
RETURNS TABLE (
  event_vendor_id       UUID,
  event_id              UUID,
  marketplace_vendor_id UUID,
  requested_at          TIMESTAMPTZ
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
     WHERE ev.delete_request_state = 'pending'
       AND ev.delete_request_nudged_at IS NULL
       AND ev.delete_requested_at IS NOT NULL
       AND ev.delete_requested_at <= NOW() - make_interval(days => p_days)
     ORDER BY ev.delete_requested_at
     LIMIT p_limit
     FOR UPDATE SKIP LOCKED
  )
  UPDATE public.event_vendors t
     SET delete_request_nudged_at = NOW(),
         updated_at               = NOW()
    FROM due
   WHERE t.vendor_id = due.vendor_id
  RETURNING t.vendor_id, t.event_id, t.marketplace_vendor_id, t.delete_requested_at;
END;
$nudge$;

REVOKE ALL ON FUNCTION public.nudge_stale_deletion_requests(INTEGER, INTEGER) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.nudge_stale_deletion_requests(INTEGER, INTEGER) FROM anon;
REVOKE ALL ON FUNCTION public.nudge_stale_deletion_requests(INTEGER, INTEGER) FROM authenticated;

COMMENT ON FUNCTION public.nudge_stale_deletion_requests(INTEGER, INTEGER) IS
  'One reminder per ask round to a supplier sitting on a couple''s deletion request. Fires at delete_requested_at + p_days (DEFAULT 3 -- a placeholder, no owner ruling exists for this window). Selects on delete_request_nudged_at IS NULL so it fires once per round; request_event_deletion clears that stamp on every (re-)ask. No matching expiry: unlike the lock handshake, a deletion ask never auto-closes.';

COMMIT;
