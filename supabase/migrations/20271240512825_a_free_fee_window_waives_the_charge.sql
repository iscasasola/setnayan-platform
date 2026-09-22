-- A FREE-FEE WINDOW WAIVES THE CHARGE (owner 2026-09-22: "build the free-fee
-- promo window").
--
-- ── WHAT DID NOT EXIST ──────────────────────────────────────────────────────
-- The owner asked, on the day the booking-fee lock was switched on: *"if we
-- make booking fee free for a specific time … they can access what the booking
-- fee locks."* Two of the three free-access rules he named were already true —
-- `waived_free5` (a shop's first five) and `waived_import` (a booking the shop
-- brought in itself) are both in `FEE_SETTLED_STATUSES`, so both already
-- unlock. THE THIRD DID NOT EXIST AT ALL, and three things in the tree look
-- like it and are not:
--   · `promo_free_windows` promotes a vendor's SUBSCRIPTION TIER, not the fee;
--   · `NEXT_PUBLIC_VENDOR_DAYOF_FREE_UNTIL` ends the free day-of TOOLS;
--   · `lib/vendor-launch-free-window.ts` has ZERO callers outside its own file
--     — written, and wired to nothing.
-- So declaring a free-fee period would still have minted `pending` charges at
-- full price, and — now that the lock is on — locked those suppliers out of the
-- weddings they were about to work.
--
-- ── WHY A NEW STATUS AND NOT `paid` ─────────────────────────────────────────
-- Writing `paid` with an amount of 0 would work mechanically; the zero-fee arm
-- already does exactly that when the ₱4,000 cap is reached. It is still wrong:
-- the ledger would say a supplier PAID when Setnayan gave it away, and a
-- promotion would be indistinguishable from a cap. `waived_promo` keeps the
-- books honest and lets the owner count what a promotion cost.
-- 🔑 It also cannot accidentally pay out: `grantVendorPapicCreditsForBookingFee`
-- returns early on any status that is not exactly `paid`.
--
-- ── THREE DOORS MINT A CHARGE, NOT ONE ──────────────────────────────────────
-- Asked of `pg_proc`, not of memory:
--   `booking_fee_open_charge`       — the proposal send-gate
--   `booking_fee_open_lock_charge`  — the booking lock (every real charge today)
--   `booking_fee_rederive_lock_fee` — an amendment re-deriving the total
-- A window taught to only one of them leaks through the other two. All three
-- are replaced below, each carrying its ORIGINAL body verbatim with a counted,
-- asserted patch applied — the bodies are not retyped from memory.
--
-- ⚠ EVERY "IS THERE ALREADY A LIVE CHARGE?" SELECTOR LEARNS THE NEW STATUS TOO.
-- `booking_fee_open_lock_charge` carries that selector TWICE (the import path
-- and the main path). A selector that cannot SEE a `waived_promo` row believes
-- the booking has no charge and mints a SECOND one.
--
-- ── SCOPE, SAID OUT LOUD ────────────────────────────────────────────────────
-- The window decides charges OPENED while it is open. It does NOT retroactively
-- waive a `pending` charge that already existed when the window opened — that
-- is forgiving a debt already incurred, which is a separate decision and a
-- separate migration. A booking waived by a window STAYS waived when its total
-- is later amended, even after the window closes: the promise was "this booking
-- is free", and re-billing it because the couple added an hour would withdraw a
-- promise the shop already accepted.

BEGIN;

-- ── 1 · THE WINDOW ITSELF ───────────────────────────────────────────────────
-- On `platform_settings`, beside the other booking-fee knobs
-- (`booking_fee_rate_pct`, `booking_fee_tail_rate_pct`,
-- `booking_fee_tier1_limit_php`, `fee_unlocks_event_enforced`) rather than in a
-- new table: this is ONE window at a time, which is what "a specific time"
-- asked for, and the neighbouring switch already lives here.
ALTER TABLE public.platform_settings
  ADD COLUMN IF NOT EXISTS booking_fee_free_from  TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS booking_fee_free_until TIMESTAMPTZ;

COMMENT ON COLUMN public.platform_settings.booking_fee_free_from IS
  'Start of the free-fee window (inclusive). NULL = open-ended start, so setting only _until makes the fee free from now until then.';
COMMENT ON COLUMN public.platform_settings.booking_fee_free_until IS
  'End of the free-fee window (inclusive). NULL with a NULL _from means NO window — never "free forever". Both NULL is the default and the off state.';

-- ── 2 · THE STATUS ──────────────────────────────────────────────────────────
-- ⚠ RE-LISTED IN FULL, INCLUDING `waived_free5`, WHICH A LATER MIGRATION ADDED.
-- A re-listed CHECK vocabulary that drops a value added after the original
-- migration fails only when a real row of that value is present — so it can
-- pass CI and break production. Every existing member is named here.
ALTER TABLE public.booking_fee_charges
  DROP CONSTRAINT IF EXISTS booking_fee_charges_status_check;
ALTER TABLE public.booking_fee_charges
  ADD CONSTRAINT booking_fee_charges_status_check
  CHECK (status IN ('pending', 'paid', 'failed', 'expired',
                    'waived_import', 'waived_free5', 'waived_promo'));

-- ── 3 · THE RULE, IN ONE PLACE ──────────────────────────────────────────────
-- Three call sites ask this; none of them re-implements it. STABLE + SQL so it
-- folds into the surrounding statement, and it reads the settings row the same
-- way `booking_fee_centavos` does, with the same fail-safe default.
--
-- 🔑 IT FAILS CLOSED. No row, or both bounds NULL, means NO window — the fee is
-- charged. A missing settings row must never read as "everything is free".
CREATE OR REPLACE FUNCTION public.booking_fee_free_window_active(
  p_at TIMESTAMPTZ DEFAULT NOW()
) RETURNS BOOLEAN
LANGUAGE sql
STABLE
SET search_path TO 'public'
AS $window$
  SELECT COALESCE(
    (SELECT (s.booking_fee_free_from IS NOT NULL OR s.booking_fee_free_until IS NOT NULL)
        AND (s.booking_fee_free_from  IS NULL OR p_at >= s.booking_fee_free_from)
        AND (s.booking_fee_free_until IS NULL OR p_at <= s.booking_fee_free_until)
       FROM public.platform_settings s
      WHERE s.id = 1),
    FALSE);
$window$;

COMMENT ON FUNCTION public.booking_fee_free_window_active(TIMESTAMPTZ) IS
  'Is a free-fee promotion running at p_at? Reads platform_settings id=1. Both bounds NULL = no window (fails closed). One bound NULL = open-ended on that side.';

-- ── 4 · THE THREE DOORS ─────────────────────────────────────────────────────
-- 4a · the proposal send-gate.
CREATE OR REPLACE FUNCTION public.booking_fee_open_charge(
  p_proposal_id     UUID,
  p_attribution     TEXT DEFAULT 'sourced',
  p_thread_id       UUID DEFAULT NULL,
  p_schedule_version TEXT DEFAULT '2026-07-23-flat2'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_proposal RECORD;
  v_ledger   RECORD;
  v_existing RECORD;
  v_fee            BIGINT;
  v_remaining      BIGINT;
  v_charge_amount  BIGINT;
  v_status         TEXT;
  v_charge_id      UUID;
BEGIN
  SELECT vendor_profile_id, event_id, COALESCE(total_centavos, 0) AS amount
    INTO v_proposal
    FROM public.vendor_proposals
    WHERE proposal_id = p_proposal_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'proposal_not_found';
  END IF;

  -- Upsert the ledger; attribution + freeze stamp only on first insert.
  INSERT INTO public.booking_fee_ledger
    (vendor_profile_id, event_id, attribution, attribution_thread_id,
     attribution_frozen_at, highest_declared_centavos)
  VALUES
    (v_proposal.vendor_profile_id, v_proposal.event_id,
     CASE WHEN p_attribution = 'import' THEN 'import' ELSE 'sourced' END,
     p_thread_id, NOW(), v_proposal.amount)
  ON CONFLICT (vendor_profile_id, event_id) DO UPDATE
    SET highest_declared_centavos =
          GREATEST(COALESCE(public.booking_fee_ledger.highest_declared_centavos, 0),
                   EXCLUDED.highest_declared_centavos),
        updated_at = NOW()
  RETURNING * INTO v_ledger;

  -- Idempotent: a live charge already exists for this proposal → return it.
  SELECT charge_id, status, amount_charged_centavos, computed_fee_centavos
    INTO v_existing
    FROM public.booking_fee_charges
    WHERE proposal_id = p_proposal_id
      AND status IN ('pending', 'paid', 'waived_import', 'waived_promo')
    LIMIT 1;
  IF FOUND THEN
    RETURN jsonb_build_object(
      'charge_id', v_existing.charge_id, 'status', v_existing.status,
      'amount_charged_centavos', v_existing.amount_charged_centavos,
      'computed_fee_centavos', v_existing.computed_fee_centavos,
      'attribution', v_ledger.attribution, 'reused', true);
  END IF;

  v_fee := public.booking_fee_centavos(v_proposal.amount);
  v_remaining := GREATEST(0, 400000 - v_ledger.fee_paid_total_centavos);
  v_charge_amount := LEAST(v_fee, v_remaining);

  IF v_ledger.attribution = 'import' THEN
    v_status := 'waived_import';
    v_charge_amount := 0;
  ELSIF v_charge_amount <= 0 THEN
    v_status := 'paid';        -- cap reached or fee 0 → nothing to collect
    v_charge_amount := 0;
  -- ── THE FREE-FEE WINDOW ────────────────────────────────────────────
  -- Sits BELOW the free-5 and the zero-fee arms on purpose. A booking
  -- that is already free stays `waived_free5`: the window must not
  -- silently spend one of a shop's five courtesies during a period when
  -- everything was free anyway. The window only decides bookings that
  -- would otherwise have been billed.
  -- `computed_fee_centavos` still records what the fee WOULD have been,
  -- so the owner can count what a promotion gave away.
  ELSIF public.booking_fee_free_window_active() THEN
    v_status := 'waived_promo';
    v_charge_amount := 0;
  ELSE
    v_status := 'pending';
  END IF;

  INSERT INTO public.booking_fee_charges
    (ledger_id, proposal_id, vendor_profile_id, event_id, proposal_amount_centavos,
     computed_fee_centavos, amount_charged_centavos, schedule_version, status,
     paid_at, expires_at)
  VALUES
    (v_ledger.ledger_id, p_proposal_id, v_proposal.vendor_profile_id, v_proposal.event_id,
     v_proposal.amount, v_fee, v_charge_amount, p_schedule_version, v_status,
     CASE WHEN v_status IN ('paid', 'waived_import', 'waived_promo') THEN NOW() END,
     CASE WHEN v_status = 'pending' THEN NOW() + INTERVAL '7 days' END)
  RETURNING charge_id INTO v_charge_id;

  RETURN jsonb_build_object(
    'charge_id', v_charge_id, 'status', v_status,
    'amount_charged_centavos', v_charge_amount, 'computed_fee_centavos', v_fee,
    'attribution', v_ledger.attribution, 'reused', false);
END;
$$;

-- 4b · the booking lock. Every real charge on the platform today came
--      through here (`booking_fee_ledger.source = 'lock'`).
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
        AND status IN ('pending', 'paid', 'waived_import', 'waived_free5', 'waived_promo')
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
      AND status IN ('pending', 'paid', 'waived_import', 'waived_free5', 'waived_promo')
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
  -- ── THE FREE-FEE WINDOW ────────────────────────────────────────────
  -- Sits BELOW the free-5 and the zero-fee arms on purpose. A booking
  -- that is already free stays `waived_free5`: the window must not
  -- silently spend one of a shop's five courtesies during a period when
  -- everything was free anyway. The window only decides bookings that
  -- would otherwise have been billed.
  -- `computed_fee_centavos` still records what the fee WOULD have been,
  -- so the owner can count what a promotion gave away.
  ELSIF public.booking_fee_free_window_active() THEN
    v_status := 'waived_promo';
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

-- 4c · the amendment re-derive.
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
      AND status IN ('pending', 'paid', 'waived_import', 'waived_free5', 'waived_promo')
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
  -- A booking waived by a free-fee window stays waived when its total is later
  -- amended. The promise was "this booking is free"; re-billing it because the
  -- couple added a second hour — or because the window has since closed — would
  -- withdraw a promise the shop already accepted.
  IF v_primary.status = 'waived_promo' THEN
    RETURN jsonb_build_object('action', 'promo_noop');
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

COMMIT;
