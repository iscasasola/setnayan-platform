import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { isAdminProfile, isDemoMode } from '@/lib/demo-mode';
import {
  fetchGrowthStats,
  buildDemoGrowthStats,
  type GrowthRangeKey,
} from '@/lib/admin/growth-stats';
import { toCsv } from '@/lib/admin/growth-csv';

/**
 * GET /admin/growth/export?range=3m|6m|12m[&demo=1]
 *
 * CSV export of the admin Growth surface. Route handlers are NOT covered by the
 * /admin layout's admin guard, so we re-check admin here and 404 (not 403) for
 * everyone else to avoid leaking the endpoint's existence. Honors the same demo
 * flag the page uses, so "what you see is what you export."
 *
 * Output is tidy/long format (one fact per row: section,series,period,value) so
 * it imports cleanly into any spreadsheet without mixed-width sections.
 */

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function parseRange(raw: string | null): GrowthRangeKey {
  return raw === '3m' || raw === '6m' || raw === '12m' ? raw : '6m';
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return new NextResponse('Not found', { status: 404 });

  const { data: profile } = await supabase
    .from('users')
    .select('account_type, is_internal, is_team_member')
    .eq('user_id', user.id)
    .maybeSingle();
  if (!isAdminProfile(profile)) return new NextResponse('Not found', { status: 404 });

  const range = parseRange(request.nextUrl.searchParams.get('range'));
  const demo = isDemoMode(request, profile);
  const stats = demo ? buildDemoGrowthStats(range) : await fetchGrowthStats(range);

  const csv = toCsv(stats);
  const filename = `setnayan-growth-${stats.range}-${stats.generatedAtIso.slice(
    0,
    10,
  )}${demo ? '-demo' : ''}.csv`;

  return new NextResponse(csv, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'no-store',
    },
  });
}
