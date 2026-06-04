import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { isAdminProfile, isDemoMode } from '@/lib/demo-mode';
import {
  fetchGrowthStats,
  buildDemoGrowthStats,
  type GrowthRangeKey,
  type GrowthStats,
} from '@/lib/admin/growth-stats';

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

function cell(v: string | number): string {
  const s = String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function toCsv(stats: GrowthStats): string {
  const rows: (string | number)[][] = [['section', 'series', 'period', 'value']];
  const genDate = stats.generatedAtIso.slice(0, 10);

  rows.push(['meta', 'range', '', stats.range]);
  rows.push(['meta', 'generated_at', '', genDate]);
  rows.push(['meta', 'demo', '', String(stats.demo)]);

  const p = stats.population;
  rows.push(['population', 'account_holders', '', p.accountHolders]);
  rows.push(['population', 'customers', '', p.customers]);
  rows.push(['population', 'vendors', '', p.vendors]);
  rows.push(['population', 'vendors_published', '', p.vendorsPublished]);
  rows.push(['population', 'services', '', p.services]);
  rows.push(['population', 'services_active', '', p.servicesActive]);
  rows.push(['population', 'events', '', p.events]);
  rows.push(['population', 'guests', '', p.guests]);

  for (const s of stats.series) {
    for (const pt of s.points) {
      rows.push(['growth_cumulative', s.key, pt.at.slice(0, 10), pt.cumulative]);
    }
    for (const pt of s.points) {
      rows.push(['growth_new', s.key, pt.at.slice(0, 10), pt.added]);
    }
  }

  const c = stats.conversion;
  rows.push(['conversion', 'rate', '', c.rate.toFixed(4)]);
  rows.push(['conversion', 'converted', '', c.converted]);
  rows.push(['conversion', 'total_guests', '', c.totalGuests]);
  rows.push(['conversion', 'new_in_range', '', c.newInRange]);
  rows.push([
    'conversion',
    'median_days_to_convert',
    '',
    c.medianDaysToConvert ?? '',
  ]);
  rows.push(['conversion', 'sample_size', '', c.sampleSize]);
  for (const pt of c.points) {
    rows.push(['conversion_cumulative', 'guests', pt.at.slice(0, 10), pt.cumulative]);
  }
  for (const pt of c.points) {
    rows.push(['conversion_new', 'guests', pt.at.slice(0, 10), pt.added]);
  }

  for (const r of stats.breakdowns.eventsByType) {
    rows.push(['breakdown_events_by_type', r.label, '', r.count]);
  }
  for (const r of stats.breakdowns.eventsByRegion) {
    rows.push(['breakdown_events_by_region', r.label, '', r.count]);
  }

  return rows.map((r) => r.map(cell).join(',')).join('\n') + '\n';
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
