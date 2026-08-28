-- ════════════════════════════════════════════════════════════════════════════
-- THE OWNER SETS THE BOOKING FEE — the 5%, the ₱100,000 threshold and the 1%
-- become admin-editable at /admin/pricing → "Vendor booking fee".
--
-- ⚖ OWNER RULING 2026-08-28: the three numbers that make up the vendor booking
-- fee must be his to change, not an engineer's. Until now they were code
-- constants in TWO places (apps/web/lib/booking-fee.ts and the SQL mirror
-- below), so moving one was a deploy.
--
-- 🔑 THE ARITHMETIC EXISTS TWICE AND THE SENTENCE EXISTS TWICE — FOUR COPIES.
--   1. public.booking_fee_centavos(BIGINT)      ← AUTHORITATIVE, ~6 SQL callers
--   2. apps/web/lib/booking-fee.ts bookingFeePhp   (display / pre-computation)
--   3. public.booking_fee_schedule_summary()    ← the money document minted in
--                                                 SQL on the amendment path
--   4. apps/web/lib/booking-fee.ts bookingFeeScheduleSummary()
-- ALL FOUR now read the same three settings. Had only the arithmetic been made
-- editable, a reprice would have left both sentences behind, and a vendor would
-- read "5% of the first ₱100,000" on a bill computed at some other rate — which
-- is precisely the defect 20271013349208 was written to close, reintroduced one
-- level up. tests/db/booking-fee-rederive.db.test.ts asserts (3) == (4).
--
-- ⚠ VOLATILITY: BOTH functions change IMMUTABLE → STABLE. A function that reads
-- a table cannot honestly be IMMUTABLE — Postgres is entitled to fold an
-- IMMUTABLE call to a constant at plan time, so leaving the marker would let a
-- stale fee survive a settings change inside an already-planned statement.
-- MEASURED IN PRODUCTION BEFORE CHANGING IT (njrupjnvkjkitfctetvi, 2026-08-28):
--   • no index expression mentions either function      (0 rows)
--   • no column default or generated column mentions it (0 rows)
--   • no CHECK constraint mentions it                   (0 rows)
--   • no materialized view mentions it                  (0 rows)
-- so nothing depends on the IMMUTABLE marker and nothing needs reindexing. The
-- ~6 callers are all plpgsql/sql function BODIES (`v_fee := booking_fee_centavos(…)`),
-- which STABLE serves exactly as well.
--
-- ⚠ THE POST-CONDITION BLOCK FROM 20271009120000 CANNOT SURVIVE AS WRITTEN, and
-- deleting it would be the wrong repair. It hard-asserts the owner's four
-- worked examples (₱60k→₱3,000 · ₱300k→₱7,000 · ₱1M→₱14,000 · ₱10M→₱104,000).
-- Once the rate is admin-editable those are no longer facts about the FUNCTION —
-- they are facts about the function AT THE DEFAULT SETTINGS. So they are split:
--   • the four examples are asserted CONDITIONALLY, against a locally-seeded
--     5 / ₱100,000 / 1 — which is what this migration installs, so they still
--     genuinely run today and still refuse a broken formula;
--   • continuity at the band edge, monotonicity, the floor and the ₱0 rule are
--     asserted UNCONDITIONALLY against the LIVE settings, because those must
--     hold for every legal setting an admin can ever type. They are the
--     properties that keep under-declaring from ever paying.
-- That is strictly more coverage than before, not less.
--
-- 🔒 THE ₱50 FLOOR AND THE NO-CAP RULE STAY FIXED IN CODE. The owner ruled on
-- the three taper numbers and did not rule on these two. They are deliberately
-- NOT given columns — flagged here rather than quietly made editable.
--
-- SAFE BY ARITHMETIC: prod holds 0 booking_fee_charges and the feature is
-- flag-dark (NEXT_PUBLIC_BOOKING_FEE_ENABLED). Nothing is re-priced: the three
-- defaults ARE the current constants, so behaviour is byte-identical until an
-- admin changes a number.
--
-- Idempotent (ADD COLUMN IF NOT EXISTS · CREATE OR REPLACE). Safe to re-run.
-- ════════════════════════════════════════════════════════════════════════════

BEGIN;

-- ── 1) The three numbers, on the platform_settings singleton ────────────────
-- Same shape as setnayan_pay_fee_pct (20270103030000), the existing precedent
-- for "a code constant the owner may now set".
--
-- ⚠ TWO DIFFERENT 5%s LIVE ON THIS TABLE AND THEY ARE OPPOSITE PRODUCTS:
--   setnayan_pay_fee_pct       — a dormant gateway fee the CUSTOMER would pay.
--   booking_fee_rate_pct       — charged to the SUPPLIER for the introduction.
-- They are named apart on purpose and the admin screen heads them separately.
ALTER TABLE public.platform_settings
  ADD COLUMN IF NOT EXISTS booking_fee_rate_pct NUMERIC(5, 2) NOT NULL DEFAULT 5.00
    CHECK (booking_fee_rate_pct >= 0 AND booking_fee_rate_pct <= 100);

