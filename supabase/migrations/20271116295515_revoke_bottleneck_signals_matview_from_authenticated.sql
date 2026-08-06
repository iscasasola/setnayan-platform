-- revoke_bottleneck_signals_matview_from_authenticated
-- ============================================================================
-- THE INTERNAL-NUMBERS LEAK: every signed-in account could read the company's
-- operating dashboard.
-- ============================================================================
--
-- `public.bottleneck_signals_current` is the materialized view behind the
-- Hiring Predictive Guide. One row, and it holds:
--
--   verification_backlog_count   how many vendors are stuck waiting on us
--   support_avg_response_hours   how slow support currently is
--   signups_last_week            vendor signups, this week and last
--   signups_prior_week
--   open_disputes                open force-majeure / dispute count
--   verified_active              total verified-active vendors
--
-- Its defining migration (20260523000000) wrote:
--
--   REVOKE ALL ON public.bottleneck_signals_current FROM anon, authenticated;
--   GRANT SELECT ON public.bottleneck_signals_current TO authenticated;
--
-- The three sibling TABLES in that same migration (owner_alerts,
-- founder_time_log, hiring_roadmap) are each protected by an owner-only RLS
-- policy. The matview is not, and cannot be: **a materialized view does not
-- honour row-level security.** There is no policy to write. The GRANT *is* the
-- access control, and it was open to every authenticated principal.
--
-- Supabase publishes matviews through PostgREST, so this was one authenticated
-- GET away for any couple, vendor, guest or coordinator with an account —
-- confirmed live in prod today (relacl `authenticated=r/postgres`).
--
-- REVOKING COSTS NOTHING. The only readers are
-- apps/web/lib/hiring-guide/queries.ts → getBottleneckSignals() and
-- refreshBottleneckSignalsIfStale(), and both build their client with
-- createAdminClient() — the service_role key, which is unaffected by this file.
-- The only surface that calls them, /admin/app-performance (operations tab),
-- runs them server-side. Verified by grepping every reference to the view name
-- and to both function names across apps/web on 2026-08-06.
--
-- Idempotent: REVOKE of a privilege already absent is a no-op.
-- ============================================================================

REVOKE ALL ON public.bottleneck_signals_current FROM PUBLIC, anon, authenticated;

-- service_role keeps its grant (it is the only reader). Named explicitly so a
-- future `REFRESH MATERIALIZED VIEW` path cannot be broken by this file.
GRANT SELECT ON public.bottleneck_signals_current TO service_role;

COMMENT ON MATERIALIZED VIEW public.bottleneck_signals_current IS
  'Hourly-refreshed bottleneck signals powering the Hiring Predictive Guide dashboard. INTERNAL ONLY — service_role reads it; `authenticated` was revoked 2026-08-06 because a matview cannot carry RLS, so the GRANT is the whole access control. Refresh via REFRESH MATERIALIZED VIEW CONCURRENTLY public.bottleneck_signals_current.';
