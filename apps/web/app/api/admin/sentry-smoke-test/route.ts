/**
 * POST /api/admin/sentry-smoke-test
 *
 * Owner-initiated controlled error trigger for verifying Sentry capture +
 * alert routing in production. Punch-list item #19e (open since 2026-05-20
 * per CLAUDE.md row 441 / OWNER_ACTIONS Phase 6).
 *
 * Shape per Task #5 spec:
 *   - POST only — prevents accidental triggers from URL paste / link
 *     previews / Vercel deployment-preview crawlers. GET returns 405.
 *   - Returns 200 with { ok: true, throwingIn: 100 } IMMEDIATELY so the
 *     caller's fetch sees a clean response, then throws after 100ms via
 *     setTimeout so Sentry's Node SDK captures the unhandled rejection
 *     out-of-band from the response cycle.
 *   - Captures with Sentry.captureException + structured tags:
 *       transaction: 'smoke-test'
 *       level: 'error'
 *       tags: { source: 'manual-smoke-test', initiated_by: <user_email> }
 *   - Auth via standard pattern: 401 if not signed in, 403 if not admin.
 *     Distinct from the existing GET /api/admin/smoke-test which 404s to
 *     hide endpoint existence — this POST endpoint is documented in
 *     OWNER_ACTIONS so leakage is fine; honest status codes are clearer
 *     for owner verification.
 *
 * Companion endpoint: GET /api/admin/smoke-test?type=sentry — the older
 * GET-based shape from the existing smoke-test panel. Kept alongside for
 * backwards-compat with the operations-hiring panel.
 *
 * Note on the path: Next.js App Router treats folder names with leading
 * underscore as PRIVATE folders (not routable). Task spec called for
 * `/api/_admin/...` but that path would not exist as a route. Using
 * `/api/admin/sentry-smoke-test/` honors the spec intent (admin-gated,
 * not on the public surface) while creating a real route.
 */

import { NextResponse, type NextRequest } from 'next/server';
import * as Sentry from '@sentry/nextjs';
import { randomBytes } from 'node:crypto';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Generate an 8-char lowercase trace ID. Node's crypto is already a
// dependency — no need to pull in nanoid.
function traceId(): string {
  return randomBytes(4).toString('hex'); // 8 hex chars
}

export async function POST(_req: NextRequest): Promise<NextResponse> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Not signed in.' }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from('users')
    .select('account_type, is_internal, is_team_member, email')
    .eq('user_id', user.id)
    .maybeSingle();

  const isAdmin =
    profile?.is_internal ||
    profile?.is_team_member ||
    profile?.account_type === 'admin';
  if (!isAdmin) {
    return NextResponse.json({ error: 'Admin only.' }, { status: 403 });
  }

  const id = traceId();
  const initiatedBy = profile?.email ?? user.email ?? user.id;
  const message = `Sentry smoke test — ${id} — owner-initiated controlled error`;

  // Schedule the throw OUTSIDE the response cycle so the caller gets a
  // clean 200 back. Sentry's Node SDK catches the unhandled rejection.
  // We use captureException directly with the structured tags + level
  // the spec requires, then ALSO throw (defense in depth — if Sentry is
  // misconfigured to ignore captureException, the unhandled error still
  // surfaces via the Node runtime hook).
  setTimeout(() => {
    const err = new Error(message);
    Sentry.withScope((scope) => {
      scope.setTransactionName('smoke-test');
      scope.setLevel('error');
      scope.setTag('source', 'manual-smoke-test');
      scope.setTag('initiated_by', initiatedBy);
      scope.setExtra('trace_id', id);
      scope.setExtra('initiated_by_user_id', user.id);
      scope.setExtra('triggered_at', new Date().toISOString());
      Sentry.captureException(err);
    });
    // Also throw so the Node runtime's unhandled-rejection hook fires.
    // Sentry's auto-instrumentation has a separate capture path for that
    // which is what production-runtime errors actually exercise.
    console.error(`[sentry-smoke-test] ${message}`);
    throw err;
  }, 100);

  return NextResponse.json({
    ok: true,
    throwingIn: 100,
    traceId: id,
    initiatedBy,
    hint: 'Check Sentry dashboard within 60s. Search by trace_id or message text.',
  });
}

// Explicit 405 on GET — prevents accidental triggers from URL paste,
// link previews, or Vercel preview-deploy crawlers. The existing
// GET /api/admin/smoke-test?type=sentry endpoint serves the older
// shape if it's wanted.
export async function GET(): Promise<NextResponse> {
  return NextResponse.json(
    {
      error: 'method_not_allowed',
      message: 'POST only. This endpoint throws a controlled error for Sentry capture verification. Use POST from /admin/settings → System health.',
    },
    { status: 405, headers: { Allow: 'POST' } },
  );
}
