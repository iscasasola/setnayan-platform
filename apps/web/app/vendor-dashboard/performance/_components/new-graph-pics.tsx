'use client';

import { formatCount } from '@/lib/format-number';
import { WEEKDAYS, type CardSell, type LostDates, type MonthCount, type QuoteStates, type ReplyVsBooked } from '@/lib/vendor-analytics-graphs';

/**
 * 📈 THE FIVE NEW GRAPHS' PICTURES (Build 6 Lane I) — the prototype's SVGs (`src/an.js` picLost · picCardSell ·
 * picReplyVs · picSlow · picQuotes), drawn from real rows. Counts only, no price. Each takes the graph's own read; the
 * tile decides unread ("Couldn’t load") and empty ("Example", fed `GRAPH_SAMPLE`) before it draws one of these.
 */

const W = 358;

/**
 * a · Dates you lost — a column per weekday, the count on top, the weekday under it (one shape, owner 21 Nov 2026: page
 * text, columns that stretch sideways only). Colours by meaning (owner 22 Nov 2026): "closed" quiet grey, "full" amber —
 * the same amber as "couples asked, you weren't free" on The next 13 weeks.
 */
export function LostPic({ l }: { l: LostDates }) {
  const max = Math.max(1, ...l.byWeekday.map((d) => d.closed + d.full));
  return (
    <span className="ag-lost" data-graph-pic="lost" role="img" aria-label="Dates couples asked for that you could not take, by weekday">
      <span className="ag-lost-cols">
        {WEEKDAYS.map((d, i) => {
          const v = l.byWeekday[i]!;
          const n = v.closed + v.full;
          const hf = (v.full / max) * 100;
          const hc = (v.closed / max) * 100;
          return (
            <span key={d} className="ag-lc">
              <em>{n ? formatCount(n) : ''}</em>
              <span className="ag-col">
                {hf ? <i className="ag-full" style={{ height: `${hf}%` }} /> : null}
                {hc ? <i className="ag-closed" style={{ height: `${hc}%`, bottom: `${hf}%` }} /> : null}
              </span>
              <span className={n ? 'ag-d' : undefined}>{d}</span>
            </span>
          );
        })}
      </span>
      <span className="ag-leg">
        <span>
          <i className="ag-s-closed" />
          you were closed
        </span>
        <span>
          <i className="ag-s-full" />
          you were full
        </span>
      </span>
    </span>
  );
}

/** b · Which card sells — per card, asked and booked bars. Opens per card are not recorded, so no opened bar. */
export function CardSellPic({ c }: { c: readonly CardSell[] }) {
  const rows = c.slice(0, 5);
  // Opened is drawn only when it was read (`opened !== null`) — the prototype's three bars: opened · asked · booked.
  const withOpens = rows.some((r) => r.opened !== null);
  const max = Math.max(1, ...rows.map((r) => Math.max(r.asked, r.opened ?? 0)));
  const rowH = withOpens ? 34 : 30;
  const bar = (v: number) => Math.max(2, (v / max) * (W - 70));
  return (
    <>
      <svg
        viewBox={`0 0 ${W} ${Math.max(rows.length, 1) * rowH}`}
        className="ag-svg"
        role="img"
        aria-label={withOpens ? 'Opened, asked and booked per service card' : 'Asked and booked per service card'}
        data-graph-pic="cardsell"
      >
        {rows.map((r, i) => {
          const y = i * rowH;
          const name = r.name.length > 26 ? `${r.name.slice(0, 25)}…` : r.name;
          const bars: [number, string][] = [...(withOpens ? ([[r.opened ?? 0, 'ag-pale']] as [number, string][]) : []), [r.asked, 'ag-mul'], [r.booked, 'ag-ok2']];
          return (
            <g key={r.serviceId}>
              <text className="ag-lbl" x={0} y={y + 11}>
                {name}
              </text>
              {bars.map(([v, cls], j) => (
                <rect key={cls} className={cls} x={0} y={y + 15 + j * 6} width={bar(v)} height={4} rx={1.5} />
              ))}
              <text className="ag-bk" x={W} y={y + 24} textAnchor="end">
                {withOpens ? `${formatCount(r.opened ?? 0)} · ` : ''}
                {formatCount(r.asked)} · {formatCount(r.booked)}
              </text>
            </g>
          );
        })}
      </svg>
      <div className="ag-leg">
        {withOpens ? <span className="ag-leg-opened">▬ opened</span> : null}
        <span className="ag-leg-mul">▬ asked</span>
        <span className="ag-leg-ok">▬ booked</span>
      </div>
    </>
  );
}

