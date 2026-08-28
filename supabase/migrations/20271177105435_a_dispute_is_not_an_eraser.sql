/*
  A DISPUTE IS NOT AN ERASER — Setnayan can settle "it never reached me" by hand.

  ⚖ OWNER, 2026-08-28: "no. do not. we will confirm it manually."

  ── WHAT WAS ALREADY TRUE BEFORE THIS MIGRATION (do not rebuild it) ──────────
  The destruction this session was named for is ALREADY FIXED. PR #4927
  (20271175634994) stopped `reject_vendor_deposit` erasing the couple's
  deposit_recorded_at / deposit_proof_url / deposit_method_id /
  deposit_method_label and deleting their event_vendor_payments ledger row.
  Verified 2026-08-28 BY THE OBJECT — pg_get_functiondef of the LIVE function,
  not the original migration file, which still describes the erasure because
  applied migrations are never edited.

  🔑 SO THIS MIGRATION IS THE OTHER HALF, AND IT IS THE HALF NOBODY BUILT: the
  refusal is kept, the couple is told — and NOTHING EVER REACHED SETNAYAN. There
  was no queue, no surface and no function with which to "confirm it manually".
  The refusal simply sat between the two parties with no referee.

  ── WHY THE SETTLEMENT LIVES HERE AND NOT IN `vendor_disputes` ───────────────
  Reusing the shipped dispute table was the first instinct and it was measured
  and REJECTED, for two reasons found by reading its constraints and readers:

   1. `CHECK ((payout_id IS NOT NULL) OR (order_id IS NOT NULL))` — a deposit
      dispute has NEITHER. Couple→supplier money is off-platform by owner lock
      ("they do not transact on our website"), so there is no order and no
      payout to attach. Reuse would mean weakening the one constraint that keeps
      a dispute row attached to money Setnayan can actually see.
   2. `vendor_disputes` feeds the 3-in-30 DEMOTION cron
      (api/admin/cron/dispute-counter), which counts status='resolved_for_couple'
      + counts_toward_demotion. A dispute the SUPPLIER raises, resolved "for the
      couple", would sit one boolean away from demoting the supplier who raised
      it.

  So the settlement is recorded beside the deposit facts it is about, and the
  PERMANENT history goes to `admin_audit_log` (before/after + reason + actor),
  which is the mechanism /admin/disputes already uses for exactly this.

  ── THE ONE INVARIANT, STATED ONCE ──────────────────────────────────────────
  🔑 THE SETTLEMENT DESCRIBES THE REFUSAL CURRENTLY ON THE ROW. Whenever that
  refusal is cleared or replaced, the settlement clears with it. That is what
  makes a SECOND refusal, months later, open a genuinely new question instead of
  inheriting a stale "already settled" and silently never reaching the queue
  again. Every writer of the refusal below therefore also writes the settlement.

  🔢 SAFE BY ARITHMETIC AT THE MERGE, read out of prod 2026-08-28:
     45 event_vendors rows · 0 with a deposit recorded · 0 acknowledged ·
     0 declined. Nobody is mid-dispute, so this changes nothing retroactively
     and starts working on the first real refusal.

  🔒 EXPOSURE, COUNTED NOT RUBBER-STAMPED: `event_vendors` grants are
  TABLE-level (all 76 columns granted uniformly to anon/authenticated), so these
  4 columns are granted automatically — a column-level REVOKE here is inert. The
  read audience is unchanged: all 4 RLS policies name {authenticated} only, none
  names anon or PUBLIC, so anon reaches ZERO rows. The couple and the event's
  moderators already read deposit_decline_reason sitting next to these.
*/

