-- ============================================================================
-- 20260513230000_platform_settings.sql
-- Admin-editable singleton row for cross-platform configuration.
--
-- Holds the business identity (used on receipts), merchant payment info
-- (used on order detail + receipts), and the default VAT rate. Eliminates
-- hardcoded values across the app so owner can fill in real production
-- details via /admin/settings before any real receipts or payments go out.
--
-- Single-row enforcement via CHECK (id = 1). One canonical row seeded at
-- migration time; admins edit it via UPDATE.
--
-- Idempotent.
-- ============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS public.platform_settings (
  id                     INTEGER PRIMARY KEY CHECK (id = 1),
  business_name          TEXT NOT NULL DEFAULT 'Setnayan',
  business_tin           TEXT,
  business_address       TEXT,
  business_email         TEXT,
  bdo_account_name       TEXT,
  bdo_account_number     TEXT,
  bdo_qr_url             TEXT,
  gcash_account_name     TEXT,
  gcash_number           TEXT,
  gcash_qr_url           TEXT,
  default_vat_rate_pct   NUMERIC(5,2) NOT NULL DEFAULT 12.00,
  updated_at             TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO public.platform_settings (id) VALUES (1)
  ON CONFLICT (id) DO NOTHING;

ALTER TABLE public.platform_settings ENABLE ROW LEVEL SECURITY;

-- Everyone can read — these are display values (business name, TIN, merchant
-- payment info), not secrets. Writes are admin-only via service-role.
DROP POLICY IF EXISTS platform_settings_read_all ON public.platform_settings;
CREATE POLICY platform_settings_read_all
  ON public.platform_settings FOR SELECT
  TO anon, authenticated
  USING (true);

COMMIT;
