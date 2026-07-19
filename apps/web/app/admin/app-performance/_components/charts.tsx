import type { ReactNode } from 'react';

/**
 * App Performance cockpit — server-rendered SVG chart primitives.
 *
 * WHY hand-rolled SVG (same doctrine as /admin/growth's Sparkline): no chart
 * library, no client JS — every chart is static markup that streams with the
 * RSC payload and prints crisply. Animation is layered on OPTIONALLY by
 * CockpitFx (fx.tsx) via the `apx-draw` / `data-reveal` hooks; without JS or
 * under prefers-reduced-motion these render in their final state.
 *
 * All strokes/fills use the editorial --m-* palette vars. Every <svg> carries
 * role="img" + a descriptive aria-label (the data is otherwise presentational
 * paths). Numbers next to charts are the accessible source of truth.
 */

const CHART_W = 320;
const CHART_H = 96;
const PAD_Y = 6;

function scaleMax(values: number[]): number {
  return Math.max(1, ...values);
}

/** Per-bucket bar chart (net-new style). Bars grow from the baseline. */
export function BucketBars({
  values,
  ariaLabel,
  color = 'var(--m-orange)',
}: {
  values: number[];
  ariaLabel: string;
  color?: string;
}) {
  const n = Math.max(1, values.length);
  const max = scaleMax(values);
  const slot = CHART_W / n;
  const barW = Math.max(4, slot * 0.62);
  return (
    <svg
      viewBox={`0 0 ${CHART_W} ${CHART_H}`}
      className="h-24 w-full"
      role="img"
      aria-label={ariaLabel}
      preserveAspectRatio="none"
    >
      <line
        x1={0}
        y1={CHART_H - 0.5}
        x2={CHART_W}
        y2={CHART_H - 0.5}
        stroke="var(--m-line)"
        strokeWidth={1}
      />
      {values.map((v, i) => {
        const h = v <= 0 ? 0 : Math.max(2, ((CHART_H - PAD_Y) * v) / max);
        return (
          <rect
            key={i}
            className="apx-bar"
            x={i * slot + (slot - barW) / 2}
            y={CHART_H - h}
            width={barW}
            height={h}
            rx={2}
            fill={color}
            opacity={0.75}
          >
            <title>{`${v}`}</title>
          </rect>
        );
      })}
    </svg>
  );
}

/** Stacked per-bucket bars — up to 3 series (monetization streams, report statuses). */
export function StackedBars({
  series,
  ariaLabel,
  formatTitle,
}: {
  series: { label: string; color: string; values: number[] }[];
  ariaLabel: string;
  formatTitle?: (label: string, value: number) => string;
}) {
  const n = Math.max(1, ...series.map((s) => s.values.length));
  const totals = Array.from({ length: n }, (_, i) =>
    series.reduce((sum, s) => sum + (s.values[i] ?? 0), 0),
  );
  const max = scaleMax(totals);
  const slot = CHART_W / n;
  const barW = Math.max(4, slot * 0.62);
  return (
    <svg
      viewBox={`0 0 ${CHART_W} ${CHART_H}`}
      className="h-24 w-full"
      role="img"
      aria-label={ariaLabel}
      preserveAspectRatio="none"
    >
      <line
        x1={0}
        y1={CHART_H - 0.5}
        x2={CHART_W}
        y2={CHART_H - 0.5}
        stroke="var(--m-line)"
        strokeWidth={1}
      />
      {Array.from({ length: n }, (_, i) => {
        let yCursor = CHART_H;
        return (
          <g key={i} className="apx-bar">
            {series.map((s) => {
              const v = s.values[i] ?? 0;
              if (v <= 0) return null;
              const h = Math.max(1.5, ((CHART_H - PAD_Y) * v) / max);
              yCursor -= h;
              return (
                <rect
                  key={s.label}
                  x={i * slot + (slot - barW) / 2}
                  y={yCursor}
                  width={barW}
                  height={h}
                  fill={s.color}
                  opacity={0.85}
                >
                  <title>
                    {formatTitle ? formatTitle(s.label, v) : `${s.label}: ${v}`}
                  </title>
                </rect>
              );
            })}
          </g>
        );
      })}
    </svg>
  );
}

/**
 * Normalized growth-index overlay — every series rebased to 100 at the window
 * open, so the steepest line = fastest relative grower regardless of absolute
 * size. `pathLength=1` lets fx.tsx run the draw-in without measuring paths.
 */
export function IndexChart({
  series,
  ariaLabel,
}: {
  series: { label: string; color: string; index: number[] }[];
  ariaLabel: string;
}) {
  const H = 140;
  const all = series.flatMap((s) => s.index);
  const min = Math.min(100, ...all);
  const max = Math.max(101, ...all);
  const y = (v: number) => 6 + (H - 12) * (1 - (v - min) / (max - min));
  const x = (i: number, n: number) => (n <= 1 ? 0 : (CHART_W * i) / (n - 1));
  return (
    <svg
      viewBox={`0 0 ${CHART_W} ${H}`}
      className="h-36 w-full"
      role="img"
      aria-label={ariaLabel}
      preserveAspectRatio="none"
    >
      <line
        x1={0}
        y1={y(100)}
        x2={CHART_W}
        y2={y(100)}
        stroke="var(--m-line)"
        strokeWidth={1}
        strokeDasharray="3 4"
      />
      {series.map((s) => (
        <polyline
          key={s.label}
          className="apx-draw"
          fill="none"
          stroke={s.color}
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
          pathLength={1}
          points={s.index.map((v, i) => `${x(i, s.index.length)},${y(v)}`).join(' ')}
        >
          <title>{`${s.label}: ${Math.round(s.index[s.index.length - 1] ?? 100)} (index, start = 100)`}</title>
        </polyline>
      ))}
    </svg>
  );
}

