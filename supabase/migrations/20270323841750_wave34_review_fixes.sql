-- wave34_review_fixes
-- ============================================================================
-- WAVE-3/4 VENDOR-BENEFITS ADVERSARIAL-REVIEW FIXES (security + money + concurrency)
--
-- Six code-substantiated bugs in already-merged Wave-3/4 vendor surfaces. Each
-- fix is the minimal, root-cause correction; all are idempotent so this
-- migration is safe to re-apply.
--
--   A (HIGH)   Couple can forge the vendor's deposit acknowledgement.
--   B (HIGH)   Credit/removal change-order inflates the couple's budget.
--   C (MEDIUM) No-Show policy-acknowledgement evidence is couple-forgeable.
--   E (LOW)    advance_schedule_block START cross-row TOCTOU (two live blocks).
--   F (LOW)    Waitlist couple UPDATE policy is too permissive.
--
--   (Fix D — recordDeposit double-counting the payment ledger — is an
--    app-code-only change in apps/web/app/dashboard/[eventId]/vendors/actions.ts;
--    no schema change, so it is not in this migration.)
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- A (HIGH) · Lock deposit_acknowledged_at to the vendor's DEFINER RPC only.
--
-- event_vendors.deposit_acknowledged_at is meant to be VENDOR-set, exclusively
-- via the SECURITY DEFINER acknowledge_vendor_deposit() RPC. But the couple
-- write policy is `FOR ALL` with no column restriction, so a couple could
-- forge the acknowledgement via a raw PostgREST UPDATE.
--
-- A column-level REVOKE UPDATE (deposit_acknowledged_at) does NOT close this:
-- both `authenticated` and `anon` hold a TABLE-WIDE UPDATE grant on
-- event_vendors (the Supabase `GRANT ALL ... TO authenticated, anon` default),
-- and a table-level UPDATE confers UPDATE on every column regardless of any
-- column-level revoke. So we use the prompt's noted safer alternative: a BEFORE
-- UPDATE trigger that rejects a change to deposit_acknowledged_at from a
-- non-owner role.
--
-- The DEFINER acknowledge_vendor_deposit() RPC runs as the table owner
-- (current_user='postgres', verified), so it passes; service_role (admin
-- client) passes too. Direct PostgREST writes run as 'authenticated'/'anon' and
-- are rejected the instant they try to change this column. The couple
-- legitimately writes deposit_recorded_at + deposit_proof_url — those are
-- untouched (recordDeposit verified to never write deposit_acknowledged_at, so
-- this breaks no legitimate path).
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.guard_event_vendor_deposit_ack()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $guard$
BEGIN
  -- Only the SECURITY DEFINER RPC (runs as owner 'postgres') and the
  -- service_role admin client may change the vendor's acknowledgement. A direct
  -- couple/guest PostgREST UPDATE (role authenticated/anon) cannot forge it.
  IF NEW.deposit_acknowledged_at IS DISTINCT FROM OLD.deposit_acknowledged_at
     AND current_user IN ('authenticated', 'anon') THEN
    RAISE EXCEPTION 'deposit_acknowledged_at is vendor-set only (via acknowledge_vendor_deposit)'
      USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$guard$;

DROP TRIGGER IF EXISTS event_vendors_guard_deposit_ack ON public.event_vendors;
CREATE TRIGGER event_vendors_guard_deposit_ack
  BEFORE UPDATE ON public.event_vendors
  FOR EACH ROW
  EXECUTE FUNCTION public.guard_event_vendor_deposit_ack();

COMMENT ON FUNCTION public.guard_event_vendor_deposit_ack() IS
  'BEFORE UPDATE guard: rejects any change to event_vendors.deposit_acknowledged_at made directly by the authenticated/anon PostgREST roles. The vendor''s acknowledgement may only be set by the SECURITY DEFINER acknowledge_vendor_deposit() RPC (runs as owner postgres) or the service_role admin client. Closes the couple-forgeable-ack hole left by the table-wide UPDATE grant + column-unrestricted FOR ALL couple-write RLS.';

-- ----------------------------------------------------------------------------
-- B (HIGH) · Signed change-order ledger (a credit must REDUCE the budget).
--
-- accept_change_order() settled ABS(delta) into event_vendor_line_items, which
-- carried CHECK (amount_php >= 0). So a removal (negative delta) stored a
-- POSITIVE amount and lib/budget.ts (which sums amount_php positively) treated a
-- credit as money OWED. Fix: drop the non-negative CHECK so a credit can store
-- a signed-negative amount, and settle the SIGNED delta. Manual couple entry
-- still validates > 0 at the app layer (parseRequiredMoney), so only
-- change-order credits ever produce a negative line.
-- ----------------------------------------------------------------------------

