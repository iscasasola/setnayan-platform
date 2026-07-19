-- ============================================================================
-- 20270809875276_vendor_dayof_configs.sql
--
-- Vendor "On the Day" launcher · PR-2 — SPARSE per-booking module override.
--
-- The day-of console's controller family + which modules are on are computed in
-- code from the vendor's taxonomy (lib/vendor-dayof-modules.ts). Defaults are a
-- pure function of that taxonomy — a vendor who never touches the configurator
-- writes NOTHING here and gets sensible defaults. This table exists ONLY to
-- record a deliberate override for one (vendor, event) booking: the vendor
-- switched a default-on module off, or switched an available module on.
--
--   enabled_modules  = the authoritative on-set for that booking (a JSONB array
--                      of module ids). Absent row → code defaults. Present row →
--                      the app intersects it with the modules AVAILABLE to the
--                      vendor's family (an override can never enable a module the
--                      vendor's category doesn't offer — enforced in code by
--                      resolveModules, not trusted from the row).
--
-- No money, no PII. Operational config only.
--
-- RLS AT CREATE TIME with canonical helpers — the vendor reads/writes only their
-- OWN profile's rows, and only on events they are BOOKED on
-- (current_vendor_booked_event_ids ∩ current_vendor_profile_ids), mirroring the
-- booking_handovers vendor-insert gate (20270321980372). Admin reads all.
-- Idempotent + re-run safe.
-- ============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS public.vendor_dayof_configs (
  config_id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- The marketplace vendor profile (event_vendors.marketplace_vendor_id).
  vendor_profile_id  UUID NOT NULL,
  -- The booked event this override applies to.
  event_id           UUID NOT NULL
                     REFERENCES public.events(event_id) ON DELETE CASCADE,
  -- Authoritative on-set for this booking: JSONB array of module ids
  -- (e.g. '["run_of_show","shot_list","qr_scanner"]'). Validated in code
  -- against the modules available to the vendor's family — never trusted raw.
  enabled_modules    JSONB NOT NULL DEFAULT '[]'::jsonb
                     CHECK (jsonb_typeof(enabled_modules) = 'array'),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- One override row per (vendor, event) — the configurator upserts on it.
  UNIQUE (vendor_profile_id, event_id)
);

CREATE INDEX IF NOT EXISTS vendor_dayof_configs_vendor_idx
  ON public.vendor_dayof_configs (vendor_profile_id, event_id);

COMMENT ON TABLE public.vendor_dayof_configs IS
  'Vendor On-the-Day launcher — SPARSE per-booking module override. Absent row = code defaults (lib/vendor-dayof-modules.ts); present row = the vendor deliberately configured which day-of modules are on for that (vendor,event). enabled_modules is intersected in code with the modules available to the vendor family — an override can never enable a module the category does not offer. Operational config only, no money/PII. RLS: vendor read+write own booked events (current_vendor_booked_event_ids ∩ current_vendor_profile_ids); admin read.';

-- RLS AT CREATE TIME.
ALTER TABLE public.vendor_dayof_configs ENABLE ROW LEVEL SECURITY;

-- Vendor: READ their own org's configs.
DROP POLICY IF EXISTS vendor_dayof_configs_vendor_read ON public.vendor_dayof_configs;
CREATE POLICY vendor_dayof_configs_vendor_read
  ON public.vendor_dayof_configs FOR SELECT TO authenticated
  USING (vendor_profile_id IN (SELECT public.current_vendor_profile_ids()));

-- Vendor: INSERT an override only on events they're BOOKED on, for their OWN
-- profile. Mirrors booking_handovers_vendor_insert.
DROP POLICY IF EXISTS vendor_dayof_configs_vendor_insert ON public.vendor_dayof_configs;
CREATE POLICY vendor_dayof_configs_vendor_insert
  ON public.vendor_dayof_configs FOR INSERT TO authenticated
  WITH CHECK (
    event_id IN (SELECT public.current_vendor_booked_event_ids())
    AND vendor_profile_id IN (SELECT public.current_vendor_profile_ids())
  );

-- Vendor: UPDATE their own override (re-config). Same gate on both sides.
DROP POLICY IF EXISTS vendor_dayof_configs_vendor_update ON public.vendor_dayof_configs;
CREATE POLICY vendor_dayof_configs_vendor_update
  ON public.vendor_dayof_configs FOR UPDATE TO authenticated
  USING (vendor_profile_id IN (SELECT public.current_vendor_profile_ids()))
  WITH CHECK (
    event_id IN (SELECT public.current_vendor_booked_event_ids())
    AND vendor_profile_id IN (SELECT public.current_vendor_profile_ids())
  );

-- Admin: read all (support / audit).
DROP POLICY IF EXISTS vendor_dayof_configs_admin_read ON public.vendor_dayof_configs;
CREATE POLICY vendor_dayof_configs_admin_read
  ON public.vendor_dayof_configs FOR SELECT TO authenticated
  USING (public.is_admin());

COMMIT;
