-- 20271119501642_anonymity_floor_cannot_identify.sql
--
-- 🔴 PRIVACY. `platform_settings.radar_min_n_floor` is the minimum number of
-- distinct peers a market band needs before it may be shown. It is the ONLY
-- thing standing between "an anonymised benchmark" and "one supplier's private
-- numbers, relabelled".
--
-- Its CHECK allowed `>= 1`, and prod was **set to 1**.
--
-- WHAT 1 MEANS. Seven functions gate on this via public.min_n_ok():
--   demand_radar_admin · demand_radar_for_vendor · recompute_market_funnel_bands
--   recompute_market_price_bands · rival_signals_for_vendor · service_card_records
--   trusted_circle_vendor_signal
-- With a floor of 1, a band can be built from a SINGLE other vendor — and then
-- its p25 / p50 / p75 are that one vendor's exact reply rate, reply time and
-- conversion. The feature's own docblock promises "quantiles-only … no peer
-- identity by construction". At n=1 that promise is simply false, and at n=2 the
-- median still gives the other party away.
--
-- ⚠ NOBODY HAS BEEN EXPOSED YET — market_funnel_bands has 0 rows and the
-- recompute is an admin "Run now" that has never been pressed (verified in prod
-- 2026-08-06, alongside 2 vendor profiles total). This closes the hole while it
-- is still theoretical. The moment that button is pressed with a floor of 1, the
-- exposure is real AND retroactive.
--
-- ── THE TWO NUMBERS, AND WHY THEY DIFFER ───────────────────────────────────
--
-- CHECK >= 3  — the safety rail. Below 3 an individual is readable out of a
--               quantile. No admin, however well-intentioned, can go there.
-- VALUE  = 5  — the operating value. `FUNNEL_MIN_N = 5` in
--               apps/web/lib/vendor-funnel.ts already gates the vendor funnel,
--               and its docblock calls itself "a TS mirror of the shipped SQL
--               public.min_n_ok" — a claim that was false by 5× while SQL sat at
--               1. Setting 5 makes the mirror real. At n=3 the p25/p75 sit almost
--               on the extremes; at n=5 they are genuinely interior.
--
-- A range rather than one number: if a thin category later needs 5 relaxed, an
-- admin can drop to 3 — a real decision, inside a safe band. They can never drop
-- into the identifying zone.
--
-- 🔑 THIS IS A THIRD COPY OF ONE FACT. The migration default said 1, the
-- funnel-benchmark docblock said "held >= 3", and vendor-funnel.ts said 5. Three
-- numbers, one rule, all disagreeing — the shape behind nearly every defect found
-- on 2026-08-06. The CHECK is now the authority; the comments are corrected in
-- the same PR.
--
-- Idempotent. No data is destroyed: raising a floor only suppresses MORE.

-- ── 1 · the safety rail ────────────────────────────────────────────────────
ALTER TABLE public.platform_settings
  DROP CONSTRAINT IF EXISTS platform_settings_radar_min_n_floor_chk;

-- Raise any existing sub-3 value FIRST, or the constraint cannot be added.
UPDATE public.platform_settings
   SET radar_min_n_floor = 5
 WHERE radar_min_n_floor IS NULL OR radar_min_n_floor < 3;

ALTER TABLE public.platform_settings
  ADD CONSTRAINT platform_settings_radar_min_n_floor_chk
  CHECK (radar_min_n_floor >= 3);

-- ── 2 · the operating value ────────────────────────────────────────────────
-- Only raise. If an admin has deliberately set something >= 5, leave it alone.
UPDATE public.platform_settings
   SET radar_min_n_floor = 5
 WHERE radar_min_n_floor < 5;

-- ── 3 · a new row can never be born identifying ────────────────────────────
ALTER TABLE public.platform_settings
  ALTER COLUMN radar_min_n_floor SET DEFAULT 5;

COMMENT ON COLUMN public.platform_settings.radar_min_n_floor IS
  'Minimum distinct peers before a market band may be shown. PRIVACY CONTROL, not a tuning knob: below 3 an individual vendor is readable out of a quantile (at n=1 the p50 IS the other vendor). CHECK enforces >= 3 as a hard rail; default and operating value are 5, matching FUNNEL_MIN_N in apps/web/lib/vendor-funnel.ts. Raised from 1 on 2026-08-06 — the old value would have exposed one supplier''s private reply rate, reply time and conversion to another the first time an admin pressed Run now.';
