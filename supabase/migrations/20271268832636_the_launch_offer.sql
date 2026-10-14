-- the_launch_offer
-- ============================================================================
-- THE LAUNCH OFFER — the first 2,000 Setnayan-sourced bookings are fee-free.
--
-- ⚖ OWNER, 2026-10-08 (three DECISION_LOG rows): "the first 2,000 platform
-- bookings" fee-free · Pro free until then, "will end on the end of that week.
-- since our subscription is a 4 week cycle" · 50 free Papic credits per booked
-- event · ONE admin page, admin-editable, never hard-coded.
-- ⚖ OWNER, 2026-10-12 ("APPROVE ALL: THE BOOKING-FEE QUESTIONS (14)"):
--   (3) the 2,000 counts Setnayan-sourced bookings, at fee creation;
--   (4) launch bookings do not use up a supplier's free 5;
--   (5) free Pro ends at the end of the 28-day cycle running when the 2,000th
--       booking happens — one platform-wide date, shown in admin;
--   (6) 50 Papic credits once per launch-waived charge, at creation;
--   (7) no fee, no couple gift — the quote stops promising it while waived.
-- Audit `BOOKING_FEE_RULES_AUDIT_2026-10-12.md` C10–C12, H3, build item 8.
--
-- ── EVERY NUMBER HAS A HOME ON `platform_settings` ──────────────────────────
-- `launch_offer_booking_cap` (seeded 2000), `launch_offer_papic_credits` (seeded
-- 50) and `launch_offer_cycle_days` (seeded 28 — "a 4 week cycle") are the
-- owner's figures from the rulings above, edited at /admin/launch-offer. The
-- seeds only fill a NULL; an edited value is never overwritten.
-- `launch_offer_enabled` is NULL — OFF — until the owner starts it there.
--
-- ── HOW A BOOKING IS COUNTED ────────────────────────────────────────────────
-- In `booking_fee_open_lock_charge` (made at the supplier's yes since
-- 20271268087628), on the SOURCED path only, BEFORE free-5: if the booking has
-- no frozen place yet and the offer is open, `booking_fee_launch_offer_take`
-- marks its ledger row `launch_offer` with its number (1…cap) under ONE
-- platform-wide advisory lock, and the charge is `waived_launch` at ₱0 with
-- `computed_fee_centavos` recording what it would have cost. The cap-th
-- booking is free and stamps `launch_offer_closed_at` and
-- `launch_offer_pro_ends_at`; the next one is billed. A launch booking takes no
-- ordinal, and the free-5 count skips launch rows, so no shop spends one of its
-- five during the offer.
--
-- Bodies are copied from their LATEST definitions with marked patches:
-- `booking_fee_open_lock_charge` + `setnayan_gift_quote_applies` from
-- 20271268252763; `booking_fee_rederive_lock_fee` from 20271240512825; the four
-- date-hold functions from 20271268087628 (`waived_launch` joins the settled
-- set — a launch booking holds its date like any waiver). Idempotent.
-- ============================================================================

BEGIN;

-- ── 1 · THE SETTINGS ────────────────────────────────────────────────────────
ALTER TABLE public.platform_settings
  ADD COLUMN IF NOT EXISTS launch_offer_enabled       BOOLEAN,
  ADD COLUMN IF NOT EXISTS launch_offer_booking_cap   INTEGER,
  ADD COLUMN IF NOT EXISTS launch_offer_papic_credits INTEGER,
  ADD COLUMN IF NOT EXISTS launch_offer_cycle_days    INTEGER,
  ADD COLUMN IF NOT EXISTS launch_offer_started_at    TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS launch_offer_closed_at     TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS launch_offer_pro_ends_at   TIMESTAMPTZ;

ALTER TABLE public.platform_settings
  DROP CONSTRAINT IF EXISTS platform_settings_launch_offer_numbers;
ALTER TABLE public.platform_settings
  ADD CONSTRAINT platform_settings_launch_offer_numbers CHECK (
    (launch_offer_booking_cap   IS NULL OR launch_offer_booking_cap   >= 0)
    AND (launch_offer_papic_credits IS NULL OR launch_offer_papic_credits >= 0)
    AND (launch_offer_cycle_days    IS NULL OR launch_offer_cycle_days    >  0)
  );

-- The owner's figures (2026-10-08 / 2026-10-12), only where nothing is set yet.
UPDATE public.platform_settings SET launch_offer_booking_cap   = 2000 WHERE id = 1 AND launch_offer_booking_cap   IS NULL;
UPDATE public.platform_settings SET launch_offer_papic_credits = 50   WHERE id = 1 AND launch_offer_papic_credits IS NULL;
UPDATE public.platform_settings SET launch_offer_cycle_days    = 28   WHERE id = 1 AND launch_offer_cycle_days    IS NULL;

