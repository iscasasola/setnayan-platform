-- one_free_first_booking_per_business
-- ============================================================================
-- 🛡 ONE FREE FIRST BOOKING PER BUSINESS, NOT PER ACCOUNT.
--
-- ⚖ OWNER, 2026-11-06 (DECISION_LOG row "ONE FREE FIRST BOOKING PER BUSINESS,
-- NOT PER ACCOUNT — THE NEW-ACCOUNT LOOPHOLE IS CLOSED AT THE VERIFICATION
-- DESK"): *"Doesn't this give businesses to just keep creating a new account
-- then?"* → chose "One free first per business". The desk matches the
-- REGISTRATION/PERMIT NUMBER, PHONE and PAYOUT ACCOUNT against other shops; a
-- match is flagged, and the second shop gets NO second free booking — the
-- waiver counter must count per business, not per shop.
--
-- ── WHAT "THE SAME BUSINESS" MEANS HERE (the three identities the ruling names)
--   · registration number — `vendor_profiles.registration_number_raw`, compared
--     the way `normalizeRegistrationNumber` does (UPPER, alphanumerics only, ≥5).
--     Raw, not `_normalized`: a shop whose number COLLIDED keeps `_normalized`
--     NULL (20270925937630) — exactly the second shop this row is about.
--   · phone — `vendor_profiles.contact_phone`, as its national number (+63 / 0
--     stripped, digits only, ≥7).
--   · payout account — `vendor_payment_methods.account_number` of a `bank`
--     (bank / e-wallet) row not `removed`, alphanumerics only (an all-digit
--     number gets the phone treatment, so 0917… and +63917… agree), ≥6.
--   · Any match on ANY of the three is the same business. `vendor_profiles.
--     user_id` is UNIQUE, so every other shop is already another ACCOUNT — the
--     loophole the ruling closes — and no owner test is needed.
--   · Demo shops (`is_demo`) are never matched, on either side.
--   · Direct matches only (A~B), not the transitive closure (A~B~C).
--
-- ── THE COUNT ─────────────────────────────────────────────────────────────
-- A shop's booking takes the free place only if (a) its own ordinal is within
-- `booking_fee_free_booking_limit()` — unchanged — AND (b) NO matched shop has
-- already taken a free place (`booking_fee_ledger.is_free_booking`).
-- The per-shop ordinal is untouched, so every place already frozen keeps it.
--
-- ── FAIL CLOSED ───────────────────────────────────────────────────────────
-- `booking_fee_business_free_standing()` answers 'available' ONLY when the
-- match ran and found no matched shop holding a free place. Any error inside it
-- is caught and answered 'unreadable', and anything but 'available' means NOT
-- FREE: the booking is billed the normal fee. The reason is frozen on the
-- ledger (`free_booking_withheld_reason`) so the supplier's line and the admin
-- desk can say which it was.
--
-- ── RACE ─────────────────────────────────────────────────────────────────
-- The RPC took one advisory lock per SHOP. It now takes one per shop of the
-- business, in uuid order (the match is symmetric, so two matched shops take
-- the same locks in the same order — no deadlock), so two matched shops locking
-- at the same moment cannot both read "nobody took it".
--
-- Bodies of `booking_fee_open_lock_charge` and `setnayan_gift_quote_applies`
-- copied from their LATEST definitions (20271284624593) with only the marked
-- lines changed. Grants re-stated, unchanged. Idempotent.
-- ============================================================================

BEGIN;

ALTER TABLE public.booking_fee_ledger
  ADD COLUMN IF NOT EXISTS free_booking_withheld_reason TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'booking_fee_ledger_free_booking_withheld_reason_chk'
  ) THEN
    ALTER TABLE public.booking_fee_ledger
      ADD CONSTRAINT booking_fee_ledger_free_booking_withheld_reason_chk
      CHECK (free_booking_withheld_reason IS NULL
             OR free_booking_withheld_reason IN ('business_already_used', 'business_check_unreadable'));
  END IF;
END $$;

COMMENT ON COLUMN public.booking_fee_ledger.free_booking_withheld_reason IS
  'Set when this booking was within the shop''s own free place (booking_ordinal <= booking_fee_free_booking_limit()) but was billed anyway: business_already_used = another shop of the same business (booking_fee_business_matches) already took the free first booking; business_check_unreadable = the match could not be run, so it failed closed (owner 2026-11-06, ONE FREE FIRST BOOKING PER BUSINESS). Frozen with the ordinal.';

-- ── The comparable forms ───────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.booking_fee_registration_key(p_raw TEXT)
 RETURNS TEXT
 LANGUAGE sql
 IMMUTABLE
 PARALLEL SAFE
AS $function$
  SELECT CASE WHEN length(k) >= 5 THEN k END
    FROM (SELECT upper(regexp_replace(COALESCE(p_raw, ''), '[^A-Za-z0-9]', '', 'g')) AS k) s
$function$;

CREATE OR REPLACE FUNCTION public.booking_fee_number_key(p_raw TEXT, p_min_length INTEGER)
 RETURNS TEXT
 LANGUAGE sql
 IMMUTABLE
 PARALLEL SAFE
AS $function$
  SELECT CASE WHEN length(n) >= p_min_length THEN n END
    FROM (
      SELECT CASE
               WHEN a ~ '^[0-9]+$' AND a ~ '^63' AND length(a) >= 11 THEN substr(a, 3)
               WHEN a ~ '^[0-9]+$' AND a ~ '^0' THEN substr(a, 2)
               ELSE a
             END AS n
        FROM (SELECT upper(regexp_replace(COALESCE(p_raw, ''), '[^A-Za-z0-9]', '', 'g')) AS a) s
    ) t