ALTER TABLE public.platform_settings
  ADD COLUMN IF NOT EXISTS booking_fee_tail_rate_pct NUMERIC(5, 2) NOT NULL DEFAULT 1.00
    CHECK (booking_fee_tail_rate_pct >= 0 AND booking_fee_tail_rate_pct <= 100);

ALTER TABLE public.platform_settings
  ADD COLUMN IF NOT EXISTS booking_fee_tier1_limit_php NUMERIC(12, 2) NOT NULL DEFAULT 100000
    CHECK (booking_fee_tier1_limit_php > 0);

COMMENT ON COLUMN public.platform_settings.booking_fee_rate_pct IS
  'Vendor BOOKING FEE: the percentage charged on the first booking_fee_tier1_limit_php of an agreed booking. Charged to the SUPPLIER for the introduction + in-app sync — NEVER a commission, and never paid by the couple. Admin-editable at /admin/pricing. Default 5.00 == the owner-locked 2026-07-25 taper. Read by public.booking_fee_centavos() and by apps/web/lib/booking-fee.ts via getBookingFeeSchedule(). Not to be confused with setnayan_pay_fee_pct, which is a dormant CUSTOMER-side gateway fee.';

COMMENT ON COLUMN public.platform_settings.booking_fee_tail_rate_pct IS
  'Vendor BOOKING FEE: the percentage charged on the amount ABOVE booking_fee_tier1_limit_php — the taper that softens large bookings so nobody is punished for declaring the true figure. Default 1.00 == the owner-locked 2026-07-25 taper.';

COMMENT ON COLUMN public.platform_settings.booking_fee_tier1_limit_php IS
  'Vendor BOOKING FEE: the peso amount at which the headline rate stops and the tail rate begins. Default 100000 == the owner-locked 2026-07-25 taper.';

-- ── 2) The arithmetic, now reading the settings ─────────────────────────────
-- Shape is unchanged: head rate on the first band, tail rate above it, floored
-- at ₱50, no cap, non-positive → 0. Only the three numbers moved out of the
-- body. COALESCE to the locked defaults so an unreadable / absent settings row
-- degrades to today's schedule rather than to a free booking fee.
CREATE OR REPLACE FUNCTION public.booking_fee_centavos(p_amount_centavos BIGINT)
RETURNS BIGINT
LANGUAGE sql
STABLE                              -- ← was IMMUTABLE; it reads a table now.
SET search_path = public
AS $$
  WITH s AS (
    SELECT
      COALESCE((SELECT booking_fee_rate_pct       FROM public.platform_settings WHERE id = 1),   5.00) AS head_pct,
      COALESCE((SELECT booking_fee_tail_rate_pct  FROM public.platform_settings WHERE id = 1),   1.00) AS tail_pct,
      COALESCE((SELECT booking_fee_tier1_limit_php FROM public.platform_settings WHERE id = 1), 100000) AS band_php
  )
  SELECT CASE
    WHEN p_amount_centavos IS NULL OR p_amount_centavos <= 0 THEN 0::BIGINT
    ELSE GREATEST(
      round(
        LEAST(p_amount_centavos, (s.band_php * 100)::BIGINT) * (s.head_pct / 100.0)
        + GREATEST(p_amount_centavos - (s.band_php * 100)::BIGINT, 0::BIGINT) * (s.tail_pct / 100.0)
      )::BIGINT,
      5000::BIGINT                  -- ₱50 floor — FIXED, not owner-editable.
    )
  END
  FROM s;
$$;

COMMENT ON FUNCTION public.booking_fee_centavos(BIGINT) IS
  'Vendor Booking Fee (centavos) for an agreed amount (centavos). Reads the '
  'admin-set head rate, band ceiling and tail rate from platform_settings '
  '(defaults 5%% / PHP 100,000 / 1%% == the owner-locked 2026-07-25 taper); the '
  'PHP 50 floor and the no-cap rule are FIXED in this body and are not '
  'owner-editable. AUTHORITATIVE mirror of apps/web/lib/booking-fee.ts. STABLE, '
  'not IMMUTABLE, because it reads a table - an IMMUTABLE marker would let a '
  'stale rate be folded into an already-planned statement. Non-positive -> 0.';