/** Diverging leaderboard row — signed %Δ bar from a center axis. */
export function LeaderRow({
  label,
  pct,
  inverseGood = false,
  insufficient = false,
  note,
}: {
  label: string;
  /** Signed fraction, e.g. 0.24 = +24%. */
  pct: number | null;
  /** True when a RISING number is bad (reports). */
  inverseGood?: boolean;
  insufficient?: boolean;
  note?: string;
}) {
  const shown = pct === null ? null : Math.max(-2, Math.min(2, pct));
  const width = shown === null ? 0 : Math.min(50, Math.abs(shown) * 50);
  const positive = (shown ?? 0) >= 0;
  const good = inverseGood ? !positive : positive;
  const barColor = good ? 'var(--m-sage-deep)' : 'var(--m-blush-deep)';
  return (
    <li className="flex items-center gap-3 py-1.5">
      <span className="w-40 shrink-0 truncate text-sm" style={{ color: 'var(--m-ink)' }}>
        {label}
        {note ? (
          <span className="ml-1 text-[10px]" style={{ color: 'var(--m-slate-3)' }}>
            {note}
          </span>
        ) : null}
      </span>
      <span aria-hidden className="relative block h-2.5 flex-1 rounded-full bg-[var(--m-paper-2)]">
        <span
          className="absolute top-0 h-2.5 w-px"
          style={{ left: '50%', background: 'var(--m-line)' }}
        />
        {insufficient || shown === null ? null : (
          <span
            className="apx-lb absolute top-0 h-2.5 rounded-full"
            style={{
              left: positive ? '50%' : `${50 - width}%`,
              width: `${Math.max(1.5, width)}%`,
              background: barColor,
              opacity: 0.8,
            }}
          />
        )}
      </span>
      <span
        className="w-24 shrink-0 text-right text-sm font-medium tabular-nums"
        style={{
          color: insufficient || shown === null ? 'var(--m-slate-3)' : barColor,
        }}
      >
        {insufficient || pct === null
          ? 'not enough data'
          : `${pct > 0 ? '+' : ''}${Math.round(pct * 100)}%`}
      </span>
    </li>
  );
}

/** Live / Needs-wiring honesty pill (plan § 3 tags). */
export function StatusPill({ state }: { state: 'live' | 'wiring' }) {
  if (state === 'live') {
    return (
      <span
        className="shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em]"
        style={{ background: 'var(--m-sage)', color: '#2E4A2A' }}
      >
        Live
      </span>
    );
  }
  return (
    <span
      className="shrink-0 rounded-full border border-dashed px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em]"
      style={{ borderColor: 'var(--m-orange-2)', color: '#7A5D24', background: 'var(--m-orange-4)' }}
    >
      Needs wiring
    </span>
  );
}

/** Card shell with title row + honesty pill + source caption. */
export function ChartCard({
  title,
  pill,
  source,
  children,
  muted = false,
  className = '',
}: {
  title: string;
  pill: 'live' | 'wiring';
  source: string;
  children: ReactNode;
  muted?: boolean;
  className?: string;
}) {
  return (
    <div
      data-reveal=""
      className={`m-card p-5 ${muted ? 'opacity-80' : ''} ${className}`}
      style={muted ? { borderStyle: 'dashed' } : undefined}
    >
      <div className="mb-1 flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold" style={{ color: 'var(--m-ink)' }}>
          {title}
        </h3>
        <StatusPill state={pill} />
      </div>
      <p className="mb-3 font-mono text-[10px] uppercase tracking-[0.12em]" style={{ color: 'var(--m-slate-2)' }}>
        {source}
      </p>
      {children}
    </div>
  );
}

/** ▲/▼ %Δ chip vs the previous equal-length window. */
export function DeltaPct({
  current,
  previous,
  inverseGood = false,
}: {
  current: number;
  previous: number;
  inverseGood?: boolean;
}) {
  if (previous < 1) {
    return (
      <span className="text-[11px]" style={{ color: 'var(--m-slate-3)' }}>
        no prior-period base
      </span>
    );
  }
  const pct = (current - previous) / previous;
  const positive = pct >= 0;
  const good = inverseGood ? !positive : positive;
  return (
    <span
      className="rounded-full px-2 py-0.5 text-[11px] font-medium tabular-nums"
      style={{
        background: good ? 'var(--m-sage)' : 'var(--m-blush)',
        color: good ? '#2E4A2A' : '#7C3A22',
      }}
    >
      {positive ? '▲' : '▼'} {Math.abs(Math.round(pct * 100))}% vs prev period
    </span>
  );
}
