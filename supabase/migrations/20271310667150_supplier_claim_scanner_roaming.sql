-- supplier claim scanner roaming
-- Created via `pnpm migration:new`. Prefix auto-allocated to sort AFTER every
-- existing migration. KEEP THIS MIGRATION IDEMPOTENT (it may be re-applied).
--
-- ═══════════════════════════════════════════════════════════════════════════
-- 🎟 THE SUPPLIER CLAIM SCANNER — slice 4: ROAMING PHOTOGRAPHER.
--
-- Owner ruling (DECISION_LOG 2026-09-25 "ROAMING PHOTOGRAPHER MODE: TAP/SCAN BEFORE THE SHOT, GROUPS INCLUDED"):
-- scan/tap each guest in frame → the shot gets one number (#0231) linked to them → printed → each linked guest is
-- announced "#0231 is ready…" → each claims with a scan/tap ("#0231 · 2 of 4 claimed"). No unlinked prints (the
-- shoot-first/table flow was NOT chosen). Counter: "Shots · Ready · Claimed".
--
-- It is the Group session's shape with no station, so it is the SAME machinery — slice 3's functions already treat
-- `roaming` like `group_session` (supplier_scan_claim · _session_open · _tally). This migration only lets the mode be
-- chosen and stored: the settings, claims and sessions CHECKs widen. Nothing else changes.
-- ═══════════════════════════════════════════════════════════════════════════

BEGIN;

ALTER TABLE public.supplier_scan_settings DROP CONSTRAINT IF EXISTS supplier_scan_settings_mode_check;
ALTER TABLE public.supplier_scan_settings
  ADD CONSTRAINT supplier_scan_settings_mode_check
  CHECK (mode IN ('once', 'ordered_received', 'unlimited', 'group_session', 'roaming'));

ALTER TABLE public.supplier_scan_claims DROP CONSTRAINT IF EXISTS supplier_scan_claims_mode_check;
ALTER TABLE public.supplier_scan_claims
  ADD CONSTRAINT supplier_scan_claims_mode_check
  CHECK (mode IN ('once', 'ordered_received', 'unlimited', 'group_session', 'roaming'));

ALTER TABLE public.supplier_scan_sessions DROP CONSTRAINT IF EXISTS supplier_scan_sessions_mode_check;
ALTER TABLE public.supplier_scan_sessions
  ADD CONSTRAINT supplier_scan_sessions_mode_check CHECK (mode IN ('group_session', 'roaming'));

COMMIT;
