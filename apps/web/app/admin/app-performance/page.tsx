import { Suspense } from 'react';
import { cookies } from 'next/headers';
import { Activity } from 'lucide-react';

import {
  GROWTH_RANGE_OPTIONS,
  buildDemoGrowthStats,
  fetchGrowthStats,
  type GrowthRangeKey,
  type GrowthSeries,
} from '@/lib/admin/growth-stats';
import {
  MIN_N,
  fetchAppPerformanceStats,
  type AppPerfStats,
} from '@/lib/admin/app-performance-stats';
import { DEMO_MODE_COOKIE_NAME } from '@/lib/demo-mode';

import {
  BucketBars,
  ChartCard,
  DeltaPct,
  IndexChart,
  LeaderRow,
  StackedBars,
  StatusPill,
} from './_components/charts';
import { APX_CSS, CockpitFx } from './_components/fx';
import { HealthNow } from './_components/health-now';
import { ActionCenterZone } from './_components/action-center';

/**
 * /admin/app-performance — the App Performance cockpit (owner lock 2026-07-03:
 * one of the 6 admin menus; plan: spec corpus
 * 0023_admin_console/App_Performance_Plan_2026-07-03.md).
 *
 * PR 1 scope: context strip + Growth zone + Stability zone, LIVE charts only —
 * every chart is backed by a real table verified against origin/main. The
 * needs-wiring surfaces (error rate · p95 · Web Vitals · uptime history) ship
 * as clearly-muted cards stating exactly what wires them, per the
 * honest-empty rule. Action Center (PR 2) and Expenses & Receipts (PR 3)
 * land as their own zones above/below Growth per the plan.
 *
 * Charts are server-rendered SVG (no chart lib). CockpitFx layers the
 * scroll-into-view premium animation on top; no-JS / reduced-motion render
 * final state (see fx.tsx).
 */

export const metadata = { title: 'App Performance · Admin' };

type Props = {
  searchParams: Promise<{ range?: string; demo?: string }>;
};

const nf = new Intl.NumberFormat('en-PH');
const php = new Intl.NumberFormat('en-PH', {
  style: 'currency',
  currency: 'PHP',
  maximumFractionDigits: 0,
});

function parseRange(raw: string | undefined): GrowthRangeKey {
  return raw === '3m' || raw === '6m' || raw === '12m' ? raw : '6m';
}

/** Rebase a cumulative series to index=100 at the window open. */
function toIndex(points: { cumulative: number }[], baseline: number): number[] | null {
  if (baseline < 3) return null; // no meaningful base to rebase from
  return [100, ...points.map((p) => (p.cumulative / baseline) * 100)];
}

function pctDelta(current: number, previous: number): number | null {
  if (previous < 1) return null;
  return (current - previous) / previous;
}

const STREAM_COLORS: Record<string, string> = {
  ai: 'var(--m-orange)',
  vendor: 'var(--m-mulberry-3)',
  other: 'var(--m-slate-3)',
};

const INDEX_COLORS = [
  'var(--m-orange-2)',
  'var(--m-mulberry)',
  'var(--m-sage-deep)',
  'var(--m-slate)',
  'var(--m-blush-deep)',
];

