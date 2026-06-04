import { LineChart } from 'lucide-react';
import {
  fetchGrowthStats,
  GROWTH_RANGE_OPTIONS,
  type GrowthRangeKey,
  type GrowthSeries,
  type ConversionStats,
  type SeriesPoint,
} from '@/lib/admin/growth-stats';

export const metadata = { title: 'Growth · Admin' };

type Props = {
  searchParams: Promise<{ range?: string }>;
};

const nf = new Intl.NumberFormat('en-PH');

function parseRange(raw: string | undefined): GrowthRangeKey {
  return raw === '3m' || raw === '6m' || raw === '12m' ? raw : '6m';
}

export default async function AdminGrowthPage({ searchParams }: Props) {
  const { range: rawRange } = await searchParams;
  const range = parseRange(rawRange);
  const stats = await fetchGrowthStats(range);
  const rangeLabel =
    GROWTH_RANGE_OPTIONS.find((o) => o.value === range)?.label ?? 'window';

  return (
    <div className="mx-auto w-full max-w-6xl xl:max-w-7xl 2xl:max-w-screen-2xl px-4 py-10 sm:px-6 lg:px-8">
      <header className="mb-6 space-y-2">
        <p className="m-eyebrow text-[color:var(--m-orange-2)]">Setnayan · Internal ops</p>
        <h1 className="m-display-tight text-3xl text-[color:var(--m-ink)] sm:text-4xl">
          Growth &amp; Population
        </h1>
        <p className="max-w-prose text-base text-ink/65">
          Where the platform stands today, and how it&apos;s grown over the{' '}
          {rangeLabel.toLowerCase()}. Counts are live from the platform&apos;s own
          tables; curves track cumulative totals across the window.
        </p>
      </header>

      {/* Range picker — GET form, no client JS (mirrors /admin/funnels). */}
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
          Since {stats.sinceIso.slice(0, 10)}
        </span>
      </form>

      {stats.errors.length > 0 ? (
        <p
          role="alert"
          className="mb-6 rounded-md border border-terracotta/30 bg-terracotta/10 px-4 py-3 text-sm text-terracotta-700"
        >
          Some metrics couldn&apos;t load: {stats.errors.join(' · ')}
        </p>
      ) : null}

      {/* ── POPULATION NOW ─────────────────────────────────────────── */}
      <section className="mb-10">
        <SectionHeading
          icon
          title="Population now"
          blurb="Current totals across the platform."
        />
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          <StatTile label="Account holders" value={nf.format(stats.population.accountHolders)} />
          <StatTile label="Customers" value={nf.format(stats.population.customers)} />
          <StatTile
            label="Vendors"
            value={nf.format(stats.population.vendors)}
            sub={`${nf.format(stats.population.vendorsPublished)} published`}
          />
          <StatTile
            label="Services"
            value={nf.format(stats.population.services)}
            sub={`${nf.format(stats.population.servicesActive)} active`}
          />
          <StatTile label="Events" value={nf.format(stats.population.events)} />
          <StatTile label="Guests" value={nf.format(stats.population.guests)} />
        </div>
      </section>

      {/* ── GROWTH OVER TIME ───────────────────────────────────────── */}
      <section className="mb-10">
        <SectionHeading
          title="Growth over time"
          blurb={`Cumulative totals (line) and net new per period (bars) across the ${rangeLabel.toLowerCase()}.`}
        />
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {stats.series.map((s) => (
            <GrowthCard key={s.key} series={s} />
          ))}
        </div>
      </section>

      {/* ── GUEST → ACCOUNT CONVERSION ─────────────────────────────── */}
      <section className="mb-4">
        <SectionHeading
          title="Guest → account conversion"
          blurb="How many invited guests went on to hold a Setnayan account."
        />
        <ConversionCard c={stats.conversion} rangeLabel={rangeLabel} />
      </section>
    </div>
  );
}

/* ────────────────────────────────────────────────────────────────── */
/* Presentational helpers (server-rendered, no client JS)             */
/* ────────────────────────────────────────────────────────────────── */

function SectionHeading({
  title,
  blurb,
  icon = false,
}: {
  title: string;
  blurb: string;
  icon?: boolean;
}) {
  return (
    <header className="mb-3 flex items-center gap-2">
      {icon ? (
        <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--m-orange)]/10 text-[var(--m-orange-2)]">
          <LineChart aria-hidden className="h-4 w-4" strokeWidth={1.75} />
        </span>
      ) : null}
      <div>
        <h2 className="text-base font-semibold text-ink">{title}</h2>
        <p className="text-xs text-ink/55">{blurb}</p>
      </div>
    </header>
  );
}

