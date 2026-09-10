/*
  A PAYMENT CAN BE REFUSED TOO — "Not received" for every payment the couple
  logs. Register session H4.

  ⚖ OWNER, 2026-09-11 (DECISION_LOG "NOT RECEIVED USES ONE PATH FOR EVERY
  PAYMENT"; the owner chose the recommendation): the deposit keeps its existing
  path; installments get the same one, refereed on the same disputes page; and
  confirming a deposit in the chat also confirms it on the booking, so the two
  can never disagree.

  ── WHAT WAS ALREADY TRUE (do not rebuild it) ────────────────────────────────
  The DEPOSIT has the whole path, on `event_vendors`: reject_vendor_deposit →
  /admin/disputes → settle_vendor_deposit_dispute, fenced by
  guard_event_vendor_deposit_ack (20271175634994, 20271177105435). The deposit is
  ALSO an `event_vendor_payments` row — both deposit writers in
  app/dashboard/[eventId]/vendors/actions.ts insert one — and
  confirm_vendor_payment stamped only that row, never deposit_acknowledged_at.
  So one sum carried two independent supplier answers, linked by nothing but a
  notes string. INSTALLMENTS HAD NO REFUSAL AT ALL.

  ── WHAT THIS ADDS ───────────────────────────────────────────────────────────
  1. `is_deposit_record` — WHICH ledger row is the deposit, stamped once, at
     insert, by the database (§ 2). Everything below routes on it.
  2. The deposit's refusal + settlement columns, MIRRORED onto the ledger for
     installments (§ 1), fenced by the ledger's guard (§ 3).
  3. refuse_vendor_payment (§ 4): a deposit row DELEGATES to
     reject_vendor_deposit — there is never a second refusal path for the same
     money; an installment row gets the mirrored refusal.
  4. confirm_vendor_payment (§ 5): confirming the deposit's row also
     acknowledges the deposit; confirming an installment clears its refusal.
  5. The other direction (§ 6): whenever the deposit is acknowledged — from the
     deposit card, or by Setnayan settling "the payment stands" — its ledger row
     is confirmed with it. The two answers stop drifting in BOTH directions.
  6. settle_vendor_payment_dispute (§ 7): Setnayan referees an installment by
     hand, exactly as it referees the deposit.

  ── THE ONE INVARIANT, INHERITED FROM THE DEPOSIT ────────────────────────────
  🔑 THE SETTLEMENT DESCRIBES THE REFUSAL CURRENTLY ON THE ROW. Every writer of
  the refusal also writes the settlement, so a SECOND refusal is a new question
  for the queue, never one that inherits a stale "already settled".

  🔢 SAFE BY ARITHMETIC, read out of prod 2026-09-11 (read-only):
     3 event_vendor_payments rows, all unconfirmed · 0 carrying either deposit
     note · 0 bookings with a deposit recorded, acknowledged or declined.
     Nothing is mid-dispute and nothing has drifted.

  🔒 EXPOSURE, COUNTED: `event_vendor_payments` is granted at TABLE level
  (SIUD to anon + authenticated), so the new columns are granted automatically —
  a column-level REVOKE would be inert. The read audience is unchanged: every
  policy on the table names {authenticated} only, so anon reaches ZERO rows.
  The couple and the booked supplier already read the rows these columns sit on.

  Guards: apps/web/tests/db/a-payment-can-be-refused-too.db.test.ts ·
  apps/web/lib/a-payment-can-be-refused-too.test.ts.
*/

-- ─────────────────────────────────────────────────────────────────────────────
-- 1 · The columns. One ALTER per column.
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.event_vendor_payments
  ADD COLUMN IF NOT EXISTS is_deposit_record BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE public.event_vendor_payments
  ADD COLUMN IF NOT EXISTS payment_refused_at TIMESTAMPTZ;
ALTER TABLE public.event_vendor_payments
  ADD COLUMN IF NOT EXISTS payment_refusal_reason TEXT;
ALTER TABLE public.event_vendor_payments
  ADD COLUMN IF NOT EXISTS payment_refused_by_user_id UUID;
ALTER TABLE public.event_vendor_payments
  ADD COLUMN IF NOT EXISTS payment_dispute_settled_at TIMESTAMPTZ;
