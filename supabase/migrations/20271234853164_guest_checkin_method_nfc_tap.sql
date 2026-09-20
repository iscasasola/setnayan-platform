-- ============================================================================
-- 20271234853164_guest_checkin_method_nfc_tap.sql
-- The check-in desk can now read a guest's NFC tag (owner, 2026-09-20: "build
-- the NFC check-in for guests too"). The tag holds the guest's invitation link
-- — the SAME link their QR encodes — so the desk resolves the same qr_token.
--
-- `guest_checkins.method` is the audit trail of HOW a guest was checked in.
-- Recording a tap as 'qr_scan' would be a false record, so the vocabulary
-- gains 'nfc_tap'. Every existing value is re-listed (a re-listed CHECK that
-- drops a value fails at ALTER time against real rows); prod had 0 rows in
-- guest_checkins when this was written (2026-09-20).
--
-- Constraint name verified in prod: guest_checkins_method_check (inline CHECK
-- from 20261118000000, auto-named). DROP … IF EXISTS + ADD keeps it idempotent.
--
-- ⚠ Applied ONLY by the pipeline (deploy-prod `supabase db push --include-all`)
-- when this merges. Never applied by hand.
-- ============================================================================

BEGIN;

ALTER TABLE public.guest_checkins
  DROP CONSTRAINT IF EXISTS guest_checkins_method_check;

ALTER TABLE public.guest_checkins
  ADD CONSTRAINT guest_checkins_method_check
  CHECK (method IN ('qr_scan', 'manual_search', 'nfc_tap'));

COMMENT ON COLUMN public.guest_checkins.method IS
  'How the guest was checked in: qr_scan (camera read their QR) · nfc_tap (desk phone read their NFC tag) · manual_search (found by name).';

COMMIT;
