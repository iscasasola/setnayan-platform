-- badge_rewards_land_in_the_gift_stock
-- ============================================================================
-- BADGE REWARDS — what each badge gives lands in the supplier's gift stock
-- (owner, 2026-11-05).
--
-- ⚖ DECISION_LOG 2026-11-05 "BADGE REWARDS — WHAT EACH BADGE GIVES, WHERE IT
--   LANDS, AND THE NEXT ONE SHOWN" (closed, do not re-ask):
--   · each badge and each step pays ONCE; no expiry;
--   · Papic 150, Event Plus and Event Pro land in the EXISTING gift stock
--     (supplier-gifts slices 1–2: 20271309169686 · 20271310091114), marked
--     "Badge reward", and are given the normal way — on a card or quote — at
--     the couple's first payment;
--   · badge rewards are EXEMPT from the 40%-of-booking-fee gift limit; bought
--     gifts keep it;
--   · Events on Setnayan 1,000 / 5,000 / 10,000 → a FREE BOOKING FEE on the
--     next customer: applied automatically to the shop's next booking that
--     would carry a fee (never one that is already free), shown as ₱0 · Badge
--     reward, one per booking, with history and an admin revoke.
--
-- WHAT THIS FILE DOES (extends, re-draws nothing):
--   1. `shop_badge_rewards` — ONE row per reward a shop was given, keyed
--      UNIQUE (shop, reward_key). The key names the badge and its step or
--      period ('events:50', 'award:most_booked:2026-11-01', 'branches:2'), so
--      a re-run, or a badge lost and earned again, can never pay twice. A
--      revoked row stays — revoking never re-opens the key.
--   2. `shop_gift_stock_entries` accepts a fourth kind, 'badge_reward' (+),
--      pointing at its reward (`badge_reward_id`, UNIQUE): the reward IS stock,
--      so `shop_gift_stock_status` counts it and every quote can offer it with
--      no change.
--   3. `vendor_proposal_shop_gifts.from_badge_reward` — a quote line paid from
--      badge-reward stock. The 40% limit leaves those lines out (the app's
--      `judgeQuoteGifts` decides it; the column records it).
--   4. `shop_gift_reward_stock_status` — how much of each kind of stock is
--      still badge reward: earned − what reward lines on live or delivered
--      quotes use. The app takes the smaller of that and the free stock.
--   5. `shop_badge_reward_grant` — the ONE door a reward takes in. Idempotent.
--   6. `booking_fee_charges.badge_reward_id` + the badge arm in
--      `booking_fee_open_lock_charge`: below free-first-booking, the ₱0 fee
--      and the promo window (so a booking that is already free never spends
--      one), the shop's oldest unused free booking fee pays the fee. The
--      charge is written as a ₱0 `paid` — the status every settled-fee reader
--      already knows (access unlocked, date held, no bill, no receipt e-mail)
--      — and names the reward that paid it. ⚠ No new charge status on purpose:
--      eight functions carry hard-coded status lists, and a status missing
--      from one of them would mint a second charge on a re-lock.
--   7. `booking_fee_rederive_lock_fee` — a badge-paid booking stays free when
--      its total is amended (the promo / launch rule). Without this arm a ₱0
--      `paid` primary reads as "underpaid by the whole fee" and opens a delta.
--   8. `shop_badge_fee_waiver_revoke` — the admin takes back an UNUSED free
--      booking fee.
--   9. (owner 2026-11-05, on the draft) A BOOKING CANCELLED BEFORE ITS DAY GIVES
--      ITS FREE BOOKING FEE BACK — "the supplier got nothing from that booking".
--      `booking_fee_expires_when_booking_cancelled` gains that arm.
--  10. (owner 2026-11-05, on the draft) A BADGE-PAID BOOKING STILL GIVES THE
--      COUPLE THE SETNAYAN GIFT — "the gift belongs with the booking, not the
--      bill". It lands on the couple's event the moment the free fee is used,
--      sized exactly as the supplier's card / quote promised (the lock stamp
--      first, else `setnayan_gift_for_fee`). No bill: Setnayan covers it.
--      `setnayan_gift_quote_applies` answers two new arms — 'badge_reward' (the
--      gift is on) and 'badge_reward_card_says_no' (it is off, the supplier may
--      switch it on) — so the quote promises those photos, at no bill, instead
--      of saying "no deal".
--
-- Bodies of (6), (7), (9) and (10) copied from their LATEST definitions —
-- 20271284624593_the_first_booking_is_on_us.sql (lock charge, quote applies),
-- 20271268832636_the_launch_offer.sql (rederive) and
-- 20271268087628_the_fee_is_made_at_the_yes.sql (cancel) — with only the lines
-- marked `⟵ BADGE` changed. Grants re-stated, unchanged.
--
-- KEEP IDEMPOTENT. 🛑 NEVER APPLIED BY HAND. The pipeline pushes this file.
-- ============================================================================

