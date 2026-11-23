'use client';

import { formatCount } from '@/lib/format-number';
import { vsLastYear, pctWord, type CountKind, type YearLine } from '@/lib/analytics-vs-last-year';

/**
 * 📈 THREE YEARS — tap a count card (owner 21 Nov 2026, *"Yes, add it"*; drawing `analytics_one_shape_2026-11-21`,
 * "Tap a card: three years"). One line per season, December → November — this season in the card's own colour, the
 * one before dashed grey, the oldest dotted — then the yearly totals, each counted to today's month and day, with the
 * change from the year before (the same under-10 rule as the card: under 10 either side, no percent). Only for a shop
 * that has lived two seasons (`yearsToShow`). Pure SVG + page text; the plot stretches sideways only.
 */
const MONTHS = ['Dec', 'May', 'Nov'] as const;
const W = 300;
const H = 100;

export function ThreeYears({ kind, years, word }: { kind: CountKind; years: readonly YearLine[]; word: string }) {
  const max = Math.max(1, ...years.flatMap((y) => y.months.map((m) => m ?? 0)));
  const y = (v: number) => H - 4 - (v / max) * (H - 12);
  const x = (i: number) => (i * W) / 11;
  const lines = years.map((yr) => {
    const pts = yr.months.map((m, i) => (m === null ? null : ([x(i), y(m)] as const))).filter((p): p is readonly [number, number] => p !== null);
    return { label: yr.label, d: pts.map((p, i) => `${i ? 'L' : 'M'}${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(' '), end: pts[pts.length - 1] ?? null };
  });
  // The year labels sit at each line's end, pushed apart so two close lines never print over each other.
  const PLOT_PX = 160;
  const GAP_PX = 14;
  const tops = new Map<string, number>();
  [...lines]
    .filter((l) => l.end)
    .sort((a, b) => a.end![1] - b.end![1])
    .reduce((prev, l) => {
      const at = Math.max((l.end![1] / H) * PLOT_PX, prev + GAP_PX);
      tops.set(l.label, at);
      return at;
    }, -Infinity);
  const cls = (i: number) => (i === lines.length - 1 ? `ag-y2 ag-k-${kind}` : i === lines.length - 2 ? 'ag-y1' : 'ag-y0');
  return (
    <section className="ag-3y" data-three-years={kind} aria-label="Three years">
      <h4 className="ag-subt" style={{ margin: 0 }}>
        {years.length === 3 ? 'Three years' : 'Two years'}
      </h4>
      <div className="ag-3y-plot">
        <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" role="img" aria-label={`${word} per month, one line per year`}>
          {lines.map((l, i) => (l.d ? <path key={l.label} className={cls(i)} d={l.d} /> : null))}
        </svg>
        {lines.map((l, i) =>
          l.end ? (
            <span key={l.label} className={i === lines.length - 1 ? 'ag-3y-lbl ag-now' : 'ag-3y-lbl'} style={{ top: `${tops.get(l.label) ?? 0}px` }}>
              {l.label}
            </span>
          ) : null,
        )}
      </div>
      <div className="ag-3y-axis" aria-hidden>
        <span>{MONTHS[0]}</span>
        <span>{MONTHS[1]}</span>
        <span>{MONTHS[2]}</span>
      </div>
      <div className="ag-3y-tot">
        {years.map((yr, i) => {
          const prev = i > 0 ? years[i - 1]!.total : null;
          const c = prev === null ? null : vsLastYear(yr.total, prev, true);
          return (
            <span key={yr.label} data-year-total={yr.label}>
              <small>{yr.label}</small>
              <b>{formatCount(yr.total)}</b>
              {c === null ? (
                yr.first ? <small>first year</small> : null
              ) : c.show === 'pct' ? (
                <span className={`ag-${c.dir}`}>{pctWord(c)}</span>
              ) : (
                <small>{formatCount(prev ?? 0)} the year before</small>
              )}
            </span>
          );
        })}
      </div>
    </section>
  );
}
