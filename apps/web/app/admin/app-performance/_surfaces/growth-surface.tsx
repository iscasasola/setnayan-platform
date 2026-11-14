// Insights Studio surface — the body of the former /admin/growth page,
// re-homed here (2026-07-10) so the App Performance menu is ONE tabbed
// studio. Its actions/_components stay under /admin/growth; the legacy
// route is now a redirect into /admin/app-performance?tab={tab}.
//
// Re-drawn 2026-11-14 onto the approved drawing (`admin_pub/insights.html` ›
// Sign-ups & growth): the range is the one dropdown row (`InsightsParamPick`,
// moves `?range=` — the native select + Apply GET form went), the population is
// read-only `Facts`, each growth curve is a `Fold` row, conversion is `Facts`
// with its explanation in the ⓘ, and the breakdowns are folds of hairline rows.
// No frames on read-only facts (T18); the Export CSV link is unchanged.
//
// 🔑 A REFUSED READ SAYS SO. `fetchGrowthStats` names each failed section in
// `errors` and hands back a zero in its place; this view turns every such zero
// back into "—", so a refused count is never drawn as a fact about the business.
import { manilaDayLabel } from '@/lib/admin/manila-stamp';
import { cookies } from 'next/headers';
import { Download } from 'lucide-react';
import {
  fetchGrowthStats,
  buildDemoGrowthStats,
  GROWTH_RANGE_OPTIONS,
  type EntityKey,
  type GrowthRangeKey,
  type GrowthSeries,
  type ConversionStats,
  type SeriesPoint,
  type BreakdownRow,
} from '@/lib/admin/growth-stats';
import { ReadFailed } from '../../_components/read-failed';
import { PageMasthead } from '@/app/_components/page-masthead';
import { Fold } from '@/app/_components/fold';
import { DEMO_MODE_COOKIE_NAME } from '@/lib/demo-mode';
import { Badge, Facts, One, Rows, Row, Sec, UNREAD } from '../_components/insights-parts';
import { InsightsParamPick } from '../_components/insights-param-pick';

type Props = {
  searchParams: Promise<{ range?: string; demo?: string }>;
};

const nf = new Intl.NumberFormat('en-PH');

function parseRange(raw: string | undefined): GrowthRangeKey {
  return raw === '3m' || raw === '6m' || raw === '12m' ? raw : '6m';
}

