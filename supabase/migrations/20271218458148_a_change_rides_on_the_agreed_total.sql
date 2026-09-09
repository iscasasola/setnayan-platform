-- ============================================================================
-- A CHANGE RIDES ON THE AGREED TOTAL — it never replaces it.
--
-- Owner ruling 2026-09-09, asked directly whether a price change after a lock
-- should replace the agreed total or sit beside it:
--
--     "Both, shown separately."
--
-- The agreed total UPDATES and the change stays visible as its own line. He was
-- told plainly that this is the most work and that two numbers to keep in step
-- is exactly how the current defect happened, and chose it anyway.
--
-- ── WHAT WAS WRONG ──────────────────────────────────────────────────────────
-- `accept_change_order` settles the agreed delta as a signed row in
-- `event_vendor_line_items`, which is right. But that table has always carried
-- ONE meaning: the couple's ITEMISED BREAKDOWN of a supplier's price, with
-- `event_vendors.total_cost_php` as the fallback when no breakdown exists. Every
-- money reader implements that as "once any manual line exists, bill the lines
-- and DROP the headline."
--
-- So accepting a −₱15,000 reduction on a supplier billed at ₱100,000 did not
-- report ₱85,000. It DELETED the ₱100,000 and reported −₱15,000.
-- `lib/a-settled-delta-must-not-erase-the-headline.test.ts` has measured exactly
-- that, executably, since the change-order feature shipped — it named the
-- defect and raised the repair to the owner rather than taking it, because
-- changing what a real couple's budget reports is his call. This is that call
-- landing.
--
-- ⚠ THE ONE BRANCH WHERE IT ALREADY BEHAVED IS USED BY NOBODY. A package anchor
-- bills its agreed total and rides the lines ON TOP — correct — and production
-- holds ZERO package anchors (measured 2026-09-10). Every real supplier is
-- headline- or breakdown-billed, so the broken branch was the only branch.
--
-- ── WHY A COLUMN AND NOT "JUST ALWAYS ADD THE LINES ON TOP" ──────────────────
-- Because production disproves that fix outright. All 12 suppliers that carry
-- line items today have Σ(lines) EXACTLY EQUAL to `total_cost_php` — they are a
-- breakdown OF the headline, not extras beside it:
--
--     Hain Catering    ₱225,000 headline · 2 lines · ₱225,000
--     Alon Films        ₱95,000 headline · 2 lines ·  ₱95,000
--     Bulaklak & Co.    ₱78,000 headline · 2 lines ·  ₱78,000   … and 9 more
--
-- Riding those on top would DOUBLE every one of them. The two meanings have to
-- be told apart in the row itself, so this adds the fact that distinguishes
-- them. A comment cannot do it: a comment does not travel with the value into a
-- query result.
--
-- ── SAFE BY ARITHMETIC AT THE MERGE (read out of prod 2026-09-10) ────────────
--   · `vendor_change_orders`               0 rows, ever  → nothing is reclassified
--   · `event_vendor_line_items`           18 rows        → all default FALSE
--   · `event_vendors` with package_role='anchor'  0 rows → no branch flips
-- Every existing row keeps the meaning it already had, so this migration changes
-- no number on any screen the day it lands. It changes what the NEXT accepted
-- change order does.
--
-- ⚠ GRANTS ARE TABLE-LEVEL ON THIS TABLE (verified in prod: `authenticated` and
-- `anon` hold SELECT/INSERT/UPDATE at TABLE level, not per column), so the new
-- column is readable the moment it exists and no allowlist has to be extended.
-- That is NOT true of `events` — do not carry this assumption there.
--
-- ⚖ NOT REVOKED FROM `authenticated`, deliberately. The couple's write policy on
-- this table is `FOR ALL` on their own event, and `total_cost_php` is already
-- theirs to type — this table IS the couple's own budget record, not a charge.
-- A column-level REVOKE against a TABLE-level grant is inert anyway; narrowing
-- it properly means a table revoke plus a 9-column allowlist on a live read
-- path, which is its own change and its own risk.
-- ============================================================================

ALTER TABLE public.event_vendor_line_items
  ADD COLUMN IF NOT EXISTS is_change_delta BOOLEAN NOT NULL DEFAULT FALSE;

COMMENT ON COLUMN public.event_vendor_line_items.is_change_delta IS
  'FALSE (default) = a BREAKDOWN line: part of the couple''s itemisation of this '
  'supplier''s agreed price, and it REPLACES event_vendors.total_cost_php as the '
  'base. TRUE = a CHANGE line: a settled change-order delta that RIDES ON TOP of '
  'whatever the base is, signed (negative = credit). Owner 2026-09-09, "Both, '
  'shown separately" — the agreed total updates AND the change stays its own '
  'line. Only accept_change_order sets TRUE. Read the shared rule in '
  'apps/web/lib/agreed-total-and-its-changes.ts; never re-derive this from the '
  'label text, which a couple can type themselves.';

-- ── accept_change_order — the LIVE body (read out of prod with
--    pg_get_functiondef on 2026-09-10), with ONE change: the settlement row is
--    stamped `is_change_delta = TRUE` so every money reader bills it on top of
--    the agreed total instead of in place of it. Nothing else moves — not the
--    ownership test, not the single-winner gate, not the idempotent branch.
CREATE OR REPLACE FUNCTION public.accept_change_order(p_change_order_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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

  -- 🔑 `is_change_delta = TRUE` is the whole of the 2026-09-09 owner ruling in
  -- one column. Without it this row is read as a BREAKDOWN line and DELETES the
  -- supplier's agreed price instead of adjusting it. It is set HERE, in the
  -- SECURITY DEFINER function that is the only legitimate author of a settled
  -- delta — never inferred downstream from the label above.
  INSERT INTO public.event_vendor_line_items
    (event_id, vendor_id, label, amount_php, due_date, is_change_delta)
  VALUES
    (v_event_id, v_event_vendor_id, v_label, v_delta, v_due_date, TRUE)
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
$function$;