-- ─────────────────────────────────────────────────────────────────────────────
-- 1 · The settlement, recorded beside the deposit facts it is about.
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.event_vendors
  ADD COLUMN IF NOT EXISTS deposit_dispute_settled_at         TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS deposit_dispute_outcome            TEXT,
  ADD COLUMN IF NOT EXISTS deposit_dispute_note               TEXT,
  ADD COLUMN IF NOT EXISTS deposit_dispute_settled_by_user_id UUID;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conrelid = 'public.event_vendors'::regclass
       AND conname  = 'event_vendors_deposit_dispute_outcome_check'
  ) THEN
    ALTER TABLE public.event_vendors
      ADD CONSTRAINT event_vendors_deposit_dispute_outcome_check
      CHECK (deposit_dispute_outcome IS NULL
             OR deposit_dispute_outcome IN ('payment_stands', 'not_received'));
  END IF;
END $$;

COMMENT ON COLUMN public.event_vendors.deposit_dispute_settled_at IS
  'When Setnayan settled the supplier''s "it never reached me" BY HAND (owner '
  '2026-08-28: "we will confirm it manually"). NULL alongside a non-NULL '
  'deposit_declined_at is the definition of an OPEN dispute and is what the '
  '/admin/disputes queue counts. Cleared whenever the refusal it describes is '
  'cleared or replaced — see the invariant in 20271177105435.';
COMMENT ON COLUMN public.event_vendors.deposit_dispute_outcome IS
  'payment_stands = Setnayan confirmed the money reached the supplier (the '
  'booking proceeds). not_received = Setnayan confirmed it did not arrive; the '
  'refusal stands and the couple must send it again. NEITHER outcome deletes '
  'the couple''s receipt, proof, method or ledger row.';
COMMENT ON COLUMN public.event_vendors.deposit_dispute_note IS
  'The Setnayan team''s reason, shown to BOTH parties. The permanent, '
  'non-superseded history of every settlement is in admin_audit_log.';

