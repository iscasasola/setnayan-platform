import { NextResponse, type NextRequest } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { gscConfigured, pullSearchConsole } from '@/lib/seo/search-console';

// Daily Google Search Console pull (owner Q 2026-07-10).
//
// GET/POST /api/cron/seo-gsc
// Auth: `Authorization: Bearer <CRON_SECRET>` OR `x-cron-secret`. Fail-closed.
//
// Upserts the last ~14 days of daily totals + the window's top queries into
// seo_metrics for the /admin/seo trend panel. If the GSC creds aren't set yet
// (owner action #1 in SEO_GEO_UPDATE_2026-07-10.md §7) the pull is SKIPPED
// cleanly — the cron returns ok:true with skipped:'gsc not configured' rather
// than erroring, so it's safe to wire the schedule before the creds land.

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

function authorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const bearer = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '') ?? '';
  const header = req.headers.get('x-cron-secret') ?? '';
  return timingSafeEqual(bearer, secret) || timingSafeEqual(header, secret);
}

async function run(req: NextRequest): Promise<NextResponse> {
  if (!authorized(req)) {
    return NextResponse.json({ ok: false, error: 'forbidden' }, { status: 403 });
  }
  if (!gscConfigured()) {
    return NextResponse.json({ ok: true, skipped: 'gsc not configured' });
  }

  let pull;
  try {
    pull = await pullSearchConsole(14);
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : 'gsc pull failed' },
      { status: 502 },
    );
  }

  const admin = createAdminClient();
  // The whole-window top queries are stamped onto the most recent day's row so
  // the dashboard has one "current top queries" list without a second table.
  const latestDate = pull.days.reduce<string | null>(
    (max, d) => (max === null || d.metricDate > max ? d.metricDate : max),
    null,
  );

  const rows = pull.days.map((d) => ({
    source: 'gsc' as const,
    metric_date: d.metricDate,
    clicks: d.clicks,
    impressions: d.impressions,
    ctr: d.ctr,
    avg_position: d.avgPosition,
    top_queries: d.metricDate === latestDate ? pull.topQueries : [],
    captured_at: new Date().toISOString(),
  }));

  const { error } = await admin
    .from('seo_metrics')
    .upsert(rows, { onConflict: 'source,metric_date' });
  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, days: rows.length, topQueries: pull.topQueries.length });
}

export async function POST(req: NextRequest) {
  return run(req);
}
export async function GET(req: NextRequest) {
  return run(req);
}
