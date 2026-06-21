-- ============================================================================
-- Named Calendars — Phase A: vendor-named calendars + service-level membership
-- (owner-chosen 2026-06-20 · design: Named_Calendars_Rework_Design_2026-06-20.md)
-- ============================================================================
--
-- WHY: today a vendor's schedule is an AUTO per-(vendor_profile_id, leaf-category)
-- pool. The owner wants vendor-NAMED calendars where the vendor picks WHICH
-- SERVICES a calendar covers. This phase is PURELY ADDITIVE + flag-gated
-- (NEXT_PUBLIC_NAMED_CALENDARS_ENABLED, default OFF) — production behaves
-- identically until the flag flips.
--
-- SAFETY (the whole point): a "calendar" IS a vendor_schedule_pools row — that
-- table, daily_booking_capacity, vendor_schedule_pool_bookings, and the
-- acquire/release SECURITY DEFINER RPCs are UNCHANGED. We only add (1) a
-- vendor-owned name on the pool and (2) an explicit service→pool membership
-- table, then backfill so every service maps to the EXACT pool it resolves to
-- today. Because pool_ids never move, no booking row is touched and
-- double-booking stays impossible. The old category→pool path
-- (vendor_schedule_pool_categories) stays fully live as the flag-off path AND
-- the flag-on fallback for unassigned services (owner decision: an unassigned
-- service stays bookable via its category pool).
--
-- OWNER DECISIONS baked in (2026-06-20):
--   • One calendar per service  → PK(vendor_service_id) on the membership table.
--   • Unassigned service stays bookable → resolver falls back to category pool
--     (handled app-side in resolvePoolIdsForService; the category map is kept).
--   • "Merge" replaced by the service-picker → no schema change here; the
--     existing merged pools simply become named calendars with their services
--     already attached (backfill below). Merge-UI removal lands with the UI PR.
-- ============================================================================

BEGIN;

-- 1. A vendor-owned NAME on the pool (decoupled from category_key) + a marker
--    distinguishing vendor-created calendars from auto-spawned category pools.
ALTER TABLE public.vendor_schedule_pools
  ADD COLUMN IF NOT EXISTS calendar_name TEXT
    CHECK (calendar_name IS NULL OR length(calendar_name) <= 80);
ALTER TABLE public.vendor_schedule_pools
  ADD COLUMN IF NOT EXISTS is_vendor_created BOOLEAN NOT NULL DEFAULT FALSE;

-- 2. Explicit service → calendar (pool) membership. PK(vendor_service_id) =
--    a service belongs to exactly ONE calendar (owner decision 2026-06-20).
CREATE TABLE IF NOT EXISTS public.vendor_schedule_calendar_services (
  vendor_service_id  UUID PRIMARY KEY
                     REFERENCES public.vendor_services(vendor_service_id)
                     ON DELETE CASCADE,
  pool_id            UUID NOT NULL
                     REFERENCES public.vendor_schedule_pools(pool_id)
                     ON DELETE CASCADE,
  vendor_profile_id  UUID NOT NULL
                     REFERENCES public.vendor_profiles(vendor_profile_id)
                     ON DELETE CASCADE,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS vendor_schedule_calendar_services_pool_idx
  ON public.vendor_schedule_calendar_services(pool_id);
CREATE INDEX IF NOT EXISTS vendor_schedule_calendar_services_profile_idx
  ON public.vendor_schedule_calendar_services(vendor_profile_id);

ALTER TABLE public.vendor_schedule_calendar_services ENABLE ROW LEVEL SECURITY;

-- RLS mirrors vendor_schedule_pool_categories verbatim (owner FOR ALL on own
-- profiles; public SELECT for published vendors).
DROP POLICY IF EXISTS vendor_schedule_calendar_services_owner ON public.vendor_schedule_calendar_services;
CREATE POLICY vendor_schedule_calendar_services_owner
  ON public.vendor_schedule_calendar_services FOR ALL
  TO authenticated
  USING (
    vendor_profile_id IN (
      SELECT vendor_profile_id FROM public.vendor_profiles
      WHERE user_id = auth.uid()
    )
  )
  WITH CHECK (
    vendor_profile_id IN (
      SELECT vendor_profile_id FROM public.vendor_profiles
      WHERE user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS vendor_schedule_calendar_services_public_read ON public.vendor_schedule_calendar_services;
CREATE POLICY vendor_schedule_calendar_services_public_read
  ON public.vendor_schedule_calendar_services FOR SELECT
  TO authenticated
  USING (
    vendor_profile_id IN (
      SELECT vendor_profile_id FROM public.vendor_profiles
      WHERE is_published = TRUE
    )
  );

COMMENT ON TABLE public.vendor_schedule_calendar_services IS
  'Service → named-calendar (pool) membership (Named Calendars rework, owner 2026-06-20). PK(vendor_service_id) = one calendar per service. Resolution: resolvePoolIdsForService reads this when NEXT_PUBLIC_NAMED_CALENDARS_ENABLED, falling back to the category pool (vendor_schedule_pool_categories) for an unassigned service. The pool IS the schedulable resource (capacity + acquire RPC unchanged).';

-- ── BACKFILL (idempotent) ───────────────────────────────────────────────────

-- 3. Name every existing pool. For merged pools (multiple category rows → one
--    pool) join the category keys so the calendar keeps a representative label;
--    the vendor renames it later. Raw category keys are fine as a seed name.
UPDATE public.vendor_schedule_pools p SET calendar_name =
  COALESCE(
    NULLIF((
      SELECT string_agg(c.category_key, ' · ' ORDER BY c.category_key)
      FROM public.vendor_schedule_pool_categories c
      WHERE c.pool_id = p.pool_id
    ), ''),
    NULLIF(p.pool_label, ''),
    'Schedule'
  )
WHERE p.calendar_name IS NULL;

-- 4. Pin every service to the EXACT pool it resolves to today, via the live
--    category map. ON CONFLICT DO NOTHING = idempotent + re-runnable. A service
--    whose category has no pool row yet (lazy-create never fired) gets no row
--    here and is resolved on demand by the app fallback.
INSERT INTO public.vendor_schedule_calendar_services (vendor_service_id, pool_id, vendor_profile_id)
SELECT vs.vendor_service_id, pc.pool_id, vs.vendor_profile_id
FROM public.vendor_services vs
JOIN public.vendor_schedule_pool_categories pc
  ON pc.vendor_profile_id = vs.vendor_profile_id
 AND pc.category_key      = vs.category
ON CONFLICT (vendor_service_id) DO NOTHING;

COMMIT;

-- ── POST-APPLY CONSERVATION CHECK (run manually before flipping the flag) ────
-- Every live booking's pool must stay reachable from a calendar-service row OR a
-- category row for the same vendor; a non-empty result = an orphan to fix before
-- enabling the flag for that vendor (no booking is ever rewritten):
--
--   SELECT b.pool_id, b.event_vendor_id
--   FROM public.vendor_schedule_pool_bookings b
--   WHERE b.released_at IS NULL
--     AND NOT EXISTS (
--       SELECT 1 FROM public.vendor_schedule_calendar_services s WHERE s.pool_id = b.pool_id
--     )
--     AND NOT EXISTS (
--       SELECT 1 FROM public.vendor_schedule_pool_categories c WHERE c.pool_id = b.pool_id
--     );