/** c · Reply speed vs bookings — two rows, each bar the share of all answered, booked part filled. */
export function ReplyVsPic({ r }: { r: ReplyVsBooked }) {
  const total = Math.max(1, r.fast.n + r.slow.n);
  const rows = [
    { l: 'Replied within the hour', b: r.fast },
    { l: 'Replied later', b: r.slow },
  ];
  return (
    <div className="ag-rv" data-graph-pic="replyvs">
      {rows.map((x) => (
        <div key={x.l}>
          <div className="ag-rv-k">
            <span>{x.l}</span>
            <span className="tabular-nums">
              {formatCount(x.b.booked)} of {formatCount(x.b.n)} booked
            </span>
          </div>
          <div className="ag-rv-t">
            <i style={{ width: `${(x.b.n / total) * 100}%` }}>
              <i style={{ width: `${x.b.n ? (x.b.booked / x.b.n) * 100 : 0}%` }} />
            </i>
          </div>
        </div>
      ))}
    </div>
  );
}

/** d · Slow months ahead — a column per month; an empty month is a ring, a thin month pale. */
export function SlowPic({ months, label = 'Live bookings by month, the next 12', pic = 'slow' }: { months: readonly MonthCount[]; label?: string; pic?: string }) {
  const max = Math.max(1, ...months.map((m) => m.count));
  const colW = W / months.length;
  const H = 44;
  return (
    <svg viewBox={`0 0 ${W} 62`} className="ag-svg" role="img" aria-label={label} data-graph-pic={pic}>
      {months.map((m, i) => {
        const x = i * colW + 3;
        const bw = colW - 6;
        const h = (m.count / max) * H;
        return (
          <g key={m.key}>
            <rect className="ag-gr" x={x} y={0} width={bw} height={H} rx={2} />
            {h ? <rect className={m.count <= 1 ? 'ag-ok ag-thin-m' : 'ag-ok'} x={x} y={H - h} width={bw} height={h} rx={2} /> : <rect className="ag-rng" x={x + 0.8} y={0.8} width={bw - 1.6} height={H - 1.6} rx={2} />}
            <text className={m.count === 0 ? 'ag-bk ag-d' : 'ag-bk'} x={x + bw / 2} y={58} textAnchor="middle">
              {m.label}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

/** e · Quotes waiting — one strip of the four states, each sized by its count. */
export function QuotesPic({ q }: { q: QuoteStates }) {
  const seg = (
    [
      ['Accepted', q.accepted, 'ag-acc'],
      ['Waiting', q.waiting, 'ag-wait2'],
      ['Expired', q.expired, 'ag-exp'],
      ['Declined', q.declined, 'ag-gr'],
    ] as const
  ).filter(([, n]) => n > 0);
  const tot = Math.max(1, q.sent);
  let x = 0;
  return (
    <>
      <svg viewBox={`0 0 ${W} 38`} className="ag-svg" role="img" aria-label="Quotations by state" data-graph-pic="quotes">
        {seg.map(([l, n, cls]) => {
          const w = (n / tot) * W;
          const at = x;
          x += w;
          return (
            <g key={l}>
              <rect className={cls} x={at} y={0} width={Math.max(w - 2, 2)} height={18} rx={3} />
              <text className="ag-bk ag-d" x={at + 2} y={32}>
                {l} {n}
              </text>
            </g>
          );
        })}
      </svg>
      <p className="ag-cap">
        of <b>{formatCount(q.sent)} sent</b> · {formatCount(q.accepted)} of {formatCount(q.sent)} accepted
      </p>
    </>
  );
}

/**
 * 🎠 THE THREE COUNT CARDS' PICTURE — ONE SHAPE (owner 21 Nov 2026, drawing `analytics_one_shape_2026-11-21`): Opened =
 * a line over its area, Asked and Booked = bars, one per day (30 days) or month (12 months). The plot stretches
 * SIDEWAYS only inside the fixed 144-px box (`preserveAspectRatio="none"`, strokes that never scale); its words — the
 * three dates and the key — are page text on the type scale, so they never grow. The dashed "same days last year"
 * line and the "+N% vs last year" key are drawn only when a percent is shown (lib/analytics-vs-last-year.ts). The line
 * is uncovered left to right and the bars grow once the card is seen (`.perf-play` from `Reanimate`); still under
 * reduced motion. Colours by meaning (owner 22 Nov 2026): the CSS paints opened blue · asked amber · booked green.
 */
const PW = 300;
const PH = 100;

/** The key over the plot: "+23% vs last year ----", or "Last year: couldn’t load". */
export type CountKey = { word: string; dir: 'up' | 'down' | 'flat' } | { unread: true };

export function CountPic({
  kind,
  values,
  lastYear,
  axis,
  countKey,
  label: named,
  pic,
}: {
  kind: 'opened' | 'asked' | 'booked';
  /** The picture's name for a reader, when it is not one of the three count cards (the Store's series graphs). */
  label?: string;
  /** `data-graph-pic`, when it is not `kind`. */
  pic?: string;
  values: readonly number[];
  /** Last year's buckets, the same length — drawn dashed; null = no line. */
  lastYear: readonly number[] | null;
  /** First · middle · last label, page text. */
  axis: readonly [string, string, string] | null;
  countKey: CountKey | null;
}) {
  const n = Math.max(values.length, 1);
  const ly = lastYear && lastYear.length === values.length ? lastYear : null;
  const max = Math.max(1, ...values, ...(ly ?? []));
  // The top of the plot is left for the key, so the tallest point never runs under it.
  const top = countKey ? 28 : 6;
  const y = (v: number) => PH - (v / max) * (PH - top);
  const xLine = (i: number) => (n === 1 ? PW / 2 : (i * PW) / (n - 1));
  const gap = n > 12 ? 3 : 8;
  const bw = (PW - (n - 1) * gap) / n;
  const xBar = (i: number) => i * (bw + gap);
  const path = (vals: readonly number[], x: (i: number) => number) => vals.map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)} ${y(v).toFixed(1)}`).join(' ');
  const line = path(values, xLine);
  // Over bars, last year is a step — one flat dash across each bar's own slot (the drawing's `stepPath`).
  const lyPath = ly
    ? kind === 'opened'
      ? path(ly, xLine)
      : ly.map((v, i) => `${i ? 'L' : 'M'}${xBar(i).toFixed(1)} ${y(v).toFixed(1)} H${(xBar(i) + bw).toFixed(1)}`).join(' ')
    : null;
  const label = named ?? (kind === 'opened' ? 'Opens over the window' : kind === 'asked' ? 'Inquiries over the window' : 'Bookings over the window');
  return (
    <span className="ag-pic" data-graph-pic={pic ?? kind}>
      <span className="ag-plot">
        <svg viewBox={`0 0 ${PW} ${PH}`} preserveAspectRatio="none" role="img" aria-label={ly ? `${label}, with the same days last year dashed` : label}>
          {kind === 'opened' ? (
            <>
              <path className="ag-area" d={`${line} L${PW} ${PH} L0 ${PH} Z`} />
              <path className="ag-line" d={line} />
            </>
          ) : (
            values.map((v, i) =>
              v > 0 ? (
                <rect
                  key={i}
                  className={`ag-bar-${kind} ag-bar-grow`}
                  style={{ animationDelay: `${Math.min(i * 18, 500)}ms` }}
                  x={xBar(i).toFixed(1)}
                  y={y(v).toFixed(1)}
                  width={bw.toFixed(1)}
                  height={(PH - y(v)).toFixed(1)}
                />
              ) : null,
            )
          )}
          {lyPath ? <path className="ag-ly" d={lyPath} data-last-year-line="" /> : null}
        </svg>
        {kind === 'opened' ? <span className="ag-reveal" aria-hidden /> : null}
        {countKey ? (
          'unread' in countKey ? (
            <span className="ag-key" data-vs-last-year="unread">
              Last year: couldn’t load
            </span>
          ) : (
            <span className="ag-key" data-vs-last-year={countKey.dir}>
              <b className={`ag-${countKey.dir}`}>{countKey.word}</b> vs last year <i className="ag-dash" aria-hidden />
            </span>
          )
        ) : null}
      </span>
      <span className="ag-axis" aria-hidden>
        {axis ? (
          <>
            <span>{axis[0]}</span>
            <span>{axis[1]}</span>
            <span>{axis[2]}</span>
          </>
        ) : null}
      </span>
    </span>
  );
}
