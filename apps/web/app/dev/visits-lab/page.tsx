/**
 * /dev/visits-lab — the Visits tab (Admin › App Performance) on fixture data,
 * with no sign-in and no database. DEV-ONLY: production builds 404 this route
 * (`the-lab-never-ships.test.ts`). It draws the tab's REAL component
 * (`VisitsView`) over the tab's own demo figures (`buildDemoVisitStats`):
 *
 *   ?s=demo     (default) three months of illustrative traffic
 *   ?s=empty    nothing counted yet — the honest empty lines
 *   ?s=unread   the visits read was refused — "Couldn't read", never 0
 *   ?s=funnel   visits read, but the sign-up count was refused
 *   ?range=3m|6m|12m
 */
import { notFound } from 'next/navigation';
import { VisitsView } from '@/app/admin/app-performance/_surfaces/visits-view';
import { GROWTH_RANGE_OPTIONS, type GrowthRangeKey } from '@/lib/admin/growth-stats';
import { buildDemoVisitStats, type VisitStats } from '@/lib/visits/visit-stats';

const LAB_UNTIL = '2026-10-22';

export default async function VisitsLabPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  if (process.env.NODE_ENV === 'production') notFound();
  const sp = await searchParams;
  const s = typeof sp.s === 'string' ? sp.s : 'demo';
  const range: GrowthRangeKey = sp.range === '6m' || sp.range === '12m' ? sp.range : '3m';
  const days = GROWTH_RANGE_OPTIONS.find((o) => o.value === range)?.days ?? 90;
  const demo = buildDemoVisitStats(days, LAB_UNTIL);
  const stats: VisitStats =
    s === 'unread'
      ? { ...demo, summary: null, signUps: null, paidOrders: null }
      : s === 'funnel'
        ? { ...demo, signUps: null }
        : s === 'empty'
          ? {
              ...demo,
              demo: false,
              signUps: 0,
              paidOrders: 0,
              summary: { firstDay: null, days: [], pages: [], sources: [], devices: [], countries: [], signedInViews: 0 },
            }
          : demo;

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
      <VisitsView stats={stats} range={range} />
    </div>
  );
}
