-- Foundation for the "Maria & Jose" public sample/showcase event (Phase 1).
--
-- Two additive, demo-isolation flags so the canonical sample experience is
-- independently identifiable and can NEVER leak into a real launch:
--
--   1. events.is_sample          — marks the canonical showcase event(s) (Maria
--      & Jose). Must be excluded from real-event stats + never billed; drives
--      the curated read-only tour entry.
--
--   2. vendor_services.is_demo   — until now a service was "demo" ONLY by its
--      parent vendor (vendor_profiles.is_demo). This flags the SERVICE directly
--      (owner requirement 2026-06-20: "the vendors here and the services here
--      will be marked as demo") so exclusion + cleanup can key on the service
--      itself, and a service can never be demo-by-accident.
--
--   3. vendor_services.demo_batch_id — groups demo services per seed run for
--      one-click cleanup. Mirrors vendor_profiles.demo_batch_id.
--
-- Backfills is_demo + demo_batch_id onto every existing demo vendor's services.
-- Fully idempotent (IF NOT EXISTS + guarded UPDATE). RLS is unchanged — these
-- are columns on existing RLS-enabled tables, covered by their current policies.
--
-- Rollback:
--   ALTER TABLE public.vendor_services DROP COLUMN IF EXISTS demo_batch_id, DROP COLUMN IF EXISTS is_demo;
--   DROP INDEX IF EXISTS public.vendor_services_is_demo_idx;
--   ALTER TABLE public.events DROP COLUMN IF EXISTS is_sample;
--   DROP INDEX IF EXISTS public.events_is_sample_idx;

-- 1. events.is_sample ────────────────────────────────────────────────────────
ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS is_sample BOOLEAN NOT NULL DEFAULT FALSE;

COMMENT ON COLUMN public.events.is_sample IS
  'TRUE on the canonical public showcase event(s) (Maria & Jose). Drives the curated read-only tour; must be excluded from real-event stats and never billed.';

CREATE INDEX IF NOT EXISTS events_is_sample_idx
  ON public.events (is_sample) WHERE is_sample = TRUE;

-- 2 + 3. vendor_services demo flags (mirror vendor_profiles) ──────────────────
ALTER TABLE public.vendor_services
  ADD COLUMN IF NOT EXISTS is_demo BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS demo_batch_id UUID;

COMMENT ON COLUMN public.vendor_services.is_demo IS
  'TRUE on services belonging to demo/sample vendors. Mirrors vendor_profiles.is_demo so a service is independently identifiable as demo, not only via its parent vendor.';
COMMENT ON COLUMN public.vendor_services.demo_batch_id IS
  'Seed-batch id grouping demo services for one-click cleanup. Mirrors vendor_profiles.demo_batch_id.';

CREATE INDEX IF NOT EXISTS vendor_services_is_demo_idx
  ON public.vendor_services (is_demo) WHERE is_demo = TRUE;

-- Backfill: every service of an existing demo vendor inherits is_demo + the
-- parent vendor's demo_batch_id. Guarded so re-runs are no-ops.
UPDATE public.vendor_services vs
SET is_demo = TRUE,
    demo_batch_id = vp.demo_batch_id
FROM public.vendor_profiles vp
WHERE vs.vendor_profile_id = vp.vendor_profile_id
  AND vp.is_demo = TRUE
  AND vs.is_demo = FALSE;