ALTER TABLE public.event_vendor_payments
  ADD COLUMN IF NOT EXISTS payment_dispute_outcome TEXT;
ALTER TABLE public.event_vendor_payments
  ADD COLUMN IF NOT EXISTS payment_dispute_note TEXT;
ALTER TABLE public.event_vendor_payments
  ADD COLUMN IF NOT EXISTS payment_dispute_settled_by_user_id UUID;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint
                  WHERE conrelid = 'public.event_vendor_payments'::regclass
                    AND conname = 'event_vendor_payments_dispute_outcome_check') THEN
    ALTER TABLE public.event_vendor_payments
      ADD CONSTRAINT event_vendor_payments_dispute_outcome_check
      CHECK (payment_dispute_outcome IS NULL
             OR payment_dispute_outcome IN ('payment_stands', 'not_received'));
  END IF;
  -- The supplier's answer is ONE of the two, never both — the ledger's copy of
  -- event_vendors_deposit_answer_is_one_way.
  IF NOT EXISTS (SELECT 1 FROM pg_constraint
                  WHERE conrelid = 'public.event_vendor_payments'::regclass
                    AND conname = 'event_vendor_payments_answer_is_one_way') THEN
    ALTER TABLE public.event_vendor_payments
      ADD CONSTRAINT event_vendor_payments_answer_is_one_way
      CHECK (vendor_confirmed_at IS NULL OR payment_refused_at IS NULL);
  END IF;
  -- ONE PATH: the deposit's refusal lives on event_vendors and nowhere else.
  IF NOT EXISTS (SELECT 1 FROM pg_constraint
                  WHERE conrelid = 'public.event_vendor_payments'::regclass
                    AND conname = 'event_vendor_payments_deposit_refuses_on_the_booking') THEN
    ALTER TABLE public.event_vendor_payments
      ADD CONSTRAINT event_vendor_payments_deposit_refuses_on_the_booking
      CHECK (NOT is_deposit_record
             OR (payment_refused_at IS NULL AND payment_dispute_settled_at IS NULL));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint
                  WHERE conrelid = 'public.event_vendor_payments'::regclass
                    AND conname = 'event_vendor_payments_refusal_text_bounded') THEN
    ALTER TABLE public.event_vendor_payments
      ADD CONSTRAINT event_vendor_payments_refusal_text_bounded
      CHECK ((payment_refusal_reason IS NULL OR length(payment_refusal_reason) <= 240)
         AND (payment_dispute_note IS NULL OR length(payment_dispute_note) <= 500));
  END IF;
END $$;

-- One deposit record per booking.
CREATE UNIQUE INDEX IF NOT EXISTS event_vendor_payments_one_deposit_record
  ON public.event_vendor_payments (vendor_id) WHERE is_deposit_record;
-- The disputes queue reads exactly this.
CREATE INDEX IF NOT EXISTS event_vendor_payments_open_refusals
  ON public.event_vendor_payments (payment_refused_at)
  WHERE payment_refused_at IS NOT NULL AND payment_dispute_settled_at IS NULL;

COMMENT ON COLUMN public.event_vendor_payments.is_deposit_record IS
  'TRUE on the one ledger row the couple''s DEPOSIT wrote (finalizeVendor / '
  'recordDeposit). Stamped by the database at INSERT (stamp_event_vendor_payment_'
  'deposit_record), never by a session. A refusal of this row goes to '
  'reject_vendor_deposit, and confirming it acknowledges the deposit (H4, 2026-09-11).';
COMMENT ON COLUMN public.event_vendor_payments.payment_refused_at IS
  'When the booked supplier said this INSTALLMENT never reached them. A MARK, never '
  'a deletion: the couple''s row, amount, method and receipt all stand. Supplier-set '
  'only via refuse_vendor_payment; cleared by a confirmation or by the couple '
  're-sending. Never on a deposit record — the deposit refuses on event_vendors. '
  'NULL settlement beside a non-NULL refusal is an OPEN dispute on /admin/disputes.';
COMMENT ON COLUMN public.event_vendor_payments.payment_refusal_reason IS
  'The supplier''s own words, shown to the couple, 240 chars. Optional.';
