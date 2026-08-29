-- the_credit_warning_sweep_has_a_clock
-- ============================================================================
-- THE FLEET-WIDE CREDIT WARNING NEEDS SOMEWHERE TO RECORD THAT IT RAN.
--
-- Companion to 20271180086237, which adds the `vendor_credit_expiring` label.
-- This adds the one column that stops every vendor dashboard load from
-- re-scanning the fleet.
--
-- ── WHY A COLUMN AND NOT AN IN-MEMORY TIMER ────────────────────────────────
-- 🔑 AN IN-PROCESS THROTTLE IS PER-INSTANCE, AND WE RUN MANY. Two serverless
-- instances each hold their own timer, so both would sweep, and a warning would
-- go out twice for one shop. `creator_offer_sweep_last_run_at` and
-- `lead_hold_sweep_last_run_at` already solved this on the same table: the
-- claim is a CONDITIONAL UPDATE, so Postgres picks exactly one winner and every
-- other instance reads zero rows back and returns.
--
-- The in-memory timer is still worth keeping in front of it — it saves the
-- round trip on the overwhelming majority of loads — but it is an optimisation,
-- never the correctness mechanism. This column is the correctness mechanism.
--
-- ⚠ NULL MEANS "NEVER RUN", AND THAT MUST READ AS ELIGIBLE, not as "ran at the
-- beginning of time and is therefore stale" — both happen to be true here, but
-- the claim is written `IS NULL OR < cutoff` explicitly so a future reader does
-- not have to work that out from a comparison against NULL, which returns NULL
-- and would silently make the sweep never eligible.
-- ============================================================================

BEGIN;

ALTER TABLE public.platform_settings
  ADD COLUMN IF NOT EXISTS vendor_credit_warning_sweep_last_run_at TIMESTAMPTZ;

COMMENT ON COLUMN public.platform_settings.vendor_credit_warning_sweep_last_run_at IS
  'Last time the fleet-wide "your credit is about to expire" sweep ran. Cron-free: claimed by a conditional UPDATE from a vendor dashboard load so exactly one instance sweeps. NULL means never run, which is eligible.';

COMMIT;