ALTER TABLE public.event_vendor_line_items
  DROP CONSTRAINT IF EXISTS event_vendor_line_items_amount_php_check;

-- Re-define accept_change_order to settle the SIGNED delta (NOT ABS). This is
-- the exact body shipped in 20270320861005_change_order_trail.sql with one
-- change: the INSERT stores v_delta (signed) instead of ABS(v_delta). The
-- credit/add-on label encoding is preserved (it still communicates the sign in
-- the human-readable label, and the signed delta_amount_php on the change-order
-- row remains the canonical audited figure).
CREATE OR REPLACE FUNCTION public.accept_change_order(
  p_change_order_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_event_id          UUID;
  v_event_vendor_id   UUID;
  v_raised_by         TEXT;
  v_status            TEXT;
  v_title             TEXT;
  v_delta             NUMERIC(12, 2);
  v_due_date          DATE;
  v_is_couple         BOOLEAN;
  v_is_vendor         BOOLEAN;
  v_line_item_id      UUID;
  v_label             TEXT;
  v_rows              INTEGER;
BEGIN
  -- FOR UPDATE serializes concurrent responders (two accepts, or
  -- accept-vs-decline): the second waits, then re-reads the now-resolved status
  -- and is caught by the idempotent branch / precondition below.
  SELECT event_id, event_vendor_id, raised_by, status, title, delta_amount_php,
         proposed_due_date
    INTO v_event_id, v_event_vendor_id, v_raised_by, v_status, v_title, v_delta,
         v_due_date
    FROM public.vendor_change_orders
   WHERE change_order_id = p_change_order_id
   FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'change_order_not_found' USING ERRCODE = 'P0002';
  END IF;

  -- Ownership: the ACCEPTING party must be the COUNTERPARTY to raised_by.
  --   couple-raised -> vendor accepts;  vendor-raised -> couple accepts.
  v_is_couple := v_event_id IN (SELECT public.current_couple_event_ids());
  v_is_vendor := v_event_vendor_id IN (SELECT public.current_vendor_event_vendor_ids());

  IF v_raised_by = 'couple' THEN
    IF NOT (v_is_vendor OR public.is_admin()) THEN
      RAISE EXCEPTION 'not_counterparty' USING ERRCODE = '42501';
    END IF;
  ELSE -- raised_by = 'vendor'
    IF NOT (v_is_couple OR public.is_admin()) THEN
      RAISE EXCEPTION 'not_counterparty' USING ERRCODE = '42501';
    END IF;
  END IF;

  -- IDEMPOTENCY: a re-call on an already-resolved order returns its state
  -- gracefully (the single-winner already won) — not an error.
  IF v_status <> 'proposed' THEN
    RETURN jsonb_build_object('status', 'already', 'resolved_status', v_status);
  END IF;

  -- Settle the SIGNED delta into the budget ledger (single source of truth).
  -- The non-negative CHECK is dropped (above), so a removal stores a negative
  -- amount that correctly REDUCES the couple's total. The sign also lives in the
  -- label and in the audited delta_amount_php on the change-order row.
  v_label := CASE
    WHEN v_delta < 0 THEN 'Change order (credit): ' || COALESCE(v_title, 'scope reduction')
    ELSE 'Change order: ' || COALESCE(v_title, 'add-on')
  END;
  v_label := left(v_label, 64);  -- event_vendor_line_items.label CHECK <= 64

  INSERT INTO public.event_vendor_line_items
    (event_id, vendor_id, label, amount_php, due_date)
  VALUES
    (v_event_id, v_event_vendor_id, v_label, v_delta, v_due_date)
  RETURNING line_item_id INTO v_line_item_id;

  -- Status precondition in the WHERE (defense in depth alongside FOR UPDATE):
  -- the transition is atomically single-winner even if the lock is ever
  -- removed. status='proposed' is the single-winner gate.
  UPDATE public.vendor_change_orders
     SET status = 'accepted',
         acknowledged_by_user_id = auth.uid(),
         acknowledged_at = NOW(),
         settled_line_item_id = v_line_item_id,
         updated_at = NOW()
   WHERE change_order_id = p_change_order_id
     AND status = 'proposed';
  GET DIAGNOSTICS v_rows = ROW_COUNT;
  IF v_rows = 0 THEN
    -- Lost the race to a concurrent winner between the FOR UPDATE read and the
    -- UPDATE (only possible if the lock is removed). Raising rolls back our
    -- ledger insert above — the whole RPC is one transaction, so the orphan
    -- line item never lands.
    RAISE EXCEPTION 'already_resolved' USING ERRCODE = '22023';
  END IF;

  -- Bump the booking row so layout-cached vendor fields refresh.
  UPDATE public.event_vendors
     SET updated_at = NOW()
   WHERE vendor_id = v_event_vendor_id;

  RETURN jsonb_build_object(
    'status', 'ok',
    'line_item_id', v_line_item_id,
    'delta_amount_php', v_delta
  );
END;
$$;

REVOKE ALL ON FUNCTION public.accept_change_order(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.accept_change_order(UUID) FROM anon;
GRANT EXECUTE ON FUNCTION public.accept_change_order(UUID) TO authenticated;

COMMENT ON FUNCTION public.accept_change_order(UUID) IS
  'Counterparty accepts a proposed change order (couple-raised -> vendor accepts; vendor-raised -> couple accepts; or admin). Serialized via SELECT FOR UPDATE + status=proposed precondition UPDATE -> single-winner; idempotent re-call returns status=already. On accept settles the SIGNED delta_amount_php into event_vendor_line_items (a removal stores a negative amount that reduces the budget; sign also encoded in the label) and links it via settled_line_item_id — all in one transaction. No money moves; 0% commission, off-platform pay.';

COMMENT ON COLUMN public.event_vendor_line_items.amount_php IS
  'Signed PHP amount. Couple manual entries validate > 0 at the app layer (parseRequiredMoney); only change-order credits (accept_change_order) store a negative amount, which correctly reduces the budget total. The non-negative CHECK was dropped in wave34_review_fixes to allow credit lines.';

-- ----------------------------------------------------------------------------
-- C (MEDIUM) · Drop the unused, couple-forgeable policy-ack INSERT policy.
--
-- event_vendor_policy_acknowledgements is written ONLY by the service-role
-- admin client (snapshotPolicyAcknowledgement), which bypasses RLS. The
-- authenticated `_host_insert` policy is therefore dead — but it let a couple
-- plant immutable forfeit-dispute evidence (write-once table). Drop it; keep the
-- `_host_select` read policy so the couple can still see their frozen ack.
-- ----------------------------------------------------------------------------

DROP POLICY IF EXISTS event_vendor_policy_acknowledgements_host_insert
  ON public.event_vendor_policy_acknowledgements;

-- ----------------------------------------------------------------------------
-- E (LOW) · One-live-block-per-event invariant (advance_schedule_block TOCTOU).
--
-- The START branch reads count(*) WHERE run_state='live' UNLOCKED, then sets a
-- DIFFERENT row live — so two concurrent STARTs on different upcoming blocks can
-- both go live (the per-row FOR UPDATE can't see a cross-row race). A partial
-- unique index makes the second commit fail at the DB level. (Verified: no
-- event currently has 2+ live blocks, so this index creates clean.) The ADVANCE
-- branch marks the current block done before lighting the next within one
-- transaction, so it stays within the invariant.
-- ----------------------------------------------------------------------------

CREATE UNIQUE INDEX IF NOT EXISTS event_schedule_blocks_one_live_per_event
  ON public.event_schedule_blocks (event_id)
  WHERE run_state = 'live';

-- ----------------------------------------------------------------------------
-- F (LOW) · Constrain the waitlist couple UPDATE to safe self-states.
--
-- vendor_date_waitlist_couple_update let the couple set status to ANY value,
-- including the vendor-only 'notified'/'converted'. Recreate it so the couple
-- can only keep the row pending or self-cancel; vendor-only states stay
-- service-role / vendor-RPC territory.
-- ----------------------------------------------------------------------------

DROP POLICY IF EXISTS vendor_date_waitlist_couple_update ON public.vendor_date_waitlist;
CREATE POLICY vendor_date_waitlist_couple_update
  ON public.vendor_date_waitlist FOR UPDATE TO authenticated
  USING ((user_id = auth.uid()) OR public.is_admin())
  WITH CHECK (
    ((user_id = auth.uid()) AND status IN ('pending', 'cancelled'))
    OR public.is_admin()
  );

COMMIT;