COMMENT ON COLUMN public.event_vendor_payments.payment_dispute_outcome IS
  'payment_stands = Setnayan confirmed the money reached the supplier (the row is '
  'confirmed). not_received = it did not arrive; the refusal stands. Neither deletes '
  'anything the couple sent. Permanent history in admin_audit_log.';
COMMENT ON COLUMN public.event_vendor_payments.payment_dispute_note IS
  'The Setnayan team''s reason, shown to BOTH parties.';

-- ─────────────────────────────────────────────────────────────────────────────
-- 2 · WHICH ROW IS THE DEPOSIT — decided once, by the database.
--
-- Until now the only link was a notes string, matched with LIKE by the old
-- reject_vendor_deposit's ledger DELETE (since removed). The two deposit writers
-- in vendors/actions.ts write these two EXACT notes, and a guard test pins them
-- to this list. A row is the deposit record only when, at the moment it is
-- inserted: its notes are one of the two, the booking already carries
-- deposit_recorded_at (both writers stamp it first), and the booking has no
-- deposit record yet. Whatever a session sends for the column is overwritten.
--
-- ⚠ WHAT THIS DOES NOT CLOSE: the couple authors both their deposit claim and
-- their ledger rows, so they can shape their OWN deposit record however they
-- like. What a supplier confirms is the amount printed on the row they confirm.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.stamp_event_vendor_payment_deposit_record()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  NEW.is_deposit_record :=
        NEW.notes IN ('Downpayment (lock · awaiting vendor confirmation)',
                      'Deposit (date held · awaiting vendor confirmation)')
    AND EXISTS (SELECT 1 FROM public.event_vendors v
                 WHERE v.vendor_id = NEW.vendor_id
                   AND v.deposit_recorded_at IS NOT NULL)
    AND NOT EXISTS (SELECT 1 FROM public.event_vendor_payments p
                     WHERE p.vendor_id = NEW.vendor_id
                       AND p.is_deposit_record);
  RETURN NEW;
END;
$function$;

REVOKE ALL ON FUNCTION public.stamp_event_vendor_payment_deposit_record() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_stamp_event_vendor_payment_deposit_record ON public.event_vendor_payments;
CREATE TRIGGER trg_stamp_event_vendor_payment_deposit_record
  BEFORE INSERT ON public.event_vendor_payments
  FOR EACH ROW EXECUTE FUNCTION public.stamp_event_vendor_payment_deposit_record();

-- Rows written before this migration (0 in prod; any in a dev database): the
-- first deposit-noted row per booking that already carries a recorded deposit.
UPDATE public.event_vendor_payments p
   SET is_deposit_record = TRUE
  FROM (
    SELECT DISTINCT ON (p2.vendor_id) p2.payment_id
      FROM public.event_vendor_payments p2
      JOIN public.event_vendors v ON v.vendor_id = p2.vendor_id
     WHERE p2.notes IN ('Downpayment (lock · awaiting vendor confirmation)',
                        'Deposit (date held · awaiting vendor confirmation)')
       AND v.deposit_recorded_at IS NOT NULL
       AND NOT EXISTS (SELECT 1 FROM public.event_vendor_payments d
                        WHERE d.vendor_id = p2.vendor_id AND d.is_deposit_record)
     ORDER BY p2.vendor_id, p2.created_at, p2.payment_id
  ) first_deposit
 WHERE p.payment_id = first_deposit.payment_id;