export async function GrowthSurface({ searchParams }: Props) {
  const { range: rawRange, demo: rawDemo } = await searchParams;
  const range = parseRange(rawRange);
  // The /admin layout 404s non-admins, so by the time this renders the viewer
  // is an admin — reading the demo cookie/flag directly here is safe.
  const cookieStore = await cookies();
  const demoActive =
    cookieStore.get(DEMO_MODE_COOKIE_NAME)?.value === '1' ||
    rawDemo === '1' ||
    rawDemo === 'on';
  const stats = demoActive
    ? buildDemoGrowthStats(range)
    : await fetchGrowthStats(range);
  const exportHref = `/admin/growth/export?range=${range}${demoActive ? '&demo=1' : ''}`;
  const rangeLabel =
    GROWTH_RANGE_OPTIONS.find((o) => o.value === range)?.label ?? 'window';

  // Which reads were refused — named by `fetchGrowthStats` in `errors`.
  const seriesFailed = (key: EntityKey) => stats.errors.includes(`${key} growth`);
  const popFailed = stats.errors.includes('population totals');
  const convFailed = stats.errors.includes('guest conversion') || seriesFailed('guests');
  const p = stats.population;
  const count = (failed: boolean, n: number): string | null => (failed ? null : nf.format(n));
  const withSub = (failed: boolean, n: number, subFailed: boolean, sub: number, word: string): string | null =>
    failed ? null : `${nf.format(n)} · ${subFailed ? UNREAD : nf.format(sub)} ${word}`;

  return (
    <div className="max-w-3xl">
      {/* The tab strip above already says "Growth & Population"; this row said
          it again at 36px. The name stays in the document at zero pixels.
          🔒 THE DEMO BADGE IS NOT THE PAGE NAME AND DOES NOT GO WITH IT. It is
          the only thing on the screen saying these numbers are illustrative,
          and every figure below it is wrong without it — so it moves into
          `actions`, which is the slot for what the old header genuinely held.
          ⚖ The lede splits: the demo sentence is an INSTRUCTION (it names the
          switch that brings the real counts back) and survives beside the
          badge — now inside its ⓘ (T17); the live-mode sentence was
          orientation and goes. */}
      <PageMasthead
        title="Growth & Population"
        className="mb-0"
        actions={stats.demo ? <Badge tone="warn">Illustrative demo data</Badge> : null}
      />
      {stats.demo ? (
        <One label="Demo data">
          Sample figures so you can see the shape of this surface before real
          data accrues. Turn off demo mode to see live counts.
        </One>
      ) : null}

      {/* Range — the one dropdown (approved drawing: rangeRow()), never a native select with an Apply. */}
      <InsightsParamPick
        name="Range"
        param="range"
        value={range}
        options={GROWTH_RANGE_OPTIONS.map((o) => ({ key: o.value, label: o.label }))}
        about={`Since ${manilaDayLabel(stats.sinceIso)}.`}
      />

      <div className="my-2 flex">
        <a
          href={exportHref}
          className="button-secondary inline-flex min-h-11 items-center gap-1.5 px-3 text-sm"
          download
        >
          <Download aria-hidden className="h-4 w-4" strokeWidth={2} />
          Export CSV
        </a>
      </div>

      {stats.errors.length > 0 ? (
        <p
          role="alert"
          className="my-2 rounded-lg bg-[var(--sn-warning-soft)] px-3 py-2 text-sm text-ink"
        >
          <b>Some metrics couldn&apos;t load: {stats.errors.join(' · ')}</b> — that is not the same as none.
          Refresh to try again.
        </p>
      ) : null}

      {/* ── POPULATION NOW ─────────────────────────────────────────── */}
      <section aria-labelledby="growth-population">
        <Sec id="growth-population" title="Population now" about="Current totals across the platform." />
        <Facts
          data="growth-population"
          rows={[
            ['Account holders', count(popFailed, p.accountHolders)],
            ['Customers', count(seriesFailed('customers'), p.customers)],
            ['Suppliers', withSub(seriesFailed('vendors'), p.vendors, popFailed, p.vendorsPublished, 'published')],
            ['Services', withSub(seriesFailed('services'), p.services, popFailed, p.servicesActive, 'active')],
            ['Events', count(seriesFailed('events'), p.events)],
            ['Guests', count(seriesFailed('guests'), p.guests)],
          ]}
        />
      </section>

      {/* ── GROWTH OVER TIME ───────────────────────────────────────── */}
      <section aria-labelledby="growth-over-time">
        <Sec
          id="growth-over-time"
          title="Growth over time"
          about={`Cumulative totals (line) and net new per period (bars) across the ${rangeLabel.toLowerCase()}. The accent bar is the latest period.`}
        />
        <div className="divide-y divide-ink/10 border-y border-ink/10">
          {stats.series.map((s) => (
            <GrowthFold key={s.key} series={s} failed={seriesFailed(s.key)} />
          ))}
        </div>
      </section>

      {/* ── GUEST → ACCOUNT CONVERSION ─────────────────────────────── */}
      <section aria-labelledby="growth-conversion">
        <Sec
          id="growth-conversion"
          title="Guest → account conversion"
          about="How many invited guests went on to hold a Setnayan account. A conversion is a guest-list entry that became tied to a real Setnayan account (joined by QR scan or invite link). Rate is converted ÷ all non-removed guests, all-time."
        />
        <Conversion c={stats.conversion} rangeLabel={rangeLabel} failed={convFailed} />
      </section>

      {/* ── BREAKDOWNS ─────────────────────────────────────────────── */}
      <section aria-labelledby="growth-breakdowns">
        <Sec
          id="growth-breakdowns"
          title="Breakdowns"
          about={`Current composition of events by type and region${
            stats.breakdowns.sampled ? ' (sampled)' : ''
          }.`}
          right={stats.breakdowns.sampled ? <Badge>sampled</Badge> : null}
        />
        {stats.breakdowns.failed ? (
          <ReadFailed what="the events-by-type and events-by-region breakdowns" />
        ) : (
          <div className="divide-y divide-ink/10 border-y border-ink/10">
            <BreakdownFold title="Events by type" rows={stats.breakdowns.eventsByType} />
            <BreakdownFold title="Events by region" rows={stats.breakdowns.eventsByRegion} />
          </div>
        )}
      </section>
    </div>
  );
}

/* ────────────────────────────────────────────────────────────────── */
/* Presentational helpers (server-rendered; the folds are the client  */
/* island, their contents are static SVG)                             */
/* ────────────────────────────────────────────────────────────────── */

function signed(n: number): string {
  return `${n > 0 ? '+' : ''}${nf.format(n)}`;
}

function share(n: number, total: number): number {
  return total > 0 ? Math.round((n / total) * 100) : 0;
}

/** One entity's curve: the row says the total and the net new; it opens to the line and the bars. */
function GrowthFold({ series, failed }: { series: GrowthSeries; failed: boolean }) {
  return (
    <Fold
      title={series.label}
      data={`growth-${series.key}`}
      summary={
        failed
          ? `${UNREAD} · couldn’t read`
          : `${nf.format(series.total)} · ${signed(series.newInRange)} this period`
      }
    >
      {failed ? (
        <div className="pb-3">
          <ReadFailed what={`the ${series.label.toLowerCase()} growth`} />
        </div>
      ) : (
        <div className="pb-3">
          <Sparkline points={series.points} ariaLabel={`${series.label} cumulative growth`} />
          <div className="mt-2">
            <MiniBars points={series.points} />
          </div>
          <p className="mt-1.5 text-[12px] text-ink/65">Net new this period</p>
        </div>
      )}
    </Fold>
  );
}

