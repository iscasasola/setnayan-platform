/**
 * VISITS — the Visits tab of the App Performance studio (owner 2026-10-22:
 * site traffic in our own admin, not Vercel; no cookies, no banner).
 *
 * Reads `fetchVisitStats()` through the service role, so it gates itself with
 * requireAdmin() like every other surface here; draws with `VisitsView`, the
 * same component the lab draws. Demo mode (the Growth tab's switch) draws the
 * illustrative figures instead, badged.
 *
 * What is counted and how it stays private: lib/visits/visit-capture.ts and
 * migration 20271282829207_site_visits_daily.sql.
 */
import { cookies } from 'next/headers';

import { requireAdmin } from '@/lib/admin/require-admin';
import { GROWTH_RANGE_OPTIONS, type GrowthRangeKey } from '@/lib/admin/growth-stats';
import { DEMO_MODE_COOKIE_NAME } from '@/lib/demo-mode';
import { buildDemoVisitStats } from '@/lib/visits/visit-stats';
import { fetchVisitStats } from '@/lib/visits/visit-stats.server';
import { VisitsView } from './visits-view';

function parseRange(raw: string | undefined): GrowthRangeKey {
  return raw === '3m' || raw === '6m' || raw === '12m' ? raw : '3m';
}

export async function VisitsSurface({ searchParams }: { searchParams: Promise<{ range?: string; demo?: string }> }) {
  await requireAdmin();
  const { range: rawRange, demo: rawDemo } = await searchParams;
  const range = parseRange(rawRange);
  const days = GROWTH_RANGE_OPTIONS.find((o) => o.value === range)?.days ?? 90;
  const demo =
    (await cookies()).get(DEMO_MODE_COOKIE_NAME)?.value === '1' || rawDemo === '1' || rawDemo === 'on';
  const stats = demo ? buildDemoVisitStats(days) : await fetchVisitStats(days);
  return <VisitsView stats={stats} range={range} />;
}