export default async function AppPerformancePage({ searchParams }: Props) {
  const { range: rawRange, demo: rawDemo } = await searchParams;
  const range = parseRange(rawRange);
  const cookieStore = await cookies();
  const demoActive =
    cookieStore.get(DEMO_MODE_COOKIE_NAME)?.value === '1' ||
    rawDemo === '1' ||
    rawDemo === 'on';

  // Growth entities reuse the existing fetcher verbatim (extend, don't fork).
  // The cockpit's own metrics have no demo builder yet — in demo mode they
  // render their honest empty states rather than inventing numbers.
  const [growth, perf] = await Promise.all([
    demoActive ? Promise.resolve(buildDemoGrowthStats(range)) : fetchGrowthStats(range),
    fetchAppPerformanceStats(range),
  ]);
  const rangeLabel =
    GROWTH_RANGE_OPTIONS.find((o) => o.value === range)?.label ?? 'window';

  const byKey = Object.fromEntries(growth.series.map((s) => [s.key, s])) as Record<
    string,
    GrowthSeries | undefined
  >;
  const entityCards = (
    [
      ['customers', 'New users'],
      ['vendors', 'New vendors'],
      ['services', 'New services'],
      ['events', 'New events'],
    ] as const
  ).map(([key, label]) => ({ key, label, series: byKey[key] }));

  // Normalized growth index — entities + realized revenue where a base exists.
  const indexSeries = entityCards
    .map((c, i) => {
      const s = c.series;
      if (!s) return null;
      const idx = toIndex(s.points, s.baseline);
      if (!idx) return null;
      return { label: s.label, color: INDEX_COLORS[i] ?? 'var(--m-slate)', index: idx };
    })
    .filter((s): s is NonNullable<typeof s> => s !== null);
  if (perf.monetization.prevTotalPhp >= 500) {
    let running = perf.monetization.prevTotalPhp;
    const revIdx = [100];
    const perBucket = perf.monetization.streams.reduce<number[]>((acc, s) => {
      s.php.forEach((v, i) => {
        acc[i] = (acc[i] ?? 0) + v;
      });
      return acc;
    }, []);
    for (const v of perBucket) {
      running += v;
      revIdx.push((running / perf.monetization.prevTotalPhp) * 100);
    }
    indexSeries.push({
      label: 'Revenue (cumulative)',
      color: INDEX_COLORS[4] ?? 'var(--m-blush-deep)',
      index: revIdx,
    });
  }

  // MoM/WoW-style leaderboard — every metric vs its previous equal window,
  // min-N floored so tiny bases can't post explosive/meaningless %.
  const leaders = [
    ...entityCards.map((c) => ({
      label: c.label,
      current: c.series?.newInRange ?? 0,
      previous: null as number | null, // entities: prev-window new not head-counted in PR 1
      pct: null as number | null,
      note: 'net-new',
    })),
    {
      label: 'Revenue',
      current: perf.monetization.totalPhp,
      previous: perf.monetization.prevTotalPhp,
      pct: pctDelta(perf.monetization.totalPhp, perf.monetization.prevTotalPhp),
      note: 'realized ₱',
    },
    {
      label: 'Completed services',
      current: perf.completedServices.total,
      previous: perf.completedServices.prevTotal,
      pct: pctDelta(perf.completedServices.total, perf.completedServices.prevTotal),
      note: '',
    },
    {
      label: 'Reviews',
      current: perf.reviews.total,
      previous: perf.reviews.prevTotal,
      pct: pctDelta(perf.reviews.total, perf.reviews.prevTotal),
      note: '',
    },
    {
      label: 'Reports',
      current: perf.reports.total,
      previous: perf.reports.prevTotal,
      pct: pctDelta(perf.reports.total, perf.reports.prevTotal),
      note: 'rising = worse',
      inverseGood: true,
    },
  ];

  const sampled =
    perf.monetization.sampled ||
    perf.completedServices.sampled ||
    perf.reviews.sampled ||
    perf.reports.sampled;

  const errors = [...growth.errors, ...perf.errors];

  return (
    <div
      id="apx-root"
      className="mx-auto w-full max-w-6xl xl:max-w-7xl 2xl:max-w-screen-2xl px-4 py-10 sm:px-6 lg:px-8"
    >
      <style>{APX_CSS}</style>
      <CockpitFx />

      <header className="mb-6 space-y-2">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="m-display-tight text-3xl text-[color:var(--m-ink)] sm:text-4xl">
            App Performance
          </h1>
          {demoActive ? (
            <span className="rounded-full border border-warn-300/70 bg-warn-50 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-warn-800">
              Entity curves: demo data
            </span>
          ) : null}
        </div>
        <p className="max-w-prose text-base text-ink/65">
          Is it growing, and is it working — the operator&apos;s daily screen over the{' '}
          {rangeLabel.toLowerCase()}. Every chart is tagged{' '}
          <StatusPill state="live" /> (computed from the platform&apos;s own tables) or{' '}
          <StatusPill state="wiring" /> (one instrumentation step away — never
          simulated).
        </p>
      </header>

      {/* Range picker — GET form, no client JS (mirrors /admin/growth). */}
      <form method="get" className="mb-8 flex flex-wrap items-center gap-2">
        <label
          htmlFor="range"
          className="font-mono text-[11px] uppercase tracking-[0.15em] text-ink/55"
        >
          Range
        </label>
        <select
          id="range"
          name="range"
          defaultValue={range}
          className="input-field h-9 max-w-[14rem] py-0 text-sm"
        >
          {GROWTH_RANGE_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        <button type="submit" className="button-secondary h-9 px-3 text-xs">
          Apply
        </button>
        <span className="ml-2 font-mono text-[10px] uppercase tracking-[0.15em] text-ink/45">
          Since {perf.sinceIso.slice(0, 10)} · deltas vs the previous equal window
        </span>
      </form>

      {errors.length > 0 ? (
        <p
          role="alert"
          className="mb-6 rounded-md border border-terracotta/30 bg-terracotta/10 px-4 py-3 text-sm text-terracotta-700"
        >
          Some metrics couldn&apos;t load: {errors.join(' · ')}
        </p>
      ) : null}

      {/* ── CONTEXT STRIP — standing totals (owner list: Users · Vendors ·
             Services · Events · Editorials · Uptime · Error rate) ─────── */}
      <section className="mb-10" aria-label="Standing totals">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 xl:grid-cols-7">
          <ContextTile label="Users" value={nf.format(growth.population.accountHolders)} />
          <ContextTile
            label="Vendors"
            value={nf.format(growth.population.vendors)}
            sub={`${nf.format(growth.population.vendorsPublished)} published`}
          />
          <ContextTile
            label="Services"
            value={nf.format(growth.population.services)}
            sub={`${nf.format(growth.population.servicesActive)} active`}
          />
          <ContextTile label="Total events" value={nf.format(growth.population.events)} />
          <ContextTile
            label="Total editorials"
            value={nf.format(perf.editorials.total)}
            sub={`${nf.format(perf.editorials.published)} published`}
          />
          <ContextTile label="Uptime" value="—" sub="needs probe history" muted />
          <ContextTile label="Error rate" value="—" sub="needs Sentry API" muted />
        </div>
      </section>

      {/* ── ZONE 1 · ACTION CENTER — what to do next (PR 2; streams behind
             Suspense so queue digests never block the chart zones) ───── */}
      <Suspense
        fallback={
          <section aria-label="Action Center loading" className="mb-12">
            <div className="m-card h-28 animate-pulse p-5" />
          </section>
        }
      >
        <ActionCenterZone />
      </Suspense>

      {/* ── GROWTH ─────────────────────────────────────────────────────── */}
      <section className="mb-12" aria-labelledby="apx-growth">
        <ZoneHeading
          id="apx-growth"
          title="Growth"
          blurb="Is it getting bigger — acquisition, delivery, money in, and trust."
        />

        {/* G1 — the four acquisition engines, side by side */}
        <div className="mb-4 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {entityCards.map((c) => (
            <ChartCard
              key={c.key}
              title={c.label}
              pill="live"
              source={`${c.key} · created_at per bucket`}
            >
              <p
                className="mb-2 text-2xl font-semibold tabular-nums"
                data-countup=""
                style={{ color: 'var(--m-ink)' }}
              >
                {nf.format(c.series?.newInRange ?? 0)}
              </p>
              <BucketBars
                values={(c.series?.points ?? []).map((p) => p.added)}
                ariaLabel={`${c.label} per bucket over the ${rangeLabel.toLowerCase()}: ${(c.series?.points ?? [])
                  .map((p) => p.added)
                  .join(', ')}`}
              />
            </ChartCard>
          ))}
        </div>

        <div className="mb-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
          {/* G4 — sales split three ways (pesos) */}
          <ChartCard
            title="Sales — split three ways"
            pill="live"
            source="orders (paid/fulfilled) + vendor_subscriptions + vendor_token_purchases · pesos"
          >
            <div className="mb-2 flex flex-wrap items-baseline gap-2">
              <p
                className="text-2xl font-semibold tabular-nums"
                data-countup=""
                style={{ color: 'var(--m-ink)' }}
              >
                {php.format(perf.monetization.totalPhp)}
              </p>
              <DeltaPct
                current={perf.monetization.totalPhp}
                previous={perf.monetization.prevTotalPhp}
              />
            </div>
            <StackedBars
              series={perf.monetization.streams.map((s) => ({
                label: s.label,
                color: STREAM_COLORS[s.key] ?? 'var(--m-slate-3)',
                values: s.php,
              }))}
              ariaLabel={`Realized revenue per bucket by stream. Totals — ${perf.monetization.streams
                .map((s) => `${s.label}: ${php.format(s.totalPhp)}`)
                .join('; ')}.`}
              formatTitle={(label, v) => `${label}: ${php.format(v)}`}
            />
            <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1">
              {perf.monetization.streams.map((s) => (
                <li key={s.key} className="flex items-center gap-1.5 text-xs" style={{ color: 'var(--m-slate)' }}>
                  <span
                    aria-hidden
                    className="inline-block h-2 w-2 rounded-full"
                    style={{ background: STREAM_COLORS[s.key] ?? 'var(--m-slate-3)' }}
                  />
                  {s.label}
                  <span className="tabular-nums" style={{ color: 'var(--m-ink)' }}>
                    {php.format(s.totalPhp)}
                  </span>
                </li>
              ))}
            </ul>
          </ChartCard>

          {/* G3 — completed services (the real delivery signal) */}
          <ChartCard
            title="Completed services"
            pill="live"
            source="event_vendors.completion_status ∈ confirmed · auto_confirmed"
          >
            <div className="mb-2 flex flex-wrap items-baseline gap-2">
              <p
                className="text-2xl font-semibold tabular-nums"
                data-countup=""
                style={{ color: 'var(--m-ink)' }}
              >
                {nf.format(perf.completedServices.total)}
              </p>
              <DeltaPct
                current={perf.completedServices.total}
                previous={perf.completedServices.prevTotal}
              />
            </div>
            <BucketBars
              values={perf.completedServices.count}
              color="var(--m-sage-deep)"
              ariaLabel={`Completed services per bucket: ${perf.completedServices.count.join(', ')}. All-time ${perf.completedServices.allTime}.`}
            />
            <p className="mt-2 text-xs" style={{ color: 'var(--m-slate)' }}>
              {nf.format(perf.completedServices.allTime)} all-time
              {perf.completedServices.disputed > 0 ? (
                <span style={{ color: 'var(--m-blush-deep)' }}>
                  {' '}· {nf.format(perf.completedServices.disputed)} disputed (not counted)
                </span>
              ) : null}
            </p>
          </ChartCard>
        </div>

        <div className="mb-4 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {/* G5 — first-pick rate */}
          <ChartCard
            title="First-pick rate"
            pill="live"
            source="event_vendors.selection_match_rank = 1 ÷ ranked bookings"
          >
            {perf.firstPick.rate === null ? (
              <p className="text-sm" style={{ color: 'var(--m-slate-2)' }}>
                Not enough ranked bookings yet ({nf.format(perf.firstPick.den)} of{' '}
                {MIN_N} needed this window). The rate appears once the
                recommendation flow has volume — never extrapolated from a tiny
                base.
              </p>
            ) : (
              <>
                <p
                  className="text-2xl font-semibold tabular-nums"
                  style={{ color: 'var(--m-ink)' }}
                >
                  {Math.round(perf.firstPick.rate * 100)}%
                </p>
                <p className="mt-1 text-xs" style={{ color: 'var(--m-slate)' }}>
                  {nf.format(perf.firstPick.picks)} of {nf.format(perf.firstPick.den)}{' '}
                  ranked bookings chose the engine&apos;s #1 match
                  {perf.firstPick.prevRate !== null
                    ? ` · prev ${Math.round(perf.firstPick.prevRate * 100)}%`
                    : ''}
                </p>
              </>
            )}
          </ChartCard>

          {/* G6 — reviews */}
          <ChartCard title="Reviews" pill="live" source="vendor_reviews · event-bound">
            <div className="mb-2 flex flex-wrap items-baseline gap-2">
              <p
                className="text-2xl font-semibold tabular-nums"
                data-countup=""
                style={{ color: 'var(--m-ink)' }}
              >
                {nf.format(perf.reviews.total)}
              </p>
              <DeltaPct current={perf.reviews.total} previous={perf.reviews.prevTotal} />
            </div>
            <BucketBars
              values={perf.reviews.count}
              ariaLabel={`Reviews per bucket: ${perf.reviews.count.join(', ')}.`}
            />
            <p className="mt-2 text-xs" style={{ color: 'var(--m-slate)' }}>
              {perf.reviews.avgRating !== null
                ? `${perf.reviews.avgRating.toFixed(2)} avg rating this window · `
                : ''}
              {nf.format(perf.reviews.allTime)} all-time
            </p>
          </ChartCard>

          {/* G2 — events by type (snapshot) */}
          <ChartCard
            title="Events by type"
            pill="live"
            source="events.event_type · current snapshot"
          >
            {growth.breakdowns.eventsByType.length === 0 ? (
              <p className="text-sm" style={{ color: 'var(--m-slate-2)' }}>
                No events yet.
              </p>
            ) : (
              <ul className="space-y-1.5">
                {growth.breakdowns.eventsByType.slice(0, 6).map((r) => (
                  <li
                    key={r.key}
                    className="flex items-baseline justify-between gap-2 text-sm"
                  >
                    <span style={{ color: 'var(--m-ink)' }}>{r.label}</span>
                    <span className="tabular-nums" style={{ color: 'var(--m-slate)' }}>
                      {nf.format(r.count)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </ChartCard>
        </div>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {/* G7 — normalized growth index (headline comparison) */}
          <ChartCard
            title="Normalized growth index"
            pill="live"
            source="all series rebased to 100 at window open — steepest = fastest grower"
          >
            {indexSeries.length === 0 ? (
              <p className="text-sm" style={{ color: 'var(--m-slate-2)' }}>
                Not enough pre-window base to rebase yet — the index appears once
                entities have a standing population at the window open.
              </p>
            ) : (
              <>
                <IndexChart
                  series={indexSeries}
                  ariaLabel={`Growth index, start = 100. Latest — ${indexSeries
                    .map(
                      (s) => `${s.label}: ${Math.round(s.index[s.index.length - 1] ?? 100)}`,
                    )
                    .join('; ')}.`}
                />
                <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1">
                  {indexSeries.map((s) => (
                    <li
                      key={s.label}
                      className="flex items-center gap-1.5 text-xs"
                      style={{ color: 'var(--m-slate)' }}
                    >
                      <span
                        aria-hidden
                        className="inline-block h-2 w-2 rounded-full"
                        style={{ background: s.color }}
                      />
                      {s.label}
                      <span className="tabular-nums" style={{ color: 'var(--m-ink)' }}>
                        {Math.round(s.index[s.index.length - 1] ?? 100)}
                      </span>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </ChartCard>

          {/* G8 — period-over-period leaderboard */}
          <ChartCard
            title="Fastest movers"
            pill="live"
            source={`% change vs the previous equal window · min base ${MIN_N} (below → “not enough data”)`}
          >
            <ul>
              {leaders.map((l) => {
                const insufficient =
                  l.pct === null ||
                  Math.max(l.current, l.previous ?? 0) < MIN_N ||
                  (l.previous !== null && l.previous < MIN_N);
                return (
                  <LeaderRow
                    key={l.label}
                    label={l.label}
                    pct={l.pct}
                    note={l.note || undefined}
                    inverseGood={'inverseGood' in l ? Boolean(l.inverseGood) : false}
                    insufficient={insufficient}
                  />
                );
              })}
            </ul>
            <p className="mt-2 text-[11px]" style={{ color: 'var(--m-slate-3)' }}>
              Entity rows show net-new counts; their prior-window % lands with the
              Action Center PR. Rates beat raw counts on small bases.
            </p>
          </ChartCard>
        </div>
      </section>

      {/* ── STABILITY ──────────────────────────────────────────────────── */}
      <section className="mb-10" aria-labelledby="apx-stability">
        <ZoneHeading
          id="apx-stability"
          title="Stability"
          blurb="Is it working — platform health and trust & safety."
        />
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <ChartCard
            title="Platform health — right now"
            pill="live"
            source="/api/health/deep · point-in-time (history needs probe persistence)"
          >
            <HealthNow />
          </ChartCard>

          <ChartCard
            title="Abuse reports"
            pill="live"
            source="user_reports by status · rising = worse"
          >
            <div className="mb-2 flex flex-wrap items-baseline gap-2">
              <p
                className="text-2xl font-semibold tabular-nums"
                data-countup=""
                style={{
                  color:
                    perf.reports.openNow > 0 ? 'var(--m-blush-deep)' : 'var(--m-ink)',
                }}
              >
                {nf.format(perf.reports.openNow)}
              </p>
              <span className="text-xs" style={{ color: 'var(--m-slate)' }}>
                open right now
              </span>
              <DeltaPct
                current={perf.reports.total}
                previous={perf.reports.prevTotal}
                inverseGood
              />
            </div>
            <StackedBars
              series={[
                { label: 'Open', color: 'var(--m-blush-deep)', values: perf.reports.open },
                { label: 'Actioned', color: 'var(--m-sage-deep)', values: perf.reports.actioned },
                { label: 'Dismissed', color: 'var(--m-slate-4)', values: perf.reports.dismissed },
              ]}
              ariaLabel={`Reports per bucket by status. Window total ${perf.reports.total}; open now ${perf.reports.openNow}.`}
            />
          </ChartCard>
        </div>

        {/* Needs-wiring row — stated plainly, never simulated. */}
        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <ChartCard title="Error rate" pill="wiring" source="Sentry API — SDK is wired; the stats API token isn't" muted>
            <WiringNote text="Errors are captured today; charting the rate needs a Sentry API token + one fetcher." />
          </ChartCard>
          <ChartCard title="API speed (p95)" pill="wiring" source="Vercel / Sentry Performance" muted>
            <WiringNote text="Needs request-timing export from Vercel or Sentry Performance." />
          </ChartCard>
          <ChartCard title="Web Vitals (p75)" pill="wiring" source="web-vitals RUM — not instrumented yet" muted>
            <WiringNote text="Lighthouse runs in CI per deploy; field LCP/INP/CLS needs the web-vitals beacon." />
          </ChartCard>
          <ChartCard title="Uptime history" pill="wiring" source="probe persistence (Better Stack export or samples table)" muted>
            <WiringNote text="The live probe above is point-in-time; a timeline needs each sample stored." />
          </ChartCard>
        </div>
      </section>

      <footer
        className="border-t pt-4 text-xs"
        style={{ borderColor: 'var(--m-line)', color: 'var(--m-slate-2)' }}
      >
        Live charts compute from the platform&apos;s own tables at{' '}
        {perf.generatedAtIso.slice(0, 16).replace('T', ' ')} UTC
        {sampled ? ' · some window reads hit their row cap — those counts are a floor, not exact' : ''}
        . Needs-wiring cards name their missing instrumentation — nothing here is
        simulated. Expenses &amp; Receipts (the money-out ledger + receipts) lands as the
        next PR per the plan.
      </footer>
    </div>
  );
}

function ZoneHeading({ id, title, blurb }: { id: string; title: string; blurb: string }) {
  return (
    <header className="mb-4 flex items-center gap-2">
      <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--m-orange)]/10 text-[var(--m-orange-2)]">
        <Activity aria-hidden className="h-4 w-4" strokeWidth={1.75} />
      </span>
      <div>
        <h2 id={id} className="text-base font-semibold text-ink">
          {title}
        </h2>
        <p className="text-xs text-ink/55">{blurb}</p>
      </div>
    </header>
  );
}

function ContextTile({
  label,
  value,
  sub,
  muted = false,
}: {
  label: string;
  value: string;
  sub?: string;
  muted?: boolean;
}) {
  return (
    <div
      data-reveal=""
      className={`m-card p-4 ${muted ? 'opacity-75' : ''}`}
      style={muted ? { borderStyle: 'dashed' } : undefined}
    >
      <p className="m-label-mono" style={{ color: 'var(--m-slate-2)' }}>
        {label}
      </p>
      <p
        className="mt-1 text-2xl font-semibold tabular-nums"
        data-countup={muted ? undefined : ''}
        style={{ color: 'var(--m-ink)' }}
      >
        {value}
      </p>
      {sub ? (
        <p className="mt-0.5 text-xs" style={{ color: 'var(--m-slate)' }}>
          {sub}
        </p>
      ) : null}
    </div>
  );
}

function WiringNote({ text }: { text: string }) {
  return (
    <p className="text-sm" style={{ color: 'var(--m-slate-2)' }}>
      {text}
    </p>
  );
}
