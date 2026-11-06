-- the_first_booking_is_on_us
-- ============================================================================
-- A SUPPLIER'S FIRST SETNAYAN-SOURCED BOOKING IS FREE — ONE, NOT FIVE.
--
-- ⚖ OWNER, 2026-10-23, verbatim: "Your first booking is on us. Not 5. Then the
-- first 2000 bookings is also free."
--   (a) each supplier's FIRST booking sourced by Setnayan carries no booking
--       fee. This was 5 and is now 1, and it stays after the launch offer.
--   (b) the launch offer is UNCHANGED: the first 2,000 bookings on Setnayan are
--       fee-free (`platform_settings.launch_offer_booking_cap`, 20271268832636)
--       and they still spend none of a shop's free booking.
--
-- ── ONE HOME FOR THE NUMBER ────────────────────────────────────────────────
-- Until now the 5 was a LITERAL in two function bodies (`v_ordinal <= 5`,
-- `GREATEST(v_ordinal, 1) <= 5`) with a TypeScript twin in
-- `apps/web/lib/booking-fee-lock.ts` (`FREE_BOOKING_LIMIT`). It now lives in
-- ONE function, `public.booking_fee_free_booking_limit()`, which both bodies
-- call. The TS constant mirrors it for the copy and the projections, and
-- `apps/web/tests/db/the-first-booking-is-on-us.db.test.ts` fails the moment
-- the two disagree — so there is one fact, fenced, not two that drift.
--
-- ── NOTHING ALREADY GIVEN IS TAKEN BACK ─────────────────────────────────────
-- ⛔ FROZEN ORDINALS ARE NOT REWRITTEN. A booking already given its place
-- (`booking_fee_ledger.booking_ordinal` + `is_free_booking`) keeps it — the RPC
-- reads a frozen row and never re-derives it, `booking_fee_rederive_lock_fee`
-- reads `is_free_booking`, and no charge row is touched here. A shop that had
-- bookings 2…5 waived under the old rule keeps every one of them waived, with
-- no charge back. Only a booking that takes its place AFTER this ships is
-- counted against the new limit of 1.
--
-- Bodies copied from their LATEST definitions — both from 20271268832636
-- (`booking_fee_open_lock_charge`, `setnayan_gift_quote_applies`) — with only
-- the marked literal replaced. Grants re-stated, unchanged. Idempotent.
-- ============================================================================

BEGIN;

CREATE OR REPLACE FUNCTION public.booking_fee_free_booking_limit()
 RETURNS integer
 LANGUAGE sql
 IMMUTABLE
 PARALLEL SAFE
AS $function$
  SELECT 1
$function$;

COMMENT ON FUNCTION public.booking_fee_free_booking_limit() IS
  'How many of a supplier''s Setnayan-sourced bookings carry no booking fee (owner 2026-10-23: "Your first booking is on us. Not 5."). The ONE home of the number; booking_fee_open_lock_charge and setnayan_gift_quote_applies call it, and FREE_BOOKING_LIMIT in apps/web/lib/booking-fee-lock.ts is pinned to it by a db-test. Frozen ledger ordinals are never re-derived against it.';