BEGIN;

-- ── 1 · the rewards a shop was given ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.shop_badge_rewards (
  reward_id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_profile_id UUID NOT NULL
                      REFERENCES public.vendor_profiles(vendor_profile_id) ON DELETE CASCADE,
  -- The badge and its step or period — the exactly-once key ('verified',
  -- 'events:50', 'reviews:10', 'award:rising:2026-11-01', 'branches:2').
  reward_key        TEXT NOT NULL
                      CONSTRAINT shop_badge_rewards_reward_key_shape
                      CHECK (length(btrim(reward_key)) > 0 AND length(reward_key) <= 120),
  -- The badge family ('events', 'reviews', 'award', …) — for the badge page.
  badge             TEXT NOT NULL
                      CONSTRAINT shop_badge_rewards_badge_shape
                      CHECK (length(btrim(badge)) > 0 AND length(badge) <= 40),
  reward_kind       TEXT NOT NULL
                      CONSTRAINT shop_badge_rewards_reward_kind_allowed
                      CHECK (reward_kind IN ('papic', 'event_plus', 'event_pro', 'fee_waiver')),
  -- How many packs / unlocks / free fees ("2 × Papic 150" = 2).
  units             INTEGER NOT NULL
                      CONSTRAINT shop_badge_rewards_units_range
                      CHECK (units > 0 AND units <= 10),
  -- What landed in the gift stock: Papic credits (units × the smallest pack's
  -- credits, read from the catalogue at grant time), or units for an unlock.
  -- 0 for a free booking fee, which is not stock.
  stock_delta       INTEGER NOT NULL
                      CONSTRAINT shop_badge_rewards_stock_delta_nonneg
                      CHECK (stock_delta >= 0),
  CONSTRAINT shop_badge_rewards_waiver_is_one CHECK (
    reward_kind <> 'fee_waiver' OR (units = 1 AND stock_delta = 0)
  ),
  CONSTRAINT shop_badge_rewards_stock_kind_lands CHECK (
    reward_kind = 'fee_waiver' OR stock_delta > 0
  ),
  -- A free booking fee: the charge it paid, when it was used.
  used_on_charge_id UUID REFERENCES public.booking_fee_charges(charge_id) ON DELETE SET NULL,
  used_at           TIMESTAMPTZ,
  -- …and, when that booking was cancelled before its day, when it came back
  -- and from which charge (owner 2026-11-05: give the free fee back).
  returned_at             TIMESTAMPTZ,
  returned_from_charge_id UUID REFERENCES public.booking_fee_charges(charge_id) ON DELETE SET NULL,
  -- The Setnayan gift the couple got with the badge-paid booking (owner
  -- 2026-11-05: "the gift belongs with the booking, not the bill").
  setnayan_gift_credits   INTEGER
                            CONSTRAINT shop_badge_rewards_gift_credits_positive
                            CHECK (setnayan_gift_credits IS NULL OR setnayan_gift_credits > 0),
  setnayan_gift_grant_id  UUID REFERENCES public.papic_event_point_grants(grant_id) ON DELETE SET NULL,
  CONSTRAINT shop_badge_rewards_only_a_waiver_is_used CHECK (
    reward_kind = 'fee_waiver'
    OR (used_on_charge_id IS NULL AND used_at IS NULL AND returned_at IS NULL
        AND returned_from_charge_id IS NULL AND setnayan_gift_credits IS NULL
        AND setnayan_gift_grant_id IS NULL)
  ),
  -- Admin revoke (a free booking fee, unused). The row stays: the key stays spent.
  revoked_at        TIMESTAMPTZ,
  revoked_by        UUID,
  revoke_note       TEXT,
  note              TEXT,
  granted_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS shop_badge_rewards_once
  ON public.shop_badge_rewards (vendor_profile_id, reward_key);

CREATE INDEX IF NOT EXISTS shop_badge_rewards_waiver_free_idx
  ON public.shop_badge_rewards (vendor_profile_id, granted_at)
  WHERE reward_kind = 'fee_waiver' AND used_on_charge_id IS NULL AND revoked_at IS NULL;

COMMENT ON TABLE public.shop_badge_rewards IS
  'What each badge GAVE a shop (owner 2026-11-05, DECISION_LOG "BADGE REWARDS"): one row '
  'per reward, UNIQUE (vendor_profile_id, reward_key) so every badge and every step pays '
  'exactly once — a re-run or a badge lost and re-earned never pays twice; a revoked row '
  'keeps its key. Papic / Event Plus / Event Pro land in shop_gift_stock_entries (kind '
  'badge_reward); a fee_waiver is a free booking fee the next fee-bearing booking uses '
  '(booking_fee_open_lock_charge). Written only by shop_badge_reward_grant. Never expires.';

ALTER TABLE public.shop_badge_rewards ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS shop_badge_rewards_vendor_read ON public.shop_badge_rewards;
CREATE POLICY shop_badge_rewards_vendor_read
  ON public.shop_badge_rewards
  FOR SELECT TO authenticated
  USING (
    vendor_profile_id IN (SELECT public.current_vendor_profile_ids())
    OR (SELECT public.is_admin())
  );

REVOKE ALL ON TABLE public.shop_badge_rewards FROM anon;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER
  ON TABLE public.shop_badge_rewards FROM authenticated;

-- ── 2 · a reward is stock ────────────────────────────────────────────────────
ALTER TABLE public.shop_gift_stock_entries
  ADD COLUMN IF NOT EXISTS badge_reward_id UUID
    REFERENCES public.shop_badge_rewards(reward_id) ON DELETE SET NULL;

CREATE UNIQUE INDEX IF NOT EXISTS shop_gift_stock_entries_badge_reward_once
  ON public.shop_gift_stock_entries (badge_reward_id)
  WHERE badge_reward_id IS NOT NULL;

ALTER TABLE public.shop_gift_stock_entries
  DROP CONSTRAINT IF EXISTS shop_gift_stock_entries_kind_allowed;
ALTER TABLE public.shop_gift_stock_entries
  ADD CONSTRAINT shop_gift_stock_entries_kind_allowed
  CHECK (kind IN ('bought', 'given', 'reversal', 'badge_reward'));

ALTER TABLE public.shop_gift_stock_entries
  DROP CONSTRAINT IF EXISTS shop_gift_stock_entries_sign_matches_kind;
ALTER TABLE public.shop_gift_stock_entries
  ADD CONSTRAINT shop_gift_stock_entries_sign_matches_kind CHECK (
    (kind IN ('bought', 'badge_reward') AND delta > 0)
    OR (kind IN ('given', 'reversal') AND delta < 0)
  );

COMMENT ON COLUMN public.shop_gift_stock_entries.badge_reward_id IS
  'On a badge_reward row: the shop_badge_rewards row it came from (UNIQUE — one stock row '
  'per reward). The "Badge reward" mark that tells it apart from bought stock.';

-- ── 3 · a quote line paid from badge-reward stock ────────────────────────────
ALTER TABLE public.vendor_proposal_shop_gifts
  ADD COLUMN IF NOT EXISTS from_badge_reward BOOLEAN NOT NULL DEFAULT FALSE;

COMMENT ON COLUMN public.vendor_proposal_shop_gifts.from_badge_reward IS
  'TRUE = this line is paid from the shop''s badge-reward stock, so it sits outside the '
  '40%-of-booking-fee gift limit (owner 2026-11-05). Decided by the app''s judgeQuoteGifts '
  'at send, from shop_gift_reward_stock_status.';

-- ── 4 · how much of the stock is still badge reward ──────────────────────────
-- earned = SUM of badge_reward rows; used = reward lines on quotes that still
-- hold (the same "live" test as shop_gift_stock_status, including its rule that
-- a paid unlock stops being held) or that were delivered (a 'given' row names
-- the proposal). p_except_event_id leaves out live lines of the event a new
-- quote replaces, exactly as shop_gift_stock_status does. SECURITY INVOKER.
CREATE OR REPLACE FUNCTION public.shop_gift_reward_stock_status(
  p_vendor_profile_id UUID,
  p_except_event_id   UUID DEFAULT NULL
)
 RETURNS TABLE (gift_kind TEXT, earned INTEGER, used INTEGER)
 LANGUAGE sql
 STABLE
 SECURITY INVOKER
 SET search_path TO 'public', 'pg_temp'
AS $function$
  WITH kinds(gift_kind) AS (
    VALUES ('papic'::TEXT), ('event_plus'::TEXT), ('event_pro'::TEXT)
  ),
  lines AS (
    SELECT g.gift_kind, g.credits, g.proposal_id, p.event_id, p.status, p.valid_until,
           EXISTS (
             SELECT 1 FROM public.event_vendors ev
              WHERE ev.event_id = p.event_id
                AND ev.marketplace_vendor_id = p_vendor_profile_id
                AND ev.deposit_acknowledged_at IS NOT NULL
           ) AS paid,
           EXISTS (
             SELECT 1 FROM public.shop_gift_stock_entries e
              WHERE e.vendor_profile_id = p_vendor_profile_id
                AND e.proposal_id = g.proposal_id
                AND e.gift_kind = g.gift_kind
                AND e.kind = 'given'
           ) AS delivered
      FROM public.vendor_proposal_shop_gifts g
      JOIN public.vendor_proposals p ON p.proposal_id = g.proposal_id
     WHERE g.vendor_profile_id = p_vendor_profile_id
       AND g.from_badge_reward
  )
  SELECT k.gift_kind,
         COALESCE((SELECT SUM(e.delta) FROM public.shop_gift_stock_entries e
                    WHERE e.vendor_profile_id = p_vendor_profile_id
                      AND e.gift_kind = k.gift_kind
                      AND e.kind = 'badge_reward'), 0)::INTEGER,
         COALESCE((SELECT SUM(l.credits) FROM lines l
                    WHERE l.gift_kind = k.gift_kind
                      AND (
                        l.delivered
                        OR (
                          l.event_id IS NOT NULL
                          AND (p_except_event_id IS NULL OR l.event_id <> p_except_event_id)
                          AND (l.gift_kind = 'papic' OR NOT l.paid)
                          AND (
                            l.status = 'accepted'
                            OR (l.status IN ('sent', 'viewed')
                                AND (l.valid_until IS NULL
                                     OR l.valid_until >= (NOW() AT TIME ZONE 'Asia/Manila')::date))
                          )
                        )
                      )), 0)::INTEGER
    FROM kinds k;
$function$;

REVOKE ALL ON FUNCTION public.shop_gift_reward_stock_status(UUID, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.shop_gift_reward_stock_status(UUID, UUID) TO authenticated, service_role;

COMMENT ON FUNCTION public.shop_gift_reward_stock_status(UUID, UUID) IS
  'How much of a shop''s gift stock is still BADGE REWARD, per kind: earned (badge_reward '
  'stock rows) and used (from_badge_reward quote lines that are live or delivered). Free '
  'reward = min(earned − used, free stock). Reward lines sit outside the 40% gift limit.';

-- ── 5 · the one door a reward takes in ───────────────────────────────────────
-- Returns {status:'granted', reward_id} · {status:'already'} · {status:'bad_input'}.
-- Under the same per-shop lock as the gift doors. ON CONFLICT DO NOTHING on the
-- (shop, reward_key) key is the whole exactly-once mechanism.
CREATE OR REPLACE FUNCTION public.shop_badge_reward_grant(
  p_vendor_profile_id UUID,
  p_reward_key        TEXT,
  p_badge             TEXT,
  p_reward_kind       TEXT,
  p_units             INTEGER,
  p_credits_each      INTEGER,
  p_note              TEXT DEFAULT NULL
)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_reward UUID;
  v_delta  INTEGER;
BEGIN
  IF p_vendor_profile_id IS NULL OR p_reward_key IS NULL OR btrim(p_reward_key) = ''
     OR p_badge IS NULL OR btrim(p_badge) = ''
     OR p_reward_kind IS NULL OR p_reward_kind NOT IN ('papic', 'event_plus', 'event_pro', 'fee_waiver')
     OR p_units IS NULL OR p_units < 1 OR p_units > 10 THEN
    RETURN jsonb_build_object('status', 'bad_input');
  END IF;
  IF p_reward_kind = 'fee_waiver' THEN
    IF p_units <> 1 THEN RETURN jsonb_build_object('status', 'bad_input'); END IF;
    v_delta := 0;
  ELSIF p_reward_kind = 'papic' THEN
    -- The smallest pack's credits, read by the app from the catalogue. Never typed.
    IF p_credits_each IS NULL OR p_credits_each < 1 THEN
      RETURN jsonb_build_object('status', 'bad_input');
    END IF;
    v_delta := p_units * p_credits_each;
  ELSE
    v_delta := p_units;   -- one unlock each
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended('shop_gift_stock:' || p_vendor_profile_id::text, 0));

  INSERT INTO public.shop_badge_rewards
    (vendor_profile_id, reward_key, badge, reward_kind, units, stock_delta, note)
  VALUES
    (p_vendor_profile_id, btrim(p_reward_key), btrim(p_badge), p_reward_kind, p_units, v_delta, p_note)
  ON CONFLICT (vendor_profile_id, reward_key) DO NOTHING
  RETURNING reward_id INTO v_reward;

  IF v_reward IS NULL THEN
    RETURN jsonb_build_object('status', 'already');
  END IF;

  IF p_reward_kind <> 'fee_waiver' THEN
    INSERT INTO public.shop_gift_stock_entries
      (vendor_profile_id, gift_kind, delta, kind, badge_reward_id, note)
    VALUES
      (p_vendor_profile_id, p_reward_kind, v_delta, 'badge_reward', v_reward,
       COALESCE(p_note, 'Badge reward'));
  END IF;

  RETURN jsonb_build_object('status', 'granted', 'reward_id', v_reward);
END;
$function$;

REVOKE ALL ON FUNCTION public.shop_badge_reward_grant(UUID, TEXT, TEXT, TEXT, INTEGER, INTEGER, TEXT)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.shop_badge_reward_grant(UUID, TEXT, TEXT, TEXT, INTEGER, INTEGER, TEXT)
  TO service_role;

COMMENT ON FUNCTION public.shop_badge_reward_grant(UUID, TEXT, TEXT, TEXT, INTEGER, INTEGER, TEXT) IS
  'The only door a badge reward takes in (owner 2026-11-05). Writes shop_badge_rewards once per '
  '(shop, reward_key) and, for Papic / Event Plus / Event Pro, the matching badge_reward stock row. '
  'A second call with the same key writes nothing ({status:already}). Service-role only; the app '
  'decides which badges are earned (lib/badge-rewards.ts).';

-- ── 6 · a free booking fee pays the next fee ─────────────────────────────────
ALTER TABLE public.booking_fee_charges
  ADD COLUMN IF NOT EXISTS badge_reward_id UUID
    REFERENCES public.shop_badge_rewards(reward_id) ON DELETE SET NULL;

-- One free booking fee pays one charge.
CREATE UNIQUE INDEX IF NOT EXISTS booking_fee_charges_badge_reward_once
  ON public.booking_fee_charges (badge_reward_id)
  WHERE badge_reward_id IS NOT NULL;

COMMENT ON COLUMN public.booking_fee_charges.badge_reward_id IS
  'Set when a badge reward (a free booking fee, shop_badge_rewards.reward_kind = fee_waiver) paid '
  'this charge: status paid, amount_charged_centavos 0, computed_fee_centavos = what it would have '
  'cost. Written only by booking_fee_open_lock_charge (owner 2026-11-05).';

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
    'attribution', 'sourced', 'reused', false);
