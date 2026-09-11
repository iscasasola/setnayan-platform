/*
  A DEPOSIT REFUSAL SURVIVES A RE-SEND — the history Setnayan can see.
  Register "FOLLOW-UPS A" item 1 (found in H4, #5443).

  ── THE HOLE ───────────────────────────────────────────────────────────────
  guard_event_vendor_deposit_ack let a SESSION clear the supplier's refusal
  (deposit_declined_*) and Setnayan's ruling (deposit_dispute_*), because the
  couple's re-send (recordDeposit) clears them through the couple's own session.
  So re-sending took the dispute off /admin/disputes with no trace: the
  supplier's words and any ruling on them were gone — and any couple could do the
  same with one PATCH to /rest/v1/event_vendors.

  ── THE FIX ────────────────────────────────────────────────────────────────
  The re-send stays (the deposit's deliberate design). What changes:
   1. event_vendor_deposit_refusals — one history row per refusal that ENDS,
      whatever ends it: the couple sends it again, the supplier confirms after
      all, Setnayan rules the payment stands, or the booking row is deleted.
      Written by ONE SECURITY DEFINER trigger on event_vendors, never a session:
      RLS on, no policies, no grant to anon or authenticated. /admin/disputes
      reads it on the service client.
   2. resend_vendor_deposit(p_event_vendor_id, p_actor_user_id) — the re-send's
      clear, SERVER-ONLY (service_role). recordDeposit calls it with the admin
      client AFTER its own couple/coordinator authorization. It marks the
      transaction so the history row says "couple_resent" and who.
   3. guard_event_vendor_deposit_ack — re-signed from its LIVE production body
      (md5 equal to pg_get_functiondef on prod, 2026-09-11), changed ONLY in
      the two clearing clauses and their comment (line-hash diff in the PR): a
      session may no longer CLEAR the seven columns. Setting was already refused.

  ── WHY THE HISTORY HAS NO FOREIGN KEY ─────────────────────────────────────
  A history that cascades away with its booking would erase itself in exactly
  the case it exists for. event_vendor_id, event_id and vendor_name are
  snapshots; the row stands on its own.

  🔢 Prod 2026-09-11 (read-only): 0 bookings with a recorded deposit, 0 refused.
  Nothing to backfill.

  Guards: apps/web/tests/db/a-deposit-refusal-survives-a-resend.db.test.ts ·
  apps/web/lib/the-couple-keeps-their-record.test.ts.
*/

-- ─────────────────────────────────────────────────────────────────────────────
-- 1 · The history.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.event_vendor_deposit_refusals (
  refusal_id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_vendor_id             UUID NOT NULL,
  event_id                    UUID,
  vendor_name                 TEXT,
  refused_at                  TIMESTAMPTZ NOT NULL,
  reason                      TEXT,
  refused_by_user_id          UUID,
  dispute_settled_at          TIMESTAMPTZ,
  dispute_outcome             TEXT,
  dispute_note                TEXT,
  dispute_settled_by_user_id  UUID,
  closed_at                   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  closed_by                   TEXT NOT NULL,
  closed_by_user_id           UUID,
  CONSTRAINT event_vendor_deposit_refusals_outcome_check
    CHECK (dispute_outcome IS NULL OR dispute_outcome IN ('payment_stands', 'not_received')),
  CONSTRAINT event_vendor_deposit_refusals_closed_by_check
    CHECK (closed_by IN ('couple_resent', 'supplier_confirmed', 'setnayan_ruled_it_stands',
                         'booking_deleted', 'cleared_by_service'))
);

CREATE INDEX IF NOT EXISTS event_vendor_deposit_refusals_by_booking
  ON public.event_vendor_deposit_refusals (event_vendor_id, closed_at DESC);
CREATE INDEX IF NOT EXISTS event_vendor_deposit_refusals_by_closure
  ON public.event_vendor_deposit_refusals (closed_by, closed_at DESC);

ALTER TABLE public.event_vendor_deposit_refusals ENABLE ROW LEVEL SECURITY;
-- No policies: no session reads or writes it. /admin/disputes reads it on the
-- service client; only the trigger below writes it.
REVOKE ALL ON TABLE public.event_vendor_deposit_refusals FROM PUBLIC, anon, authenticated;

COMMENT ON TABLE public.event_vendor_deposit_refusals IS
  'Every supplier refusal of a couple''s DEPOSIT that has ended, and how it ended '
  '(couple_resent · supplier_confirmed · setnayan_ruled_it_stands · booking_deleted '
  '· cleared_by_service), with Setnayan''s ruling if there was one. Written only by '
  'archive_deposit_refusal() (SECURITY DEFINER trigger on event_vendors); never by a '
  'session. No foreign key on purpose: the history must outlive the booking row. '
  'Read by /admin/disputes on the service client. FOLLOW-UPS A, 20271223918326.';

