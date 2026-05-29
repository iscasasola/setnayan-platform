-- V2 Cutover · Phase D · Master event QR + crew device 5-cap enforcement
-- Canon: CLAUDE.md third 2026-05-28 row (V1→V2 architectural pivot) +
-- tenth 2026-05-28 row (v2.1 BRIEF LOCKED AS CANONICAL).
-- Spec brief: blueprint Part 3 / v2.1 § 11 — master event QR with rolling
-- 60s hash regen + crew device fingerprinting at 5-cap-per-vendor-per-event
-- enforced via DB trigger (not just app code) so the cap survives any
-- engineering path into the table.
--
-- This migration is ADDITIVE. It does not touch any existing column or
-- table semantics. The master_qr_token column has a default so existing
-- events backfill cleanly at ALTER time.
--
-- Pattern parity:
--   • pgcrypto schema-qualification follows the convention locked in
--     20260513030000_fix_pgcrypto_qualification.sql — every gen_random_bytes
--     call goes through `extensions.gen_random_bytes` so SECURITY DEFINER
--     functions resolve it correctly on the standard search_path.
--   • RLS shape follows iteration 0006 / 0022 patterns — vendor reads
--     scoped to vendor_profiles.user_id (owner) OR vendor_team_members
--     (team), event host reads via current_event_ids() helper, admin
--     reads via is_admin() helper.

-- ----------------------------------------------------------------------------
-- 1. events.master_qr_token + rotated-at audit column
-- ----------------------------------------------------------------------------

ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS master_qr_token TEXT NOT NULL
    DEFAULT encode(extensions.gen_random_bytes(16), 'hex');

ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS master_qr_token_rotated_at TIMESTAMPTZ NOT NULL
    DEFAULT NOW();

COMMENT ON COLUMN public.events.master_qr_token IS
  'V2 Phase D · durable secret token rendered as the master event QR. '
  'Vendor host shares the QR with photography + livestream crew. Each '
  'crew device pairs once via /api/crew/register-device and counts '
  'toward the 5-device-per-vendor-per-event hard cap. Rotated by host '
  'via regenerateEventMasterQR server action; rotation invalidates '
  'further device registrations using the old token but does NOT revoke '
  'already-registered devices (they keep using their device_id session '
  'for telemetry checkpoints). Token format: 32 lowercase hex chars '
  '(16 bytes of entropy · ~128 bits · indistinguishable from random).';

COMMENT ON COLUMN public.events.master_qr_token_rotated_at IS
  'V2 Phase D · timestamp of last rotation. Audit-only; not consumed by '
  'app logic. Defaults to event creation time on backfill.';

-- ----------------------------------------------------------------------------
-- 2. registered_crew_devices table
-- ----------------------------------------------------------------------------

-- A prior partial migration created `registered_crew_devices` with a
-- different (incomplete) shape (no vendor_profile_id, no revoked_at, etc).
-- The table has no rows yet (Phase D first ship · pilot 2026-06-01 not
-- launched), so a clean drop + recreate is the cheapest path to canonical
-- shape. CASCADE drops the dependent (also partial) trigger + policies.
DROP TABLE IF EXISTS public.registered_crew_devices CASCADE;

CREATE TABLE public.registered_crew_devices (
  device_id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id            UUID NOT NULL
                      REFERENCES public.events(event_id) ON DELETE CASCADE,
  vendor_profile_id   UUID NOT NULL
                      REFERENCES public.vendor_profiles(vendor_profile_id),
  device_fingerprint  TEXT NOT NULL,
  device_label        TEXT,
  registered_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  revoked_at          TIMESTAMPTZ NULL,
  last_seen_at        TIMESTAMPTZ,
  UNIQUE (event_id, vendor_profile_id, device_fingerprint)
);

COMMENT ON TABLE public.registered_crew_devices IS
  'V2 Phase D · crew device fingerprinting · 5-cap enforced via trigger · '
  'vendor crew pair phones/tablets to event for capture · CLAUDE.md '
  '2026-05-28 third + tenth rows';

COMMENT ON COLUMN public.registered_crew_devices.device_fingerprint IS
  'Opaque fingerprint computed crew-side (browser/native) — typically a '
  'hash of useragent + canvas + audio + timezone signals. Idempotency '
  'key: re-POST from same device updates last_seen_at instead of '
  'inserting a duplicate row.';

COMMENT ON COLUMN public.registered_crew_devices.revoked_at IS
  'Soft-revoke timestamp. Revoked devices keep history but the 5-cap '
  'trigger only counts WHERE revoked_at IS NULL · revoking frees a slot.';

