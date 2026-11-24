-- free_booking_fee_only_for_you_events_locked_once_a_supplier_joins
-- Created via `pnpm migration:new`. Idempotent: ADD COLUMN IF NOT EXISTS · CREATE OR REPLACE FUNCTION · the backfill
-- touches only rows still NULL · DROP TRIGGER IF EXISTS before CREATE TRIGGER.
--
-- ── THE RULING (specs DECISION_LOG, 2026-11-23, "Free booking fee only on 'For you' events, locked once a supplier
--    joins") ─────────────────────────────────────────────────────────────────────────────────────────────────────────
--   Owner, verbatim: "you can only get free booking fee if the event is for self (you are the celebrant) once a
--   supplier comes in, it is locked that way." Confirmed: "Yes, that's it".
--     · A booking pays NO fee only when its event is "For you": the account that made it is the celebrant.
--     · An event made for someone else always pays — a planner, a relative, or a supplier creating it for a client.
--     · EVERY free path: 'import' (clients the supplier brings), free fee tickets, the launch offer, free-fee windows,
--       every-Nth. A ledger row frozen free before today is never taken back.
--     · Once any supplier joins the event (an event_vendors row), For you / For someone else is LOCKED.
--
-- ── FIND IT FIRST (RULE 0) ──────────────────────────────────────────────────────────────────────────────────────────
--   exists  · the answer's vocabulary — `event_type_vocab.for_whom` / lib/create-subjects.ts FOR_WHOM_MODES:
--             'self' · 'someone' · 'memorial' · 'business' — and the "For ▾" choice on every create path
--             (app/_components/self-celebrant-lock.tsx draws the locked celebrant for 'self').
--   missing · the event never STORED the answer. "For you" rode only in sessionStorage (lib/onboarding/
--             honoree-handoff.ts `forSelf`); a blank `events.honoree_label` means "the account holder's slot", but a
--             "Someone else" pick leaves the same blank (the name is optional), so it cannot tell the two apart — and
--             reading it as "for you" would hand the free fee to exactly the event the owner ruled must pay.
--   delta   · ONE column, `events.for_whom`, in those same four words. No second copy anywhere.
--
-- ── WHAT CHANGES ────────────────────────────────────────────────────────────────────────────────────────────────────
--   1 · events.for_whom (NULL = never recorded). Written by the create paths (service role) from the "For ▾" answer;
--       `authenticated` / `anon` get NO grant on it (20271005100000's allow-list is a snapshot), so a host cannot set
--       it from the browser.
--   2 · Backfill, weddings only: the creator's own host row (event_moderators, invited by themselves) says who they
--       are — bride / groom → 'self', family_helper → 'someone'. Every other existing event stays NULL (unknowable),
--       which pays: the free paths fail toward the fee, as every rule in this lane does.
--   3 · public.booking_fee_event_is_for_you(event) — the ONE reader (TS twin: lib/event-for-whom.ts `isForYouEvent`).
--   4 · events_for_whom_locked trigger: once an event_vendors row exists for the event, any change to for_whom is
--       refused — for every role, service_role included ("No one can change it").
--   5 · booking_fee_open_lock_charge re-created: every free arm also asks (3). Everything else is 20271356196197
--       verbatim (marked ⟵ 23 NOV where it is not). The attribution is NOT changed — 'import' stays 'import', because
--       the proof readers (#8227's arm's-length rule) ask it who brought the client, not whether the fee is waived.
--   booking_fee_rederive_lock_fee is untouched: an amendment never grants a new waiver and keeps every existing one.

BEGIN;

-- A busy events table must not hold the deploy: give up after 5 s rather than queue behind it.
SET LOCAL lock_timeout = '5s';

-- ── 1 · The stored answer ───────────────────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS for_whom TEXT
    CHECK (for_whom IS NULL OR for_whom IN ('self', 'someone', 'memorial', 'business'));

COMMENT ON COLUMN public.events.for_whom IS
  'Who the event is for, as the creator answered "For ▾": self (the account that made it is the celebrant) | someone | '
  'memorial | business. NULL = never recorded (pays on every free path). The words are lib/create-subjects.ts '
  'FOR_WHOM_MODES. LOCKED once any event_vendors row exists (events_for_whom_locked). Owner 2026-11-23.';

-- ── 4 (first half) · The lock comes off for the backfill only, and goes back on below ──────────────────────────────
DROP TRIGGER IF EXISTS events_for_whom_locked ON public.events;

-- ── 2 · Backfill: a wedding's creator already said who they are ─────────────────────────────────────────────────────
UPDATE public.events e
   SET for_whom = m.answer
  FROM (
    SELECT DISTINCT ON (em.event_id)
           em.event_id,
           CASE WHEN em.role_subtype IN ('bride', 'groom') THEN 'self' ELSE 'someone' END AS answer
      FROM public.event_moderators em
     WHERE em.user_id = em.invited_by_user_id
       AND em.role_subtype IN ('bride', 'groom', 'family_helper')
     ORDER BY em.event_id, em.accepted_at NULLS LAST, em.moderator_id
  ) m
 WHERE e.event_id = m.event_id
   AND e.event_type = 'wedding'
   AND e.for_whom IS NULL;

-- ── 3 · The one reader ──────────────────────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.booking_fee_event_is_for_you(p_event_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT COALESCE((SELECT e.for_whom = 'self' FROM public.events e WHERE e.event_id = p_event_id), FALSE);
$$;
COMMENT ON FUNCTION public.booking_fee_event_is_for_you(UUID) IS
  'True only when events.for_whom = ''self'' (the account that made the event is its celebrant). No row, NULL, or '
  'any other word is FALSE — the fee. Every free path of booking_fee_open_lock_charge asks it. Owner 2026-11-23. '
  'TS twin: lib/event-for-whom.ts isForYouEvent.';
REVOKE ALL ON FUNCTION public.booking_fee_event_is_for_you(UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.booking_fee_event_is_for_you(UUID) TO service_role;

-- ── 4 · Locked once a supplier joins ────────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.events_for_whom_locked_once_a_supplier_joins()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.for_whom IS DISTINCT FROM OLD.for_whom
     AND EXISTS (SELECT 1 FROM public.event_vendors ev WHERE ev.event_id = OLD.event_id) THEN
    RAISE EXCEPTION 'for_whom_locked: who this event is for cannot change once a supplier has joined it'
      USING ERRCODE = 'check_violation',
            HINT = 'Owner 2026-11-23: For you / For someone else is locked once any supplier joins the event.';
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.events_for_whom_locked_once_a_supplier_joins() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER events_for_whom_locked
  BEFORE UPDATE OF for_whom ON public.events
  FOR EACH ROW
  EXECUTE FUNCTION public.events_for_whom_locked_once_a_supplier_joins();

-- ── 5 · The lock RPC: every free arm asks whether the event is For you ─────────────────────────────────────────────
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
  v_badge       UUID;
  v_gift_on     BOOLEAN;
  v_stamp       RECORD;
  v_gift_credits INTEGER;
  v_gift_grant  UUID;
  v_business    TEXT;
  v_withheld    TEXT;
  v_lock_id     UUID;
  v_platform_no BIGINT;   -- ⟵ 20 NOV: this booking's place among Setnayan's fee bookings
  v_platform_free BOOLEAN := FALSE;  -- ⟵ 20 NOV: the every-Nth waiver
  v_for_you     BOOLEAN := FALSE;  -- ⟵ 23 NOV: the event is "For you" — the only kind a free path may waive
BEGIN
  SELECT ev.marketplace_vendor_id AS vpid,
         ev.event_id,
         ev.status,
         ev.package_role,
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
  -- ⟵ 23 NOV (owner, DECISION_LOG "Free booking fee only on 'For you' events, locked once a supplier joins"): every
  -- free path below — the import, the launch offer, a free-fee window, the every-Nth booking fee, a free booking fee
  -- ticket — waives a fee ONLY when the account that made the event is its celebrant. Anything else (someone else, a
  -- business, a memorial, or an event that never recorded the answer) pays. A waiver already granted is never taken
  -- back: the reuse checks return a live waived charge, and a ledger place frozen free or in the launch offer keeps it.
  -- The attribution itself stays honest ('import' is still 'import'): other readers (proof, reviews) ask it who
  -- brought the client, not whether the fee is waived.
  v_for_you := public.booking_fee_event_is_for_you(v_ev.event_id);

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

  IF v_ledger.attribution = 'import' AND v_for_you THEN   -- ⟵ 23 NOV: an import is free only on a For-you event
    SELECT charge_id, status INTO v_existing
      FROM public.booking_fee_charges
      WHERE event_vendor_id = p_event_vendor_id
        AND status IN ('pending', 'paid', 'waived_import', 'waived_free5', 'waived_promo', 'waived_launch')
      LIMIT 1;
    IF FOUND THEN
      RETURN jsonb_build_object(
        'charge_id', v_existing.charge_id, 'status', v_existing.status,
        'amount_charged_centavos', 0, 'computed_fee_centavos', 0,
        'is_free', TRUE, 'attribution', 'import', 'for_you', TRUE, 'reused', TRUE);
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
      'is_free', TRUE, 'attribution', 'import', 'for_you', TRUE, 'reused', FALSE);
  END IF;

  -- THE LAUNCH OFFER (unchanged): the first N sourced bookings on the platform carry no fee.
  IF v_ledger.booking_ordinal IS NULL THEN
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
        'attribution', v_ledger.attribution, 'for_you', v_for_you, 'reused', true);
    END IF;

    IF v_ledger.launch_offer THEN
      v_launch_no := v_ledger.launch_offer_number;      -- a launch place already held is never taken back
    ELSIF v_for_you THEN                                -- ⟵ 23 NOV: a new launch place only for a For-you event
      v_launch_no := public.booking_fee_launch_offer_take(v_ledger.ledger_id);
    ELSE
      v_launch_no := NULL;
    END IF;

    IF v_launch_no IS NOT NULL THEN
      v_fee := public.booking_fee_centavos_for(v_ev.amount_centavos, v_ev.vpid);   -- ⟵ 20 NOV: this shop's schedule
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
        'attribution', v_ledger.attribution, 'for_you', v_for_you, 'reused', false);
    END IF;
  END IF;

  IF v_ledger.booking_ordinal IS NULL THEN
    SELECT count(*) INTO v_ordinal
      FROM public.booking_fee_ledger l2
      WHERE l2.vendor_profile_id = v_ev.vpid
        AND l2.source = 'lock'
        AND l2.attribution = 'sourced'
        AND NOT l2.launch_offer
        AND (l2.created_at, l2.ledger_id) <= (v_ledger.created_at, v_ledger.ledger_id);
    v_ordinal := GREATEST(v_ordinal, 1);
    -- ⟵ 20 NOV: the limit is now 0, so no booking that takes its place now is free. The arm stays so the one home of
    -- the number keeps deciding it.
    v_is_free := v_for_you AND v_ordinal <= public.booking_fee_free_booking_limit();   -- ⟵ 23 NOV
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
          free_booking_withheld_reason = v_withheld,
          updated_at = NOW()
      WHERE ledger_id = v_ledger.ledger_id;
  ELSE
    -- A waiver already granted stays granted (frozen, never re-derived).
    v_ordinal := v_ledger.booking_ordinal;
    v_is_free := v_ledger.is_free_booking;
    v_withheld := v_ledger.free_booking_withheld_reason;
  END IF;

  SELECT charge_id, status, amount_charged_centavos, computed_fee_centavos,
         platform_fee_number, free_by_platform_count            -- ⟵ 20 NOV
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
      'platform_fee_number', v_existing.platform_fee_number,          -- ⟵ 20 NOV
      'free_by_platform_count', v_existing.free_by_platform_count,    -- ⟵ 20 NOV
      'attribution', v_ledger.attribution, 'for_you', v_for_you, 'reused', true);
  END IF;

  v_fee := public.booking_fee_centavos_for(v_ev.amount_centavos, v_ev.vpid);   -- ⟵ 20 NOV: taper or flat, locked

  IF v_is_free THEN
    v_status := 'waived_free5';
    v_charge_amount := 0;
  ELSIF v_fee <= 0 THEN
    v_status := 'paid';
    v_charge_amount := 0;
  ELSIF v_for_you AND public.booking_fee_free_window_active() THEN   -- ⟵ 23 NOV
    v_status := 'waived_promo';
    v_charge_amount := 0;
  ELSE
    -- ⟵ 20 NOV · THE BOOKING CARRIES A FEE: it takes its place among every fee booking on Setnayan. Every Nth is free
    -- (owner: "every 100,000th booking fee", "All of Setnayan"). It sits ABOVE the badge ticket on purpose: a booking
    -- Setnayan waives has no fee for a ticket to pay, so the shop keeps its ticket for the next one.
    v_platform_no := public.booking_fee_take_platform_number();
    -- ⟵ 23 NOV: a booking on an event made for someone else still takes its place in Setnayan's count (it carries a
    -- fee), but the Nth number never waives it.
    v_platform_free := v_for_you AND public.booking_fee_platform_number_is_free(v_platform_no);
    IF v_platform_free THEN
      v_status := 'paid';
      v_charge_amount := 0;
    ELSE
      -- The free booking fee ticket (badge reward), auto-claimed: the shop's OLDEST unused one pays this fee. No
      -- choice, no redeem — owner 2026-11-20 "auto claimed on your next event booking" (unchanged code).
      -- ⟵ 23 NOV: only on a For-you event. Otherwise the shop keeps its ticket for a booking it may pay.
      IF v_for_you THEN
        SELECT r.reward_id INTO v_badge
          FROM public.shop_badge_rewards r
         WHERE r.vendor_profile_id = v_ev.vpid
           AND r.reward_kind = 'fee_waiver'
           AND r.revoked_at IS NULL
           AND r.used_on_charge_id IS NULL
         ORDER BY r.granted_at, r.reward_id
         LIMIT 1
         FOR UPDATE;
      END IF;
      IF v_badge IS NOT NULL THEN
        v_status := 'paid';
        v_charge_amount := 0;
      ELSE
        v_status := 'pending';
        v_charge_amount := v_fee;
      END IF;
    END IF;
  END IF;

  INSERT INTO public.booking_fee_charges
    (ledger_id, proposal_id, event_vendor_id, source, vendor_profile_id, event_id,
     proposal_amount_centavos, computed_fee_centavos, amount_charged_centavos,
     schedule_version, status, paid_at, expires_at, badge_reward_id,
     platform_fee_number, free_by_platform_count)                       -- ⟵ 20 NOV
  VALUES
    (v_ledger.ledger_id, NULL, p_event_vendor_id, 'lock', v_ev.vpid, v_ev.event_id,
     v_ev.amount_centavos, v_fee, v_charge_amount, p_schedule_version, v_status,
     CASE WHEN v_status = 'paid' THEN NOW() ELSE NULL END,
     CASE WHEN v_status = 'pending' THEN NOW() + INTERVAL '7 days' ELSE NULL END,
     v_badge,
     v_platform_no, v_platform_free)                                    -- ⟵ 20 NOV
  RETURNING charge_id INTO v_charge_id;

  IF v_badge IS NOT NULL THEN
    UPDATE public.shop_badge_rewards
       SET used_on_charge_id = v_charge_id, used_at = NOW(),
           returned_at = NULL, returned_from_charge_id = NULL
     WHERE reward_id = v_badge;

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
    'badge_reward_id', v_badge,
    'free_withheld', v_withheld,
    'platform_fee_number', v_platform_no,          -- ⟵ 20 NOV
    'free_by_platform_count', v_platform_free,     -- ⟵ 20 NOV
    'attribution', v_ledger.attribution, 'for_you', v_for_you, 'reused', false);
END;
$function$;

REVOKE ALL ON FUNCTION public.booking_fee_open_lock_charge(UUID, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.booking_fee_open_lock_charge(UUID, TEXT) TO service_role;

COMMIT;