function StatTile({
  label,
  value,
  sub,
}: {
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <div className="m-card p-4">
      <p className="m-label-mono" style={{ color: 'var(--m-slate-2)' }}>
        {label}
      </p>
      <p
        className="mt-1 text-2xl font-semibold tabular-nums"
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

function DeltaChip({ value }: { value: number }) {
  const positive = value > 0;
  return (
    <span
      className="shrink-0 rounded-full px-2 py-0.5 text-xs font-medium tabular-nums"
      style={
        positive
          ? { background: '#ECFDF5', color: '#065F46' }
          : { background: 'var(--m-paper-2)', color: 'var(--m-slate)' }
      }
    >
      {positive ? '+' : ''}
      {nf.format(value)}
    </span>
  );
}

function GrowthCard({ series }: { series: GrowthSeries }) {
  return (
    <div className="m-card p-5">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="m-label-mono" style={{ color: 'var(--m-slate-2)' }}>
            {series.label}
          </p>
          <p
            className="mt-1 text-3xl font-semibold tabular-nums"
            style={{ color: 'var(--m-ink)' }}
          >
            {nf.format(series.total)}
          </p>
        </div>
        <DeltaChip value={series.newInRange} />
      </div>
      <div className="mt-4">
        <Sparkline points={series.points} ariaLabel={`${series.label} cumulative growth`} />
      </div>
      <div className="mt-2">
        <MiniBars points={series.points} />
      </div>
      <p className="mt-2 text-[11px]" style={{ color: 'var(--m-slate)' }}>
        Net new this period
      </p>
    </div>
  );
}

function ConversionCard({
  c,
  rangeLabel,
}: {
  c: ConversionStats;
  rangeLabel: string;
}) {
  const ratePct = c.totalGuests > 0 ? `${(c.rate * 100).toFixed(1)}%` : '—';
  const median =
    c.medianDaysToConvert === null
      ? '—'
      : `${Math.round(c.medianDaysToConvert)} ${
          Math.round(c.medianDaysToConvert) === 1 ? 'day' : 'days'
        }`;
  return (
    <div className="m-card p-5">
      <div className="grid gap-5 lg:grid-cols-[1fr_1.4fr]">
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-2">
          <div>
            <p className="m-label-mono" style={{ color: 'var(--m-slate-2)' }}>
              Conversion rate
            </p>
            <p
              className="mt-1 text-4xl font-semibold tabular-nums"
              style={{ color: 'var(--m-ink)' }}
            >
              {ratePct}
            </p>
          </div>
          <div>
            <p className="m-label-mono" style={{ color: 'var(--m-slate-2)' }}>
              Converted
            </p>
            <p
              className="mt-1 text-2xl font-semibold tabular-nums"
              style={{ color: 'var(--m-ink)' }}
            >
              {nf.format(c.converted)}
              <span className="text-base font-normal" style={{ color: 'var(--m-slate)' }}>
                {' '}
                / {nf.format(c.totalGuests)}
              </span>
            </p>
          </div>
          <div>
            <p className="m-label-mono" style={{ color: 'var(--m-slate-2)' }}>
              New this period
            </p>
            <p
              className="mt-1 text-2xl font-semibold tabular-nums"
              style={{ color: 'var(--m-ink)' }}
            >
              {c.newInRange >= 0 ? '+' : ''}
              {nf.format(c.newInRange)}
            </p>
          </div>
          <div>
            <p className="m-label-mono" style={{ color: 'var(--m-slate-2)' }}>
              Median time to convert
            </p>
            <p
              className="mt-1 text-2xl font-semibold tabular-nums"
              style={{ color: 'var(--m-ink)' }}
            >
              {median}
            </p>
            {c.sampleSize > 0 ? (
              <p className="mt-0.5 text-[11px]" style={{ color: 'var(--m-slate)' }}>
                n={nf.format(c.sampleSize)} in range
              </p>
            ) : null}
          </div>
        </div>
        <div className="flex flex-col justify-center">
          <p className="m-label-mono mb-2" style={{ color: 'var(--m-slate-2)' }}>
            Cumulative conversions · {rangeLabel.toLowerCase()}
          </p>
          <Sparkline points={c.points} ariaLabel="Cumulative guest conversions" />
          <div className="mt-2">
            <MiniBars points={c.points} />
          </div>
        </div>
      </div>
      <p className="mt-4 border-t border-ink/10 pt-3 text-[11px]" style={{ color: 'var(--m-slate)' }}>
        A conversion is a guest-list entry that became tied to a real Setnayan
        account (joined by QR scan or invite link). Rate is converted ÷ all
        non-removed guests, all-time.
      </p>
    </div>
  );
}

/** Cumulative-curve sparkline. Pure SVG — stretches to its container width. */
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
      <path d={area} fill="var(--m-orange)" opacity={0.12} />
      <path
        d={line}
        fill="none"
        stroke="var(--m-orange)"
        strokeWidth={1.5}
        vectorEffect="non-scaling-stroke"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  );
}

/** Net-new-per-bucket bars beneath the cumulative curve. */
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
            background: 'var(--m-orange)',
            opacity: 0.45,
          }}
        />
      ))}
    </div>
  );
}
