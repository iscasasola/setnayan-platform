import { NextResponse, type NextRequest } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { runSeoHealthChecks, type CatalogRow } from '@/lib/seo/health-checks';

// Daily SEO/GEO health audit (owner Q 2026-07-10).
//
// GET/POST /api/cron/seo-health
// Auth: `Authorization: Bearer <CRON_SECRET>` (Vercel Cron) OR
//   `x-cron-secret: <CRON_SECRET>` (manual). Timing-safe, fail-closed:
//   an unset CRON_SECRET → 403.
//
// Fetches the LIVE served llms.txt + the live service_catalog and runs the
// pure health checks, then writes ONE seo_health_snapshots row. This is the
// standing, automated form of SEO_GEO_UPDATE_2026-07-10.md §3's manual
// reconciliation — a repriced SKU or a deleted route that leaves stale copy in
// the AI-crawler surface now surfaces on /admin/seo the next morning instead of
// silently feeding every LLM a wrong answer.

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const APP_URL = (process.env.NEXT_PUBLIC_APP_URL ?? 'https://www.setnayan.com').replace(/\/+$/, '');

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

function authorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false; // fail-closed
  const bearer = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '') ?? '';
  const header = req.headers.get('x-cron-secret') ?? '';
  return timingSafeEqual(bearer, secret) || timingSafeEqual(header, secret);
}

function orgSameAs(): string[] {
  // Comma-separated FB/LinkedIn/etc. profile URLs, once the owner creates them.
  return (process.env.SETNAYAN_ORG_SAMEAS ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

async function run(req: NextRequest): Promise<NextResponse> {
  if (!authorized(req)) {
    return NextResponse.json({ ok: false, error: 'forbidden' }, { status: 403 });
  }

  // Live AI-crawler surface (tests the real served file, not a repo copy).
  let llmsText = '';
  try {
    const res = await fetch(`${APP_URL}/llms.txt`, { cache: 'no-store' });
    if (res.ok) llmsText = await res.text();
  } catch {
    // fall through — an empty body makes every price look "missing", which is
    // itself a visible fail on the dashboard rather than a silent skip.
  }

  const admin = createAdminClient();
  const { data: catalog } = await admin
    .from('service_catalog')
    .select('sku_code, display_name, price_centavos, is_active, purchaser_role');

  const result = runSeoHealthChecks({
    llmsText,
    catalog: (catalog ?? []) as CatalogRow[],
    env: {
      googleSiteVerification: process.env.GOOGLE_SITE_VERIFICATION,
      bingSiteVerification: process.env.BING_SITE_VERIFICATION,
      orgSameAs: orgSameAs(),
    },
  });

  const { error } = await admin.from('seo_health_snapshots').insert({
    ok_count: result.counts.ok,
    warn_count: result.counts.warn,
    fail_count: result.counts.fail,
    findings: result.findings,
    price_drift: result.priceDrift,
    generated_by: 'cron',
  });
  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, counts: result.counts, drift: result.priceDrift.length });
}

export async function POST(req: NextRequest) {
  return run(req);
}
export async function GET(req: NextRequest) {
  return run(req);
}
