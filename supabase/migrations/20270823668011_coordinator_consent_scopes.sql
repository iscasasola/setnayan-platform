-- ============================================================================
-- 20270823668011_coordinator_consent_scopes.sql
--
-- Granted-scopes column on the RA 10173 coordinator consent record.
-- Owner decision 2026-07-19 #5: coordinators MAY lock vendors and handle the
-- payment process, but ONLY upon the couple's approval of the coordinator's
-- access limitations — the money wall becomes consent-SCOPED instead of
-- absolute.
--
-- The couple grants the optional money scopes when they send the coordinator
-- host invite (the PR #3390 consent modal grows two default-OFF toggles).
-- Shape: {"vendor_lock": bool, "checkout": bool}
--   • vendor_lock — the coordinator may lock (finalize) vendors directly.
--   • checkout    — the coordinator may handle payments: submit orders,
--                   upload payment proof, record vendor deposits.
-- Absent key / '{}' = scope NOT granted (fail-closed). Enforcement lives in
-- apps/web/lib/coordinator-money-scope.ts behind
-- NEXT_PUBLIC_COORDINATOR_CONSENT_GATE_ENABLED (default OFF) — this column is
-- inert data until the flag flips.
--
-- Idempotent: ADD COLUMN IF NOT EXISTS. No data mutation; reversible by
-- ALTER TABLE public.coordinator_access_consents DROP COLUMN scopes.
-- ============================================================================

BEGIN;

ALTER TABLE public.coordinator_access_consents
  ADD COLUMN IF NOT EXISTS scopes JSONB NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.coordinator_access_consents.scopes IS
  'Couple-granted optional authority scopes for this coordinator (owner 2026-07-19 #5): {"vendor_lock": bool, "checkout": bool}. Missing key = not granted (fail-closed). vendor_lock = may lock/finalize vendors; checkout = may handle payments (submit orders · upload payment proof · record deposits). Enforced by lib/coordinator-money-scope.ts behind NEXT_PUBLIC_COORDINATOR_CONSENT_GATE_ENABLED.';

COMMIT;