COMMENT ON COLUMN public.platform_settings.launch_offer_enabled IS
  'THE LAUNCH OFFER switch (owner 2026-10-08). NULL/FALSE = off: no booking is launch-waived. Set at /admin/launch-offer.';
COMMENT ON COLUMN public.platform_settings.launch_offer_booking_cap IS
  'How many Setnayan-sourced bookings are fee-free (owner: 2,000). Counted at fee creation, platform-wide.';
COMMENT ON COLUMN public.platform_settings.launch_offer_papic_credits IS
  'Papic credits granted to the supplier once per launch-waived charge, for that event (owner: 50).';
COMMENT ON COLUMN public.platform_settings.launch_offer_cycle_days IS
  'The subscription cycle free Pro ends on (owner: "a 4 week cycle" = 28). Cycles count from launch_offer_started_at.';
COMMENT ON COLUMN public.platform_settings.launch_offer_closed_at IS
  'Stamped when the cap-th booking is made (or the admin ends the offer). After it, bookings are billed as normal.';
COMMENT ON COLUMN public.platform_settings.launch_offer_pro_ends_at IS
  'The ONE platform-wide date free Pro ends: the end of the cycle running when the offer closed (owner 2026-10-12 #5).';

-- Re-stated after the ADD COLUMN, as every platform_settings migration since
-- 20271014400000 does: anon holds nothing on this table.
REVOKE ALL ON TABLE public.platform_settings FROM anon;
GRANT SELECT ON TABLE public.platform_settings TO authenticated;

-- ── 2 · THE LEDGER KNOWS A LAUNCH BOOKING ───────────────────────────────────
ALTER TABLE public.booking_fee_ledger
  ADD COLUMN IF NOT EXISTS launch_offer        BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS launch_offer_number INTEGER;

COMMENT ON COLUMN public.booking_fee_ledger.launch_offer IS
  'TRUE = this booking was one of the launch offer''s fee-free bookings. It takes no booking_ordinal and does not count toward the shop''s free five (owner 2026-10-12 #4).';
COMMENT ON COLUMN public.booking_fee_ledger.launch_offer_number IS
  'Its place in the launch offer (1…launch_offer_booking_cap), stamped once under the platform lock.';

CREATE INDEX IF NOT EXISTS booking_fee_ledger_launch_offer_idx
  ON public.booking_fee_ledger (launch_offer) WHERE launch_offer;

