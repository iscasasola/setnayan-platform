import { type NextRequest, NextResponse } from 'next/server';
import { rateLimit } from '@/lib/rate-limit';
import { cspViolationSummary } from '@/lib/csp-report';
import { createAdminClient } from '@/lib/supabase/admin';

/**
 * POST /api/csp-report — the sink for `Content-Security-Policy-Report-Only`.
 *
 * WHY THIS EXISTS. `next.config.ts` has shipped `frame-ancestors`-only CSP with a
 * documented deferral: a real `default-src`/`script-src` "would have to enumerate
 * every external origin we load (Supabase · Sentry ingest · PostHog · R2 · Maya ·
 * YouTube · Google Fonts · Vercel)". That list is a GUESS until measured, and
 * guessing it wrong takes the site down — the same long-tail trap that made a
 * fail-closed allowlist the wrong call for `/api/upload`'s media prefixes.
 *
 * So the report-only header names the origins we *believe* we use and this route
 * collects what it actually caught. Enforcement is a LATER, owner-reviewed step
 * once the reports are boring — never a same-PR flip.
 *
 * ── PRIVACY: reports are minimised before they are recorded ─────────────────
 * A raw CSP report carries `document-uri`, `referrer` and the full
 * `blocked-uri` — which on this product means event slugs, guest tokens in query
 * strings, signed R2 URLs. The house rule is no PII in logs
 * (0035 observability · "no PII in logs · session recordings disabled"), so
 * `cspViolationSummary` keeps only the DIRECTIVE and the blocked ORIGIN
 * (scheme+host) and drops every path, query and fragment. That is the whole
 * signal needed to build an allowlist.
 *
 * ── SHAPE ───────────────────────────────────────────────────────────────────
 * Unauthenticated by necessity (browsers post these with no session), so it is
 * rate-limited per IP, size-capped, and answers 204 to everything — a report sink
 * must never become a way to probe the server. Never returns an error body.
 */
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Reports per IP per minute. A misconfigured policy can fire on every asset. */
const REPORTS_PER_MINUTE = 60;
/** A CSP report is ~1 KB; anything larger is not a report. */
const MAX_BYTES = 8 * 1024;

const noContent = () => new NextResponse(null, { status: 204 });

export async function POST(req: NextRequest) {
  try {
    const ip =
      req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
      req.headers.get('x-real-ip') ||
      'unknown';
    if (!rateLimit(`csp-report:${ip}`, REPORTS_PER_MINUTE, 60_000).ok) return noContent();

    const raw = await req.text();
    if (raw.length === 0 || raw.length > MAX_BYTES) return noContent();

    const summary = cspViolationSummary(raw);
    if (!summary) return noContent();

    // ── WHERE THE REPORT ACTUALLY LANDS (2026-08-17) ────────────────────────
    // This used to be a lone `console.warn`, under a comment claiming "Sentry
    // when configured, the platform log otherwise" — there was no Sentry call.
    // The cost was not a leak: it was that enforcement was deferred until "the
    // reports are boring", and NOTHING KEPT THE REPORTS, so the moment to
    // enforce could never arrive. Function logs roll off and nobody builds an
    // allowlist from them.
    //
    // Aggregated on the way in — one counter per
    // (directive, origin, route shape, Manila day) — because a misconfigured
    // policy fires on every asset of every page view, and raw rows would be an
    // unbounded write amplifier aimed at our own database by unauthenticated
    // traffic.
    //
    // 🔒 SERVICE ROLE, not the anonymous key. The browser posts to OUR route
    // and the route writes, so collecting reports adds nothing to the anon
    // grant surface and no anon-callable function.
    const admin = createAdminClient();
    const { error } = await admin.rpc('record_csp_violation', {
      p_directive: summary.directive,
      p_blocked_origin: summary.blockedOrigin,
      p_route_shape: summary.path,
    });

    // ⚠ SUPABASE DOES NOT THROW — it resolves with `{ error }`. A sink whose
    // write silently fails is indistinguishable from a site with no violations,
    // which is the exact false calm this whole change exists to end. So the
    // failure is loud in the log even though the response stays 204.
    if (error) {
      console.error('[csp-report] could not record violation', error.message);
    }

    // Kept alongside the write. Deliberately a WARNING, not an error: a
    // report-only violation is information, and paging on it while the
    // allowlist is still being learned would train people to mute it.
    console.warn('[csp-report-only]', summary.directive, summary.blockedOrigin, summary.path);
  } catch {
    // A malformed body is the norm here (browsers differ), never an incident.
  }
  return noContent();
}
