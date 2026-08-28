-- ============================================================================
-- 20271175634994_the_couple_keeps_their_record.sql
--
-- THE COUPLE KEEPS THEIR RECORD. Owner ruling 2026-08-27, asked in plain terms
-- and answered in plain terms: **"yes they keep their record."**
--
-- ── WHAT WAS WRONG ─────────────────────────────────────────────────────────
-- A supplier saying "that money never reached me" ERASED THE COUPLE'S OWN
-- RECORD OF PAYING. `reject_vendor_deposit` cleared `deposit_recorded_at`, the
-- proof URL and both method columns, and DELETED the couple's
-- `event_vendor_payments` row — matched on `notes LIKE '%awaiting vendor
-- confirmation%'`, a substring, unscoped by amount or date. After a refusal the
-- couple's screen read as though they had never recorded anything: no amount,
-- no receipt, no ledger line, and the only trace anywhere was an email.
--
-- 🔑 A SUPPLIER NOT SEEING THE MONEY IS NOT EVIDENCE THE COUPLE DID NOT SEND
-- IT. Bank transfers take days, references get mistyped, names mismatch. The
-- platform holds none of this money, so the couple's record is the only record
-- they have — and it was being deleted by the other party to the disagreement.
--
-- ── WHAT THIS CHANGES ──────────────────────────────────────────────────────
-- The refusal becomes a MARK, not a deletion. Three columns record the
-- supplier's own answer; everything the couple entered stays exactly where it
-- was. Both parties keep what they said, which is the only honest shape for a
-- disagreement about money that never touched us.
--
--  1. deposit_declined_at / deposit_decline_reason / deposit_declined_by_user_id.
--  2. `reject_vendor_deposit` STAMPS those instead of clearing the claim, and
--     no longer deletes the ledger row. Same name, same arguments, same
--     ownership gate, same statuses — so every caller is untouched.
--  3. `acknowledge_vendor_deposit` CLEARS a refusal: a supplier who says "not
--     yet" and later finds the money just confirms, and the couple must never
--     read a refusal beside a confirmation. A CHECK makes both-at-once
--     unrepresentable rather than merely unlikely.
--  4. The forgery guard grows to cover the new columns, with ONE deliberate
--     exception: a couple may CLEAR them — that is what re-sending their proof
--     looks like — and may never SET them.
--
-- ⚠ THIS REPLACES TWO LIVE MONEY FUNCTIONS. Both bodies below are production's,
--    read out with `pg_get_functiondef` and reproduced, with only the described
--    lines changed. This repo has silently reverted a guard by replacing a
--    function without reproducing it, so `deposit-answer-is-kept.db.test.ts`
--    asserts the ORIGINAL contracts too — the ownership gate, `not_recorded`,
--    the benign `already`, the single-winner WHERE — and a future replacement
--    that drops either half fails there.
--
-- ── WHAT IT STILL DOES NOT DO ──────────────────────────────────────────────
-- ⛔ No date is released and no booking is cancelled (unchanged).
-- ⛔ A CONFIRMED deposit still cannot be un-confirmed: that confirmation is what
--    bills the booking fee and acquires the schedule pool.
-- ⛔ No money moves. Setnayan holds none of it (0% commission, owner lock);
--    these are orthogonal markers beside the acknowledgement, and the status
--    enum is untouched.
--
-- 🔢 SAFE BY ARITHMETIC: production holds 45 `event_vendors` rows and ZERO with
--    a deposit ever recorded or acknowledged, and ZERO `event_vendor_payments`
--    rows for one — so no refusal has ever happened and nothing is mid-flight.
-- ⚠ `event_vendors` grants SELECT/UPDATE to `authenticated` at TABLE level (73
--    of 73 columns measured), unlike `events` with its per-column allowlist, so
--    the new columns need no GRANT of their own. Do not carry that assumption
--    to a table that revokes at table level.
--
-- ── THE EXPOSURE DECISION, MADE ON PURPOSE ─────────────────────────────────
-- The exposure-freeze guard fired on exactly three new capabilities and they
-- were READ AND COUNTED, not regenerated away: the three columns arrive with
-- `anon=SIU authenticated=SIU`, byte-identical to their two nearest siblings —
-- `deposit_acknowledged_at` and `lock_answered_by_user_id`, which are the same
-- kind of field (a supplier's own answer, trigger-protected, on the same table).
--   · `authenticated` genuinely needs SELECT (the couple reads the refusal) and
--     UPDATE (clearing it IS re-sending their proof).
--   · `anon` reaches ZERO rows: `event_vendors` has 4 policies and NONE names
--     `anon` or PUBLIC (measured in production).
--   · 🪤 AND A COLUMN-LEVEL REVOKE HERE WOULD BE INERT. The grants are
--     TABLE-level, and Postgres ignores a column-level REVOKE while the
--     table-level privilege stands — the same trap that once shipped a
--     `REVOKE UPDATE (cols)` protecting nothing. Narrowing these three means
--     revoking at TABLE level and re-granting a 73-column allowlist, which is
--     how `events` is built and why it needs its own lint. **That is real work
--     and its own change: NAMED HERE, NOT ATTEMPTED.**
-- The fence for these columns is therefore the trigger below plus RLS, stated
-- rather than assumed.
-- ============================================================================

BEGIN;

ALTER TABLE public.event_vendors
  ADD COLUMN IF NOT EXISTS deposit_declined_at         TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS deposit_decline_reason      TEXT,
  ADD COLUMN IF NOT EXISTS deposit_declined_by_user_id UUID
    REFERENCES auth.users(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.event_vendors.deposit_declined_at IS
  'When the booked SUPPLIER declared that the deposit the couple recorded never reached them (owner 2026-08-27). A MARK, never a deletion: deposit_recorded_at, deposit_proof_url, the method columns and the couple''s event_vendor_payments row all survive it, because a supplier not seeing the money is not evidence the couple did not send it. Vendor-set only via reject_vendor_deposit; cleared by the couple re-sending, or by the supplier acknowledging after all. Never set alongside deposit_acknowledged_at (CHECK event_vendors_deposit_answer_is_one_way). Releases no date and cancels no booking.';
COMMENT ON COLUMN public.event_vendors.deposit_decline_reason IS
  'The supplier''s own words, shown to the couple, 240 chars. Optional — a supplier who says nothing still says no.';
COMMENT ON COLUMN public.event_vendors.deposit_declined_by_user_id IS
  'The account that declared it, from auth.uid() inside the DEFINER RPC. A couple cannot set it (guard_event_vendor_deposit_ack).';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'event_vendors_deposit_answer_is_one_way'
       AND conrelid = 'public.event_vendors'::regclass
  ) THEN
    ALTER TABLE public.event_vendors
      ADD CONSTRAINT event_vendors_deposit_answer_is_one_way
      CHECK (deposit_acknowledged_at IS NULL OR deposit_declined_at IS NULL);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS event_vendors_deposit_declined_idx
  ON public.event_vendors (marketplace_vendor_id, deposit_declined_at)
  WHERE deposit_declined_at IS NOT NULL;

-- ---------------------------------------------------------------------------
-- THE REFUSAL MARKS; IT NO LONGER ERASES.
--
-- Production's body, with the destructive UPDATE replaced by a stamp and the
-- ledger DELETE removed entirely. Statuses are unchanged — ok · already ·
-- already_confirmed · not_recorded — so `vendorRejectDeposit` and the desk both
-- keep working with no edit.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.reject_vendor_deposit(
  p_event_vendor_id uuid,
  p_reason text DEFAULT NULL::text
)
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

COMMENT ON FUNCTION public.reject_vendor_deposit(uuid, text) IS
  'The booked supplier declares that a recorded deposit never reached them. Since 2026-08-27 it MARKS (deposit_declined_at + reason + who) instead of erasing: the couple keeps their amount, their receipt, their method and their ledger row — owner ruling, "yes they keep their record". DEFINER with an explicit ownership gate, FOR UPDATE single-winner, benign idempotency. Refuses an already-acknowledged claim. Releases no date, cancels no booking, moves no money. Statuses: ok | already | already_confirmed | not_recorded.';

-- ---------------------------------------------------------------------------
-- THE YES CLEARS THE NO. Production's body, reproduced, with three lines added
-- to its single UPDATE.
-- ---------------------------------------------------------------------------
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
  -- Ownership — DEFINER + granted to authenticated, so gate explicitly. The
  -- caller must be the booked vendor (owner/admin/agent on this booking) or a
  -- platform admin. current_vendor_event_vendor_ids() resolves the exact
  -- event_vendors.vendor_id set the vendor org owns (mirrors the read RLS in
  -- 20270315091571_vendor_read_payment_ledger_rls.sql).
  IF p_event_vendor_id NOT IN (SELECT public.current_vendor_event_vendor_ids())
     AND NOT public.is_admin() THEN
    RAISE EXCEPTION 'not_your_booking' USING ERRCODE = '42501';
  END IF;

  -- FOR UPDATE serializes concurrent acknowledgers (double-click / retry / two
  -- agents): the second waits, then re-reads the now-acked row and is caught by
  -- the idempotent branch below.
  SELECT deposit_recorded_at, deposit_acknowledged_at
    INTO v_recorded_at, v_acked_at
    FROM public.event_vendors
   WHERE vendor_id = p_event_vendor_id
   FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'booking_not_found' USING ERRCODE = 'P0002';
  END IF;

  -- Precondition: a deposit must have been recorded by the couple first.
  IF v_recorded_at IS NULL THEN
    RETURN jsonb_build_object('status', 'not_recorded');
  END IF;

  -- IDEMPOTENCY: a re-call on an already-acked row returns gracefully (the
  -- single-winner already won) instead of raising — mirrors the
  -- "already_resolved is not an error to the second caller" intent, but here
  -- the contract is a benign no-op so the vendor UX still shows "confirmed".
  IF v_acked_at IS NOT NULL THEN
    RETURN jsonb_build_object(
      'status', 'already', 'acknowledged_at', v_acked_at);
  END IF;

  -- Status precondition in the WHERE (defense in depth alongside FOR UPDATE):
  -- the transition is atomically single-winner even if the lock above is ever
  -- removed. deposit_acknowledged_at IS NULL is the single-winner gate.
  --
  -- 2026-08-27: the confirmation also CLEARS an earlier "it never arrived" from
  -- this same supplier — the money turned up, and the couple must not be left
  -- reading a refusal beside a confirmation. It is also what keeps the one-way
  -- CHECK satisfiable without a second call.
  UPDATE public.event_vendors
     SET deposit_acknowledged_at = NOW(),
         deposit_declined_at         = NULL,
         deposit_decline_reason      = NULL,
         deposit_declined_by_user_id = NULL,
         updated_at = NOW()
   WHERE vendor_id = p_event_vendor_id
     AND deposit_recorded_at IS NOT NULL
     AND deposit_acknowledged_at IS NULL;
  GET DIAGNOSTICS v_rows = ROW_COUNT;
  IF v_rows = 0 THEN
    -- Lost the race to a concurrent winner between the FOR UPDATE read and the
    -- UPDATE (only possible if the lock is removed) — re-read & report acked.
    SELECT deposit_acknowledged_at INTO v_acked_at
      FROM public.event_vendors WHERE vendor_id = p_event_vendor_id;
    RETURN jsonb_build_object(
      'status', 'already', 'acknowledged_at', v_acked_at);
  END IF;

  RETURN jsonb_build_object('status', 'ok', 'acknowledged_at', NOW());
END;
$function$;

-- ---------------------------------------------------------------------------
-- THE FORGERY GUARD COVERS THE SUPPLIER'S NEW ANSWER.
--
-- 🔑 THE ROW IS THEIRS, THE FIELD IS NOT — ninth instance of that shape here.
-- The couple's write policy on event_vendors is FOR ALL with no column list and
-- `authenticated` holds a table-wide UPDATE grant, so without this a couple
-- could POST `deposit_declined_at` straight through PostgREST and plant their
-- own supplier's refusal.
--
-- ⚖ ONE DELIBERATE ASYMMETRY: a couple may CLEAR the refusal, never SET it.
-- Clearing is exactly what re-sending their proof means, and `recordDeposit`
-- COALESCEs deposit_recorded_at, so no marker changes that the database could
-- infer a fresh claim from. The worst a couple can do with it is put their own
-- claim back in front of the supplier, who can refuse it again; it cannot
-- fabricate a confirmation, move money, or extend a hold they did not have.
-- ---------------------------------------------------------------------------
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
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;

COMMENT ON FUNCTION public.guard_event_vendor_deposit_ack() IS
  'BEFORE INSERT OR UPDATE on event_vendors. Refuses any authenticated/anon write to the SUPPLIER''s own answer about a deposit — deposit_acknowledged_at in either direction and, since 2026-08-27, deposit_declined_at / deposit_decline_reason / deposit_declined_by_user_id when SET. Clearing the refusal to NULL stays permitted on purpose: that is the couple re-sending their proof, and recordDeposit COALESCEs deposit_recorded_at so no marker changes that could be inferred as a fresh claim. Exists because the couple write policy is FOR ALL with no column list while authenticated holds a table-wide UPDATE grant.';

COMMIT;