-- ── 3 · THE STATUS ──────────────────────────────────────────────────────────
-- ⚠ RE-LISTED IN FULL (every member of 20271268087628's list, plus one).
ALTER TABLE public.booking_fee_charges
  DROP CONSTRAINT IF EXISTS booking_fee_charges_status_check;
ALTER TABLE public.booking_fee_charges
  ADD CONSTRAINT booking_fee_charges_status_check
  CHECK (status IN ('pending', 'paid', 'failed', 'expired',
                    'waived_import', 'waived_free5', 'waived_promo',
                    'cancelled_unbilled', 'waived_launch'));

-- ── 4 · THE 50 PAPIC CREDITS HAVE A DOOR OF THEIR OWN ───────────────────────
-- ⚠ The source CHECK is re-listed in full (20271206612859's five + one), same
-- NAME, which the Ugat schema-claims guard asserts.
ALTER TABLE public.vendor_papic_portfolio_credit_grants
  DROP CONSTRAINT IF EXISTS vendor_papic_portfolio_credit_grants_source_allowed;
ALTER TABLE public.vendor_papic_portfolio_credit_grants
  ADD CONSTRAINT vendor_papic_portfolio_credit_grants_source_allowed
  CHECK (source IN ('booking_fee', 'pack_order', 'admin', 'comp', 'migration', 'launch_offer'));

-- Once per launch-waived charge (#6): keyed on the CHARGE, because a waived
-- charge has no order to key on (audit C12).
ALTER TABLE public.vendor_papic_portfolio_credit_grants
  ADD COLUMN IF NOT EXISTS booking_fee_charge_id UUID
    REFERENCES public.booking_fee_charges(charge_id) ON DELETE SET NULL;
CREATE UNIQUE INDEX IF NOT EXISTS vendor_papic_portfolio_credit_grants_charge_source_unique
  ON public.vendor_papic_portfolio_credit_grants (booking_fee_charge_id, source)
  WHERE booking_fee_charge_id IS NOT NULL;

-- ── 5 · THE RULES, ONCE ─────────────────────────────────────────────────────
-- Free Pro's one end date (#5): the end of the cycle running at p_at, cycles of
-- p_cycle_days counted from p_started. Mirrored by `launchProEndsAt` in
-- apps/web/lib/launch-offer.ts; the db test drives both from one table.
CREATE OR REPLACE FUNCTION public.booking_fee_launch_offer_pro_end(
  p_started    TIMESTAMPTZ,
  p_at         TIMESTAMPTZ,
  p_cycle_days INTEGER
) RETURNS TIMESTAMPTZ
LANGUAGE sql
IMMUTABLE
SET search_path TO 'public'
AS $pro$
  SELECT CASE
    WHEN p_at IS NULL OR p_cycle_days IS NULL OR p_cycle_days <= 0 THEN NULL
    ELSE COALESCE(p_started, p_at)
         + make_interval(days => p_cycle_days * (
             floor(GREATEST(EXTRACT(EPOCH FROM (p_at - COALESCE(p_started, p_at))), 0)
                   / (p_cycle_days * 86400.0))::int + 1))
  END;
$pro$;

-- Is the offer taking bookings right now? Fails CLOSED: no row, switch off,
-- closed, not started, or the cap reached all answer FALSE (the fee is charged).
CREATE OR REPLACE FUNCTION public.booking_fee_launch_offer_open()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $open$
  SELECT COALESCE((
    SELECT s.launch_offer_enabled IS TRUE
       AND s.launch_offer_closed_at IS NULL
       AND COALESCE(s.launch_offer_booking_cap, 0) > 0
       AND (s.launch_offer_started_at IS NULL OR NOW() >= s.launch_offer_started_at)
       AND (SELECT count(*) FROM public.booking_fee_ledger l WHERE l.launch_offer)
           < s.launch_offer_booking_cap
      FROM public.platform_settings s
     WHERE s.id = 1
  ), FALSE);
$open$;

-- Close the offer: stamp the end and free Pro's one date. Idempotent — an
-- already-closed offer keeps its first stamps.
CREATE OR REPLACE FUNCTION public.booking_fee_launch_offer_close()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $close$
DECLARE
  s RECORD;
BEGIN
  UPDATE public.platform_settings
     SET launch_offer_closed_at   = NOW(),
         launch_offer_pro_ends_at = public.booking_fee_launch_offer_pro_end(
           launch_offer_started_at, NOW(), launch_offer_cycle_days)
   WHERE id = 1 AND launch_offer_closed_at IS NULL;
  SELECT launch_offer_closed_at, launch_offer_pro_ends_at INTO s
    FROM public.platform_settings WHERE id = 1;
  RETURN jsonb_build_object('closed_at', s.launch_offer_closed_at, 'pro_ends_at', s.launch_offer_pro_ends_at);
END;
$close$;

-- Take a place in the offer for ONE booking, or NULL (closed / full / off).
-- Under ONE platform-wide advisory lock, so two yeses at once cannot both be
-- the 2,000th. The caller already holds the per-shop lock; the order is always
-- shop → platform, so the two cannot deadlock.
CREATE OR REPLACE FUNCTION public.booking_fee_launch_offer_take(p_ledger_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $take$
DECLARE
  s   RECORD;
  v_n INTEGER;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended('booking_fee_launch_offer', 0));

  SELECT launch_offer_enabled, launch_offer_booking_cap, launch_offer_started_at,
         launch_offer_closed_at
    INTO s
    FROM public.platform_settings WHERE id = 1;
  IF NOT FOUND
     OR s.launch_offer_enabled IS NOT TRUE
     OR s.launch_offer_closed_at IS NOT NULL
     OR COALESCE(s.launch_offer_booking_cap, 0) <= 0 THEN
    RETURN NULL;
  END IF;
  IF s.launch_offer_started_at IS NOT NULL AND NOW() < s.launch_offer_started_at THEN
    RETURN NULL;
  END IF;

  SELECT count(*) INTO v_n FROM public.booking_fee_ledger WHERE launch_offer;
  IF v_n >= s.launch_offer_booking_cap THEN
    PERFORM public.booking_fee_launch_offer_close();
    RETURN NULL;
  END IF;

  UPDATE public.booking_fee_ledger
     SET launch_offer = TRUE, launch_offer_number = v_n + 1, updated_at = NOW()
   WHERE ledger_id = p_ledger_id;

  -- The cap-th booking is free, and it is the one that closes the offer.
  IF v_n + 1 >= s.launch_offer_booking_cap THEN
    PERFORM public.booking_fee_launch_offer_close();
  END IF;
  RETURN v_n + 1;
END;
$take$;

REVOKE ALL ON FUNCTION public.booking_fee_launch_offer_pro_end(TIMESTAMPTZ, TIMESTAMPTZ, INTEGER) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.booking_fee_launch_offer_pro_end(TIMESTAMPTZ, TIMESTAMPTZ, INTEGER) TO service_role;
REVOKE ALL ON FUNCTION public.booking_fee_launch_offer_open() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.booking_fee_launch_offer_open() TO service_role;
REVOKE ALL ON FUNCTION public.booking_fee_launch_offer_close() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.booking_fee_launch_offer_close() TO service_role;
REVOKE ALL ON FUNCTION public.booking_fee_launch_offer_take(UUID) FROM PUBLIC, anon, authenticated;

-- ── 6 · THE DOORS (latest bodies, marked patches) ───────────────────────────
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
    IF GREATEST(v_ordinal, 1) <= 5 THEN RETURN 'free_booking'; END IF;
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

-- ── 7 · A LAUNCH BOOKING HOLDS ITS DATE LIKE ANY WAIVER ─────────────────────
CREATE OR REPLACE FUNCTION public.vendor_hold_date_on_fee_settled(p_charge_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v RECORD;
BEGIN
  SELECT c.status                AS charge_status,
         ev.marketplace_vendor_id AS vpid,
         ev.status                AS booking_status,
         ev.archived_at           AS archived_at,
         e.event_date             AS event_date
    INTO v
    FROM public.booking_fee_charges c
    JOIN public.event_vendors ev ON ev.vendor_id = c.event_vendor_id
    JOIN public.events e         ON e.event_id   = ev.event_id
   WHERE c.charge_id = p_charge_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('held', false, 'skipped', 'no_booking');
  END IF;
  IF v.vpid IS NULL THEN
    RETURN jsonb_build_object('held', false, 'skipped', 'not_marketplace');
  END IF;
  IF v.event_date IS NULL THEN
    RETURN jsonb_build_object('held', false, 'skipped', 'no_date');
  END IF;
  -- ⟵ CHANGED: a cancelled booking holds nothing, whatever its fee says.
  IF v.archived_at IS NOT NULL
     OR v.booking_status NOT IN ('contracted', 'deposit_paid', 'delivered', 'complete') THEN
    RETURN jsonb_build_object('held', false, 'skipped', 'not_booked');
  END IF;
  -- ⟵ CHANGED: `waived_promo` is settled.
  IF v.charge_status NOT IN ('paid', 'waived_free5', 'waived_import', 'waived_promo', 'waived_launch') THEN
    RETURN jsonb_build_object('held', false, 'skipped', 'fee_unsettled',
                              'status', v.charge_status);
  END IF;

  PERFORM public.vendor_block_booked_date(v.vpid, v.event_date, 'Booked');
  RETURN jsonb_build_object('held', true, 'date', v.event_date);
END;
$$;

CREATE OR REPLACE FUNCTION public.vendor_unblock_booked_date(
  p_vendor_profile_id uuid,
  p_date              date,
  p_except_event_vendor_id uuid DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_deleted int := 0;
BEGIN
  IF p_vendor_profile_id IS NULL OR p_date IS NULL THEN
    RETURN FALSE;
  END IF;

  -- (1) UNCHANGED — another live booking still holds this day by STATUS.
  IF EXISTS (
    SELECT 1
      FROM public.event_vendors ev
      JOIN public.events e ON e.event_id = ev.event_id
     WHERE ev.marketplace_vendor_id = p_vendor_profile_id
       AND ev.status IN (
             'deposit_paid'::public.vendor_status,
             'delivered'::public.vendor_status,
             'complete'::public.vendor_status
           )
       AND e.event_date = p_date
       AND (p_except_event_vendor_id IS NULL
            OR ev.vendor_id <> p_except_event_vendor_id)
  ) THEN
    RETURN FALSE;
  END IF;

  -- (2) another booking holds this day by a SETTLED FEE.
  IF EXISTS (
    SELECT 1
      FROM public.booking_fee_charges c
      JOIN public.event_vendors ev ON ev.vendor_id = c.event_vendor_id
      JOIN public.events e         ON e.event_id   = ev.event_id
     WHERE ev.marketplace_vendor_id = p_vendor_profile_id
       -- ⟵ CHANGED: `waived_promo` is settled.
       AND c.status IN ('paid', 'waived_free5', 'waived_import', 'waived_promo', 'waived_launch')
       -- ⟵ CHANGED: only while that booking is still booked — a paid fee
       -- outlives a cancellation (owner #9) and must not hold a day forever.
       AND ev.archived_at IS NULL
       AND ev.status IN ('contracted', 'deposit_paid', 'delivered', 'complete')
       AND e.event_date = p_date
       AND (p_except_event_vendor_id IS NULL
            OR ev.vendor_id <> p_except_event_vendor_id)
  ) THEN
    RETURN FALSE;
  END IF;

  DELETE FROM public.vendor_calendar_blocks
   WHERE vendor_profile_id = p_vendor_profile_id
     AND pool_id IS NULL
     AND block_source = 'setnayan_booking'
     AND (blocked_at AT TIME ZONE 'Asia/Manila')::date = p_date;

  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  RETURN v_deleted > 0;
END;
$$;

CREATE OR REPLACE FUNCTION public.events_booked_dates_follow_the_event()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r RECORD;
BEGIN
  IF OLD.event_date IS NULL OR NEW.event_date IS NULL OR OLD.event_date = NEW.event_date THEN
    RETURN NULL;
  END IF;

  FOR r IN
    SELECT ev.vendor_id, ev.marketplace_vendor_id
      FROM public.event_vendors ev
     WHERE ev.event_id = NEW.event_id
       AND ev.marketplace_vendor_id IS NOT NULL
       AND (
         ev.status IN ('deposit_paid', 'delivered', 'complete')
         OR (
           -- ⟵ CHANGED: a fee-held day belongs to a booking still booked.
           ev.archived_at IS NULL
           AND ev.status IN ('contracted', 'deposit_paid', 'delivered', 'complete')
           AND EXISTS (
             SELECT 1 FROM public.booking_fee_charges c
              WHERE c.event_vendor_id = ev.vendor_id
                -- ⟵ CHANGED: `waived_promo` is settled.
                AND c.status IN ('paid', 'waived_free5', 'waived_import', 'waived_promo', 'waived_launch')
           )
         )
       )
  LOOP
    BEGIN
      PERFORM public.vendor_unblock_booked_date(r.marketplace_vendor_id, OLD.event_date, r.vendor_id);
      PERFORM public.vendor_block_booked_date(r.marketplace_vendor_id, NEW.event_date, 'Booked');
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'events_booked_dates_follow_the_event: % from % to %: %',
        r.marketplace_vendor_id, OLD.event_date, NEW.event_date, SQLERRM;
    END;
  END LOOP;

  BEGIN
    UPDATE public.vendor_schedule_pool_bookings
       SET booked_date = NEW.event_date
     WHERE event_id = NEW.event_id
       AND released_at IS NULL;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'events_booked_dates_follow_the_event: pools for %: %', NEW.event_id, SQLERRM;
  END;

  RETURN NULL;
END $$;

REVOKE ALL ON FUNCTION public.events_booked_dates_follow_the_event() FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.event_vendor_reopen_on_release()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_date      DATE;
  v_row       public.event_vendors%ROWTYPE;
  v_was       BOOLEAN;
  v_is_now    BOOLEAN;
  v_fee_held  BOOLEAN;
BEGIN
  v_row := OLD;

  IF v_row.marketplace_vendor_id IS NULL THEN
    RETURN NULL;
  END IF;

  -- ⟵ NEW: does this booking's own fee hold its day?
  v_fee_held := EXISTS (
    SELECT 1 FROM public.booking_fee_charges c
     WHERE c.event_vendor_id = v_row.vendor_id
       AND c.status IN ('paid', 'waived_free5', 'waived_import', 'waived_promo', 'waived_launch')
  );

  v_was := OLD.status IN (
    'deposit_paid'::public.vendor_status,
    'delivered'::public.vendor_status,
    'complete'::public.vendor_status
  ) OR (v_fee_held AND OLD.status = 'contracted'::public.vendor_status);
  IF NOT v_was THEN
    RETURN NULL;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    v_is_now := NEW.status IN (
      'deposit_paid'::public.vendor_status,
      'delivered'::public.vendor_status,
      'complete'::public.vendor_status
    ) OR (v_fee_held AND NEW.status = 'contracted'::public.vendor_status);
    IF v_is_now THEN
      RETURN NULL;  -- contracted → deposit_paid → delivered is not a release.
    END IF;
  END IF;

  SELECT event_date INTO v_date FROM public.events WHERE event_id = v_row.event_id;
  IF v_date IS NULL THEN
    RETURN NULL;
  END IF;

  BEGIN
    PERFORM public.vendor_unblock_booked_date(
      v_row.marketplace_vendor_id, v_date, v_row.vendor_id
    );
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'event_vendor_reopen_on_release: reopen failed for vendor % date %: %',
      v_row.marketplace_vendor_id, v_date, SQLERRM;
  END;

  RETURN NULL;
END;
$$;

COMMIT;
