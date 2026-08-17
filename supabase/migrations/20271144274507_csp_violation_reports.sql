-- ============================================================================
-- Somewhere for the browser-protection reports to LAND.
--
-- ── THE STATE THIS FIXES ───────────────────────────────────────────────────
-- Measured from the live site's own headers on 2026-08-17:
--
--   content-security-policy:              frame-ancestors + frame-src ONLY
--   content-security-policy-report-only:  the wide policy, report-uri /api/csp-report
--
-- So the wide policy watches and never blocks — which is correct, and was
-- always meant to be temporary. `app/api/csp-report/route.ts` ends at a single
-- `console.warn`. Its own docblock says "Sentry when configured, the platform
-- log otherwise"; there is no Sentry call in the file. A sentence is not a
-- mechanism.
--
-- The consequence is not a leak. It is that THE MOMENT TO SWITCH REAL
-- PROTECTION ON NEVER ARRIVES BY ITSELF: enforcement was deliberately deferred
-- until "the reports are boring", and nobody can see whether they are boring,
-- because nothing keeps them. Vercel's function logs roll off and are not a
-- place anyone reviews an allowlist from.
--
-- ⛔ THIS MIGRATION DOES NOT ENFORCE ANYTHING. Enforcing a policy learned from
-- nothing breaks live pages — our own frame policy blocked our own map for
-- weeks. This only builds the evidence. Tightening is a separate, later,
-- owner-reviewed decision made ON that evidence.
--
-- ── WHY AGGREGATED, NOT RAW ROWS ───────────────────────────────────────────
-- A misconfigured policy fires on EVERY asset of EVERY page view. Raw rows
-- would be an unbounded write amplifier pointed at our own database by
-- unauthenticated traffic. Rows here are COUNTERS, unique on
-- (directive, blocked_origin, route_shape, day) — the exact four fields an
-- allowlist is built from. Their cardinality is bounded by design: ~20 known
-- directives, a handful of origins, route SHAPES rather than URLs.
--
-- ── PRIVACY ────────────────────────────────────────────────────────────────
-- Nothing here is personal data and nothing here can become personal data.
-- `lib/csp-report.ts` minimises before this table is ever reached: the
-- directive is matched against a known set (unknown → `other`), the blocked URI
-- is reduced to scheme+host, and the document URI is reduced to a route SHAPE
-- (`/dashboard/:id/seating`, never the real URL). Ids, tokens, query strings
-- and event slugs are stripped there, not here. That satisfies the 0035
-- "no PII in logs" rule while keeping a violation locatable.
--
-- ── ACCESS ─────────────────────────────────────────────────────────────────
-- 🔒 anon is granted NOTHING on this table, deliberately and explicitly.
-- New tables in this schema do NOT arrive locked: default privileges have
-- historically handed `anon` a SELECT, which is how 306 of 383 public tables
-- came to grant it one. A REVOKE here is not ceremony — without it this table
-- would join that list on creation.
--
-- The report sink writes with the SERVICE ROLE from a server route, so no
-- anonymous grant and no anon-callable function is needed to collect reports.
-- The recording function is granted to service_role only, which is also why it
-- is NOT SECURITY DEFINER: nothing that can reach it needs elevated rights.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.csp_violation_reports (
  report_id       bigserial PRIMARY KEY,
  -- Which rule fired. Matched against a known set in the app; never free text.
  directive       text        NOT NULL,
  -- scheme+host, or a CSP keyword (`inline`, `eval`) — the most diagnostic values.
  blocked_origin  text        NOT NULL,
  -- WHERE, as a route shape. `/:slug` for anything not a known static root.
  route_shape     text        NOT NULL,
  -- The MANILA day. Computed server-side in record_csp_violation() so that a
  -- day boundary means a day here, not a day in UTC. A date column filled from
  -- a UTC instant reads as the previous day for the eight hours that matter.
  day             date        NOT NULL,
  hits            bigint      NOT NULL DEFAULT 1,
  first_seen_at   timestamptz NOT NULL DEFAULT now(),
  last_seen_at    timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT csp_violation_reports_shape_unique
    UNIQUE (directive, blocked_origin, route_shape, day)
);

COMMENT ON TABLE public.csp_violation_reports IS
  'Aggregated Content-Security-Policy report-only violations: one counter row '
  'per (directive, blocked origin, route shape, Manila day). Built 2026-08-17 '
  'because the report endpoint ended at a console.warn, so the evidence needed '
  'to tighten the policy was never kept and the moment to enforce could never '
  'arrive. Contains NO personal data by construction — see lib/csp-report.ts, '
  'which reduces the blocked URI to scheme+host and the document URI to a route '
  'shape before anything reaches this table. Read at '
  '/admin/app-performance?tab=browser-blocks. anon is granted nothing here.';

COMMENT ON COLUMN public.csp_violation_reports.day IS
  'Asia/Manila calendar day, computed in record_csp_violation(). NOT a UTC date.';

ALTER TABLE public.csp_violation_reports ENABLE ROW LEVEL SECURITY;

-- Admins read. Nobody else, at any privilege, through PostgREST.
DROP POLICY IF EXISTS csp_violation_reports_admin_read ON public.csp_violation_reports;
CREATE POLICY csp_violation_reports_admin_read
  ON public.csp_violation_reports
  FOR SELECT
  TO authenticated
  USING (public.is_admin());

-- 🔒 Explicit, because the default is NOT closed.
REVOKE ALL ON public.csp_violation_reports FROM PUBLIC;
REVOKE ALL ON public.csp_violation_reports FROM anon;
GRANT SELECT ON public.csp_violation_reports TO authenticated;

-- ── The recorder ───────────────────────────────────────────────────────────
-- One place computes the Manila day and one statement does the upsert, so the
-- conflict target can never disagree with the value that was inserted.
CREATE OR REPLACE FUNCTION public.record_csp_violation(
  p_directive      text,
  p_blocked_origin text,
  p_route_shape    text
)
RETURNS void
LANGUAGE sql
AS $$
  INSERT INTO public.csp_violation_reports
    (directive, blocked_origin, route_shape, day)
  VALUES
    (left(p_directive, 64), left(p_blocked_origin, 253), left(p_route_shape, 120),
     (now() AT TIME ZONE 'Asia/Manila')::date)
  ON CONFLICT (directive, blocked_origin, route_shape, day)
  DO UPDATE SET
    hits         = public.csp_violation_reports.hits + 1,
    last_seen_at = now();
$$;

COMMENT ON FUNCTION public.record_csp_violation(text, text, text) IS
  'Upserts one aggregated CSP report-only violation counter. Called by '
  'app/api/csp-report/route.ts with the SERVICE ROLE — deliberately NOT '
  'SECURITY DEFINER and deliberately NOT granted to anon: the browser posts to '
  'our own route, and the route writes. Adding an anon grant here would put an '
  'unauthenticated write primitive on the public RPC surface for no gain. '
  'The length caps are a write-amplification guard, not validation.';

REVOKE ALL ON FUNCTION public.record_csp_violation(text, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.record_csp_violation(text, text, text) FROM anon;
REVOKE ALL ON FUNCTION public.record_csp_violation(text, text, text) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.record_csp_violation(text, text, text) TO service_role;