-- ─────────────────────────────────────────────────────────────────────────────
-- 3 · THE ROW IS THE COUPLE'S, THE ANSWERS ARE NOT.
--
-- `event_vendor_payments_couple_write` is a PERMISSIVE FOR ALL policy and the
-- table is granted SIUD, so without this a couple could PATCH their own row to
-- read "the supplier refused" or "Setnayan ruled it stands".
--
-- 🔒 THIS IS NOW BEFORE INSERT **OR** UPDATE. The old guard ran on UPDATE only,
-- which 20271008178212 recorded as "KNOWN, NOT FIXED": a couple could INSERT a
-- row already carrying vendor_confirmed_at. Measured 2026-09-11 before closing
-- it: no app path inserts vendor_confirmed_* through a session; the only writer
-- that does (vendor_claim_locked_qr) is SECURITY DEFINER and runs as owner.
--
-- The admin exemption on vendor_confirmed_* is the old guard's and is kept as
-- it was. The NEW columns follow the deposit's rule instead: definer functions
-- and service_role only. CLEARING a refusal to NULL stays legal, for the
-- deposit's reason — the couple re-sending clears the stale answer.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.guard_vendor_payment_confirmation()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  IF current_user IN ('authenticated', 'anon') THEN
    IF TG_OP = 'INSERT' THEN
      IF NOT public.is_admin()
         AND (NEW.vendor_confirmed_at IS NOT NULL OR NEW.vendor_confirmed_by IS NOT NULL) THEN
        RAISE EXCEPTION 'event_vendor_payments: vendor confirmation may only be set via confirm_vendor_payment'
          USING ERRCODE = '42501';
      END IF;
      IF NEW.payment_refused_at IS NOT NULL
         OR NEW.payment_refusal_reason IS NOT NULL
         OR NEW.payment_refused_by_user_id IS NOT NULL THEN
        RAISE EXCEPTION 'event_vendor_payments: the refusal is supplier-set only (via refuse_vendor_payment)'
          USING ERRCODE = '42501';
      END IF;
      IF NEW.payment_dispute_settled_at IS NOT NULL
         OR NEW.payment_dispute_outcome IS NOT NULL
         OR NEW.payment_dispute_note IS NOT NULL
         OR NEW.payment_dispute_settled_by_user_id IS NOT NULL THEN
        RAISE EXCEPTION 'event_vendor_payments: the settlement is Setnayan-set only (via settle_vendor_payment_dispute)'
          USING ERRCODE = '42501';
      END IF;
      -- is_deposit_record: overwritten by trg_stamp_event_vendor_payment_deposit_record.
    ELSE
      IF NOT public.is_admin()
         AND (NEW.vendor_confirmed_at IS DISTINCT FROM OLD.vendor_confirmed_at
              OR NEW.vendor_confirmed_by IS DISTINCT FROM OLD.vendor_confirmed_by) THEN
        RAISE EXCEPTION 'event_vendor_payments: vendor confirmation may only be set via confirm_vendor_payment'
          USING ERRCODE = '42501';
      END IF;
      IF NEW.is_deposit_record IS DISTINCT FROM OLD.is_deposit_record THEN
        RAISE EXCEPTION 'event_vendor_payments: which row is the deposit is decided by the database'
          USING ERRCODE = '42501';
      END IF;
      -- SET is forgery; CLEARING to NULL is the couple re-sending.
      IF (NEW.payment_refused_at IS DISTINCT FROM OLD.payment_refused_at
            AND NEW.payment_refused_at IS NOT NULL)
         OR (NEW.payment_refusal_reason IS DISTINCT FROM OLD.payment_refusal_reason
            AND NEW.payment_refusal_reason IS NOT NULL)
         OR (NEW.payment_refused_by_user_id IS DISTINCT FROM OLD.payment_refused_by_user_id
            AND NEW.payment_refused_by_user_id IS NOT NULL) THEN
        RAISE EXCEPTION 'event_vendor_payments: the refusal is supplier-set only (via refuse_vendor_payment)'
          USING ERRCODE = '42501';
      END IF;
      IF (NEW.payment_dispute_settled_at IS DISTINCT FROM OLD.payment_dispute_settled_at
            AND NEW.payment_dispute_settled_at IS NOT NULL)
         OR (NEW.payment_dispute_outcome IS DISTINCT FROM OLD.payment_dispute_outcome
            AND NEW.payment_dispute_outcome IS NOT NULL)
         OR (NEW.payment_dispute_note IS DISTINCT FROM OLD.payment_dispute_note
            AND NEW.payment_dispute_note IS NOT NULL)
         OR (NEW.payment_dispute_settled_by_user_id IS DISTINCT FROM OLD.payment_dispute_settled_by_user_id
            AND NEW.payment_dispute_settled_by_user_id IS NOT NULL) THEN
        RAISE EXCEPTION 'event_vendor_payments: the settlement is Setnayan-set only (via settle_vendor_payment_dispute)'
          USING ERRCODE = '42501';
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_guard_vendor_payment_confirmation ON public.event_vendor_payments;
CREATE TRIGGER trg_guard_vendor_payment_confirmation
  BEFORE INSERT OR UPDATE ON public.event_vendor_payments
  FOR EACH ROW EXECUTE FUNCTION public.guard_vendor_payment_confirmation();

