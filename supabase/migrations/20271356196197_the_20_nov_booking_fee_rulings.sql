-- the_20_nov_booking_fee_rulings
-- Created via `pnpm migration:new`. Idempotent: ADD COLUMN IF NOT EXISTS · CREATE TABLE IF NOT EXISTS (+ RLS in this
-- file) · CREATE OR REPLACE FUNCTION · the counter row is seeded with ON CONFLICT.
--
-- ── THE RULINGS (specs DECISION_LOG, all dated 2026-11-20) ─────────────────────────────────────────────────────────
--   💰 "BOOKING FEE: 5% OF THE FIRST ₱100,000, 3% AFTER, LOCKED AT ₱100,000." Owner, verbatim: "5% first 100,000 then
--      3% beyond 100,000" · "until they hit 100,000 then it locks there" · "also capping to 100,000 only". ⇒ fee =
--      head% × min(booking, band) + tail% × (booking − band), and the FEE never goes above ₱100,000. Unverified shops
--      keep the flat 5% of the whole booking, and it ALSO locks at ₱100,000 (owner: "Yes, lock it too").
--   🎁 "EVERY 100,000TH BOOKING FEE IS FREE" + "THE 100,000TH FREE BOOKING FEE IS COUNTED ACROSS ALL OF SETNAYAN".
--      A COUNT, not pesos, platform-wide: every 100,000th booking that carries a booking fee, on any shop, is free.
--   🎟 "FREE BOOKING FEE TICKETS ARE AUTO-CLAIMED, NOT REDEEMED AT WILL." Already true: the badge reward (a
--      `shop_badge_rewards` row, reward_kind 'fee_waiver') pays the shop's next booking with a fee, oldest first, with
--      no choice — `booking_fee_open_lock_charge` (20271325516180). Kept exactly; the counter below sits ABOVE it so a
--      platform-free booking never spends a supplier's ticket.
--   💳 "BILLING MUST FOLLOW THE RETIRED COPY": (1) a supplier's first booking is NOT free any more — the only free
--      booking is the import / own-client rule; (2) supplier-brought clients are free only as the 16 Nov import row
--      rules — ALREADY what `booking_fee_attribution_for` says (20271352968519 + 20271353556136), so nothing here
--      touches attribution. "It must not take back a waiver already granted": a ledger row frozen free stays free.
--
-- ── WHAT CHANGES ────────────────────────────────────────────────────────────────────────────────────────────────────
--   1 · platform_settings: + booking_fee_cap_php (the lock) + booking_fee_free_every_nth (the count). ALTER first,
--       then the one UPDATE: the tail rate moves 1% → 3% per the ruling (it stays admin-editable at /admin/pricing).
--   2 · booking_fee_centavos(amount) — the taper, now locked at the cap. booking_fee_flat_centavos(amount) — the
--       unverified flat head rate on the whole booking, same floor, same cap. booking_fee_centavos_for(amount, shop)
--       picks between them by `booking_fee_shop_verified_since(shop)` (the attribution's own "verified").
--   3 · booking_fee_schedule_summary() — the bill's sentence now names the lock (twin of bookingFeeScheduleSummary).
--   4 · booking_fee_free_booking_limit() → 0. No booking takes a free first place any more; frozen ones keep theirs.
--   5 · booking_fee_platform_counter (one row) + booking_fee_take_platform_number(): the platform-wide count of
--       bookings that carry a fee. ONE row, `INSERT … ON CONFLICT DO UPDATE … RETURNING` — the row lock serialises
--       every caller, the number is exact (a rolled-back lock rolls the count back with it) and never repeats.
--       booking_fee_charges + platform_fee_number (UNIQUE) + free_by_platform_count. A milestone booking is a ₱0
--       `paid` charge naming its number — the badge reward's shape, so every fee reader already treats it as settled.
--   6 · booking_fee_open_lock_charge / booking_fee_rederive_lock_fee re-created with 2 + 4 + 5. Everything else in
--       their bodies is 20271325516180 / 20271340632149 verbatim (marked ⟵ 20 NOV where it is not).
--   7 · booking_fee_schedule_version() → '2026-11-20-taper5-3-cap100k' (twin of BOOKING_FEE_SCHEDULE_VERSION), so a
--       charge priced from now on says which schedule priced it. Old charges keep theirs.
--
-- No frozen ledger row and no existing charge amount is rewritten. The only data written: the settings row (one
-- UPDATE), the counter seed, and platform_fee_number on existing charges that carried a fee (so the count is the
-- real count of Setnayan's fee bookings, not a count from today).

BEGIN;

-- A busy platform_settings row must not hold the deploy: give up after 5 s rather than queue behind it.
SET LOCAL lock_timeout = '5s';

-- ── 0 · The schedule each charge was locked on (ship review, 20 Nov) ─────────────────────────────────────────────────
-- An amendment must re-price on the schedule its booking was LOCKED on — flat or taper, and the rates, band and lock
-- in force then — never the shop's verification today or today's rates (a verified ₱1M booking locked at ₱32,000 whose
-- verification lapses must top up ~₱30 on a ₱1,000 change, not ₱18,050). Every primary charge carries that basis in
-- `fee_basis`; charges made before this file are backfilled (section 4b) from the settings captured HERE, before
-- section 1 moves the tail rate to 3%.
CREATE TEMP TABLE _fee_settings_before_20_nov ON COMMIT DROP AS
  SELECT booking_fee_rate_pct AS head_pct, booking_fee_tail_rate_pct AS tail_pct, booking_fee_tier1_limit_php AS band_php
    FROM public.platform_settings WHERE id = 1;

-- ── 1 · The settings ────────────────────────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.platform_settings
  ADD COLUMN IF NOT EXISTS booking_fee_cap_php NUMERIC(12, 2) NOT NULL DEFAULT 100000
    CHECK (booking_fee_cap_php > 0);
ALTER TABLE public.platform_settings
  ADD COLUMN IF NOT EXISTS booking_fee_free_every_nth INTEGER NOT NULL DEFAULT 100000
    CHECK (booking_fee_free_every_nth > 0);
ALTER TABLE public.platform_settings
  ALTER COLUMN booking_fee_tail_rate_pct SET DEFAULT 3.00;

COMMENT ON COLUMN public.platform_settings.booking_fee_cap_php IS
  'Vendor BOOKING FEE: the most one booking''s fee can ever be (PHP). Owner 2026-11-20: "until they hit 100,000 then it '
  'locks there" — default 100000. Applies to the taper AND to the unverified flat rate ("Yes, lock it too"). Read by '
  'public.booking_fee_centavos / booking_fee_flat_centavos and by apps/web/lib/booking-fee.ts via getBookingFeeSchedule().';
COMMENT ON COLUMN public.platform_settings.booking_fee_free_every_nth IS
  'Every Nth booking that carries a booking fee, counted across ALL of Setnayan, is free (owner 2026-11-20: "every '
  '100,000th booking fee", "All of Setnayan") — default 100000. A COUNT of bookings, never pesos. Read by '
  'public.booking_fee_open_lock_charge against booking_fee_platform_counter.';
COMMENT ON COLUMN public.platform_settings.booking_fee_tail_rate_pct IS
  'Vendor BOOKING FEE: the percentage charged on the amount ABOVE booking_fee_tier1_limit_php. Owner 2026-11-20: "5% '
  'first 100,000 then 3% beyond 100,000" — 3.00 (was 1.00, the 2026-07-25 taper).';

-- The one UPDATE, after the ALTERs: the ruled tail rate.
UPDATE public.platform_settings SET booking_fee_tail_rate_pct = 3.00 WHERE id = 1;

-- ── 2 · The arithmetic ──────────────────────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.booking_fee_centavos(p_amount_centavos BIGINT)
RETURNS BIGINT
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  WITH s AS (
    SELECT
      COALESCE((SELECT booking_fee_rate_pct        FROM public.platform_settings WHERE id = 1),   5.00) AS head_pct,
      COALESCE((SELECT booking_fee_tail_rate_pct   FROM public.platform_settings WHERE id = 1),   3.00) AS tail_pct,
      COALESCE((SELECT booking_fee_tier1_limit_php FROM public.platform_settings WHERE id = 1), 100000) AS band_php,
      -- The lock (20 Nov) held to the payment ceiling (17 Nov, max_payment_php): a fee is one payment.
      LEAST(COALESCE((SELECT booking_fee_cap_php   FROM public.platform_settings WHERE id = 1), 100000),
            COALESCE((SELECT max_payment_php       FROM public.platform_settings WHERE id = 1), 100000)) AS cap_php
  )
  SELECT CASE
    WHEN p_amount_centavos IS NULL OR p_amount_centavos <= 0 THEN 0::BIGINT
    ELSE LEAST(
      GREATEST(
        round(
          LEAST(p_amount_centavos, (s.band_php * 100)::BIGINT) * (s.head_pct / 100.0)
          + GREATEST(p_amount_centavos - (s.band_php * 100)::BIGINT, 0::BIGINT) * (s.tail_pct / 100.0)
        )::BIGINT,
        5000::BIGINT                  -- ₱50 floor — FIXED, not owner-editable (unchanged).
      ),
      round(s.cap_php * 100)::BIGINT  -- ⟵ 20 NOV: the lock. The fee never goes above it.
    )
  END
  FROM s;
$$;
COMMENT ON FUNCTION public.booking_fee_centavos(BIGINT) IS
  'Vendor Booking Fee (centavos) for a VERIFIED shop: head rate on the first band, tail rate above it, PHP 50 floor, '
  'locked at booking_fee_cap_php (owner 2026-11-20: 5% / PHP 100,000 / 3%, locked at PHP 100,000), and never above '
  'max_payment_php (owner 2026-11-17). All the numbers come from platform_settings. Mirror of bookingFeePhp() in apps/web/lib/booking-fee.ts. Non-positive -> 0.';

CREATE OR REPLACE FUNCTION public.booking_fee_flat_centavos(p_amount_centavos BIGINT)
RETURNS BIGINT
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  WITH s AS (
    SELECT
      COALESCE((SELECT booking_fee_rate_pct FROM public.platform_settings WHERE id = 1),   5.00) AS head_pct,
      LEAST(COALESCE((SELECT booking_fee_cap_php FROM public.platform_settings WHERE id = 1), 100000),
            COALESCE((SELECT max_payment_php     FROM public.platform_settings WHERE id = 1), 100000)) AS cap_php
  )
  SELECT CASE
    WHEN p_amount_centavos IS NULL OR p_amount_centavos <= 0 THEN 0::BIGINT
    ELSE LEAST(
      GREATEST(round(p_amount_centavos * (s.head_pct / 100.0))::BIGINT, 5000::BIGINT),
      round(s.cap_php * 100)::BIGINT
    )
  END
  FROM s;
$$;
COMMENT ON FUNCTION public.booking_fee_flat_centavos(BIGINT) IS
  'Vendor Booking Fee (centavos) for an UNVERIFIED shop: the head rate on the WHOLE booking (no taper), PHP 50 floor, '
  'locked at booking_fee_cap_php (owner 2026-11-20: "Unverified shops keep the flat 5%… Yes, lock it too"). Mirror of '
  'unverifiedBookingFeePhp() in apps/web/lib/booking-fee.ts.';

CREATE OR REPLACE FUNCTION public.booking_fee_centavos_for(p_amount_centavos BIGINT, p_vendor_profile_id UUID)
RETURNS BIGINT
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT CASE
    WHEN public.booking_fee_shop_verified_since(p_vendor_profile_id) IS NULL
      THEN public.booking_fee_flat_centavos(p_amount_centavos)
    ELSE public.booking_fee_centavos(p_amount_centavos)
  END;
$$;
COMMENT ON FUNCTION public.booking_fee_centavos_for(BIGINT, UUID) IS
  'The fee a given shop pays on an amount: the taper when the shop is verified now (booking_fee_shop_verified_since), '
  'else the flat rate. Both locked at booking_fee_cap_php. Read by booking_fee_open_lock_charge and '
  'booking_fee_rederive_lock_fee.';

REVOKE ALL ON FUNCTION public.booking_fee_flat_centavos(BIGINT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.booking_fee_flat_centavos(BIGINT) TO service_role;
REVOKE ALL ON FUNCTION public.booking_fee_centavos_for(BIGINT, UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.booking_fee_centavos_for(BIGINT, UUID) TO service_role;

-- ── 3 · The bill's sentence names the lock ──────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.booking_fee_schedule_summary()
RETURNS TEXT
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT public.booking_fee_pct_text(
           COALESCE((SELECT booking_fee_rate_pct FROM public.platform_settings WHERE id = 1), 5.00))
      || ' of the first '
      || public.booking_fee_php_text(
           COALESCE((SELECT booking_fee_tier1_limit_php FROM public.platform_settings WHERE id = 1), 100000))
      || ', then '
      || public.booking_fee_pct_text(
           COALESCE((SELECT booking_fee_tail_rate_pct FROM public.platform_settings WHERE id = 1), 3.00))
      || ', minimum '
      || public.booking_fee_php_text(50)   -- the FIXED floor
      || ', never more than '              -- ⟵ 20 NOV: the lock
      || public.booking_fee_php_text(
           LEAST(COALESCE((SELECT booking_fee_cap_php FROM public.platform_settings WHERE id = 1), 100000),
                 COALESCE((SELECT max_payment_php     FROM public.platform_settings WHERE id = 1), 100000)));
$$;

-- ── 4 · No free first booking ───────────────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.booking_fee_free_booking_limit()
 RETURNS integer
 LANGUAGE sql
 IMMUTABLE
 PARALLEL SAFE
AS $function$
  SELECT 0
$function$;
COMMENT ON FUNCTION public.booking_fee_free_booking_limit() IS
  'How many of a supplier''s Setnayan-sourced bookings take a free place: 0. Owner rulings, specs DECISION_LOG '
  '2026-11-20 "BILLING MUST FOLLOW THE RETIRED COPY": a first booking is not free; the only free booking is the import / '
  'own-client rule. Was 1 (2026-10-23), 5 before that. Ledger rows frozen free (is_free_booking) are never re-derived, '
  'so a waiver already granted stays granted. FREE_BOOKING_LIMIT in apps/web/lib/booking-fee-lock.ts is its twin.';

-- ── 5 · The platform-wide count of bookings that carry a fee ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.booking_fee_platform_counter (
  id                   SMALLINT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  fee_bookings_counted BIGINT NOT NULL DEFAULT 0 CHECK (fee_bookings_counted >= 0),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE public.booking_fee_platform_counter ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.booking_fee_platform_counter FROM PUBLIC;
REVOKE ALL ON TABLE public.booking_fee_platform_counter FROM anon;
REVOKE ALL ON TABLE public.booking_fee_platform_counter FROM authenticated;
GRANT SELECT ON TABLE public.booking_fee_platform_counter TO service_role;
COMMENT ON TABLE public.booking_fee_platform_counter IS
  'ONE row: how many bookings that carry a booking fee Setnayan has had, across every shop (owner 2026-11-20: every '
  '100,000th is free, "All of Setnayan"). Moved only by booking_fee_take_platform_number(). Service-role only (RLS on, '
  'no policy).';

ALTER TABLE public.booking_fee_charges
  ADD COLUMN IF NOT EXISTS platform_fee_number BIGINT;
ALTER TABLE public.booking_fee_charges
  ADD COLUMN IF NOT EXISTS free_by_platform_count BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE public.booking_fee_charges
  ADD COLUMN IF NOT EXISTS fee_basis JSONB;
COMMENT ON COLUMN public.booking_fee_charges.fee_basis IS
  'The schedule this PRIMARY charge was locked on: {flat, head_pct, tail_pct, band_php, cap_php} (cap_php null = no '
  'lock). Stamped at insert by booking_fee_charges_stamp_basis; read by booking_fee_rederive_lock_fee so an amendment '
  're-prices on the booking''s own schedule, never the shop''s verification today or today''s rates (ship review 20 Nov).';

-- The basis a charge made NOW is locked on (plpgsql: its body is checked at call time, after section 1's columns exist).
CREATE OR REPLACE FUNCTION public.booking_fee_basis_now(p_vendor_profile_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SET search_path = public
AS $$
BEGIN
  RETURN (
    SELECT jsonb_build_object(
      'flat',     public.booking_fee_shop_verified_since(p_vendor_profile_id) IS NULL,
      'head_pct', COALESCE(s.booking_fee_rate_pct, 5.00),
      'tail_pct', COALESCE(s.booking_fee_tail_rate_pct, 3.00),
      'band_php', COALESCE(s.booking_fee_tier1_limit_php, 100000),
      'cap_php',  LEAST(COALESCE(s.booking_fee_cap_php, 100000), COALESCE(s.max_payment_php, 100000)))
    FROM (SELECT 1) one LEFT JOIN public.platform_settings s ON s.id = 1
  );
END;
$$;

-- The fee on an amount, on a stored basis. The same arithmetic as booking_fee_centavos / booking_fee_flat_centavos
-- (₱50 floor, then the lock), with the numbers taken from the basis instead of today's settings.
CREATE OR REPLACE FUNCTION public.booking_fee_centavos_on_basis(p_amount_centavos BIGINT, p_basis JSONB)
RETURNS BIGINT
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  WITH b AS (
    SELECT COALESCE((p_basis->>'flat')::BOOLEAN, FALSE)          AS flat,
           COALESCE((p_basis->>'head_pct')::NUMERIC, 5.00)       AS head_pct,
           COALESCE((p_basis->>'tail_pct')::NUMERIC, 3.00)       AS tail_pct,
           COALESCE((p_basis->>'band_php')::NUMERIC, 100000)     AS band_php,
           (p_basis->>'cap_php')::NUMERIC                        AS cap_php
  ), f AS (
    SELECT b.cap_php,
           GREATEST(
             CASE WHEN b.flat THEN round(p_amount_centavos * (b.head_pct / 100.0))::BIGINT
                  ELSE round(
                         LEAST(p_amount_centavos, (b.band_php * 100)::BIGINT) * (b.head_pct / 100.0)
                         + GREATEST(p_amount_centavos - (b.band_php * 100)::BIGINT, 0::BIGINT) * (b.tail_pct / 100.0)
                       )::BIGINT
             END,
             5000::BIGINT) AS fee
      FROM b
  )
  SELECT CASE
    WHEN p_amount_centavos IS NULL OR p_amount_centavos <= 0 THEN 0::BIGINT
    WHEN f.cap_php IS NULL THEN f.fee
    ELSE LEAST(f.fee, round(f.cap_php * 100)::BIGINT)
  END
  FROM f;
$$;

CREATE OR REPLACE FUNCTION public.booking_fee_charges_stamp_basis()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.kind = 'primary' AND NEW.fee_basis IS NULL THEN
    NEW.fee_basis := public.booking_fee_basis_now(NEW.vendor_profile_id);
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS booking_fee_charges_stamp_basis ON public.booking_fee_charges;
CREATE TRIGGER booking_fee_charges_stamp_basis
  BEFORE INSERT ON public.booking_fee_charges
  FOR EACH ROW EXECUTE FUNCTION public.booking_fee_charges_stamp_basis();

REVOKE ALL ON FUNCTION public.booking_fee_basis_now(UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.booking_fee_basis_now(UUID) TO service_role;
REVOKE ALL ON FUNCTION public.booking_fee_centavos_on_basis(BIGINT, JSONB) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.booking_fee_centavos_on_basis(BIGINT, JSONB) TO service_role;
REVOKE ALL ON FUNCTION public.booking_fee_charges_stamp_basis() FROM PUBLIC, anon, authenticated;

-- 4b · Primary charges made before this file: the schedule their version names, with the settings as they were
-- (captured in section 0) and no lock — the 2026-07-25 taper never had one.
UPDATE public.booking_fee_charges c
   SET fee_basis = CASE c.schedule_version
         WHEN '2026-07-23-flat2'       THEN jsonb_build_object('flat', true, 'head_pct', 2.00, 'tail_pct', 2.00, 'band_php', 100000, 'cap_php', 4000)
         WHEN '2026-07-24-flat5-nocap' THEN jsonb_build_object('flat', true, 'head_pct', 5.00, 'tail_pct', 5.00, 'band_php', 100000, 'cap_php', NULL)
         ELSE jsonb_build_object('flat', false, 'head_pct', b.head_pct, 'tail_pct', b.tail_pct, 'band_php', b.band_php, 'cap_php', NULL)
       END
  FROM _fee_settings_before_20_nov b
 WHERE c.kind = 'primary' AND c.fee_basis IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS booking_fee_charges_platform_fee_number_once
  ON public.booking_fee_charges (platform_fee_number)
  WHERE platform_fee_number IS NOT NULL;
COMMENT ON COLUMN public.booking_fee_charges.platform_fee_number IS
  'This booking''s place among every booking that carried a booking fee on Setnayan (booking_fee_platform_counter). '
  'Taken once, when the charge is made; never re-taken. NULL for a booking that carried no fee (import, launch offer, '
  'a frozen free place, a PHP 0 total, a free-fee window).';
COMMENT ON COLUMN public.booking_fee_charges.free_by_platform_count IS
  'TRUE = platform_fee_number is a multiple of platform_settings.booking_fee_free_every_nth, so Setnayan waived this '
  'fee (owner 2026-11-20). The charge is a PHP 0 paid; computed_fee_centavos keeps what it would have cost.';

-- The count is Setnayan's REAL count: every primary lock charge that already carried a fee is numbered, oldest first.
-- Idempotent: only rows without a number are numbered, after the highest number already given.
WITH base AS (
  SELECT COALESCE(MAX(platform_fee_number), 0) AS n FROM public.booking_fee_charges
), todo AS (
  SELECT c.charge_id,
         (SELECT n FROM base) + row_number() OVER (ORDER BY c.created_at, c.charge_id) AS n
    FROM public.booking_fee_charges c
   WHERE c.platform_fee_number IS NULL
     AND c.kind = 'primary'
     AND c.source = 'lock'
     AND c.status IN ('pending', 'paid')
     AND COALESCE(c.computed_fee_centavos, 0) > 0
)
UPDATE public.booking_fee_charges c
   SET platform_fee_number = todo.n
  FROM todo
 WHERE c.charge_id = todo.charge_id;

INSERT INTO public.booking_fee_platform_counter (id, fee_bookings_counted)
VALUES (1, (SELECT COALESCE(MAX(platform_fee_number), 0) FROM public.booking_fee_charges))
ON CONFLICT (id) DO UPDATE
  SET fee_bookings_counted = GREATEST(public.booking_fee_platform_counter.fee_bookings_counted,
                                      EXCLUDED.fee_bookings_counted),
      updated_at = NOW();

CREATE OR REPLACE FUNCTION public.booking_fee_take_platform_number()
RETURNS BIGINT
LANGUAGE sql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
  -- ONE statement on ONE row: the row lock queues concurrent callers, each leaves with the next number, and the lock
  -- is held to the caller's COMMIT — so a rolled-back booking gives its number back and no number is ever given twice.
  INSERT INTO public.booking_fee_platform_counter AS c (id, fee_bookings_counted, updated_at)
  VALUES (1, 1, NOW())
  ON CONFLICT (id) DO UPDATE
    SET fee_bookings_counted = c.fee_bookings_counted + 1, updated_at = NOW()
  RETURNING fee_bookings_counted;
$$;
COMMENT ON FUNCTION public.booking_fee_take_platform_number() IS
  'Takes the next platform-wide number for a booking that carries a booking fee (booking_fee_platform_counter). Called '
  'only by booking_fee_open_lock_charge, once per new charge. Concurrency-safe by the counter row''s lock.';
REVOKE ALL ON FUNCTION public.booking_fee_take_platform_number() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.booking_fee_take_platform_number() TO service_role;

CREATE OR REPLACE FUNCTION public.booking_fee_platform_number_is_free(p_number BIGINT)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT p_number IS NOT NULL AND p_number > 0
     AND p_number % COALESCE((SELECT booking_fee_free_every_nth FROM public.platform_settings WHERE id = 1), 100000) = 0;
$$;
COMMENT ON FUNCTION public.booking_fee_platform_number_is_free(BIGINT) IS
  'TRUE when a platform-wide fee number is a multiple of booking_fee_free_every_nth. Mirror of isPlatformFreeNumber() '
  'in apps/web/lib/booking-fee-lock.ts.';
REVOKE ALL ON FUNCTION public.booking_fee_platform_number_is_free(BIGINT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.booking_fee_platform_number_is_free(BIGINT) TO service_role;

-- ── 7 · The schedule version ────────────────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.booking_fee_schedule_version()
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
AS $$ SELECT '2026-11-20-taper5-3-cap100k'::text $$;

-- ── 6a · The lock RPC ───────────────────────────────────────────────────────────────────────────────────────────────
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
        'attribution', 'sourced', 'reused', true);
    END IF;

    IF v_ledger.launch_offer THEN
      v_launch_no := v_ledger.launch_offer_number;
    ELSE
      v_launch_no := public.booking_fee_launch_offer_take(v_ledger.ledger_id);
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
        'attribution', 'sourced', 'reused', false);
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
    v_is_free := v_ordinal <= public.booking_fee_free_booking_limit();
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
      'attribution', 'sourced', 'reused', true);
  END IF;

  v_fee := public.booking_fee_centavos_for(v_ev.amount_centavos, v_ev.vpid);   -- ⟵ 20 NOV: taper or flat, locked

  IF v_is_free THEN
    v_status := 'waived_free5';
    v_charge_amount := 0;
  ELSIF v_fee <= 0 THEN
    v_status := 'paid';
    v_charge_amount := 0;
  ELSIF public.booking_fee_free_window_active() THEN
    v_status := 'waived_promo';
    v_charge_amount := 0;
  ELSE
    -- ⟵ 20 NOV · THE BOOKING CARRIES A FEE: it takes its place among every fee booking on Setnayan. Every Nth is free
    -- (owner: "every 100,000th booking fee", "All of Setnayan"). It sits ABOVE the badge ticket on purpose: a booking
    -- Setnayan waives has no fee for a ticket to pay, so the shop keeps its ticket for the next one.
    v_platform_no := public.booking_fee_take_platform_number();
    v_platform_free := public.booking_fee_platform_number_is_free(v_platform_no);
    IF v_platform_free THEN
      v_status := 'paid';
      v_charge_amount := 0;
    ELSE
      -- The free booking fee ticket (badge reward), auto-claimed: the shop's OLDEST unused one pays this fee. No
      -- choice, no redeem — owner 2026-11-20 "auto claimed on your next event booking" (unchanged code).
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
    'attribution', 'sourced', 'reused', false);
END;
$function$;

REVOKE ALL ON FUNCTION public.booking_fee_open_lock_charge(UUID, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.booking_fee_open_lock_charge(UUID, TEXT) TO service_role;

-- ── 6b · The amendment path: same schedule as the lock, and a platform-free booking stays free ────────────────────
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

  SELECT charge_id, ledger_id, status, amount_charged_centavos, proposal_amount_centavos,
         badge_reward_id, free_by_platform_count, vendor_profile_id,  -- ⟵ 20 NOV
         fee_basis                                                     -- ⟵ 20 NOV ship review
    INTO v_primary
    FROM public.booking_fee_charges
    WHERE event_vendor_id = p_event_vendor_id AND kind = 'primary'
      AND status IN ('pending', 'paid', 'waived_import', 'waived_free5', 'waived_promo', 'waived_launch')
    ORDER BY created_at
    LIMIT 1;
  IF NOT FOUND THEN RETURN jsonb_build_object('action', 'no_charge'); END IF;

  SELECT is_free_booking INTO v_ledger
    FROM public.booking_fee_ledger WHERE ledger_id = v_primary.ledger_id;

  IF COALESCE(v_ledger.is_free_booking, false) OR v_primary.status = 'waived_free5' THEN
    RETURN jsonb_build_object('action', 'free_noop');
  END IF;
  IF v_primary.status = 'waived_import' THEN
    RETURN jsonb_build_object('action', 'import_noop');
  END IF;
  IF v_primary.status = 'waived_promo' THEN
    RETURN jsonb_build_object('action', 'promo_noop');
  END IF;
  IF v_primary.status = 'waived_launch' THEN
    RETURN jsonb_build_object('action', 'launch_noop');
  END IF;
  IF v_primary.badge_reward_id IS NOT NULL THEN
    RETURN jsonb_build_object('action', 'badge_noop');
  END IF;
  -- ⟵ 20 NOV: Setnayan's every-Nth booking fee was waived; the promise was "this booking's fee is free", so an
  -- amendment must not bill it (without this arm the ₱0 `paid` primary reads as underpaid by the whole new fee).
  IF v_primary.free_by_platform_count THEN
    RETURN jsonb_build_object('action', 'platform_free_noop');
  END IF;

  v_new_total := v_ev.amount_centavos;
  -- ⟵ 20 NOV ship review: the schedule this booking was LOCKED on (fee_basis, stamped at insert) — never the shop's
  -- verification today or today's rates. A charge with no basis (none should exist after 4b) reads today's.
  v_new_fee   := public.booking_fee_centavos_on_basis(
                   v_new_total,
                   COALESCE(v_primary.fee_basis,
                            public.booking_fee_basis_now(COALESCE(v_ev.vpid, v_primary.vendor_profile_id))));

  UPDATE public.booking_fee_ledger
    SET highest_declared_centavos =
          GREATEST(COALESCE(highest_declared_centavos, 0), v_new_total),
        updated_at = NOW()
    WHERE ledger_id = v_primary.ledger_id;

  IF v_primary.status = 'pending' THEN
    IF v_primary.amount_charged_centavos = v_new_fee
       AND v_primary.proposal_amount_centavos = v_new_total THEN
      RETURN jsonb_build_object('action', 'pending_noop');
    END IF;

    IF v_new_fee <= 0 THEN
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

  SELECT COALESCE(SUM(amount_charged_centavos), 0) INTO v_paid_total
    FROM public.booking_fee_charges
    WHERE event_vendor_id = p_event_vendor_id AND status = 'paid'
      AND kind IN ('primary', 'amendment_delta');

  v_delta := v_new_fee - v_paid_total;

  IF v_delta > 0 THEN
    SELECT charge_id, amount_charged_centavos INTO v_existing_delta
      FROM public.booking_fee_charges
      WHERE event_vendor_id = p_event_vendor_id AND kind = 'amendment_delta'
        AND status = 'pending'
      LIMIT 1;

    UPDATE public.booking_fee_charges
      SET credit_centavos = 0, updated_at = NOW()
      WHERE event_vendor_id = p_event_vendor_id AND kind = 'amendment_credit'
        AND COALESCE(credit_centavos, 0) <> 0;

    -- Not `IF FOUND AND …` — see 20271013541380: FOUND is reset by the UPDATE above.
    IF v_existing_delta.charge_id IS NOT NULL THEN
      IF v_existing_delta.amount_charged_centavos = v_delta THEN
        RETURN jsonb_build_object('action', 'delta_noop', 'delta_centavos', v_delta);
      END IF;
      UPDATE public.booking_fee_charges
        SET amount_charged_centavos = v_delta, computed_fee_centavos = v_new_fee,
            proposal_amount_centavos = v_new_total,
            expires_at = COALESCE(public.booking_fee_top_up_due_at(v_ev.event_id), expires_at),
            updated_at = NOW()
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
       v_delta, p_schedule_version, 'pending',
       COALESCE(public.booking_fee_top_up_due_at(v_ev.event_id), NOW() + INTERVAL '7 days'))
    RETURNING charge_id INTO v_delta_id;
    PERFORM public.booking_fee_upsert_vendor_order(v_delta_id);
    RETURN jsonb_build_object('action', 'delta_opened',
      'delta_centavos', v_delta, 'charge_id', v_delta_id);

  ELSIF v_delta < 0 THEN
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

COMMIT;
