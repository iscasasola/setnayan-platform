import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { generateQuarter } from '@/lib/bir/generator';
import { quarterThatJustEnded } from '@/lib/bir/filings';

/**
 * POST /api/admin/cron/generate-2307
 *
 * Two callers:
 *
 *   1. Supabase pg_cron (via `net.http_post`, scheduled at 02:00 PHT on
 *      the 1st of Jan/Apr/Jul/Oct). Authenticates by sending the
 *      `X-Cron-Secret` header. The migration sets the schedule to use
 *      `current_setting('app.cron_secret', true)` so the secret is
 *      stored once in the database session and rotated centrally.
 *
 *   2. Admin manual trigger from /admin/bir/2307 — POST with an admin
 *      session cookie. The endpoint validates the admin user and
 *      optionally accepts `?year=` / `?quarter=` query params so an
 *      admin can backfill or regenerate any prior quarter.
 *
 * Response: JSON summary {period, vendor_count, generated, skipped_no_ewt,
 * errors, filings}. 200 on success, 401 on auth failure, 500 on
 * pipeline error.
 *
 * Idempotent: regenerating an already-generated quarter UPDATEs the
 * existing rows in place, bumps regenerated_count, and appends to the
 * audit_log.
 */

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type AuthResult =
  | { ok: true; via: 'cron'; admin_user_id: null }
  | { ok: true; via: 'admin'; admin_user_id: string }
  | { ok: false; status: number; message: string };

async function authenticate(req: NextRequest): Promise<AuthResult> {
  // 1) Cron path — X-Cron-Secret header.
  const cronSecret = req.headers.get('x-cron-secret');
  const expected = process.env.CRON_SECRET;
  if (expected && cronSecret && timingSafeEqual(cronSecret, expected)) {
    return { ok: true, via: 'cron', admin_user_id: null };
  }

  // 2) Admin path — Supabase session cookie + is_admin/is_internal/is_team_member.
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) {
    const { data: profile } = await supabase
      .from('users')
      .select('account_type,is_internal,is_team_member')
      .eq('user_id', user.id)
      .maybeSingle();
    const isAdmin =
      profile?.is_internal ||
      profile?.is_team_member ||
      profile?.account_type === 'admin';
    if (isAdmin) {
      return { ok: true, via: 'admin', admin_user_id: user.id };
    }
  }

  return {
    ok: false,
    status: 401,
    message:
      'Unauthorized. Provide X-Cron-Secret header (cron) or sign in as admin (manual trigger).',
  };
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

function parseQuarterParams(req: NextRequest): {
  year: number;
  quarter: 1 | 2 | 3 | 4;
} {
  const yearParam = req.nextUrl.searchParams.get('year');
  const quarterParam = req.nextUrl.searchParams.get('quarter');
  if (yearParam && quarterParam) {
    const y = Number.parseInt(yearParam, 10);
    const q = Number.parseInt(quarterParam, 10);
    if (
      Number.isFinite(y) &&
      Number.isFinite(q) &&
      y >= 2024 &&
      y <= 2100 &&
      q >= 1 &&
      q <= 4
    ) {
      return { year: y, quarter: q as 1 | 2 | 3 | 4 };
    }
  }
  const period = quarterThatJustEnded(new Date());
  return { year: period.tax_year, quarter: period.tax_quarter };
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const auth = await authenticate(req);
  if (!auth.ok) {
    return NextResponse.json(
      { error: auth.message },
      { status: auth.status },
    );
  }

  const { year, quarter } = parseQuarterParams(req);
  const admin = createAdminClient();

  try {
    const result = await generateQuarter({
      admin,
      year,
      quarter,
      triggered_by_admin_id: auth.via === 'admin' ? auth.admin_user_id : null,
    });
    return NextResponse.json(
      {
        ok: true,
        triggered_by: auth.via,
        year,
        quarter,
        ...result,
      },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('[api/admin/cron/generate-2307] failed:', message);
    return NextResponse.json(
      { ok: false, error: message },
      { status: 500 },
    );
  }
}

/**
 * GET for sanity — returns metadata so an operator can sanity-check the
 * route is wired without firing a real run.
 */
export async function GET(): Promise<NextResponse> {
  const period = quarterThatJustEnded(new Date());
  return NextResponse.json(
    {
      route: '/api/admin/cron/generate-2307',
      method: 'POST',
      next_quarter_that_would_be_generated: period,
      auth: 'X-Cron-Secret header OR admin session',
      schedule: '0 18 1 1,4,7,10 * (UTC) — 02:00 PHT on Jan/Apr/Jul/Oct 1',
    },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}
