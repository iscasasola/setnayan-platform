-- ============================================================================
-- A SUPPLIER YOU HAVE PAID CAN AGREE TO THE DELETION.
--
-- Owner, 2026-08-21: "when a user decides to delete an event and they paid
-- vendors. they can only delete it if the vendors with paid purchase accepts
-- that this deletion."
--
-- Shipped 2026-08-21 (PR #4632): a paid, unreleased supplier BLOCKS the delete.
-- That is the safe half. This is the way through — the ask, and the answer.
--
-- ── MIRRORS THE LOCK HANDSHAKE, DELIBERATELY ────────────────────────────────
-- Owner: "we already have the full handshake plan for this." He is right. The
-- lock handshake (20271107090000 · 20271143289546 · 20271144258091) is the
-- shape: a TEXT state machine on event_vendors, SECURITY DEFINER RPCs the
-- browser cannot forge, and a cancel path for the asker. This reproduces that
-- shape rather than inventing a second one.
--
-- ⚠ SEPARATE COLUMNS, NOT THE LOCK ONES. A booking can be locked AND carry a
-- pending deletion ask at the same time — they are different questions about
-- the same row, and overloading lock_request_state would make "agreed" mean two
-- things. The lock machine is untouched.
--
-- 🔑 OWNERSHIP IS NARROWED THE WAY vendor_agree_to_lock LEARNED TO BE.
-- current_vendor_event_vendor_ids() has an arm matching on event_vendors
-- .service_id — a column the COUPLE can write, with no constraint tying it to
-- marketplace_vendor_id. That RPC's own comment states the rule: "when an RPC
-- becomes the sole authority for a booking, its ownership predicate may not key
-- on a column the counterparty controls." The same applies here, harder: the
-- counterparty is the person asking to delete. Keying on service_id would let a
-- couple answer on their supplier's behalf.
-- ============================================================================

BEGIN;

ALTER TABLE public.event_vendors
  ADD COLUMN IF NOT EXISTS delete_request_state        TEXT,
  ADD COLUMN IF NOT EXISTS delete_requested_at         TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS delete_requested_by_user_id UUID,
  ADD COLUMN IF NOT EXISTS delete_answered_at          TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS delete_answered_by_user_id  UUID,
  ADD COLUMN IF NOT EXISTS delete_decline_reason       TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conrelid = 'public.event_vendors'::regclass
       AND conname  = 'event_vendors_delete_request_state_chk'
  ) THEN
    ALTER TABLE public.event_vendors
      ADD CONSTRAINT event_vendors_delete_request_state_chk
      CHECK (delete_request_state IS NULL
             OR delete_request_state IN ('pending','agreed','declined','cancelled'));
  END IF;
END $$;

COMMENT ON COLUMN public.event_vendors.delete_request_state IS
  'The couple has asked this PAID supplier to agree to deleting the celebration. '
  'NULL = never asked. pending/agreed/declined/cancelled. Written only by the '
  'four SECURITY DEFINER RPCs below — never by a session client. Separate from '
  'lock_request_state on purpose: a booking can be locked AND have a pending '
  'deletion ask, and they are different questions.';

-- 🔒 "THE ROW IS YOURS, THE FIELD IS NOT" — ENFORCED BY A TRIGGER, NOT A REVOKE.
--
-- 🪤 THE FIRST CUT USED `REVOKE UPDATE (cols)` AND IT WAS COMPLETELY INERT.
-- `authenticated` holds TABLE-LEVEL UPDATE on event_vendors, and a column-level
-- revoke cannot subtract from a table-level grant — `has_column_privilege`
-- kept returning TRUE for every revoked column. The db test caught it. Taking
-- the table grant away instead would mean re-granting ~50 columns the couple
-- legitimately writes, and that list is a bill somebody keeps paying.
--
-- So: a trigger, which is what this repo's own rule prescribes — "trigger when
-- the value must exist but the browser must not choose it". Mirrors
-- `guard_event_vendor_lock_handshake()` one-for-one, including its hardest-won
-- detail:
--
-- ⚠ INSERT IS GUARDED TOO. `event_vendors_couple_write` is FOR ALL with no
-- column list, so without this a couple could INSERT a row BORN 'agreed' and
-- manufacture their supplier's consent — the supplier never sees an ask, the
-- row simply exists as though they had said yes. A couple may create a row that
-- is NULL (never asked) or 'pending' (they are asking). Nothing further along.
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
      THEN
        RAISE EXCEPTION
          'the deletion handshake is written only by its own functions'
          USING ERRCODE = '42501';
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END $guard$;

DROP TRIGGER IF EXISTS event_vendors_guard_delete_handshake ON public.event_vendors;
CREATE TRIGGER event_vendors_guard_delete_handshake
  BEFORE INSERT OR UPDATE ON public.event_vendors
  FOR EACH ROW
  EXECUTE FUNCTION public.guard_event_vendor_delete_handshake();

