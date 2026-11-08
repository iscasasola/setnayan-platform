-- a_badge_fee_and_one_free_booking_per_business_meet
-- Created via `pnpm migration:new`. Idempotent: CREATE OR REPLACE FUNCTION · REVOKE/GRANT.
-- No table, no column, no policy — so no RLS to add.
--
-- ── WHY: two migrations re-created the SAME two functions, and the later prefix dropped the other's rule ──────────
-- `booking_fee_open_lock_charge` and `setnayan_gift_quote_applies` were each re-created, in parallel, from
-- 20271284624593_the_first_booking_is_on_us by:
--   · 20271319712279_one_free_first_booking_per_business (main, train 2B #7396) — ONE FREE FIRST BOOKING PER
--     BUSINESS (owner 2026-11-06): per-business advisory locks, `booking_fee_business_free_standing` must be
--     'available' to stay free, the withheld reason frozen on the ledger and returned as `free_withheld`;
--   · 20271323363853_badge_rewards_land_in_the_gift_stock (#7298, train 1 #7394) — A FREE BOOKING FEE (badge reward,
--     owner 2026-11-05) pays the next billable fee as a ₱0 `paid` charge naming its reward, and the couple still
--     gets the Setnayan gift; the quote reads 'badge_reward'.
-- Both apply in prefix order, so 20271323363853 ran LAST and silently put back the shop-only free first booking.
-- Neither applied migration is edited; this one re-creates both functions with BOTH changes.
--
-- HOW: a three-way merge of each body (base 20271284624593, sides 20271319712279 and 20271323363853). The hunks are
-- disjoint; the only overlaps were the DECLARE block and the returned JSON keys, where both sides' lines are kept.
-- The two rules meet at one point and agree there: the business check can turn a would-be-free booking into a
-- BILLABLE one, and the badge reward pays exactly the billable rung — so a shop whose business already spent its
-- free first booking elsewhere can still have that fee paid by a badge reward, which is what each ruling says alone.

BEGIN;

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
  v_badge       UUID;   -- ⟵ BADGE: the free booking fee that pays this one, if any
  v_gift_on     BOOLEAN; -- ⟵ BADGE: does this booking carry the Setnayan gift?
  v_stamp       RECORD;  -- ⟵ BADGE
  v_gift_credits INTEGER; -- ⟵ BADGE
  v_gift_grant  UUID;    -- ⟵ BADGE
  v_business    TEXT;   -- ⟵ NEW (owner 2026-11-06): booking_fee_business_free_standing()
  v_withheld    TEXT;   -- ⟵ NEW: why a free place was withheld, frozen on the ledger
  v_lock_id     UUID;   -- ⟵ NEW: one advisory lock per shop of the business
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

  -- ⟵ CHANGED (owner 2026-11-06): one lock per shop of the BUSINESS, in uuid
  -- order, so two matched shops agreeing at once cannot both take the one free
  -- place. The match is symmetric, so both take the same locks in the same order.
  -- If the match cannot run, the shop's own lock is taken (as before) and the
  -- free place itself fails closed below.
  BEGIN
    FOR v_lock_id IN
      SELECT s.id FROM (
        SELECT v_ev.vpid AS id
        UNION
        SELECT m.other_vendor_profile_id FROM public.booking_fee_business_matches(ARRAY[v_ev.vpid]) m
      ) s
      ORDER BY s.id
    LOOP
      PERFORM pg_advisory_xact_lock(hashtextextended(v_lock_id::text, 0));
    END LOOP;
  EXCEPTION WHEN OTHERS THEN
    PERFORM pg_advisory_xact_lock(hashtextextended(v_ev.vpid::text, 0));
  END;

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
    -- ⟵ NEW (owner 2026-11-06): ONE FREE FIRST BOOKING PER BUSINESS. Within the
    -- shop's own free place, the business must not have spent it on another
    -- shop. ONLY 'available' keeps it free — 'used_by_business', 'unreadable'
    -- or anything else bills the normal fee (fail closed).
    IF v_is_free THEN
      v_business := public.booking_fee_business_free_standing(v_ev.vpid);
      IF v_business IS DISTINCT FROM 'available' THEN
        v_is_free := FALSE;
        v_withheld := CASE WHEN v_business = 'used_by_business'
                           THEN 'business_already_used'
                           ELSE 'business_check_unreadable' END;
      END IF;
    END IF;
    UPDATE public.booking_fee_ledger
      SET booking_ordinal = v_ordinal, is_free_booking = v_is_free,
          free_booking_withheld_reason = v_withheld,   -- ⟵ NEW
          updated_at = NOW()
      WHERE ledger_id = v_ledger.ledger_id;
  ELSE
    v_ordinal := v_ledger.booking_ordinal;
    v_is_free := v_ledger.is_free_booking;
    v_withheld := v_ledger.free_booking_withheld_reason;   -- ⟵ NEW: frozen, never re-derived
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
      'free_withheld', v_withheld,
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
    -- ⟵ BADGE (owner 2026-11-05): the shop's OLDEST unused free booking fee
    -- (a badge reward from 1,000 / 5,000 / 10,000 events) pays this fee. It sits
    -- BELOW the free first booking, the ₱0 fee and the promo window on purpose:
    -- "it never applies to a booking that already has no fee". One per booking
    -- (the charge has one column, and booking_fee_charges_badge_reward_once
    -- refuses a second charge for one reward). The vendor advisory lock above
    -- already serialises this shop's charges; FOR UPDATE also waits on a revoke.
    SELECT r.reward_id INTO v_badge
      FROM public.shop_badge_rewards r
     WHERE r.vendor_profile_id = v_ev.vpid
       AND r.reward_kind = 'fee_waiver'
       AND r.revoked_at IS NULL
       AND r.used_on_charge_id IS NULL
     ORDER BY r.granted_at, r.reward_id
     LIMIT 1
     FOR UPDATE;
    IF v_badge IS NOT NULL THEN
      -- A ₱0 `paid` — the settled status every fee reader already knows — that
      -- names its reward. computed_fee_centavos keeps what it would have cost.
      v_status := 'paid';
      v_charge_amount := 0;
    ELSE
      v_status := 'pending';
      v_charge_amount := v_fee;
    END IF;
  END IF;

  INSERT INTO public.booking_fee_charges
    (ledger_id, proposal_id, event_vendor_id, source, vendor_profile_id, event_id,
     proposal_amount_centavos, computed_fee_centavos, amount_charged_centavos,
     schedule_version, status, paid_at, expires_at, badge_reward_id)   -- ⟵ BADGE
  VALUES
    (v_ledger.ledger_id, NULL, p_event_vendor_id, 'lock', v_ev.vpid, v_ev.event_id,
     v_ev.amount_centavos, v_fee, v_charge_amount, p_schedule_version, v_status,
     CASE WHEN v_status = 'paid' THEN NOW() ELSE NULL END,
     CASE WHEN v_status = 'pending' THEN NOW() + INTERVAL '7 days' ELSE NULL END,
     v_badge)                                                         -- ⟵ BADGE
  RETURNING charge_id INTO v_charge_id;

  -- ⟵ BADGE: the free booking fee is used up, on this charge.
  IF v_badge IS NOT NULL THEN
    UPDATE public.shop_badge_rewards
       SET used_on_charge_id = v_charge_id, used_at = NOW(),
           returned_at = NULL, returned_from_charge_id = NULL
     WHERE reward_id = v_badge;

    -- ⟵ BADGE (owner 2026-11-05): "the gift belongs with the booking, not the
    -- bill" — the couple still gets the Setnayan gift this booking promised.
    -- `setnayan_gift_offered` was decided on the insert above by the charge's
    -- own trigger (the quote's switch, else the card). Sized as promised: the
    -- lock stamp first (the promise wins, as on a billed charge), else the live
    -- `setnayan_gift_for_fee` on what the fee would have been. No bill — the
    -- free fee covers it. It lands now, in the event's SHARED pool, once: an
    -- event that already received a badge-paid gift from this shop (a cancelled
    -- booking re-agreed) receives nothing more.
    SELECT c.setnayan_gift_offered INTO v_gift_on
      FROM public.booking_fee_charges c WHERE c.charge_id = v_charge_id;
    IF COALESCE(v_gift_on, FALSE) AND v_ev.event_id IS NOT NULL
       AND NOT EXISTS (
         SELECT 1
           FROM public.shop_badge_rewards r2
           JOIN public.papic_event_point_grants g2 ON g2.grant_id = r2.setnayan_gift_grant_id
          WHERE r2.vendor_profile_id = v_ev.vpid
            AND g2.event_id = v_ev.event_id
       ) THEN
      SELECT ev.setnayan_gift_locked_at, ev.setnayan_gift_credits_at_lock
        INTO v_stamp
        FROM public.event_vendors ev
       WHERE ev.vendor_id = p_event_vendor_id;
      IF v_stamp.setnayan_gift_locked_at IS NOT NULL
         AND COALESCE(v_stamp.setnayan_gift_credits_at_lock, 0) > 0 THEN
        v_gift_credits := v_stamp.setnayan_gift_credits_at_lock;
      ELSE
        SELECT g.credits INTO v_gift_credits
          FROM public.setnayan_gift_for_fee(v_fee, v_ev.vpid) g;
      END IF;
      IF COALESCE(v_gift_credits, 0) > 0 THEN
        INSERT INTO public.papic_event_point_grants (event_id, points, source, note)
        VALUES (v_ev.event_id, v_gift_credits, 'comp',
                'Setnayan gift · ' || v_gift_credits
                  || ' photos · your supplier''s free booking fee (badge reward)')
        RETURNING grant_id INTO v_gift_grant;
        UPDATE public.shop_badge_rewards
           SET setnayan_gift_credits = v_gift_credits, setnayan_gift_grant_id = v_gift_grant
         WHERE reward_id = v_badge;
      END IF;
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'charge_id', v_charge_id, 'status', v_status,
    'amount_charged_centavos', v_charge_amount, 'computed_fee_centavos', v_fee,
    'booking_ordinal', v_ordinal, 'is_free', v_is_free,
    'badge_reward_id', v_badge,                                       -- ⟵ BADGE
    'free_withheld', v_withheld,   -- ⟵ NEW
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
  SELECT status, amount_charged_centavos, badge_reward_id INTO v_charge   -- ⟵ BADGE
    FROM public.booking_fee_charges
   WHERE event_vendor_id = v_ev.vendor_id
     AND kind = 'primary'
     AND status NOT IN ('failed', 'expired', 'cancelled_unbilled')
   ORDER BY created_at DESC
   LIMIT 1;
  IF FOUND THEN
    -- ⟵ BADGE (owner 2026-11-05): a free booking fee paid this one, and the
    -- couple still gets the gift it promised — Setnayan covers it, no bill.
    IF v_charge.badge_reward_id IS NOT NULL THEN
      IF NOT public.setnayan_gift_offered_on(v_ev.vendor_id) THEN RETURN 'badge_reward_card_says_no'; END IF;
      RETURN 'badge_reward';
    END IF;
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
    -- ⟵ CHANGED (owner 2026-11-06): the same per-BUSINESS test the lock RPC
    -- takes. Not 'available' (used by another shop, or unreadable) → not free.
    IF GREATEST(v_ordinal, 1) <= public.booking_fee_free_booking_limit()
       AND public.booking_fee_business_free_standing(p_vendor_profile_id) = 'available' THEN
      RETURN 'free_booking';
    END IF;
  END IF;

  -- ⟵ NEW (audit C14): the same arm `booking_fee_open_lock_charge` takes,
  -- below free-5 — a booking made now would be waived by the window.
  IF public.booking_fee_free_window_active() THEN RETURN 'fee_waived'; END IF;

  -- ⟵ BADGE: a free booking fee is waiting, so a booking agreed now would be
  -- paid by it (`booking_fee_open_lock_charge` takes it at exactly this rung) —
  -- and still carries the gift, at no bill.
  IF EXISTS (
    SELECT 1 FROM public.shop_badge_rewards r
     WHERE r.vendor_profile_id = p_vendor_profile_id
       AND r.reward_kind = 'fee_waiver'
       AND r.revoked_at IS NULL
       AND r.used_on_charge_id IS NULL
  ) THEN
    IF NOT public.setnayan_gift_offered_on(v_ev.vendor_id) THEN RETURN 'badge_reward_card_says_no'; END IF;
    RETURN 'badge_reward';
  END IF;

  -- ⟵ MOVED: the card is asked only once a fee is actually coming.
  IF NOT public.setnayan_gift_offered_on(v_ev.vendor_id) THEN RETURN 'card_says_no'; END IF;
  RETURN 'applies';
END;
$$;


REVOKE ALL ON FUNCTION public.setnayan_gift_quote_applies(UUID, UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.setnayan_gift_quote_applies(UUID, UUID) TO service_role;

COMMIT;
