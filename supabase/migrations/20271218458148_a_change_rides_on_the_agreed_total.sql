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
--   RE-MEASURED 2026-09-11 (read-only, prod): still 0 change orders (0 accepted,
--   0 line items linked by settled_line_item_id) · 18 line items over 12
--   suppliers, all 12 with Σ(lines) = total_cost_php · 0 package anchors ·
--   0 locked deals (proposal_amendments.locked_at) · 0 locked threads. So § 5
--   to § 7 below also move no number that exists today.
--
-- ⚠ GRANTS ARE TABLE-LEVEL ON THIS TABLE (verified in prod: `authenticated` and
-- `anon` hold SELECT/INSERT/UPDATE at TABLE level, not per column), so the new
-- column is readable the moment it exists and no allowlist has to be extended.
-- That is NOT true of `events` — do not carry this assumption there.
--
-- ⚖ THE GRANT IS NOT NARROWED — A TRIGGER HOLDS THE LINE INSTEAD (§ 4 below).
-- The couple's write policy on this table is `FOR ALL` on their own event, and
-- a column-level REVOKE against a TABLE-level grant is inert. Narrowing it
-- properly means a table revoke plus a 9-column allowlist on a live read path,
-- which is its own change and its own risk. But "a couple may type their own
-- breakdown" is NOT "a couple may author a line headed 'Changes you both
-- agreed'" — that heading claims the SUPPLIER's agreement, and the supplier can
-- read this table. So `guard_event_vendor_line_item_change` refuses a browser
-- session that tries to create, re-flag, edit or delete a change line.
--
-- ── WHAT 2026-09-11 ADDED (B2 rework of #5390) ───────────────────────────────
--   § 3 · a line already settled by a change order is stamped TRUE (taken from
--         the never-committed `an_adjustment_never_erases_the_price` draft —
--         0 rows in prod, but the column must be right on any database).
--   § 4 · the guard above.
--   § 5 · `record_agreed_price_change` — the POST-LOCK DEAL writes a change
--         beside the agreed total too, instead of overwriting `total_cost_php`
--         (the branch #5390 did not cover; it overwrote since #5355).
--   § 6 · `booking_fee_open_lock_charge` reads the agreed total INCLUDING its
--         changes, so the 2026-09-09 owner ruling "the fee base moves with the
--         price" survives the price no longer moving `total_cost_php`.
--   § 7 · `booking_fee_rederive_lock_fee` reads the same base, and a change line
--         fires the re-derive a `total_cost_php` move always fired.
-- ============================================================================

ALTER TABLE public.event_vendor_line_items
  ADD COLUMN IF NOT EXISTS is_change_delta BOOLEAN NOT NULL DEFAULT FALSE;

COMMENT ON COLUMN public.event_vendor_line_items.is_change_delta IS
  'FALSE (default) = a BREAKDOWN line: part of the couple''s itemisation of this '
  'supplier''s agreed price, and it REPLACES event_vendors.total_cost_php as the '
  'base. TRUE = a CHANGE line: a settled change-order delta that RIDES ON TOP of '
  'whatever the base is, signed (negative = credit). Owner 2026-09-09, "Both, '
  'shown separately" — the agreed total updates AND the change stays its own '
  'line. Only accept_change_order and record_agreed_price_change set TRUE, and '
  'guard_event_vendor_line_item_change refuses a browser session that tries to. '
  'Read the shared rule in '
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
  -- The non-negative CHECK is dropped (20270323841750), so a removal stores a negative
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

COMMENT ON FUNCTION public.accept_change_order(UUID) IS
  'Counterparty accepts a proposed change order (couple-raised -> vendor accepts; vendor-raised -> couple accepts; or admin). Serialized via SELECT FOR UPDATE + status=proposed precondition UPDATE -> single-winner; idempotent re-call returns status=already. Settles the SIGNED delta_amount_php into event_vendor_line_items as a CHANGE line (is_change_delta = TRUE, so it rides on the supplier''s agreed total instead of replacing it) and links it via settled_line_item_id — all in one transaction. No money moves; 0% commission, off-platform pay.';

-- ============================================================================
-- § 3 · A LINE ALREADY SETTLED BY A CHANGE ORDER IS A CHANGE LINE.
--
-- Taken from the never-committed draft `an_adjustment_never_erases_the_price`
-- (rescued 2026-09-10): historic correctness, not a no-op waiting to happen.
-- `settled_line_item_id` is the authoritative link from a change order to the
-- line it wrote. ZERO rows match in production (0 change orders ever, measured
-- 2026-09-11); the statement exists so the column is right on any database that
-- does have them, a developer's included — otherwise such a row would keep
-- DELETING the price it adjusts.
-- ============================================================================
UPDATE public.event_vendor_line_items li
   SET is_change_delta = TRUE
  FROM public.vendor_change_orders co
 WHERE co.settled_line_item_id = li.line_item_id
   AND li.is_change_delta IS DISTINCT FROM TRUE;

-- ============================================================================
-- § 4 · ONLY THE SERVER AUTHORS A CHANGE LINE.
--
-- The card heads these rows "Changes you both agreed" — a claim about the
-- SUPPLIER's consent — and the supplier can read this table
-- (`event_vendor_line_items_vendor_read`). The couple's `FOR ALL` policy would
-- otherwise let a browser session insert a TRUE row, flip one of its own
-- breakdown lines to TRUE (so it rides ON TOP of the price), edit the amount of
-- a settled change, or delete it — each of which puts the budget and the
-- change-order trail (which keeps saying "accepted") into disagreement.
--
-- ⚠ SECURITY INVOKER ON PURPOSE, like every sibling guard here
-- (`guard_event_vendor_completion`, `guard_event_vendor_deposit_ack`). Inside a
-- DEFINER function `current_user` is the owner, the role test never matches, and
-- the guard would be permanently inert while looking correct. That is ALSO why
-- the two legitimate authors pass: `accept_change_order` and
-- `record_agreed_price_change` are SECURITY DEFINER, so inside them
-- `current_user` is the owner; the service role is neither `anon` nor
-- `authenticated`. And a cascade from deleting the supplier or the event runs
-- as the table owner, so removing a supplier still removes its lines.
--
-- ⚠ A breakdown line (FALSE) is untouched by all of this — the couple's own
-- additions stay theirs to add, edit and delete exactly as before.
-- ============================================================================
CREATE OR REPLACE FUNCTION public.guard_event_vendor_line_item_change()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF current_user IN ('authenticated', 'anon') AND NOT public.is_admin() THEN
    IF TG_OP = 'INSERT' THEN
      -- `IS DISTINCT FROM FALSE`, not `= TRUE`: a NULL must never fail open.
      -- The column is NOT NULL DEFAULT FALSE and a default is applied before a
      -- BEFORE ROW trigger fires, so an ordinary insert arrives FALSE.
      IF NEW.is_change_delta IS DISTINCT FROM FALSE THEN
        RAISE EXCEPTION 'change_line_is_server_authored'
          USING ERRCODE = '42501',
                HINT = 'A change after a lock is recorded by accepting a change order or locking a new deal, never typed.';
      END IF;
      RETURN NEW;
    END IF;

    IF TG_OP = 'UPDATE' THEN
      IF NEW.is_change_delta IS DISTINCT FROM OLD.is_change_delta THEN
        RAISE EXCEPTION 'change_line_is_server_authored'
          USING ERRCODE = '42501',
                HINT = 'A line cannot be turned into, or out of, an agreed change.';
      END IF;
      IF OLD.is_change_delta
         AND (NEW.amount_php IS DISTINCT FROM OLD.amount_php
              OR NEW.label IS DISTINCT FROM OLD.label
              OR NEW.vendor_id IS DISTINCT FROM OLD.vendor_id
              OR NEW.event_id IS DISTINCT FROM OLD.event_id) THEN
        RAISE EXCEPTION 'change_line_is_server_authored'
          USING ERRCODE = '42501',
                HINT = 'An agreed change is undone by another change, not edited.';
      END IF;
      RETURN NEW;
    END IF;

    IF TG_OP = 'DELETE' AND OLD.is_change_delta THEN
      RAISE EXCEPTION 'change_line_is_server_authored'
        USING ERRCODE = '42501',
              HINT = 'An agreed change is undone by another change, not deleted.';
    END IF;
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;

REVOKE ALL ON FUNCTION public.guard_event_vendor_line_item_change() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS event_vendor_line_items_change_guard ON public.event_vendor_line_items;
CREATE TRIGGER event_vendor_line_items_change_guard
  BEFORE INSERT OR UPDATE OR DELETE ON public.event_vendor_line_items
  FOR EACH ROW EXECUTE FUNCTION public.guard_event_vendor_line_item_change();

-- ============================================================================
-- § 5 · A NEW DEAL AFTER THE LOCK IS A CHANGE TOO — recorded beside the agreed
--       total, never over it.
--
-- 🔴 THE BRANCH #5390 DID NOT COVER. Since #5355 (2026-09-09) a Deal the couple
-- locks on an ALREADY-BOOKED supplier (`planChatLockBooking` →
-- 'refresh_fee_only') wrote `event_vendors.total_cost_php := <new total>` — an
-- absolute overwrite. The ₱100,000 they agreed at the lock was gone and nothing
-- said a change had happened: exactly the REPLACE the owner ruled against on
-- 2026-09-09 ("Both, shown separately").
--
-- So the reprice now leaves `total_cost_php` alone and records the difference as
-- a CHANGE line — the same row shape `accept_change_order` writes — so the
-- agreed total and every change agreed since are both on screen, and the shared
-- rule (`lib/agreed-total-and-its-changes.ts`) adds them up.
--
-- ── WHAT THE CHANGE IS MEASURED AGAINST ─────────────────────────────────────
--   delta = new total − (total_cost_php + Σ change lines already on it)
-- i.e. against the price as it stands AFTER every change agreed so far. So:
--   · a second press of the SAME Deal finds delta = 0 and writes nothing —
--     idempotent by arithmetic, and FOR UPDATE on the booking row serialises two
--     presses racing each other;
--   · a Deal after a change order, or a Deal after a Deal, lands the agreed total
--     exactly on the new number, never on the new number plus old changes.
-- It is deliberately NOT measured against the budget's display cascade
-- (catalogue / breakdown): the line records what the two of them CHANGED, and
-- that is a fact about the agreement, not about how a screen chooses to price.
--
-- ⚠ NO AGREED TOTAL YET (NULL or 0) → there is nothing to keep beside, so the
-- new total lands AS the agreed total (the pre-existing absolute write). A
-- "change" of the whole price from zero would read as an extra on top of nothing.
--
-- 🔒 SERVICE ROLE ONLY. The new total is computed on the server from the
-- accepted amendment (`lockDeal` → `dealLockReadiness`), and the ids are proved
-- by the couple's own session before the call (the thread role, then an RLS read
-- of this booking row). A browser session must not be able to call this with a
-- number of its own choosing — that would forge "Changes you both agreed".
-- ============================================================================
CREATE OR REPLACE FUNCTION public.record_agreed_price_change(
  p_event_id        UUID,
  p_event_vendor_id UUID,
  p_new_total_php   NUMERIC
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_headline NUMERIC(12, 2);
  v_changes  NUMERIC(12, 2);
  v_delta    NUMERIC(12, 2);
  v_line_id  UUID;
  v_label    TEXT;
BEGIN
  IF p_new_total_php IS NULL OR p_new_total_php < 0 THEN
    RAISE EXCEPTION 'invalid_agreed_total' USING ERRCODE = '22023';
  END IF;

  -- The booking row is the serialisation point: two presses of one Deal queue
  -- here, and the second re-reads the first one's change line below.
  SELECT total_cost_php
    INTO v_headline
    FROM public.event_vendors
   WHERE vendor_id = p_event_vendor_id
     AND event_id = p_event_id
   FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('status', 'not_found');
  END IF;

  IF v_headline IS NULL OR v_headline = 0 THEN
    UPDATE public.event_vendors
       SET total_cost_php = p_new_total_php,
           updated_at = NOW()
     WHERE vendor_id = p_event_vendor_id
       AND event_id = p_event_id;
    RETURN jsonb_build_object('status', 'priced', 'agreed_total_php', p_new_total_php);
  END IF;

  SELECT COALESCE(SUM(amount_php), 0)
    INTO v_changes
    FROM public.event_vendor_line_items
   WHERE vendor_id = p_event_vendor_id
     AND event_id = p_event_id
     AND is_change_delta;

  v_delta := p_new_total_php - (v_headline + v_changes);

  IF v_delta = 0 THEN
    RETURN jsonb_build_object(
      'status', 'unchanged',
      'agreed_total_php', v_headline + v_changes
    );
  END IF;

  v_label := CASE
    WHEN v_delta < 0 THEN 'New deal agreed in chat (price lowered)'
    ELSE 'New deal agreed in chat (price raised)'
  END;

  INSERT INTO public.event_vendor_line_items
    (event_id, vendor_id, label, amount_php, is_change_delta)
  VALUES
    (p_event_id, p_event_vendor_id, v_label, v_delta, TRUE)
  RETURNING line_item_id INTO v_line_id;

  -- Bump the booking row so layout-cached vendor fields refresh — the same
  -- bump `accept_change_order` makes. The price column is NOT touched.
  UPDATE public.event_vendors
     SET updated_at = NOW()
   WHERE vendor_id = p_event_vendor_id
     AND event_id = p_event_id;

  RETURN jsonb_build_object(
    'status', 'changed',
    'line_item_id', v_line_id,
    'delta_php', v_delta,
    'agreed_before_php', v_headline + v_changes,
    'agreed_total_php', p_new_total_php
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.record_agreed_price_change(UUID, UUID, NUMERIC) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_agreed_price_change(UUID, UUID, NUMERIC) TO service_role;

COMMENT ON FUNCTION public.record_agreed_price_change(UUID, UUID, NUMERIC) IS
  'Service-role only. A Deal locked on an ALREADY-BOOKED supplier: records (new total - (total_cost_php + existing change lines)) as a CHANGE line (is_change_delta = TRUE) beside the agreed total, never over it (owner 2026-09-09, "Both, shown separately"). Delta 0 writes nothing (idempotent); a booking with no agreed total yet is priced instead. FOR UPDATE on the booking row serialises concurrent presses.';

-- ============================================================================
-- § 6 · THE BOOKING FEE READS THE AGREED TOTAL, CHANGES INCLUDED.
--
-- ⚖ THIS KEEPS AN OWNER RULING, IT DOES NOT MAKE ONE. On 2026-09-09 the owner
-- chose to reprice an already-booked supplier, and the decision log records
-- "THE FEE BASE MOVES WITH THE PRICE, AND THAT IS THE RULING" — the fee is
-- charged, at the supplier's payment acknowledgement, on what they booked at.
-- It moved because `total_cost_php` moved. § 5 stops `total_cost_php` moving, so
-- without this the fee would silently fall back to the PRE-change price.
--
-- ⇒ The base is now `total_cost_php + Σ change lines`, floored at zero — the
-- same "agreed total" § 5 measures against. This ALSO means a change order
-- accepted BEFORE the acknowledgement now moves the fee base, which it never
-- did; by the same ruling that is right (it is what they booked at). Once the
-- charge is minted this function only ever REUSES it (the idempotent branch
-- below is unchanged); a later change reaches the minted charge through the
-- re-derive in § 7, exactly as a `total_cost_php` move always has.
--
-- 🔢 Nothing already charged is touched: 0 change orders and 0 locked deals
-- exist in production (measured 2026-09-11), and a minted charge is reused, not
-- recomputed.
--
-- The body is the LIVE one (`pg_get_functiondef`, 2026-09-11 — identical to
-- 20271009180000's, compared with comments stripped) with exactly ONE change:
-- the `amount_centavos` expression.
-- ============================================================================
CREATE OR REPLACE FUNCTION public.booking_fee_open_lock_charge(p_event_vendor_id uuid, p_schedule_version text DEFAULT '2026-07-25-taper5-1-over-100k'::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_ev          RECORD;
  v_ledger      RECORD;
  v_existing    RECORD;
  v_ordinal     INTEGER;
  v_is_free     BOOLEAN;
  v_fee         BIGINT;
  v_charge_amount BIGINT;
  v_status      TEXT;
  v_attribution TEXT;
  v_charge_id   UUID;
BEGIN
  SELECT ev.marketplace_vendor_id AS vpid,
         ev.event_id,
         ev.status,
         ev.package_role,
         -- § 6 · THE ONE CHANGE: the agreed total INCLUDING the changes agreed
         -- since (is_change_delta lines), floored at zero.
         GREATEST(
           COALESCE(round((
             COALESCE(ev.total_cost_php, 0)
             + COALESCE((SELECT SUM(li.amount_php)
                           FROM public.event_vendor_line_items li
                          WHERE li.vendor_id = ev.vendor_id
                            AND li.is_change_delta), 0)
           ) * 100)::BIGINT, 0),
           0
         ) AS amount_centavos
    INTO v_ev
    FROM public.event_vendors ev
    WHERE ev.vendor_id = p_event_vendor_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('skipped', 'not_found');
  END IF;

  -- THE GUARD. A covered row is one service inside a package, not a booking.
  -- Its anchor carries the money and takes the one fee.
  IF v_ev.package_role = 'covered' THEN
    RETURN jsonb_build_object('skipped', 'covered_row_no_fee');
  END IF;

  IF v_ev.vpid IS NULL THEN
    RETURN jsonb_build_object('skipped', 'not_verified_vendor');
  END IF;
  IF v_ev.status NOT IN ('contracted', 'deposit_paid', 'delivered', 'complete') THEN
    RETURN jsonb_build_object('skipped', 'not_contracted');
  END IF;

  v_attribution := public.booking_fee_attribution_for(v_ev.vpid, v_ev.event_id);

  PERFORM pg_advisory_xact_lock(hashtextextended(v_ev.vpid::text, 0));

  INSERT INTO public.booking_fee_ledger
    (vendor_profile_id, event_id, source, attribution, attribution_frozen_at,
     highest_declared_centavos)
  VALUES
    (v_ev.vpid, v_ev.event_id, 'lock', v_attribution, NOW(), v_ev.amount_centavos)
  ON CONFLICT (vendor_profile_id, event_id) DO UPDATE
    SET highest_declared_centavos =
          GREATEST(COALESCE(public.booking_fee_ledger.highest_declared_centavos, 0),
                   EXCLUDED.highest_declared_centavos),
        source = 'lock',
        updated_at = NOW()
  RETURNING * INTO v_ledger;

  IF v_ledger.attribution = 'import' THEN
    SELECT charge_id, status INTO v_existing
      FROM public.booking_fee_charges
      WHERE event_vendor_id = p_event_vendor_id
        AND status IN ('pending', 'paid', 'waived_import', 'waived_free5')
      LIMIT 1;
    IF FOUND THEN
      RETURN jsonb_build_object(
        'charge_id', v_existing.charge_id, 'status', v_existing.status,
        'amount_charged_centavos', 0, 'computed_fee_centavos', 0,
        'is_free', TRUE, 'attribution', 'import', 'reused', TRUE);
    END IF;

    INSERT INTO public.booking_fee_charges
      (ledger_id, proposal_id, event_vendor_id, source, vendor_profile_id, event_id,
       proposal_amount_centavos, computed_fee_centavos, amount_charged_centavos,
       schedule_version, status)
    VALUES
      (v_ledger.ledger_id, NULL, p_event_vendor_id, 'lock', v_ev.vpid, v_ev.event_id,
       v_ev.amount_centavos, 0, 0, p_schedule_version, 'waived_import')
    RETURNING charge_id INTO v_charge_id;

    RETURN jsonb_build_object(
      'charge_id', v_charge_id, 'status', 'waived_import',
      'amount_charged_centavos', 0, 'computed_fee_centavos', 0,
      'is_free', TRUE, 'attribution', 'import', 'reused', FALSE);
  END IF;

  IF v_ledger.booking_ordinal IS NULL THEN
    SELECT count(*) INTO v_ordinal
      FROM public.booking_fee_ledger l2
      WHERE l2.vendor_profile_id = v_ev.vpid
        AND l2.source = 'lock'
        AND (l2.created_at, l2.ledger_id) <= (v_ledger.created_at, v_ledger.ledger_id);
    v_ordinal := GREATEST(v_ordinal, 1);
    v_is_free := v_ordinal <= 5;
    UPDATE public.booking_fee_ledger
      SET booking_ordinal = v_ordinal, is_free_booking = v_is_free, updated_at = NOW()
      WHERE ledger_id = v_ledger.ledger_id;
  ELSE
    v_ordinal := v_ledger.booking_ordinal;
    v_is_free := v_ledger.is_free_booking;
  END IF;

  SELECT charge_id, status, amount_charged_centavos, computed_fee_centavos
    INTO v_existing
    FROM public.booking_fee_charges
    WHERE event_vendor_id = p_event_vendor_id
      AND status IN ('pending', 'paid', 'waived_import', 'waived_free5')
    LIMIT 1;
  IF FOUND THEN
    RETURN jsonb_build_object(
      'charge_id', v_existing.charge_id, 'status', v_existing.status,
      'amount_charged_centavos', v_existing.amount_charged_centavos,
      'computed_fee_centavos', v_existing.computed_fee_centavos,
      'booking_ordinal', v_ordinal, 'is_free', v_is_free,
      'attribution', 'sourced', 'reused', true);
  END IF;

  v_fee := public.booking_fee_centavos(v_ev.amount_centavos);

  IF v_is_free THEN
    v_status := 'waived_free5';
    v_charge_amount := 0;
  ELSIF v_fee <= 0 THEN
    v_status := 'paid';
    v_charge_amount := 0;
  ELSE
    v_status := 'pending';
    v_charge_amount := v_fee;
  END IF;

  INSERT INTO public.booking_fee_charges
    (ledger_id, proposal_id, event_vendor_id, source, vendor_profile_id, event_id,
     proposal_amount_centavos, computed_fee_centavos, amount_charged_centavos,
     schedule_version, status, paid_at, expires_at)
  VALUES
    (v_ledger.ledger_id, NULL, p_event_vendor_id, 'lock', v_ev.vpid, v_ev.event_id,
     v_ev.amount_centavos, v_fee, v_charge_amount, p_schedule_version, v_status,
     CASE WHEN v_status = 'paid' THEN NOW() ELSE NULL END,
     CASE WHEN v_status = 'pending' THEN NOW() + INTERVAL '7 days' ELSE NULL END)
  RETURNING charge_id INTO v_charge_id;

  RETURN jsonb_build_object(
    'charge_id', v_charge_id, 'status', v_status,
    'amount_charged_centavos', v_charge_amount, 'computed_fee_centavos', v_fee,
    'booking_ordinal', v_ordinal, 'is_free', v_is_free,
    'attribution', 'sourced', 'reused', false);
END;
$function$;

-- CREATE OR REPLACE keeps the existing grants (service_role only, measured live 2026-09-11).

-- ============================================================================
-- § 7 · …AND A CHANGE AFTER THE FEE WAS CHARGED RE-DERIVES IT, as a price move
--       always has.
--
-- `event_vendors_booking_fee_rederive` (20270930120000) re-derives a booking's
-- fee whenever `total_cost_php` moves on a booked row: a PENDING charge is
-- updated in place, a PAID one gets an `amendment_delta` or a credit note —
-- never a rewrite. The post-lock Deal reached that trigger by moving
-- `total_cost_php`; § 5 no longer moves it, so the same re-derive must also
-- fire when a CHANGE line lands, and must read the same base as § 6.
--
--   · `booking_fee_rederive_lock_fee` — the LIVE body (identical to
--     20271013541380's with comments stripped, compared 2026-09-11) with ONE
--     change: its `amount_centavos` is the agreed total including changes.
--   · a fail-soft AFTER trigger on change lines, the twin of
--     `booking_fee_on_event_vendor_price_change` — a fee hiccup must never undo
--     the change the two of them agreed; it logs a WARNING and the next price
--     move re-derives. No charge on the booking (fee off, free-5, import) → the
--     re-derive returns a no-op, exactly as today.
--
-- ⚠ A NEW EFFECT, SURFACED NOT HIDDEN: an accepted CHANGE ORDER now moves the
-- fee too (before this it moved no money anywhere but the couple's budget). By
-- the 2026-09-09 ruling that is right — it is part of what they booked at — and
-- production holds 0 change orders and 0 fee charges on a changed booking.
-- ============================================================================
CREATE OR REPLACE FUNCTION public.booking_fee_rederive_lock_fee(p_event_vendor_id uuid, p_schedule_version text DEFAULT booking_fee_schedule_version())
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_ev             RECORD;
  v_primary        RECORD;
  v_ledger         RECORD;
  v_new_total      BIGINT;
  v_new_fee        BIGINT;
  v_paid_total     BIGINT;
  v_delta          BIGINT;
  v_overpaid       BIGINT;
  v_existing_delta RECORD;
  v_delta_id       UUID;
  v_stale          RECORD;
BEGIN
  SELECT vendor_id, event_id, marketplace_vendor_id AS vpid, status,
         -- § 7 · THE ONE CHANGE: the agreed total INCLUDING the changes agreed
         -- since (is_change_delta lines), floored at zero — the same base
         -- booking_fee_open_lock_charge reads (§ 6).
         GREATEST(
           COALESCE(round((
             COALESCE(total_cost_php, 0)
             + COALESCE((SELECT SUM(li.amount_php)
                           FROM public.event_vendor_line_items li
                          WHERE li.vendor_id = p_event_vendor_id
                            AND li.is_change_delta), 0)
           ) * 100)::BIGINT, 0),
           0
         ) AS amount_centavos
    INTO v_ev
    FROM public.event_vendors
    WHERE vendor_id = p_event_vendor_id;
  IF NOT FOUND THEN RETURN jsonb_build_object('action', 'no_booking'); END IF;

  -- The FLAG/DARK gate: only a booking that already carries a primary charge (i.e.
  -- one locked while the fee was on) is ever re-derived. No charge → nothing to do.
  SELECT charge_id, ledger_id, status, amount_charged_centavos, proposal_amount_centavos
    INTO v_primary
    FROM public.booking_fee_charges
    WHERE event_vendor_id = p_event_vendor_id AND kind = 'primary'
      AND status IN ('pending', 'paid', 'waived_import', 'waived_free5')
    ORDER BY created_at
    LIMIT 1;
  IF NOT FOUND THEN RETURN jsonb_build_object('action', 'no_charge'); END IF;

  SELECT is_free_booking INTO v_ledger
    FROM public.booking_fee_ledger WHERE ledger_id = v_primary.ledger_id;

  -- Free-5 bookings never accrue a fee — the frozen courtesy wins at any total.
  IF COALESCE(v_ledger.is_free_booking, false) OR v_primary.status = 'waived_free5' THEN
    RETURN jsonb_build_object('action', 'free_noop');
  END IF;
  -- Import-attributed (free-forever) bookings likewise never bill.
  IF v_primary.status = 'waived_import' THEN
    RETURN jsonb_build_object('action', 'import_noop');
  END IF;

  v_new_total := v_ev.amount_centavos;
  v_new_fee   := public.booking_fee_centavos(v_new_total);

  -- Keep the ledger high-water mark honest (harmless audit field).
  UPDATE public.booking_fee_ledger
    SET highest_declared_centavos =
          GREATEST(COALESCE(highest_declared_centavos, 0), v_new_total),
        updated_at = NOW()
    WHERE ledger_id = v_primary.ledger_id;

  -- ── PENDING primary (unpaid) → update in place ──────────────────────────────
  IF v_primary.status = 'pending' THEN
    IF v_primary.amount_charged_centavos = v_new_fee
       AND v_primary.proposal_amount_centavos = v_new_total THEN
      RETURN jsonb_build_object('action', 'pending_noop');
    END IF;

    IF v_new_fee <= 0 THEN
      -- Amended down to ₱0 / barter → nothing to collect. Clear + cancel the order.
      UPDATE public.booking_fee_charges
        SET amount_charged_centavos = 0, computed_fee_centavos = 0,
            proposal_amount_centavos = v_new_total,
            status = 'paid', paid_at = NOW(), expires_at = NULL, updated_at = NOW()
        WHERE charge_id = v_primary.charge_id;
      PERFORM public.booking_fee_upsert_vendor_order(v_primary.charge_id);
      RETURN jsonb_build_object('action', 'pending_cleared_zero',
        'charge_id', v_primary.charge_id);
    END IF;

    UPDATE public.booking_fee_charges
      SET amount_charged_centavos = v_new_fee, computed_fee_centavos = v_new_fee,
          proposal_amount_centavos = v_new_total, updated_at = NOW()
      WHERE charge_id = v_primary.charge_id;
    PERFORM public.booking_fee_upsert_vendor_order(v_primary.charge_id);
    RETURN jsonb_build_object('action', 'pending_updated',
      'charge_id', v_primary.charge_id, 'amount_charged_centavos', v_new_fee);
  END IF;

  -- ── PAID primary (settled) → reconcile with a delta or a credit, never rewrite ─
  -- Everything already PAID for this booking (primary + any settled deltas).
  SELECT COALESCE(SUM(amount_charged_centavos), 0) INTO v_paid_total
    FROM public.booking_fee_charges
    WHERE event_vendor_id = p_event_vendor_id AND status = 'paid'
      AND kind IN ('primary', 'amendment_delta');

  v_delta := v_new_fee - v_paid_total;

  IF v_delta > 0 THEN
    -- Underpaid → open / adjust the single pending supplementary delta.
    SELECT charge_id, amount_charged_centavos INTO v_existing_delta
      FROM public.booking_fee_charges
      WHERE event_vendor_id = p_event_vendor_id AND kind = 'amendment_delta'
        AND status = 'pending'
      LIMIT 1;

    -- A prior overpayment credit is now stale (we owe more) → zero it.
    UPDATE public.booking_fee_charges
      SET credit_centavos = 0, updated_at = NOW()
      WHERE event_vendor_id = p_event_vendor_id AND kind = 'amendment_credit'
        AND COALESCE(credit_centavos, 0) <> 0;

    -- ⚠ DELIBERATELY NOT `IF FOUND AND …`. FOUND is reset by EVERY statement, so
    -- by the time control reaches this line it reflects the credit-zeroing UPDATE
    -- five lines up — NOT the `SELECT … INTO v_existing_delta` it looks like it is
    -- guarding. That UPDATE matches 0 rows whenever no credit note exists (the
    -- common case), which made FOUND false, skipped this update-in-place branch
    -- despite a pending delta existing, and dropped through to the INSERT below —
    -- where it violated booking_fee_charges_one_pending_delta_per_event_vendor and
    -- the fail-soft trigger swallowed the 23505 into a WARNING. The stale delta
    -- then survived at its OLD amount and Setnayan under-billed the difference.
    -- `v_existing_delta.charge_id IS NOT NULL` is the correct and sufficient test:
    -- it is exactly what the SELECT … INTO was for, and it cannot be clobbered by
    -- an intervening statement. (Fixed 2026-07-27; introduced by 20270930120000.)
    IF v_existing_delta.charge_id IS NOT NULL THEN
      IF v_existing_delta.amount_charged_centavos = v_delta THEN
        RETURN jsonb_build_object('action', 'delta_noop', 'delta_centavos', v_delta);
      END IF;
      UPDATE public.booking_fee_charges
        SET amount_charged_centavos = v_delta, computed_fee_centavos = v_new_fee,
            proposal_amount_centavos = v_new_total, updated_at = NOW()
        WHERE charge_id = v_existing_delta.charge_id;
      PERFORM public.booking_fee_upsert_vendor_order(v_existing_delta.charge_id);
      RETURN jsonb_build_object('action', 'delta_updated',
        'delta_centavos', v_delta, 'charge_id', v_existing_delta.charge_id);
    END IF;

    INSERT INTO public.booking_fee_charges
      (ledger_id, proposal_id, event_vendor_id, source, kind, parent_charge_id,
       vendor_profile_id, event_id, proposal_amount_centavos, computed_fee_centavos,
       amount_charged_centavos, schedule_version, status, expires_at)
    VALUES
      (v_primary.ledger_id, NULL, p_event_vendor_id, 'lock', 'amendment_delta',
       v_primary.charge_id, v_ev.vpid, v_ev.event_id, v_new_total, v_new_fee,
       v_delta, p_schedule_version, 'pending', NOW() + INTERVAL '7 days')
    RETURNING charge_id INTO v_delta_id;
    PERFORM public.booking_fee_upsert_vendor_order(v_delta_id);
    RETURN jsonb_build_object('action', 'delta_opened',
      'delta_centavos', v_delta, 'charge_id', v_delta_id);

  ELSIF v_delta < 0 THEN
    -- Overpaid → cancel any outstanding delta, record a credit note (NO refund).
    v_overpaid := -v_delta;
    FOR v_stale IN
      SELECT charge_id FROM public.booking_fee_charges
        WHERE event_vendor_id = p_event_vendor_id AND kind = 'amendment_delta'
          AND status = 'pending'
    LOOP
      UPDATE public.booking_fee_charges
        SET status = 'expired', expires_at = NOW(), updated_at = NOW()
        WHERE charge_id = v_stale.charge_id;
      PERFORM public.booking_fee_upsert_vendor_order(v_stale.charge_id);
    END LOOP;

    UPDATE public.booking_fee_charges
      SET credit_centavos = v_overpaid, computed_fee_centavos = v_new_fee,
          proposal_amount_centavos = v_new_total, updated_at = NOW()
      WHERE event_vendor_id = p_event_vendor_id AND kind = 'amendment_credit';
    IF NOT FOUND THEN
      INSERT INTO public.booking_fee_charges
        (ledger_id, proposal_id, event_vendor_id, source, kind, parent_charge_id,
         vendor_profile_id, event_id, proposal_amount_centavos, computed_fee_centavos,
         amount_charged_centavos, credit_centavos, schedule_version, status, paid_at)
      VALUES
        (v_primary.ledger_id, NULL, p_event_vendor_id, 'lock', 'amendment_credit',
         v_primary.charge_id, v_ev.vpid, v_ev.event_id, v_new_total, v_new_fee,
         0, v_overpaid, p_schedule_version, 'paid', NOW());
    END IF;
    RETURN jsonb_build_object('action', 'credit_recorded', 'credit_centavos', v_overpaid);

  ELSE
    -- Exactly reconciled → cancel any dangling delta, zero any stale credit.
    FOR v_stale IN
      SELECT charge_id FROM public.booking_fee_charges
        WHERE event_vendor_id = p_event_vendor_id AND kind = 'amendment_delta'
          AND status = 'pending'
    LOOP
      UPDATE public.booking_fee_charges
        SET status = 'expired', expires_at = NOW(), updated_at = NOW()
        WHERE charge_id = v_stale.charge_id;
      PERFORM public.booking_fee_upsert_vendor_order(v_stale.charge_id);
    END LOOP;
    UPDATE public.booking_fee_charges
      SET credit_centavos = 0, updated_at = NOW()
      WHERE event_vendor_id = p_event_vendor_id AND kind = 'amendment_credit'
        AND COALESCE(credit_centavos, 0) <> 0;
    RETURN jsonb_build_object('action', 'reconciled_exact');
  END IF;
END;
$function$;

-- CREATE OR REPLACE keeps the existing grants (service_role only, measured live 2026-09-11).

CREATE OR REPLACE FUNCTION public.booking_fee_on_change_line()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  IF (TG_OP <> 'DELETE' AND NEW.is_change_delta)
     OR (TG_OP <> 'INSERT' AND OLD.is_change_delta) THEN
    BEGIN
      PERFORM public.booking_fee_rederive_lock_fee(COALESCE(NEW.vendor_id, OLD.vendor_id));
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'booking_fee_rederive_lock_fee failed for event_vendor % (change line): %',
        COALESCE(NEW.vendor_id, OLD.vendor_id), SQLERRM;
    END;
  END IF;
  RETURN NULL; -- AFTER trigger — return value ignored.
END;
$function$;

REVOKE ALL ON FUNCTION public.booking_fee_on_change_line() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS event_vendor_line_items_booking_fee_rederive ON public.event_vendor_line_items;
CREATE TRIGGER event_vendor_line_items_booking_fee_rederive
  AFTER INSERT OR UPDATE OR DELETE ON public.event_vendor_line_items
  FOR EACH ROW EXECUTE FUNCTION public.booking_fee_on_change_line();
