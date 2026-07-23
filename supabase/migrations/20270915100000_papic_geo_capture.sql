-- Papic capture geolocation (papic_geo_metadata) — build the feature the control
-- gates, and un-retire the control.
--
-- The overhaul migration (20270914100000) RETIRED papic_geo_metadata because no
-- capture path stamped geo. This ships that path: the seat/bridge capture client
-- collects a coarse fix (navigator.geolocation) when the control is active, and
-- recordSeatCapture writes it into papic_photos, fail-closed behind the control.
--
-- papic_photos already has geo_lat / geo_lon / captured_at / device_model (base
-- migration 20260520015000). This adds the two columns CLAUDE.md's data model
-- names but that never existed: geo_accuracy_m + geo_unavailable.

-- ── Columns ───────────────────────────────────────────────────────────────────
ALTER TABLE public.papic_photos
  ADD COLUMN IF NOT EXISTS geo_accuracy_m DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS geo_unavailable BOOLEAN NOT NULL DEFAULT FALSE;

COMMENT ON COLUMN public.papic_photos.geo_accuracy_m IS
  'Horizontal accuracy (metres) of the capture fix, when geo was stamped. NULL when geo not captured.';
COMMENT ON COLUMN public.papic_photos.geo_unavailable IS
  'TRUE = the capture client had geo ON but produced no usable fix (denied/no signal). FALSE = a fix is stored in geo_lat/geo_lon, OR geo was not recorded for this capture (control off, or an offline/bridge path that carried no fix).';

-- ── Un-retire the control ─────────────────────────────────────────────────────
-- The feature now exists, so the control is no longer "retired / not built". It
-- returns to the live board as INACTIVE (Off): geo is a NEW location-data
-- collection, so it stays fail-closed until the owner activates it — the capture
-- path (client + server) both gate on status='active'. Give it a sort_order in
-- the vendor-mediated group (just after cross_event_vendor_recall = 60).
UPDATE public.data_privacy_controls
  SET status = 'inactive', sort_order = 65, updated_at = NOW()
  WHERE control_key = 'papic_geo_metadata' AND status = 'retired';