-- ─────────────────────────────────────────────────────────────────────────────
-- 2 · The one writer: whenever a refusal ends, it is archived first.
--
-- `closed_by` is exact for the re-send — resend_vendor_deposit marks the
-- transaction — and inferred from the new row for the other two definer paths:
-- acknowledge_vendor_deposit sets deposit_acknowledged_at; settle_vendor_
-- deposit_dispute('payment_stands') sets it AND the outcome. Anything else that
-- clears a refusal (service_role tooling) is recorded as cleared_by_service.
-- The settlement is COALESCE(OLD, NEW): 'not_received' sits on OLD beside the
-- refusal it describes; 'payment_stands' arrives on NEW in the same statement.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.archive_deposit_refusal()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_marker    TEXT := NULLIF(current_setting('setnayan.deposit_refusal_closed_by', true), '');
  v_actor     TEXT := NULLIF(current_setting('setnayan.deposit_refusal_closed_by_user', true), '');
  v_closed_by TEXT;
BEGIN
  IF TG_OP = 'DELETE' THEN
    v_closed_by := 'booking_deleted';
    INSERT INTO public.event_vendor_deposit_refusals
      (event_vendor_id, event_id, vendor_name, refused_at, reason, refused_by_user_id,
       dispute_settled_at, dispute_outcome, dispute_note, dispute_settled_by_user_id,
       closed_by, closed_by_user_id)
    VALUES
      (OLD.vendor_id, OLD.event_id, OLD.vendor_name, OLD.deposit_declined_at,
       OLD.deposit_decline_reason, OLD.deposit_declined_by_user_id,
       OLD.deposit_dispute_settled_at, OLD.deposit_dispute_outcome, OLD.deposit_dispute_note,
       OLD.deposit_dispute_settled_by_user_id,
       v_closed_by, auth.uid());
    RETURN NULL;
  END IF;

  v_closed_by := COALESCE(
    v_marker,
    CASE
      WHEN NEW.deposit_acknowledged_at IS NOT NULL
           AND NEW.deposit_dispute_outcome = 'payment_stands' THEN 'setnayan_ruled_it_stands'
      WHEN NEW.deposit_acknowledged_at IS NOT NULL THEN 'supplier_confirmed'
      ELSE 'cleared_by_service'
    END);

  INSERT INTO public.event_vendor_deposit_refusals
    (event_vendor_id, event_id, vendor_name, refused_at, reason, refused_by_user_id,
     dispute_settled_at, dispute_outcome, dispute_note, dispute_settled_by_user_id,
     closed_by, closed_by_user_id)
  VALUES
    (OLD.vendor_id, OLD.event_id, OLD.vendor_name, OLD.deposit_declined_at,
     OLD.deposit_decline_reason, OLD.deposit_declined_by_user_id,
     COALESCE(OLD.deposit_dispute_settled_at, NEW.deposit_dispute_settled_at),
     COALESCE(OLD.deposit_dispute_outcome, NEW.deposit_dispute_outcome),
     COALESCE(OLD.deposit_dispute_note, NEW.deposit_dispute_note),
     COALESCE(OLD.deposit_dispute_settled_by_user_id, NEW.deposit_dispute_settled_by_user_id),
     v_closed_by, COALESCE(v_actor::uuid, auth.uid()));
  RETURN NULL;
END;
$function$;

REVOKE ALL ON FUNCTION public.archive_deposit_refusal() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_archive_deposit_refusal ON public.event_vendors;
CREATE TRIGGER trg_archive_deposit_refusal
  AFTER UPDATE OF deposit_declined_at ON public.event_vendors
  FOR EACH ROW
  WHEN (OLD.deposit_declined_at IS NOT NULL
        AND NEW.deposit_declined_at IS DISTINCT FROM OLD.deposit_declined_at)
  EXECUTE FUNCTION public.archive_deposit_refusal();

DROP TRIGGER IF EXISTS trg_archive_deposit_refusal_on_delete ON public.event_vendors;
CREATE TRIGGER trg_archive_deposit_refusal_on_delete
  AFTER DELETE ON public.event_vendors
  FOR EACH ROW
  WHEN (OLD.deposit_declined_at IS NOT NULL)
  EXECUTE FUNCTION public.archive_deposit_refusal();

-- ─────────────────────────────────────────────────────────────────────────────
-- 3 · The re-send's clear, server-only.
--
-- Only a STANDING refusal is cleared, and its ruling with it — the invariant of
-- 20271177105435: a settlement describes the refusal on the row, so a later
-- refusal must open a new question. A deposit that was never refused, or was
-- confirmed (a confirmed deposit carries no refusal — the one-way CHECK), is
-- left exactly as it is; a 'payment_stands' ruling on a confirmed deposit is no
-- longer wiped by a re-record, as the old session clear did.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.resend_vendor_deposit(
  p_event_vendor_id uuid,
  p_actor_user_id   uuid
)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_recorded_at TIMESTAMPTZ;
  v_declined_at TIMESTAMPTZ;