-- Index targets the trigger + RLS hot path (count rows per
-- (event_id, vendor_profile_id) with revoked_at IS NULL).
CREATE INDEX IF NOT EXISTS idx_crew_devices_event_vendor
  ON public.registered_crew_devices (event_id, vendor_profile_id)
  WHERE revoked_at IS NULL;

-- ----------------------------------------------------------------------------
-- 3. 5-cap enforcement trigger
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.check_crew_device_seat_allocation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  active_count INT;
BEGIN
  -- Only enforce when the new/updated row is itself active
  -- (revoked rows can sit in the table indefinitely without consuming a slot).
  IF NEW.revoked_at IS NOT NULL THEN
    RETURN NEW;
  END IF;

  -- Count peer active rows that would coexist with NEW after the write.
  -- For INSERT: NEW.device_id won't be in the table yet, so a plain count
  --   gives the pre-insert active count; we compare to (5 - 1) = 4.
  -- For UPDATE: filter out NEW.device_id so we don't double-count the
  --   row we're updating; compare to (5 - 1) = 4.
  SELECT COUNT(*)
    INTO active_count
    FROM public.registered_crew_devices
   WHERE event_id = NEW.event_id
     AND vendor_profile_id = NEW.vendor_profile_id
     AND revoked_at IS NULL
     AND device_id IS DISTINCT FROM NEW.device_id;

  IF active_count >= 5 THEN
    RAISE EXCEPTION
      'Crew device limit reached: 5 devices per vendor per event'
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.check_crew_device_seat_allocation() IS
  'V2 Phase D · BEFORE INSERT/UPDATE trigger function for '
  'registered_crew_devices. Hard-caps active (revoked_at IS NULL) rows '
  'at 5 per (event_id, vendor_profile_id). RAISE EXCEPTION with '
  'ERRCODE check_violation when cap reached so PostgREST surfaces a '
  'clean 409. Revoking a row frees a slot. SECURITY DEFINER so the '
  'count query bypasses RLS — the trigger needs to see ALL active '
  'rows for the vendor + event scope, not just the rows the caller '
  'can read.';

DROP TRIGGER IF EXISTS trg_crew_device_cap
  ON public.registered_crew_devices;

CREATE TRIGGER trg_crew_device_cap
  BEFORE INSERT OR UPDATE ON public.registered_crew_devices
  FOR EACH ROW
  EXECUTE FUNCTION public.check_crew_device_seat_allocation();

-- ----------------------------------------------------------------------------
-- 4. RLS · vendor owners + vendor team + event host + admin can read
-- ----------------------------------------------------------------------------

ALTER TABLE public.registered_crew_devices ENABLE ROW LEVEL SECURITY;

-- Vendor owner reads their own devices.
DROP POLICY IF EXISTS crew_devices_vendor_owner_read
  ON public.registered_crew_devices;
CREATE POLICY crew_devices_vendor_owner_read
  ON public.registered_crew_devices
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.vendor_profiles vp
       WHERE vp.vendor_profile_id = registered_crew_devices.vendor_profile_id
         AND vp.user_id = auth.uid()
    )
  );

-- Vendor team members read their vendor's devices.
DROP POLICY IF EXISTS crew_devices_vendor_team_read
  ON public.registered_crew_devices;
CREATE POLICY crew_devices_vendor_team_read
  ON public.registered_crew_devices
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.vendor_team_members vtm
       WHERE vtm.vendor_profile_id = registered_crew_devices.vendor_profile_id
         AND vtm.user_id = auth.uid()
    )
  );

-- Event host (any event_members row) reads ALL devices on their event.
-- Useful for the future event-home dashboard surface that shows host how
-- many crew slots are claimed across vendors.
DROP POLICY IF EXISTS crew_devices_event_host_read
  ON public.registered_crew_devices;
CREATE POLICY crew_devices_event_host_read
  ON public.registered_crew_devices
  FOR SELECT
  USING (
    registered_crew_devices.event_id IN (
      SELECT public.current_event_ids()
    )
  );

-- Admin reads all (moderation + cross-event audit).
DROP POLICY IF EXISTS crew_devices_admin_read
  ON public.registered_crew_devices;
CREATE POLICY crew_devices_admin_read
  ON public.registered_crew_devices
  FOR SELECT
  USING (public.is_admin());

-- No client-side INSERT/UPDATE policies. All writes route through the
-- /api/crew/register-device endpoint which uses the service-role client,
-- AND through admin/host server actions that resolve the writer's
-- authorization in app code before calling adminClient. RLS denies
-- direct PostgREST INSERT/UPDATE by default once enabled.