-- ── THE ASK ────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.request_event_deletion(p_event_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_asked INTEGER;
BEGIN
  -- Only a COUPLE member may ask — the same narrow gate deleteOwnEvent uses.
  -- A co-host may tidy the list; a co-host may not start a process that ends in
  -- somebody else's wedding being destroyed.
  IF NOT EXISTS (
    SELECT 1 FROM public.event_members m
     WHERE m.event_id = p_event_id
       AND m.user_id = auth.uid()
       AND m.member_type = 'couple'
  ) AND NOT public.is_admin() THEN
    RAISE EXCEPTION 'not_your_event' USING ERRCODE = '42501';
  END IF;

  /*
    Ask only the suppliers who are actually HOLDING the delete: paid, and not
    released. Asking a supplier who was never paid would be noise, and asking a
    released one would re-open a question the owner's rule already answered
    ("if the event is already completed and they have completed their service
    for that event, the user can delete it anytime").

    Re-asking is idempotent for a pending row and RE-OPENS a declined one — a
    couple may legitimately ask again after talking to their supplier. An
    'agreed' row is left alone: an answer already given is not re-asked.
  */
  UPDATE public.event_vendors ev
     SET delete_request_state        = 'pending',
         delete_requested_at         = now(),
         delete_requested_by_user_id = auth.uid(),
         delete_answered_at          = NULL,
         delete_answered_by_user_id  = NULL,
         delete_decline_reason       = NULL,
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

-- ── THE ANSWER ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.vendor_answer_event_deletion(
  p_event_vendor_id UUID,
  p_agree           BOOLEAN,
  p_reason          TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_state TEXT;
  v_rows  INTEGER;
BEGIN
  -- 🔑 NARROWED: marketplace_vendor_id ONLY. See the header — service_id is a
  -- column the COUPLE can write, so an ownership arm keyed on it would let the
  -- asker answer for the supplier.
  IF NOT EXISTS (
    SELECT 1 FROM public.event_vendors ev
     WHERE ev.vendor_id = p_event_vendor_id
       AND ev.marketplace_vendor_id IN (SELECT public.current_vendor_profile_ids())
  ) AND NOT public.is_admin() THEN
    RAISE EXCEPTION 'not_your_booking' USING ERRCODE = '42501';
  END IF;

  SELECT delete_request_state INTO v_state
    FROM public.event_vendors WHERE vendor_id = p_event_vendor_id;

  -- Only a PENDING ask can be answered. Answering a cancelled or already-
  -- answered one would let a stale screen overwrite a settled decision.
  IF coalesce(v_state, '') <> 'pending' THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'no_pending_request');
  END IF;

  UPDATE public.event_vendors
     SET delete_request_state       = CASE WHEN p_agree THEN 'agreed' ELSE 'declined' END,
         delete_answered_at         = now(),
         delete_answered_by_user_id = auth.uid(),
         delete_decline_reason      = CASE WHEN p_agree THEN NULL
                                           ELSE nullif(trim(coalesce(p_reason, '')), '') END,
         updated_at                 = now()
   WHERE vendor_id = p_event_vendor_id
     AND delete_request_state = 'pending';

  GET DIAGNOSTICS v_rows = ROW_COUNT;
  RETURN jsonb_build_object('ok', v_rows > 0,
                            'state', CASE WHEN p_agree THEN 'agreed' ELSE 'declined' END);
END $$;

-- ── THE INVERSE ────────────────────────────────────────────────────────────
-- 🔑 A FORWARD PRIMITIVE WITH NO INVERSE is a defect this repo has paid for more
-- than once — most recently cancel_vendor_lock_request(), which was granted,
-- commented, db-tested and had ZERO CALLERS for its whole life, so a couple
-- could not un-ask. This ships beside the ask, and the app calls it.
CREATE OR REPLACE FUNCTION public.cancel_event_deletion_request(p_event_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_rows INTEGER;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.event_members m
     WHERE m.event_id = p_event_id
       AND m.user_id = auth.uid()
       AND m.member_type = 'couple'
  ) AND NOT public.is_admin() THEN
    RAISE EXCEPTION 'not_your_event' USING ERRCODE = '42501';
  END IF;

  -- Only PENDING asks are withdrawn. An answer already given is the supplier's
  -- record of what they were asked and what they said; the couple does not get
  -- to erase it by changing their mind.
  UPDATE public.event_vendors
     SET delete_request_state = 'cancelled',
         updated_at           = now()
   WHERE event_id = p_event_id
     AND delete_request_state = 'pending';

  GET DIAGNOSTICS v_rows = ROW_COUNT;
  RETURN jsonb_build_object('cancelled', v_rows);
END $$;

-- Trigger-free by design; these are called by the app, so they need EXECUTE.
REVOKE ALL ON FUNCTION public.request_event_deletion(UUID) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.vendor_answer_event_deletion(UUID, BOOLEAN, TEXT) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.cancel_event_deletion_request(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.request_event_deletion(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.vendor_answer_event_deletion(UUID, BOOLEAN, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.cancel_event_deletion_request(UUID) TO authenticated;

COMMIT;
