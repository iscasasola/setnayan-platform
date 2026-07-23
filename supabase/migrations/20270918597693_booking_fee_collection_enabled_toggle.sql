-- Booking Fee — the admin "Enable collection" toggle (DB-driven go-live).
--
-- Lets an owner activate fee collection from /admin/integrations with no redeploy:
-- flip this + have PayMongo creds present → the fee enforces. A non-secret setting
-- on the world-readable platform_settings singleton (mirrors setnayan_pay_fee_pct).
-- Default FALSE so nothing changes until an admin deliberately turns it on.

ALTER TABLE public.platform_settings
  ADD COLUMN IF NOT EXISTS booking_fee_collection_enabled BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN public.platform_settings.booking_fee_collection_enabled IS
  'Admin go-live for the vendor Booking Fee. When TRUE (and PayMongo creds are '
  'present, or the env flags are set), the send-gate enforces. DB-driven so the '
  'owner activates from /admin/integrations with no redeploy. Default false.';