$function$;

COMMENT ON FUNCTION public.booking_fee_number_key(TEXT, INTEGER) IS
  'A phone or payout account number in one comparable form: alphanumerics only, upper-cased; an all-digit number loses its +63 / leading 0 so 0917…, +63 917… and 63917… agree. NULL below p_min_length. Used by booking_fee_business_matches.';

-- ── WHO ELSE IS THIS BUSINESS ──────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.booking_fee_business_matches(p_vendor_profile_ids UUID[])
 RETURNS TABLE (
   vendor_profile_id UUID,
   other_vendor_profile_id UUID,
   matched_on TEXT[],
   other_took_free BOOLEAN
 )
 LANGUAGE sql
 STABLE
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  WITH shops AS (
    SELECT vp.vendor_profile_id AS id,
           public.booking_fee_registration_key(
             COALESCE(vp.registration_number_raw, vp.registration_number_normalized)) AS reg,
           public.booking_fee_number_key(vp.contact_phone, 7) AS phone
      FROM public.vendor_profiles vp
     WHERE NOT COALESCE(vp.is_demo, FALSE)
  ),
  mine AS (
    SELECT s.* FROM shops s WHERE s.id = ANY(p_vendor_profile_ids)
  ),
  accounts AS (
    SELECT pm.vendor_profile_id AS id,
           public.booking_fee_number_key(pm.account_number, 6) AS k
      FROM public.vendor_payment_methods pm
     WHERE pm.method_type = 'bank'
       AND pm.moderation_status <> 'removed'
  ),
  pairs AS (
    SELECT m.id, o.id AS other, 'registration_number'::TEXT AS kind
      FROM mine m JOIN shops o ON o.reg = m.reg AND o.id <> m.id
     WHERE m.reg IS NOT NULL
    UNION
    SELECT m.id, o.id, 'phone'
      FROM mine m JOIN shops o ON o.phone = m.phone AND o.id <> m.id
     WHERE m.phone IS NOT NULL
    UNION
    SELECT m.id, o.id, 'payout_account'
      FROM mine m
      JOIN accounts ma ON ma.id = m.id AND ma.k IS NOT NULL
      JOIN accounts oa ON oa.k = ma.k AND oa.id <> m.id
      JOIN shops o ON o.id = oa.id   -- the other shop must itself be a real (non-demo) shop
  )
  SELECT p.id,
         p.other,
         array_agg(DISTINCT p.kind ORDER BY p.kind),
         EXISTS (SELECT 1 FROM public.booking_fee_ledger l
                  WHERE l.vendor_profile_id = p.other
                    AND l.is_free_booking IS TRUE)
    FROM pairs p
   GROUP BY p.id, p.other
$function$;

COMMENT ON FUNCTION public.booking_fee_business_matches(UUID[]) IS
  'For each given shop, every OTHER shop that is the same business (owner 2026-11-06): same registration number, phone or payout account (vendor_profiles.user_id is UNIQUE, so every other shop is another account); demo shops never match. other_took_free = that shop already holds a free booking place. Read by booking_fee_business_free_standing (the money path) and by /admin/verify (the desk), so both see one match.';

REVOKE ALL ON FUNCTION public.booking_fee_business_matches(UUID[]) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.booking_fee_business_matches(UUID[]) TO service_role;

-- ── MAY THIS SHOP STILL TAKE THE BUSINESS'S FREE BOOKING? (fail closed) ─────

CREATE OR REPLACE FUNCTION public.booking_fee_business_free_standing(p_vendor_profile_id UUID)
 RETURNS TEXT
 LANGUAGE plpgsql
 STABLE
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF p_vendor_profile_id IS NULL THEN
    RETURN 'unreadable';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.booking_fee_business_matches(ARRAY[p_vendor_profile_id]) m
     WHERE m.other_took_free
  ) THEN
    RETURN 'used_by_business';
  END IF;
  RETURN 'available';
EXCEPTION WHEN OTHERS THEN
  -- 🔒 FAIL CLOSED. A match that could not run is never "nobody matched": the
  -- caller bills the normal fee and freezes the reason.
  RETURN 'unreadable';
END;
$function$;

COMMENT ON FUNCTION public.booking_fee_business_free_standing(UUID) IS
  'available = no other shop of this business holds a free booking place, so this shop may take one · used_by_business = one does · unreadable = the match could not run. ONLY available permits a free booking (fail closed). Owner 2026-11-06, ONE FREE FIRST BOOKING PER BUSINESS.';

REVOKE ALL ON FUNCTION public.booking_fee_business_free_standing(UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.booking_fee_business_free_standing(UUID) TO service_role;

REVOKE ALL ON FUNCTION public.booking_fee_registration_key(TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.booking_fee_registration_key(TEXT) TO service_role;
REVOKE ALL ON FUNCTION public.booking_fee_number_key(TEXT, INTEGER) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.booking_fee_number_key(TEXT, INTEGER) TO service_role;

-- ── THE TWO BODIES THAT DECIDE "FREE" ─────────────────────────────────────

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

  -- ⟵ MOVED: the card is asked only once a fee is actually coming.
  IF NOT public.setnayan_gift_offered_on(v_ev.vendor_id) THEN RETURN 'card_says_no'; END IF;
  RETURN 'applies';
END;
$$;

REVOKE ALL ON FUNCTION public.setnayan_gift_quote_applies(UUID, UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.setnayan_gift_quote_applies(UUID, UUID) TO service_role;

COMMIT;