-- ─────────────────────────────────────────────────────────────────────────────
-- 2 · The settlement is Setnayan-set only.
--
-- 🔑 THE ROW IS YOURS, THE FIELD IS NOT — the ninth instance of this shape in
-- this schema. `event_vendors_couple_write` is a PERMISSIVE `FOR ALL` policy on
-- the couple's own event and `authenticated` holds UPDATE on all 76 columns, so
-- without this a couple could PATCH /rest/v1/event_vendors with the public anon
-- key and write "Setnayan ruled the payment stands" over their own booking —
-- forging a referee's decision, in the referee's name.
--
-- CLEARING to NULL stays legal for exactly the reason the refusal's own rule
-- does: the couple re-sending their proof clears the stale answer.
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
      -- SET is forgery; CLEARING to NULL is the couple re-sending their proof.
      IF (NEW.deposit_declined_at IS DISTINCT FROM OLD.deposit_declined_at
            AND NEW.deposit_declined_at IS NOT NULL)
         OR (NEW.deposit_decline_reason IS DISTINCT FROM OLD.deposit_decline_reason
            AND NEW.deposit_decline_reason IS NOT NULL)
         OR (NEW.deposit_declined_by_user_id IS DISTINCT FROM OLD.deposit_declined_by_user_id
            AND NEW.deposit_declined_by_user_id IS NOT NULL) THEN
        RAISE EXCEPTION 'the deposit refusal is vendor-set only (via reject_vendor_deposit)'
          USING ERRCODE = '42501';
      END IF;
      -- Same rule, same reason, for the referee's decision.
      IF (NEW.deposit_dispute_settled_at IS DISTINCT FROM OLD.deposit_dispute_settled_at
            AND NEW.deposit_dispute_settled_at IS NOT NULL)
         OR (NEW.deposit_dispute_outcome IS DISTINCT FROM OLD.deposit_dispute_outcome
            AND NEW.deposit_dispute_outcome IS NOT NULL)
         OR (NEW.deposit_dispute_note IS DISTINCT FROM OLD.deposit_dispute_note
            AND NEW.deposit_dispute_note IS NOT NULL)
         OR (NEW.deposit_dispute_settled_by_user_id IS DISTINCT FROM OLD.deposit_dispute_settled_by_user_id
            AND NEW.deposit_dispute_settled_by_user_id IS NOT NULL) THEN
        RAISE EXCEPTION 'the deposit dispute settlement is Setnayan-set only (via settle_vendor_deposit_dispute)'
          USING ERRCODE = '42501';
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 3 · A FRESH REFUSAL OPENS A FRESH QUESTION.
--
-- 🪤 THE SILENT-MISS THIS EXISTS TO PREVENT: settle "not_received" → the couple
-- sends it again → the supplier refuses AGAIN. Without the four NULLs below,
-- the row would carry a non-NULL deposit_dispute_settled_at from the PREVIOUS
-- refusal, the queue's "open" filter would not match it, and the second dispute
-- would never reach Setnayan at all. No error, no log — a queue that is simply
-- wrong about how much work is waiting.
--
-- ⚠ THE BODY BELOW IS THE LIVE PRODUCTION DEFINITION, read out by
-- pg_get_functiondef on 2026-08-28 and changed in exactly one place (the four
-- settlement NULLs in the UPDATE). Everything PR #4927 did — no claim erasure,
-- no ledger DELETE, the benign-idempotency branch — is preserved deliberately:
-- CREATE OR REPLACE on this very function has silently reverted a guard before.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.reject_vendor_deposit(p_event_vendor_id uuid, p_reason text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_recorded_at TIMESTAMPTZ;
  v_acked_at    TIMESTAMPTZ;
  v_declined_at TIMESTAMPTZ;
  v_reason      TEXT;
  v_rows        INTEGER;
BEGIN
  IF p_event_vendor_id NOT IN (SELECT public.current_vendor_event_vendor_ids())
     AND NOT public.is_admin() THEN
    RAISE EXCEPTION 'not_your_booking' USING ERRCODE = '42501';
  END IF;

  SELECT deposit_recorded_at, deposit_acknowledged_at, deposit_declined_at
    INTO v_recorded_at, v_acked_at, v_declined_at
    FROM public.event_vendors
   WHERE vendor_id = p_event_vendor_id
   FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'booking_not_found' USING ERRCODE = 'P0002';
  END IF;

  IF v_recorded_at IS NULL THEN
    RETURN jsonb_build_object('status', 'not_recorded');
  END IF;
  IF v_acked_at IS NOT NULL THEN
    RETURN jsonb_build_object('status', 'already_confirmed');
  END IF;
  -- Benign idempotency (new — the old body could not have this state, because
  -- it erased the claim instead of marking it): a re-call reports the answer
  -- already on the row rather than raising, so the UI still shows "sent".
  IF v_declined_at IS NOT NULL THEN
    RETURN jsonb_build_object('status', 'already');
  END IF;

  v_reason := NULLIF(BTRIM(COALESCE(p_reason, '')), '');
  IF v_reason IS NOT NULL THEN
    v_reason := LEFT(v_reason, 240);
  END IF;

  /*
    🔒 WHAT IS NO LONGER TOUCHED, AND IT IS THE WHOLE POINT OF THIS MIGRATION:
    deposit_recorded_at · deposit_proof_url · deposit_method_id ·
    deposit_method_label — the couple's own record of paying — and their
    event_vendor_payments ledger row, whose DELETE (matched on a notes
    substring, unscoped by amount or date) is gone from this function.
  */
  UPDATE public.event_vendors
     SET deposit_declined_at         = NOW(),
         deposit_decline_reason      = v_reason,
         deposit_declined_by_user_id = auth.uid(),
         -- A NEW refusal is a NEW question for Setnayan. See the trap above.
         deposit_dispute_settled_at         = NULL,
         deposit_dispute_outcome            = NULL,
         deposit_dispute_note               = NULL,
         deposit_dispute_settled_by_user_id = NULL,
         updated_at                  = NOW()
   WHERE vendor_id = p_event_vendor_id
     AND deposit_recorded_at IS NOT NULL
     AND deposit_acknowledged_at IS NULL
     AND deposit_declined_at IS NULL;
  GET DIAGNOSTICS v_rows = ROW_COUNT;
  IF v_rows = 0 THEN
    -- Lost the race between the read and the write (only reachable if the lock
    -- above is ever removed) — re-read and report what the row now says.
    SELECT deposit_acknowledged_at INTO v_acked_at
      FROM public.event_vendors WHERE vendor_id = p_event_vendor_id;
    IF v_acked_at IS NOT NULL THEN
      RETURN jsonb_build_object('status', 'already_confirmed');
    END IF;
    RETURN jsonb_build_object('status', 'already');
  END IF;

  RETURN jsonb_build_object('status', 'ok');
END;
$function$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 4 · The supplier confirming the money turned up ENDS the dispute too.
--     (Live production body, one clause added — same invariant as § 3.)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.acknowledge_vendor_deposit(p_event_vendor_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_recorded_at TIMESTAMPTZ;
  v_acked_at    TIMESTAMPTZ;
  v_rows        INTEGER;
BEGIN
  IF p_event_vendor_id NOT IN (SELECT public.current_vendor_event_vendor_ids())
     AND NOT public.is_admin() THEN
    RAISE EXCEPTION 'not_your_booking' USING ERRCODE = '42501';
  END IF;

  SELECT deposit_recorded_at, deposit_acknowledged_at
    INTO v_recorded_at, v_acked_at
    FROM public.event_vendors
   WHERE vendor_id = p_event_vendor_id
   FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'booking_not_found' USING ERRCODE = 'P0002';
  END IF;

  IF v_recorded_at IS NULL THEN
    RETURN jsonb_build_object('status', 'not_recorded');
  END IF;

  IF v_acked_at IS NOT NULL THEN
    RETURN jsonb_build_object(
      'status', 'already', 'acknowledged_at', v_acked_at);
  END IF;

  -- 2026-08-27: the confirmation also CLEARS an earlier "it never arrived" from
  -- this same supplier — the money turned up, and the couple must not be left
  -- reading a refusal beside a confirmation. It is also what keeps the one-way
  -- CHECK satisfiable without a second call.
  -- 2026-08-28: and it retires any settlement of that refusal, because the two
  -- parties have just settled it themselves.
  UPDATE public.event_vendors
     SET deposit_acknowledged_at = NOW(),
         deposit_declined_at         = NULL,
         deposit_decline_reason      = NULL,
         deposit_declined_by_user_id = NULL,
         deposit_dispute_settled_at         = NULL,
         deposit_dispute_outcome            = NULL,
         deposit_dispute_note               = NULL,
         deposit_dispute_settled_by_user_id = NULL,
         updated_at = NOW()
   WHERE vendor_id = p_event_vendor_id
     AND deposit_recorded_at IS NOT NULL
     AND deposit_acknowledged_at IS NULL;
  GET DIAGNOSTICS v_rows = ROW_COUNT;
  IF v_rows = 0 THEN
    SELECT deposit_acknowledged_at INTO v_acked_at
      FROM public.event_vendors WHERE vendor_id = p_event_vendor_id;
    RETURN jsonb_build_object(
      'status', 'already', 'acknowledged_at', v_acked_at);
  END IF;

  RETURN jsonb_build_object('status', 'ok', 'acknowledged_at', NOW());
END;
$function$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 5 · THE REFEREE. Setnayan settles the question by hand.
--
-- ⚖ Owner 2026-08-28: "no. do not. we will confirm it manually." Two outcomes,
-- and NEITHER of them deletes anything the couple sent:
--
--   payment_stands — the money did reach the supplier. The booking proceeds,
--                    exactly as if the supplier had confirmed it themselves.
--                    The refusal is lifted because the one-way CHECK
--                    (event_vendors_deposit_answer_is_one_way) forbids a row
--                    that is both confirmed and refused — but the settlement
--                    columns keep saying, on the row, that there WAS a dispute
--                    and how it went, and admin_audit_log keeps the supplier's
--                    words verbatim and permanently.
--   not_received   — it genuinely did not arrive. The refusal STANDS and the
--                    couple is asked to send it again. Their receipt, proof,
--                    method and ledger row are untouched, which is the whole
--                    reason this session exists.
--
-- 🔒 ADMIN ONLY, and gated INSIDE the function: it is SECURITY DEFINER and
-- granted to `authenticated`, so an unauthenticated gate here would hand every
-- signed-in person a referee's whistle.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.settle_vendor_deposit_dispute(
  p_event_vendor_id uuid,
  p_outcome         text,
  p_note            text DEFAULT NULL::text
)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_declined_at TIMESTAMPTZ;
  v_settled_at  TIMESTAMPTZ;
  v_reason      TEXT;
  v_note        TEXT;
  v_rows        INTEGER;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'settling a downpayment dispute is Setnayan-only'
      USING ERRCODE = '42501';
  END IF;

  IF p_outcome IS NULL OR p_outcome NOT IN ('payment_stands', 'not_received') THEN
    RAISE EXCEPTION 'unknown settlement outcome %', COALESCE(p_outcome, '(null)')
      USING ERRCODE = '22023';
  END IF;

  -- FOR UPDATE serializes two admins answering the same row at once; the loser
  -- re-reads and is caught by the idempotent branch below.
  SELECT deposit_declined_at, deposit_dispute_settled_at, deposit_decline_reason
    INTO v_declined_at, v_settled_at, v_reason
    FROM public.event_vendors
   WHERE vendor_id = p_event_vendor_id
   FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'booking_not_found' USING ERRCODE = 'P0002';
  END IF;

  -- Nothing to settle: the supplier never refused, or the couple has already
  -- sent it again (which lifts the refusal and hands the question back to them).
  IF v_declined_at IS NULL THEN
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
    UPDATE public.event_vendors
       SET deposit_acknowledged_at        = NOW(),
           deposit_declined_at            = NULL,
           deposit_decline_reason         = NULL,
           deposit_declined_by_user_id    = NULL,
           deposit_dispute_settled_at         = NOW(),
           deposit_dispute_outcome            = 'payment_stands',
           deposit_dispute_note               = v_note,
           deposit_dispute_settled_by_user_id = auth.uid(),
           updated_at                     = NOW()
     WHERE vendor_id = p_event_vendor_id
       AND deposit_declined_at IS NOT NULL
       AND deposit_dispute_settled_at IS NULL;
  ELSE
    UPDATE public.event_vendors
       SET deposit_dispute_settled_at         = NOW(),
           deposit_dispute_outcome            = 'not_received',
           deposit_dispute_note               = v_note,
           deposit_dispute_settled_by_user_id = auth.uid(),
           updated_at                     = NOW()
     WHERE vendor_id = p_event_vendor_id
       AND deposit_declined_at IS NOT NULL
       AND deposit_dispute_settled_at IS NULL;
  END IF;

  GET DIAGNOSTICS v_rows = ROW_COUNT;
  IF v_rows = 0 THEN
    RETURN jsonb_build_object('status', 'already');
  END IF;

  -- The supplier's own words go back to the caller so the audit row can keep
  -- them verbatim: `payment_stands` is about to clear them from the row, and
  -- the audit log is where they survive.
  RETURN jsonb_build_object(
    'status', 'ok',
    'outcome', p_outcome,
    'claim', v_reason,
    'opened_at', v_declined_at);
END;
$function$;

REVOKE ALL ON FUNCTION public.settle_vendor_deposit_dispute(uuid, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.settle_vendor_deposit_dispute(uuid, text, text)
  TO authenticated, service_role;

COMMENT ON FUNCTION public.settle_vendor_deposit_dispute(uuid, text, text) IS
  'Setnayan settles a supplier''s "the downpayment never reached me" BY HAND '
  '(owner 2026-08-28). Admin-only, gated inside the body because the function '
  'is SECURITY DEFINER and granted to authenticated. Neither outcome deletes '
  'the couple''s receipt, proof, method or ledger row.';