-- Same grant shape as the fee functions that call it (they are SECURITY
-- DEFINER, so they reach it as the owner); the app reads the TS twin.
REVOKE ALL ON FUNCTION public.booking_fee_free_booking_limit() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.booking_fee_free_booking_limit() TO service_role;

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
  v_launch_no   INTEGER;
  v_credits     INTEGER;
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
        AND status IN ('pending', 'paid', 'waived_import', 'waived_free5', 'waived_promo', 'waived_launch')
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

  -- ── THE LAUNCH OFFER (owner 2026-10-08; 2026-10-12 #3, #4, #6) ──────────
  -- ⟵ NEW. The first N Setnayan-sourced bookings on the platform are fee-free
  -- (N = platform_settings.launch_offer_booking_cap — the owner's 2,000),
  -- counted at fee creation (#3). It sits ABOVE free-5 (#4): a launch booking
  -- takes NO ordinal, so it never uses up one of the shop's five, and after the
  -- offer every shop still has its five. Imports returned above and are never
  -- counted. Each launch-waived charge grants the shop
  -- `launch_offer_papic_credits` Papic credits for this event, once, at
  -- creation (#6). A booking that already holds an ordinal (made before the
  -- offer) is frozen and never re-decided.
  IF v_ledger.booking_ordinal IS NULL THEN
    -- A charge already made for this booking (only a launch charge leaves the
    -- ordinal null) → hand it back; decide nothing again, count nothing again.
    SELECT charge_id, status, amount_charged_centavos, computed_fee_centavos
      INTO v_existing
      FROM public.booking_fee_charges
      WHERE event_vendor_id = p_event_vendor_id
        AND status IN ('pending', 'paid', 'waived_import', 'waived_free5', 'waived_promo', 'waived_launch')
      LIMIT 1;
    IF FOUND THEN
      RETURN jsonb_build_object(
        'charge_id', v_existing.charge_id, 'status', v_existing.status,
        'amount_charged_centavos', v_existing.amount_charged_centavos,
        'computed_fee_centavos', v_existing.computed_fee_centavos,
        'booking_ordinal', NULL, 'is_free', v_existing.status <> 'pending',
        'launch_offer_number', v_ledger.launch_offer_number,
        'attribution', 'sourced', 'reused', true);
    END IF;

    IF v_ledger.launch_offer THEN
      v_launch_no := v_ledger.launch_offer_number;
    ELSE
      v_launch_no := public.booking_fee_launch_offer_take(v_ledger.ledger_id);
    END IF;

    IF v_launch_no IS NOT NULL THEN
      v_fee := public.booking_fee_centavos(v_ev.amount_centavos);
      INSERT INTO public.booking_fee_charges
        (ledger_id, proposal_id, event_vendor_id, source, vendor_profile_id, event_id,
         proposal_amount_centavos, computed_fee_centavos, amount_charged_centavos,
         schedule_version, status)
      VALUES
        (v_ledger.ledger_id, NULL, p_event_vendor_id, 'lock', v_ev.vpid, v_ev.event_id,
         v_ev.amount_centavos, v_fee, 0, p_schedule_version, 'waived_launch')
      RETURNING charge_id INTO v_charge_id;

      SELECT s.launch_offer_papic_credits INTO v_credits
        FROM public.platform_settings s WHERE s.id = 1;
      IF COALESCE(v_credits, 0) > 0 AND v_ev.event_id IS NOT NULL THEN
        INSERT INTO public.vendor_papic_portfolio_credit_grants
          (vendor_profile_id, event_id, credits, source, booking_fee_charge_id, note)
        VALUES
          (v_ev.vpid, v_ev.event_id, v_credits, 'launch_offer', v_charge_id,
           'Launch offer — booking ' || v_launch_no)
        ON CONFLICT (booking_fee_charge_id, source) WHERE booking_fee_charge_id IS NOT NULL
        DO NOTHING;
      END IF;

      RETURN jsonb_build_object(
        'charge_id', v_charge_id, 'status', 'waived_launch',
        'amount_charged_centavos', 0, 'computed_fee_centavos', v_fee,
        'booking_ordinal', NULL, 'is_free', TRUE,
        'launch_offer_number', v_launch_no, 'papic_credits', COALESCE(v_credits, 0),
        'attribution', 'sourced', 'reused', false);
    END IF;
  END IF;

  IF v_ledger.booking_ordinal IS NULL THEN
    -- ⟵ CHANGED (owner 2026-10-12 #2): only SETNAYAN-SOURCED bookings take a
    -- place among the first five. An import never had a fee to waive, so it
    -- must not use one of the five up.
    SELECT count(*) INTO v_ordinal
      FROM public.booking_fee_ledger l2
      WHERE l2.vendor_profile_id = v_ev.vpid
        AND l2.source = 'lock'
        AND l2.attribution = 'sourced'
        AND NOT l2.launch_offer   -- ⟵ NEW (#4): a launch booking spends none of the five
        AND (l2.created_at, l2.ledger_id) <= (v_ledger.created_at, v_ledger.ledger_id);
    v_ordinal := GREATEST(v_ordinal, 1);
    v_is_free := v_ordinal <= public.booking_fee_free_booking_limit();   -- ⟵ CHANGED (owner 2026-10-23): was the literal 5
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
      AND status IN ('pending', 'paid', 'waived_import', 'waived_free5', 'waived_promo', 'waived_launch')
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

REVOKE ALL ON FUNCTION public.booking_fee_open_lock_charge(UUID, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.booking_fee_open_lock_charge(UUID, TEXT) TO service_role;

CREATE OR REPLACE FUNCTION public.setnayan_gift_quote_applies(
  p_event_id UUID, p_vendor_profile_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ev          RECORD;
  v_ledger      RECORD;
  v_charge      RECORD;
  v_attribution TEXT;
  v_ordinal     INTEGER;
BEGIN
  SELECT vendor_id, package_role INTO v_ev
    FROM public.event_vendors
   WHERE event_id = p_event_id
     AND marketplace_vendor_id = p_vendor_profile_id
     AND archived_at IS NULL
     AND package_role IS DISTINCT FROM 'covered'
   ORDER BY created_at
   LIMIT 1;
  IF NOT FOUND THEN RETURN 'no_booking'; END IF;

  SELECT ledger_id, attribution, booking_ordinal, is_free_booking, created_at, source
    INTO v_ledger
    FROM public.booking_fee_ledger
   WHERE vendor_profile_id = p_vendor_profile_id AND event_id = p_event_id;

  v_attribution := COALESCE(v_ledger.attribution,
                            public.booking_fee_attribution_for(p_vendor_profile_id, p_event_id));
  IF v_attribution = 'import' THEN RETURN 'not_sourced'; END IF;

  -- ⟵ NEW: the booking's own live primary charge, when one already exists,
  -- is the answer — it is what the bill (and so the gift) will actually be.
  SELECT status, amount_charged_centavos INTO v_charge
    FROM public.booking_fee_charges
   WHERE event_vendor_id = v_ev.vendor_id
     AND kind = 'primary'
     AND status NOT IN ('failed', 'expired', 'cancelled_unbilled')
   ORDER BY created_at DESC
   LIMIT 1;
  IF FOUND THEN
    IF v_charge.status = 'waived_free5' THEN RETURN 'free_booking'; END IF;
    IF v_charge.status = 'waived_import' THEN RETURN 'not_sourced'; END IF;
    IF v_charge.status LIKE 'waived\_%' THEN RETURN 'fee_waived'; END IF;
    IF COALESCE(v_charge.amount_charged_centavos, 0) <= 0 THEN RETURN 'fee_waived'; END IF;
    IF NOT public.setnayan_gift_offered_on(v_ev.vendor_id) THEN RETURN 'card_says_no'; END IF;
    RETURN 'applies';
  END IF;

  -- ⟵ NEW: the launch offer sits ABOVE free-5, exactly as the lock RPC takes it.
  -- A booking made now, with no frozen place, would be waived by the offer.
  IF v_ledger.booking_ordinal IS NULL AND public.booking_fee_launch_offer_open() THEN
    RETURN 'fee_waived';
  END IF;

  IF v_ledger.booking_ordinal IS NOT NULL THEN
    IF v_ledger.is_free_booking THEN RETURN 'free_booking'; END IF;
  ELSE
    IF v_ledger.ledger_id IS NOT NULL AND v_ledger.source = 'lock' THEN
      SELECT count(*) INTO v_ordinal
        FROM public.booking_fee_ledger l2
       WHERE l2.vendor_profile_id = p_vendor_profile_id
         AND l2.source = 'lock'
         AND l2.attribution = 'sourced'   -- ⟵ CHANGED (owner #2)
         AND NOT l2.launch_offer           -- ⟵ NEW (#4)
         AND (l2.created_at, l2.ledger_id) <= (v_ledger.created_at, v_ledger.ledger_id);
    ELSE
      SELECT count(*) + 1 INTO v_ordinal
        FROM public.booking_fee_ledger l2
       WHERE l2.vendor_profile_id = p_vendor_profile_id
         AND l2.source = 'lock'
         AND l2.attribution = 'sourced'   -- ⟵ CHANGED (owner #2)
         AND NOT l2.launch_offer;          -- ⟵ NEW (#4)
    END IF;
    IF GREATEST(v_ordinal, 1) <= public.booking_fee_free_booking_limit() THEN RETURN 'free_booking'; END IF;   -- ⟵ CHANGED (owner 2026-10-23)
  END IF;

  -- ⟵ NEW (audit C14): the same arm `booking_fee_open_lock_charge` takes,
  -- below free-5 — a booking made now would be waived by the window.
  IF public.booking_fee_free_window_active() THEN RETURN 'fee_waived'; END IF;

  -- ⟵ MOVED: the card is asked only once a fee is actually coming.
  IF NOT public.setnayan_gift_offered_on(v_ev.vendor_id) THEN RETURN 'card_says_no'; END IF;
  RETURN 'applies';
END;
$$;

REVOKE ALL ON FUNCTION public.setnayan_gift_quote_applies(UUID, UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.setnayan_gift_quote_applies(UUID, UUID) TO service_role;

COMMENT ON COLUMN public.booking_fee_ledger.is_free_booking IS
  'TRUE = this booking took a free place (booking_ordinal <= booking_fee_free_booking_limit() at the moment it was frozen). Frozen with the ordinal and never re-derived: bookings 2-5 waived under the earlier first-five rule stay waived (owner 2026-10-23).';

COMMENT ON COLUMN public.booking_fee_ledger.launch_offer IS
  'TRUE = this booking was one of the launch offer''s fee-free bookings. It takes no booking_ordinal and does not use up the shop''s free first booking (owner 2026-10-12 #4; one free booking since 2026-10-23).';

COMMIT;