END;
$function$;

REVOKE ALL ON FUNCTION public.booking_fee_open_lock_charge(UUID, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.booking_fee_open_lock_charge(UUID, TEXT) TO service_role;

-- ── 7 · an amended badge-paid booking stays free ─────────────────────────────
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
  SELECT charge_id, ledger_id, status, amount_charged_centavos, proposal_amount_centavos,
         badge_reward_id   -- ⟵ BADGE
    INTO v_primary
    FROM public.booking_fee_charges
    WHERE event_vendor_id = p_event_vendor_id AND kind = 'primary'
      AND status IN ('pending', 'paid', 'waived_import', 'waived_free5', 'waived_promo', 'waived_launch')
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
  -- ⟵ NEW (the launch offer): a launch booking is free for the same reason a
  -- promo one is — the promise was "this booking is free", and an amendment, or
  -- the offer closing since, must not withdraw it.
  IF v_primary.status = 'waived_launch' THEN
    RETURN jsonb_build_object('action', 'launch_noop');
  END IF;
  -- ⟵ BADGE (owner 2026-11-05): a booking whose fee a badge reward paid stays
  -- free when its total is amended — the promise was "this booking's fee is
  -- ₱0". Without this arm the ₱0 `paid` primary reads as underpaid by the WHOLE
  -- new fee and opens an amendment delta for it.
  IF v_primary.badge_reward_id IS NOT NULL THEN
    RETURN jsonb_build_object('action', 'badge_noop');
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

REVOKE ALL ON FUNCTION public.booking_fee_rederive_lock_fee(UUID, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.booking_fee_rederive_lock_fee(UUID, TEXT) TO service_role;

-- ── 8 · the admin takes back an unused free booking fee ──────────────────────
-- Returns {status:'revoked'} · {status:'already_revoked'} · {status:'used'} ·
-- {status:'not_found'}. A used one cannot be taken back — its booking already
-- read ₱0. The row stays (its key stays spent: a revoke never re-opens it).
CREATE OR REPLACE FUNCTION public.shop_badge_fee_waiver_revoke(
  p_reward_id UUID,
  p_admin_id  UUID,
  p_note      TEXT DEFAULT NULL
)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_row RECORD;
BEGIN
  SELECT reward_id, reward_kind, used_on_charge_id, revoked_at
    INTO v_row
    FROM public.shop_badge_rewards
   WHERE reward_id = p_reward_id
   FOR UPDATE;
  IF NOT FOUND OR v_row.reward_kind <> 'fee_waiver' THEN
    RETURN jsonb_build_object('status', 'not_found');
  END IF;
  IF v_row.revoked_at IS NOT NULL THEN
    RETURN jsonb_build_object('status', 'already_revoked');
  END IF;
  IF v_row.used_on_charge_id IS NOT NULL THEN
    RETURN jsonb_build_object('status', 'used');
  END IF;
  UPDATE public.shop_badge_rewards
     SET revoked_at = NOW(), revoked_by = p_admin_id, revoke_note = NULLIF(btrim(p_note), '')
   WHERE reward_id = p_reward_id;
  RETURN jsonb_build_object('status', 'revoked');
END;
$function$;

REVOKE ALL ON FUNCTION public.shop_badge_fee_waiver_revoke(UUID, UUID, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.shop_badge_fee_waiver_revoke(UUID, UUID, TEXT) TO service_role;

COMMENT ON FUNCTION public.shop_badge_fee_waiver_revoke(UUID, UUID, TEXT) IS
  'Admin revoke of an UNUSED free booking fee (a badge reward, owner 2026-11-05). A used one '
  'cannot be revoked. The row stays, so the badge step that earned it never pays again. '
  'Service-role only; the admin action checks is_admin first.';

-- ── 9 · a cancelled booking gives its free booking fee back ──────────────────
CREATE OR REPLACE FUNCTION public.booking_fee_expires_when_booking_cancelled()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_date  DATE;
  v_today DATE := (NOW() AT TIME ZONE 'Asia/Manila')::date;
  r       RECORD;
BEGIN
  IF NOT (OLD.archived_at IS NULL
          AND OLD.status IN ('contracted', 'deposit_paid', 'delivered', 'complete')) THEN
    RETURN NULL;  -- it was not booked; there is no fee to let go.
  END IF;
  IF NEW.archived_at IS NULL
     AND NEW.status IN ('contracted', 'deposit_paid', 'delivered', 'complete') THEN
    RETURN NULL;  -- still booked (contracted → deposit_paid is not a cancel).
  END IF;

  SELECT event_date INTO v_date FROM public.events WHERE event_id = NEW.event_id;
  IF v_date IS NOT NULL AND v_date <= v_today THEN
    RETURN NULL;  -- the day has come; the bill stands.
  END IF;

  BEGIN
    FOR r IN
      SELECT charge_id FROM public.booking_fee_charges
       WHERE event_vendor_id = NEW.vendor_id
         AND status = 'pending'
    LOOP
      UPDATE public.booking_fee_charges
         SET status = 'cancelled_unbilled', expires_at = NOW(), updated_at = NOW()
       WHERE charge_id = r.charge_id;
      PERFORM public.booking_fee_upsert_vendor_order(r.charge_id);
    END LOOP;

    -- ⟵ BADGE (owner 2026-11-05): "give the free fee back. The supplier got
    -- nothing from that booking." A charge a free booking fee paid lets go of
    -- it the same way an unpaid one does (→ cancelled_unbilled, so a re-agreed
    -- booking makes a fresh charge), and the free fee goes back to the shop's
    -- gifts, waiting again. The day having come stops this too (above): the
    -- booking stands, and so does what paid for it. The Setnayan gift the couple
    -- already received stays theirs.
    FOR r IN
      SELECT charge_id, badge_reward_id FROM public.booking_fee_charges
       WHERE event_vendor_id = NEW.vendor_id
         AND status = 'paid'
         AND badge_reward_id IS NOT NULL
    LOOP
      UPDATE public.booking_fee_charges
         SET status = 'cancelled_unbilled', badge_reward_id = NULL, updated_at = NOW()
       WHERE charge_id = r.charge_id;
      UPDATE public.shop_badge_rewards
         SET used_on_charge_id = NULL, used_at = NULL,
             returned_at = NOW(), returned_from_charge_id = r.charge_id
       WHERE reward_id = r.badge_reward_id;
    END LOOP;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'booking_fee_expires_when_booking_cancelled: booking %: %',
      NEW.vendor_id, SQLERRM;
  END;

  RETURN NULL;
END;
$$;
REVOKE ALL ON FUNCTION public.booking_fee_expires_when_booking_cancelled() FROM PUBLIC, anon, authenticated;

COMMENT ON FUNCTION public.booking_fee_expires_when_booking_cancelled() IS
  'Owner 2026-10-12 #9: a booking cancelled before its event lets its UNPAID booking fee expire unbilled (pending -> cancelled_unbilled, open order cancelled via booking_fee_upsert_vendor_order). Owner 2026-11-05: a charge a FREE BOOKING FEE (badge reward) paid lets go the same way and the free fee goes back to the shop, waiting again. Paid and other waived charges are untouched. Not fired by event deletion (booked rows are preserved; SUP-103).';

-- ── 10 · the quote knows a badge-paid booking still carries the gift ─────────
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
    IF GREATEST(v_ordinal, 1) <= public.booking_fee_free_booking_limit() THEN RETURN 'free_booking'; END IF;   -- ⟵ CHANGED (owner 2026-10-23)
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