BEGIN
  SELECT deposit_recorded_at, deposit_declined_at
    INTO v_recorded_at, v_declined_at
    FROM public.event_vendors
   WHERE vendor_id = p_event_vendor_id
   FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'booking_not_found' USING ERRCODE = 'P0002';
  END IF;
  IF v_recorded_at IS NULL THEN
    RETURN jsonb_build_object('status', 'not_recorded');
  END IF;
  IF v_declined_at IS NULL THEN
    RETURN jsonb_build_object('status', 'no_refusal');
  END IF;

  PERFORM set_config('setnayan.deposit_refusal_closed_by', 'couple_resent', true);
  PERFORM set_config('setnayan.deposit_refusal_closed_by_user', COALESCE(p_actor_user_id::text, ''), true);

  UPDATE public.event_vendors
     SET deposit_declined_at                = NULL,
         deposit_decline_reason             = NULL,
         deposit_declined_by_user_id        = NULL,
         deposit_dispute_settled_at         = NULL,
         deposit_dispute_outcome            = NULL,
         deposit_dispute_note               = NULL,
         deposit_dispute_settled_by_user_id = NULL,
         updated_at                         = NOW()
   WHERE vendor_id = p_event_vendor_id
     AND deposit_declined_at IS NOT NULL;

  -- The marker is for THIS clear only.
  PERFORM set_config('setnayan.deposit_refusal_closed_by', '', true);
  PERFORM set_config('setnayan.deposit_refusal_closed_by_user', '', true);

  RETURN jsonb_build_object('status', 'ok');
END;
$function$;

REVOKE ALL ON FUNCTION public.resend_vendor_deposit(uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.resend_vendor_deposit(uuid, uuid) TO service_role;

COMMENT ON FUNCTION public.resend_vendor_deposit(uuid, uuid) IS
  'The couple sends their deposit again: clears the supplier''s standing refusal '
  'and any ruling on it, after archive_deposit_refusal() has written them to '
  'event_vendor_deposit_refusals as couple_resent. Server-only (service_role) — '
  'recordDeposit calls it after authorizing the couple or coordinator. FOLLOW-UPS A.';

-- ─────────────────────────────────────────────────────────────────────────────
-- 4 · The guard — live body, the two clearing clauses closed (see header).
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.guard_event_vendor_deposit_ack()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  -- Only the SECURITY DEFINER RPCs (they run as owner 'postgres') and the
  -- service_role admin client may write the SUPPLIER's own answer. A direct
  -- couple/guest PostgREST write (role authenticated/anon) cannot forge it —
  -- on EITHER verb.
  IF current_user IN ('authenticated', 'anon') THEN
    IF TG_OP = 'INSERT' THEN
      IF NEW.deposit_acknowledged_at IS NOT NULL THEN
        RAISE EXCEPTION 'deposit_acknowledged_at is vendor-set only (via acknowledge_vendor_deposit)'
          USING ERRCODE = '42501';
      END IF;
      IF NEW.deposit_declined_at IS NOT NULL
         OR NEW.deposit_decline_reason IS NOT NULL
         OR NEW.deposit_declined_by_user_id IS NOT NULL THEN
        RAISE EXCEPTION 'the deposit refusal is vendor-set only (via reject_vendor_deposit)'
          USING ERRCODE = '42501';
      END IF;
      IF NEW.deposit_dispute_settled_at IS NOT NULL
         OR NEW.deposit_dispute_outcome IS NOT NULL
         OR NEW.deposit_dispute_note IS NOT NULL
         OR NEW.deposit_dispute_settled_by_user_id IS NOT NULL THEN
        RAISE EXCEPTION 'the deposit dispute settlement is Setnayan-set only (via settle_vendor_deposit_dispute)'
          USING ERRCODE = '42501';
      END IF;
    ELSE
      IF NEW.deposit_acknowledged_at IS DISTINCT FROM OLD.deposit_acknowledged_at THEN
        RAISE EXCEPTION 'deposit_acknowledged_at is vendor-set only (via acknowledge_vendor_deposit)'
          USING ERRCODE = '42501';
      END IF;
      -- SET is forgery; CLEARING is erasure — a re-send goes through resend_vendor_deposit.
      IF NEW.deposit_declined_at IS DISTINCT FROM OLD.deposit_declined_at
         OR NEW.deposit_decline_reason IS DISTINCT FROM OLD.deposit_decline_reason
         OR NEW.deposit_declined_by_user_id IS DISTINCT FROM OLD.deposit_declined_by_user_id THEN
        RAISE EXCEPTION 'the deposit refusal is vendor-set only (via reject_vendor_deposit)'
          USING ERRCODE = '42501';
      END IF;
      -- Same rule, same reason, for the referee's decision.
      IF NEW.deposit_dispute_settled_at IS DISTINCT FROM OLD.deposit_dispute_settled_at
         OR NEW.deposit_dispute_outcome IS DISTINCT FROM OLD.deposit_dispute_outcome
         OR NEW.deposit_dispute_note IS DISTINCT FROM OLD.deposit_dispute_note
         OR NEW.deposit_dispute_settled_by_user_id IS DISTINCT FROM OLD.deposit_dispute_settled_by_user_id THEN
        RAISE EXCEPTION 'the deposit dispute settlement is Setnayan-set only (via settle_vendor_deposit_dispute)'
          USING ERRCODE = '42501';
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;
