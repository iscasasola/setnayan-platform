import Link from 'next/link';
import {
  Activity,
  LineChart,
  Radar,
  Globe,
  BarChart3,
  TrendingUp,
  Bug,
  WifiOff,
} from 'lucide-react';
import { requireAdmin } from '@/lib/admin/require-admin';
import { CockpitSurface } from './_surfaces/overview-surface';
import { GrowthSurface } from './_surfaces/growth-surface';
import { IntelligenceSurface } from './_surfaces/intelligence-surface';
import { SeoSurface } from './_surfaces/seo-surface';
import { FunnelsSurface } from './_surfaces/funnels-surface';
import { OperationsHiringSurface } from './_surfaces/operations-surface';
import { ConnectionLogsSurface } from './_surfaces/connection-logs-surface';
import { OfflineSurface } from './_surfaces/offline-surface';

/**
 * Insights Studio — the tabbed /admin/app-performance shell that consolidates
 * the App Performance menu (the `funnels` group in ADMIN_NAV_GROUPS) into ONE
 * surface (owner: "what else can we integrate" · 2026-07-10). Seven tabs:
 * Overview (the cockpit) · Growth · Intelligence · Funnels · Operations &
 * Hiring · Connection logs · Offline daemon — every one a read-only analytics
 * readout, so there's no mutation risk in tabbing them together. Each tab's
 * body was re-homed byte-identical into ./_surfaces/*; the six non-cockpit
 * legacy routes now redirect in, forwarding their query params. The App
 * Performance menu parent already lands here, so the parent = the Overview tab.
 *
 * Same pattern as the Accounts + Studio studios (page shell + _surfaces + the
 * ?tab= strip). force-dynamic: the surfaces do admin-client reads, so this must
 * never be statically generated.
 */
export const dynamic = 'force-dynamic';
export const metadata = { title: 'App Performance · Admin' };

const TABS = [
  'overview',
  'growth',
  'intelligence',
  'seo',
  'funnels',
  'operations',
  'connection-logs',
  'offline',
] as const;
type Tab = (typeof TABS)[number];

// First value of a (possibly-array) search param — Next passes ?x=a&x=b as an
// array. Guards every param read below against that shape.
function first(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v;
}

function coerceTab(v: string | undefined): Tab {
  return (TABS as readonly string[]).includes(v ?? '') ? (v as Tab) : 'overview';
}

const TAB_STRIP: { key: Tab; label: string; icon: typeof Activity }[] = [
  { key: 'overview', label: 'Overview', icon: Activity },
  { key: 'growth', label: 'Growth', icon: LineChart },
  { key: 'intelligence', label: 'Intelligence', icon: Radar },
  { key: 'seo', label: 'SEO & GEO', icon: Globe },
  { key: 'funnels', label: 'Funnels', icon: BarChart3 },
  { key: 'operations', label: 'Operations & Hiring', icon: TrendingUp },
  { key: 'connection-logs', label: 'Connection logs', icon: Bug },
  { key: 'offline', label: 'Offline daemon', icon: WifiOff },
];

type Props = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function InsightsStudioPage({ searchParams }: Props) {
  await requireAdmin();
  const search = await searchParams;
  const tab = coerceTab(first(search.tab));

  return (
    <div className="mx-auto w-full max-w-6xl xl:max-w-7xl 2xl:max-w-screen-2xl px-4 py-8 sm:px-6 lg:px-8">
      <nav
        aria-label="App Performance sections"
        className="mb-6 flex flex-wrap gap-1.5 border-b border-ink/10 pb-3"
      >
        {TAB_STRIP.map((t) => {
          const active = t.key === tab;
          const Icon = t.icon;
          return (
            <Link
              key={t.key}
              href={`/admin/app-performance?tab=${t.key}`}
              aria-current={active ? 'page' : undefined}
              className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                active
                  ? 'bg-mulberry/10 text-mulberry'
                  : 'text-ink/65 hover:bg-ink/5 hover:text-ink'
              }`}
            >
              <Icon className="h-4 w-4" strokeWidth={1.75} aria-hidden />
              {t.label}
            </Link>
          );
        })}
      </nav>

      {/* Each surface kept its own narrow searchParams type; hand it a promise
          narrowed (via first()) to exactly that shape so nothing in the moved
          bodies had to change. */}
      {tab === 'growth' ? (
        <GrowthSurface
          searchParams={Promise.resolve({
            range: first(search.range),
            demo: first(search.demo),
          })}
        />
      ) : tab === 'intelligence' ? (
        <IntelligenceSurface
          searchParams={Promise.resolve({
            quiet: first(search.quiet),
            demo: first(search.demo),
          })}
        />
      ) : tab === 'funnels' ? (
        <FunnelsSurface
          searchParams={Promise.resolve({
            range: first(search.range),
            vendor: first(search.vendor),
          })}
        />
      ) : tab === 'seo' ? (
        <SeoSurface />
      ) : tab === 'operations' ? (
        <OperationsHiringSurface />
      ) : tab === 'connection-logs' ? (
        <ConnectionLogsSurface />
      ) : tab === 'offline' ? (
        <OfflineSurface />
      ) : (
        <CockpitSurface
          searchParams={Promise.resolve({
            range: first(search.range),
            demo: first(search.demo),
          })}
        />
      )}
    </div>
  );
}
