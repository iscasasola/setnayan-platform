-- ============================================================================
-- 20271174500643_supplier_night_before_email_log.sql
--
-- Idempotency lock for the NIGHT-BEFORE SUPPLIER EMAIL (S5 — cron-free,
-- runSupplierNightBeforeEmailReminders in lib/supplier-night-before-email.ts,
-- fired from admin/vendor-dashboard after() traffic). Mirrors
-- anniversary_headsup_log's shape + RLS exactly: insert-first claim per
-- (event_vendor_id, event_date) so a re-run within the same day can never
-- double-send, and a rescheduled booking gets a fresh row for its new date.
--
-- ⚠ THIS FEATURE SHIPS SWITCHED OFF. The owner gate — may we email a supplier
-- automatically at an address they never gave us? — is still open (see
-- WHATS_NEXT_Suppliers_Room_SESSIONS_2026-08-27.md § S5). The table and its
-- writer exist so the flag flip is the only remaining step; nothing here is
-- reachable until SUPPLIER_NIGHT_BEFORE_EMAIL_ENABLED=true.
--
-- Idempotent: CREATE TABLE IF NOT EXISTS + ENABLE RLS + DROP/CREATE POLICY.
-- ============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS public.supplier_night_before_email_log (
  event_vendor_id  UUID        NOT NULL REFERENCES public.event_vendors(vendor_id) ON DELETE CASCADE,
  event_date       DATE        NOT NULL,
  sent_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resend_id        TEXT,
  PRIMARY KEY (event_vendor_id, event_date)
);

ALTER TABLE public.supplier_night_before_email_log ENABLE ROW LEVEL SECURITY;

-- Close the stock `GRANT ALL ... TO anon, authenticated` a new table is born
-- with (Supabase default), same as anniversary_headsup_log's own retroactive
-- closure in 20271147692197_revoke_anon_unreachable_batch3.sql — never let a
-- log table with an admin-only policy still hand the public internet a
-- table-level SIUD grant as its "defence in depth".
REVOKE ALL ON public.supplier_night_before_email_log FROM anon;

-- Service/admin only (the cron-free job writes via the service role, bypassing
-- RLS; admins may read for support). No vendor/couple/public access.
DROP POLICY IF EXISTS supplier_night_before_email_log_admin_all ON public.supplier_night_before_email_log;
CREATE POLICY supplier_night_before_email_log_admin_all
  ON public.supplier_night_before_email_log
  FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

COMMIT;