function Conversion({
  c,
  rangeLabel,
  failed,
}: {
  c: ConversionStats;
  rangeLabel: string;
  failed: boolean;
}) {
  const ratePct = c.totalGuests > 0 ? `${(c.rate * 100).toFixed(1)}%` : '—';
  const days = c.medianDaysToConvert === null ? null : Math.round(c.medianDaysToConvert);
  const median =
    days === null
      ? '—'
      : `${days} ${days === 1 ? 'day' : 'days'}${c.sampleSize > 0 ? ` · n=${nf.format(c.sampleSize)} in range` : ''}`;
  if (failed) {
    return (
      <>
        <Facts
          data="growth-conversion"
          rows={[
            ['Conversion rate', null],
            ['Converted', null],
            ['New this period', null],
            ['Median time to convert', null],
          ]}
        />
        <ReadFailed what="the guest conversion" />
      </>
    );
  }
  return (
    <>
      <Facts
        data="growth-conversion"
        rows={[
          ['Conversion rate', ratePct],
          ['Converted', `${nf.format(c.converted)} / ${nf.format(c.totalGuests)}`],
          ['New this period', `${c.newInRange >= 0 ? '+' : ''}${nf.format(c.newInRange)}`],
          ['Median time to convert', median],
        ]}
      />
      <figure className="m-0 pt-1">
        <figcaption className="mb-1.5 text-[12px] text-ink/65">
          Cumulative conversions · {rangeLabel.toLowerCase()}
        </figcaption>
        <Sparkline points={c.points} ariaLabel="Cumulative guest conversions" />
        <div className="mt-2">
          <MiniBars points={c.points} />
        </div>
      </figure>
    </>
  );
}

/** A breakdown as a fold: the row names its two biggest shares; it opens to every row with its meter. */
function BreakdownFold({ title, rows }: { title: string; rows: BreakdownRow[] }) {
  const total = rows.reduce((sum, r) => sum + r.count, 0);
  const max = Math.max(1, ...rows.map((r) => r.count));
  const summary =
    rows.length === 0
      ? 'No data yet.'
      : rows
          .slice(0, 2)
          .map((r) => `${r.label} ${share(r.count, total)}%`)
          .join(' · ');
  return (
    <Fold title={title} summary={summary} data={`growth-breakdown-${title.toLowerCase().replace(/\s+/g, '-')}`}>
      {rows.length === 0 ? (
        <p className="pb-3 text-[13px] text-ink/65">No data yet.</p>
      ) : (
        <Rows label={title}>
          {rows.map((r, i) => (
            <Row
              key={r.key}
              title={r.label}
              sub={
                <span aria-hidden className="mt-1 block h-1.5 overflow-hidden rounded-full bg-ink/[0.06]">
                  <span
                    className="block h-full rounded-full"
                    style={{
                      width: `${Math.max(2, (r.count / max) * 100)}%`,
                      background: i === 0 ? 'var(--sn-accent)' : 'var(--sn-ink-300)',
                    }}
                  />
                </span>
              }
              trail={`${nf.format(r.count)} · ${share(r.count, total)}%`}
            />
          ))}
        </Rows>
      )}
    </Fold>
  );
}

/** Cumulative-curve sparkline. Pure SVG — stretches to its container width. One series, in the info token. */
function Sparkline({ points, ariaLabel }: { points: SeriesPoint[]; ariaLabel: string }) {
  const W = 100;
  const H = 32;
  const pad = 2;
  const vals = points.map((p) => p.cumulative);
  const n = vals.length;
  const max = Math.max(1, ...vals);
  const min = Math.min(0, ...vals);
  const span = max - min || 1;
  const x = (i: number) => (n <= 1 ? pad : pad + (i * (W - 2 * pad)) / (n - 1));
  const y = (v: number) => H - pad - ((v - min) / span) * (H - 2 * pad);
  const line = vals
    .map((v, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(2)},${y(v).toFixed(2)}`)
    .join(' ');
  const area = `${line} L${x(n - 1).toFixed(2)},${(H - pad).toFixed(2)} L${x(0).toFixed(
    2,
  )},${(H - pad).toFixed(2)} Z`;
  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="none"
      className="h-10 w-full"
      role="img"
      aria-label={ariaLabel}
    >
      <path d={area} fill="var(--sn-info)" opacity={0.12} />
      <path
        d={line}
        fill="none"
        stroke="var(--sn-info)"
        strokeWidth={1.5}
        vectorEffect="non-scaling-stroke"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  );
}

/** Net-new-per-bucket bars beneath the cumulative curve — one grey series, the latest bar in accent. */
function MiniBars({ points }: { points: SeriesPoint[] }) {
  const max = Math.max(1, ...points.map((p) => p.added));
  return (
    <div className="flex h-8 items-end gap-0.5" aria-hidden>
      {points.map((p, i) => (
        <span
          key={i}
          className="flex-1 rounded-sm"
          style={{
            height: `${Math.max(3, (p.added / max) * 100)}%`,
            background: i === points.length - 1 ? 'var(--sn-accent)' : 'var(--sn-ink-300)',
          }}
        />
      ))}
    </div>
  );
}
