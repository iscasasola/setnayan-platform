-- vendor_profile_views_funnel
-- Wave 6 "Soon" vendor benefit — Quote-to-Booking Funnel.
--
-- Adds the MISSING top-of-funnel stage: VIEWS. The other three stages already
-- have data —
--   INQUIRIES = chat_threads (one per couple→vendor inquiry)
--   QUOTES    = vendor_proposals (status sent/viewed/accepted)
--   BOOKED    = event_vendors.status (contracted+) / vendor_activity_stats
-- — but a public-profile VIEW was never tracked anywhere. This table is that
-- record.
--
-- BEHAVIORAL-DATA LOCK (project_setnayan_behavioral_data_edge):
--   • First-party Postgres only (never a 3rd-party analytics SaaS).
--   • The viewer is stored HASHED — viewer_hash = sha256(salt || viewer-id).
--     We NEVER store the raw user_id (or raw session id) on this table, so a
--     view row can't be tied back to an identifiable person.
--   • Vendor-facing reads are AGGREGATE + minimum-N suppressed via
--     public.min_n_ok(count, floor) at the app layer — a thin slice can't
--     re-identify a viewer or read as a reliable trend.
--   • Capture is fire-and-forget via Next 15 after() (cron-free · never blocks
--     the page render). The INSERT runs on the service-role admin client inside
--     the server action, so anon/authenticated callers get NO direct INSERT
--     grant on the table (the RLS below is read-only for them).
--
-- RLS AT CREATE TIME with canonical helpers (current_vendor_profile_ids,
-- is_admin). Idempotent + re-run safe.

BEGIN;

-- ----------------------------------------------------------------------------
-- 1 · TABLE
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.vendor_profile_views (
  view_id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_profile_id UUID NOT NULL REFERENCES public.vendor_profiles(vendor_profile_id) ON DELETE CASCADE,
  -- Optional couple-event context — set when a signed-in couple with an active
  -- event views the profile, so the funnel can attribute a view to the source
  -- axis. NULL for anonymous / event-less views.
  event_id          UUID REFERENCES public.events(event_id) ON DELETE SET NULL,
  -- Where the view came from — mirrors the event_vendors.source vocabulary so
  -- the funnel can be sliced by the same axis ('profile_direct', 'explore_card',
  -- 'auto_cascade_from_finalize', …). Free-text TEXT (not an enum) to stay
  -- forward-compatible with new entry points without a migration.
  source            TEXT,
  -- Raw UTM string (e.g. "utm_source=fb&utm_campaign=launch") when the landing
  -- URL carried campaign params. Opaque — kept as-is for later parsing. No PII.
  utm               TEXT,
  -- HASHED viewer id — sha256(salt || (user_id OR anon session id)). NEVER the
  -- raw id. De-duplication / unique-viewer counts run on this hash so identity
  -- never lands on the row. Nullable (a hash failure or a salt-less env degrades
  -- to an anonymous, un-deduped view rather than dropping the row).
  viewer_hash       TEXT,
  viewed_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.vendor_profile_views IS
  'Wave 6 Quote-to-Booking Funnel — the VIEWS stage. One row per public vendor-profile view (best-effort, captured via Next after()). Viewer is stored HASHED (sha256(salt||id)), never the raw user/session id, per the behavioral-data first-party + de-identified lock. Vendor reads are aggregate + min-N suppressed.';
COMMENT ON COLUMN public.vendor_profile_views.viewer_hash IS
  'sha256(VIEWER_HASH_SALT || viewer-id) — de-identified. The raw user_id / anon session id is NEVER stored. Used for unique-viewer counts only.';
COMMENT ON COLUMN public.vendor_profile_views.source IS
  'Entry point for the view — mirrors event_vendors.source vocabulary (profile_direct, explore_card, …) so the funnel slices on the same axis.';

-- ----------------------------------------------------------------------------
-- 2 · INDEX — (vendor_profile_id, viewed_at) covers the per-vendor windowed
--     aggregate count the funnel runs, in descending time order.
-- ----------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS vendor_profile_views_vendor_time_idx
  ON public.vendor_profile_views (vendor_profile_id, viewed_at DESC);

-- ----------------------------------------------------------------------------
-- 3 · RLS AT CREATE TIME
-- ----------------------------------------------------------------------------
ALTER TABLE public.vendor_profile_views ENABLE ROW LEVEL SECURITY;

-- Vendor: READ rows for their OWN profile(s) only. The funnel surface reads
-- these and applies min-N suppression at the app layer before showing any
-- aggregate. (current_vendor_profile_ids spans the owner + admin-rank team
-- members of the vendor org.)
DROP POLICY IF EXISTS vendor_profile_views_vendor_read ON public.vendor_profile_views;
CREATE POLICY vendor_profile_views_vendor_read
  ON public.vendor_profile_views FOR SELECT TO authenticated
  USING (vendor_profile_id IN (SELECT public.current_vendor_profile_ids()));

-- Admin: READ everything (powers the /admin/funnels per-vendor drill-down).
DROP POLICY IF EXISTS vendor_profile_views_admin_read ON public.vendor_profile_views;
CREATE POLICY vendor_profile_views_admin_read
  ON public.vendor_profile_views FOR SELECT TO authenticated
  USING (public.is_admin());

-- No INSERT / UPDATE / DELETE policy for anon or authenticated on purpose:
-- writes only ever happen through the service-role admin client inside the
-- recordVendorProfileView() server action (after()), which bypasses RLS. A
-- normal session can therefore READ its own aggregate but can never forge or
-- tamper with view rows.

COMMIT;

-- ----------------------------------------------------------------------------
-- DRY-RUN VERIFICATION (run manually; not part of the applied migration):
--   BEGIN;
--   \i supabase/migrations/20270323312048_vendor_profile_views_funnel.sql
--   ROLLBACK;
-- ----------------------------------------------------------------------------