-- ─────────────────────────────────────────────────────────────────────────────
-- 4 · "IT NEVER REACHED ME" — for every payment, through one door.
--
-- The gate is the deposit's (reject_vendor_deposit): the booked shop's team or
-- Setnayan. An unknown id and someone else's id get the SAME answer, so the
-- function cannot be used to learn which payment ids exist.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.refuse_vendor_payment(p_payment_id uuid, p_reason text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_event_vendor_id UUID;
  v_is_deposit      BOOLEAN;
  v_confirmed_at    TIMESTAMPTZ;
  v_refused_at      TIMESTAMPTZ;
  v_reason          TEXT;
  v_rows            INTEGER;
BEGIN
  SELECT vendor_id, is_deposit_record, vendor_confirmed_at, payment_refused_at
    INTO v_event_vendor_id, v_is_deposit, v_confirmed_at, v_refused_at
    FROM public.event_vendor_payments
   WHERE payment_id = p_payment_id
   FOR UPDATE;
  IF NOT FOUND
     OR (NOT EXISTS (SELECT 1 FROM public.current_vendor_event_vendor_ids() AS mine(id)
                      WHERE mine.id = v_event_vendor_id)
         AND NOT public.is_admin()) THEN
    RAISE EXCEPTION 'not_your_booking' USING ERRCODE = '42501';
  END IF;

  -- 🔑 ONE PATH FOR THE DEPOSIT. Its refusal, its queue and its referee are the
  -- ones that already exist; this row only ever points at them.
  IF v_is_deposit THEN
    RETURN public.reject_vendor_deposit(v_event_vendor_id, p_reason)
           || jsonb_build_object('routed', 'deposit');
  END IF;

  IF v_confirmed_at IS NOT NULL THEN
    RETURN jsonb_build_object('status', 'already_confirmed');
  END IF;
  IF v_refused_at IS NOT NULL THEN
    RETURN jsonb_build_object('status', 'already');
  END IF;

  v_reason := NULLIF(BTRIM(COALESCE(p_reason, '')), '');
  IF v_reason IS NOT NULL THEN
    v_reason := LEFT(v_reason, 240);
  END IF;

  UPDATE public.event_vendor_payments
     SET payment_refused_at         = NOW(),
         payment_refusal_reason     = v_reason,
         payment_refused_by_user_id = auth.uid(),
         -- A NEW refusal is a NEW question for Setnayan.
         payment_dispute_settled_at         = NULL,
         payment_dispute_outcome            = NULL,
         payment_dispute_note               = NULL,
         payment_dispute_settled_by_user_id = NULL
   WHERE payment_id = p_payment_id
     AND vendor_confirmed_at IS NULL
     AND payment_refused_at IS NULL;
  GET DIAGNOSTICS v_rows = ROW_COUNT;
  IF v_rows = 0 THEN
    RETURN jsonb_build_object('status', 'already');
  END IF;

  RETURN jsonb_build_object('status', 'ok');
END;
$function$;

REVOKE ALL ON FUNCTION public.refuse_vendor_payment(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.refuse_vendor_payment(uuid, text) TO authenticated;

COMMENT ON FUNCTION public.refuse_vendor_payment(uuid, text) IS
  'The booked supplier says a payment the couple logged never reached them. The '
  'DEPOSIT''s row delegates to reject_vendor_deposit (one path for the same money); '
  'an installment is marked on its own row and waits for Setnayan on /admin/disputes. '
  'Nothing the couple sent is deleted (H4, owner 2026-09-11).';

-- ─────────────────────────────────────────────────────────────────────────────
-- 5 · CONFIRMING — the live body (20270202160006, the only definition), with
--     the two H4 changes and nothing else: the deposit's row acknowledges the
--     deposit; a confirmation clears an earlier refusal and its settlement.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.confirm_vendor_payment(
  p_payment_id UUID
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_event_vendor_id  UUID;
  v_already          TIMESTAMPTZ;
  v_is_deposit       BOOLEAN;
  v_marketplace_id   UUID;
  v_owns             BOOLEAN;
  v_rows             INTEGER;
BEGIN
  SELECT vendor_id, vendor_confirmed_at, is_deposit_record
    INTO v_event_vendor_id, v_already, v_is_deposit
  FROM public.event_vendor_payments
  WHERE payment_id = p_payment_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'payment_not_found' USING ERRCODE = 'P0002';
  END IF;

  SELECT marketplace_vendor_id
    INTO v_marketplace_id
  FROM public.event_vendors
  WHERE vendor_id = v_event_vendor_id;
  IF NOT FOUND OR v_marketplace_id IS NULL THEN
    RAISE EXCEPTION 'not_a_marketplace_booking' USING ERRCODE = '42501';
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.vendor_profiles
    WHERE vendor_profile_id = v_marketplace_id
      AND user_id = auth.uid()
  ) INTO v_owns;
  IF NOT v_owns THEN
    RAISE EXCEPTION 'not_your_booking' USING ERRCODE = '42501';
  END IF;

  -- H4 · confirming the deposit's row IS acknowledging the deposit. The
  -- acknowledgement fires § 6, which confirms this row in the same transaction.
  IF v_is_deposit THEN
    PERFORM public.acknowledge_vendor_deposit(v_event_vendor_id);
  END IF;

  IF v_already IS NOT NULL THEN
    RETURN;
  END IF;

  UPDATE public.event_vendor_payments
  SET vendor_confirmed_at = NOW(),
      vendor_confirmed_by = auth.uid(),
      -- H4 · the money turned up: an earlier "it never reached me" and any
      -- settlement of it are retired, as acknowledge_vendor_deposit does.
      payment_refused_at                 = NULL,
      payment_refusal_reason             = NULL,
      payment_refused_by_user_id         = NULL,
      payment_dispute_settled_at         = NULL,
      payment_dispute_outcome            = NULL,
      payment_dispute_note               = NULL,
      payment_dispute_settled_by_user_id = NULL
  WHERE payment_id = p_payment_id
    AND vendor_confirmed_at IS NULL;  -- precondition: single-winner even sans lock
  GET DIAGNOSTICS v_rows = ROW_COUNT;
END;
$$;

REVOKE ALL ON FUNCTION public.confirm_vendor_payment(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.confirm_vendor_payment(UUID) FROM anon;
GRANT EXECUTE ON FUNCTION public.confirm_vendor_payment(UUID) TO authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- 6 · THE OTHER DIRECTION — a deposit acknowledged anywhere confirms its row.
--
-- acknowledge_vendor_deposit (the deposit card, the answers desk) and
-- settle_vendor_deposit_dispute('payment_stands') both set
-- deposit_acknowledged_at. Without this, the ledger row kept asking the supplier
-- "Confirm received" for money they had already acknowledged one card over.
-- SECURITY DEFINER so it passes the ledger's guard whoever fired it; it can only
-- fire on a transition guard_event_vendor_deposit_ack already restricts to the
-- definer functions and service_role.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.confirm_deposit_record_on_acknowledgement()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  UPDATE public.event_vendor_payments
     SET vendor_confirmed_at = NEW.deposit_acknowledged_at,
         vendor_confirmed_by = auth.uid()
   WHERE vendor_id = NEW.vendor_id
     AND is_deposit_record
     AND vendor_confirmed_at IS NULL;
  RETURN NULL;
END;
$function$;

REVOKE ALL ON FUNCTION public.confirm_deposit_record_on_acknowledgement() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_confirm_deposit_record_on_acknowledgement ON public.event_vendors;
CREATE TRIGGER trg_confirm_deposit_record_on_acknowledgement
  AFTER UPDATE OF deposit_acknowledged_at ON public.event_vendors
  FOR EACH ROW
  WHEN (OLD.deposit_acknowledged_at IS NULL AND NEW.deposit_acknowledged_at IS NOT NULL)
  EXECUTE FUNCTION public.confirm_deposit_record_on_acknowledgement();

-- ─────────────────────────────────────────────────────────────────────────────
-- 7 · THE REFEREE, for installments — settle_vendor_deposit_dispute's mirror.
--
-- 🔒 ADMIN ONLY, gated INSIDE: SECURITY DEFINER and granted to authenticated,
-- so an ungated body would hand every signed-in person a referee's whistle. It
-- reads auth.uid(), so the caller must use the admin's SESSION, not the
-- service-role client (lib/admin-gated-rpc-needs-a-session.test.ts).
-- A deposit record never carries these columns (CHECK above), so a deposit
-- reaches the answer 'no_dispute' here and is settled where it always was.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.settle_vendor_payment_dispute(
  p_payment_id uuid,
  p_outcome    text,
  p_note       text DEFAULT NULL::text
)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_refused_at TIMESTAMPTZ;
  v_settled_at TIMESTAMPTZ;
  v_reason     TEXT;
  v_note       TEXT;
  v_rows       INTEGER;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'settling a payment dispute is Setnayan-only'
      USING ERRCODE = '42501';
  END IF;

  IF p_outcome IS NULL OR p_outcome NOT IN ('payment_stands', 'not_received') THEN
    RAISE EXCEPTION 'unknown settlement outcome %', COALESCE(p_outcome, '(null)')
      USING ERRCODE = '22023';
  END IF;

  SELECT payment_refused_at, payment_dispute_settled_at, payment_refusal_reason
    INTO v_refused_at, v_settled_at, v_reason
    FROM public.event_vendor_payments
   WHERE payment_id = p_payment_id
   FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'payment_not_found' USING ERRCODE = 'P0002';
  END IF;

  IF v_refused_at IS NULL THEN
    RETURN jsonb_build_object('status', 'no_dispute');
  END IF;
  IF v_settled_at IS NOT NULL THEN
    RETURN jsonb_build_object('status', 'already');
  END IF;

  v_note := NULLIF(BTRIM(COALESCE(p_note, '')), '');
  IF v_note IS NOT NULL THEN
    v_note := LEFT(v_note, 500);
  END IF;

  IF p_outcome = 'payment_stands' THEN
    UPDATE public.event_vendor_payments
       SET vendor_confirmed_at               = NOW(),
           vendor_confirmed_by               = auth.uid(),
           payment_refused_at                = NULL,
           payment_refusal_reason            = NULL,
           payment_refused_by_user_id        = NULL,
           payment_dispute_settled_at         = NOW(),
           payment_dispute_outcome            = 'payment_stands',
           payment_dispute_note               = v_note,
           payment_dispute_settled_by_user_id = auth.uid()
     WHERE payment_id = p_payment_id
       AND payment_refused_at IS NOT NULL
       AND payment_dispute_settled_at IS NULL;
  ELSE
    UPDATE public.event_vendor_payments
       SET payment_dispute_settled_at         = NOW(),
           payment_dispute_outcome            = 'not_received',
           payment_dispute_note               = v_note,
           payment_dispute_settled_by_user_id = auth.uid()
     WHERE payment_id = p_payment_id
       AND payment_refused_at IS NOT NULL
       AND payment_dispute_settled_at IS NULL;
  END IF;

  GET DIAGNOSTICS v_rows = ROW_COUNT;
  IF v_rows = 0 THEN
    RETURN jsonb_build_object('status', 'already');
  END IF;

  -- The supplier's words go back so the audit row keeps them verbatim:
  -- `payment_stands` clears them from the row.
  RETURN jsonb_build_object(
    'status', 'ok',
    'outcome', p_outcome,
    'claim', v_reason,
    'opened_at', v_refused_at);
END;
$function$;

REVOKE ALL ON FUNCTION public.settle_vendor_payment_dispute(uuid, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.settle_vendor_payment_dispute(uuid, text, text)
  TO authenticated, service_role;

COMMENT ON FUNCTION public.settle_vendor_payment_dispute(uuid, text, text) IS
  'Setnayan settles a supplier''s "this payment never reached me" BY HAND, for an '
  'installment — the mirror of settle_vendor_deposit_dispute. Admin-only, gated '
  'inside the body. Neither outcome deletes the couple''s row, amount or receipt.';