-- ── 3) The sentence, now reading the same settings ──────────────────────────
-- ⚠ THIS IS THE HALF THAT IS EASY TO FORGET. It is the vendor's money document
-- on the amendment path (no TypeScript runs there). It must be composed from
-- the settings, or a reprice bills one rate and prints another.
--
-- The output must match apps/web/lib/booking-fee.ts::bookingFeeScheduleSummary()
-- BYTE FOR BYTE — Intl.NumberFormat('en-PH'): a percent with trailing zeros
-- trimmed, and a peso amount with thousands separators and no decimals when it
-- is a whole number. tests/db/booking-fee-rederive.db.test.ts is what catches a
-- disagreement, and it compares the two directly rather than against a literal.
CREATE OR REPLACE FUNCTION public.booking_fee_pct_text(p_pct NUMERIC)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
AS $$
  -- 5.00 → '5%' · 5.50 → '5.5%' · 0.25 → '0.25%'. Mirrors Intl percent
  -- formatting with maximumFractionDigits: 3 and no trailing zeros.
  SELECT CASE
    WHEN p_pct = trunc(p_pct) THEN trunc(p_pct)::BIGINT::TEXT
    ELSE trim(trailing '.' from trim(trailing '0' from to_char(p_pct, 'FM999990.999')))
  END || '%';
$$;

CREATE OR REPLACE FUNCTION public.booking_fee_php_text(p_php NUMERIC)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
AS $$
  -- 100000 → '₱100,000' · 50 → '₱50' · 1500.5 → '₱1,500.50'. Mirrors Intl
  -- currency PHP with 0 decimals for whole numbers and 2 otherwise.
  SELECT '₱' || CASE
    WHEN p_php = trunc(p_php) THEN to_char(p_php, 'FM999,999,999,990')
    ELSE to_char(p_php, 'FM999,999,999,990.00')
  END;
$$;

CREATE OR REPLACE FUNCTION public.booking_fee_schedule_summary()
RETURNS TEXT
LANGUAGE sql
STABLE                              -- ← was IMMUTABLE; it reads a table now.
SET search_path = public
AS $$
  SELECT public.booking_fee_pct_text(
           COALESCE((SELECT booking_fee_rate_pct FROM public.platform_settings WHERE id = 1), 5.00))
      || ' of the first '
      || public.booking_fee_php_text(
           COALESCE((SELECT booking_fee_tier1_limit_php FROM public.platform_settings WHERE id = 1), 100000))
      || ', then '
      || public.booking_fee_pct_text(
           COALESCE((SELECT booking_fee_tail_rate_pct FROM public.platform_settings WHERE id = 1), 1.00))
      || ', minimum '
      || public.booking_fee_php_text(50);   -- the FIXED floor
$$;

COMMENT ON FUNCTION public.booking_fee_schedule_summary() IS
  'The vendor Booking Fee schedule as one human sentence, for money documents '
  'minted in SQL (the amendment path, where no TypeScript runs). COMPOSED from '
  'the same platform_settings the arithmetic reads, so a reprice moves the bill '
  'and the maths together. Authoritative mirror of bookingFeeScheduleSummary() '
  'in apps/web/lib/booking-fee.ts - asserted identical by '
  'apps/web/tests/db/booking-fee-rederive.db.test.ts. STABLE, not IMMUTABLE. '
  'service_role-only.';

REVOKE ALL ON FUNCTION public.booking_fee_pct_text(NUMERIC) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.booking_fee_php_text(NUMERIC) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.booking_fee_pct_text(NUMERIC) TO service_role;
GRANT EXECUTE ON FUNCTION public.booking_fee_php_text(NUMERIC) TO service_role;

-- The two replaced functions keep the grants their originals carried
-- (CREATE OR REPLACE preserves the ACL), stated here so a reader need not go
-- looking: booking_fee_centavos → authenticated + service_role;
-- booking_fee_schedule_summary → service_role only.

COMMIT;

-- ════════════════════════════════════════════════════════════════════════════
-- POST-CONDITIONS — split into "true at the default settings" and "true for
-- EVERY setting". See the header for why the 20271009120000 block could not
-- survive unchanged.
-- ════════════════════════════════════════════════════════════════════════════
DO $$
DECLARE
  bad        TEXT[] := ARRAY[]::TEXT[];
  v          BIGINT;
  v_head     NUMERIC;
  v_tail     NUMERIC;
  v_band     NUMERIC;
  v_at_edge  BIGINT;
  v_prev     BIGINT;
  v_cur      BIGINT;
  v_amt      BIGINT;
BEGIN
  -- ⚠ COALESCED TO THE SAME DEFAULTS THE FUNCTION USES. Without this, an
  -- environment with no `platform_settings` row (the PGlite replay can be one)
  -- leaves v_band NULL, the sampled amounts below become NULL, the fee for a
  -- NULL amount is 0, and the monotonicity check reports a FALSE failure — a
  -- migration failing for a reason that has nothing to do with the schedule.
  SELECT COALESCE(s.booking_fee_rate_pct,        5.00),
         COALESCE(s.booking_fee_tail_rate_pct,   1.00),
         COALESCE(s.booking_fee_tier1_limit_php, 100000)
    INTO v_head, v_tail, v_band
    FROM (SELECT 1) AS one
    LEFT JOIN public.platform_settings s ON s.id = 1;

  -- ── A. THE OWNER'S FOUR WORKED EXAMPLES, at the seeded default schedule ───
  -- Conditional on the settings actually being 5 / 100,000 / 1 — which is what
  -- this migration installs, so on a fresh apply this arm DOES run. If an admin
  -- later reprices and someone re-runs this file, the examples are skipped
  -- rather than failing a migration for reflecting a decision the owner made.
  IF v_head = 5.00 AND v_tail = 1.00 AND v_band = 100000 THEN
    v := public.booking_fee_centavos(6000000);
    IF v <> 300000 THEN bad := array_append(bad, format('60k=%s want 300000', v)); END IF;

    v := public.booking_fee_centavos(30000000);
    IF v <> 700000 THEN bad := array_append(bad, format('300k=%s want 700000', v)); END IF;

    v := public.booking_fee_centavos(100000000);
    IF v <> 1400000 THEN bad := array_append(bad, format('1M=%s want 1400000', v)); END IF;

    v := public.booking_fee_centavos(1000000000);
    IF v <> 10400000 THEN bad := array_append(bad, format('10M=%s want 10400000', v)); END IF;

    -- The sentence the vendor reads, at the default schedule.
    IF public.booking_fee_schedule_summary()
       <> '5% of the first ₱100,000, then 1%, minimum ₱50' THEN
      bad := array_append(bad,
        format('summary drifted: %s', public.booking_fee_schedule_summary()));
    END IF;
  ELSE
    RAISE NOTICE 'booking fee: settings are not at the locked defaults (%/%/%) — '
                 'the four worked examples are skipped; the invariants below still run.',
                 v_head, v_band, v_tail;
  END IF;

  -- ── B. THE INVARIANTS — must hold for ANY setting an admin can type ───────
  -- These are what stop a reprice from making under-declaring profitable.

  -- ₱0 / barter is still free, and the ₱50 floor still binds on a small booking.
  IF public.booking_fee_centavos(0) <> 0 THEN
    bad := array_append(bad, 'zero/barter is no longer free');
  END IF;
  IF public.booking_fee_centavos(1) <> 5000 THEN
    bad := array_append(bad, 'the PHP 50 floor no longer binds at the bottom');
  END IF;

  -- CONTINUITY at the band edge: the fee computed either side of the threshold
  -- must not jump. A discontinuity is a cliff a vendor can sit just below.
  v_at_edge := public.booking_fee_centavos((v_band * 100)::BIGINT);
  IF public.booking_fee_centavos((v_band * 100)::BIGINT + 1) - v_at_edge > 100 THEN
    bad := array_append(bad, 'fee JUMPS just above the band edge — a cliff');
  END IF;

  -- MONOTONICITY: declaring MORE must never pay LESS. Sampled across the whole
  -- shape — inside the band, at the edge, and far into the tail.
  v_prev := -1;
  FOREACH v_amt IN ARRAY ARRAY[
    0::BIGINT, 1::BIGINT, 5000::BIGINT, 100000::BIGINT,
    (v_band * 50)::BIGINT,            -- half the band
    (v_band * 100)::BIGINT - 1,       -- just inside
    (v_band * 100)::BIGINT,           -- exactly at
    (v_band * 100)::BIGINT + 1,       -- just outside
    (v_band * 300)::BIGINT,           -- 3× the band
    (v_band * 10000)::BIGINT          -- deep in the tail
  ] LOOP
    v_cur := public.booking_fee_centavos(v_amt);
    IF v_cur < v_prev THEN
      bad := array_append(bad,
        format('fee DECREASES at %s (%s < %s) — under-declaring would pay',
               v_amt, v_cur, v_prev));
    END IF;
    v_prev := v_cur;
  END LOOP;

  IF array_length(bad, 1) IS NOT NULL THEN
    RAISE EXCEPTION 'booking fee settings post-condition failed: %',
      array_to_string(bad, ' | ');
  END IF;
END $$;

-- ════════════════════════════════════════════════════════════════════════════
-- VERIFICATION:
--   SELECT booking_fee_rate_pct, booking_fee_tier1_limit_php, booking_fee_tail_rate_pct
--     FROM public.platform_settings WHERE id = 1;          -- → 5.00 · 100000.00 · 1.00
--   SELECT public.booking_fee_centavos(100000000);         -- → 1400000  (₱1M → ₱14,000)
--   SELECT public.booking_fee_schedule_summary();          -- → 5% of the first ₱100,000, then 1%, minimum ₱50
--   SELECT provolatile FROM pg_proc WHERE proname = 'booking_fee_centavos';  -- → s
-- ════════════════════════════════════════════════════════════════════════════
