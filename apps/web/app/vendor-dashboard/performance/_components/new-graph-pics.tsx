'use client';

import { formatCount } from '@/lib/format-number';
import { WEEKDAYS, type CardSell, type LostDates, type MonthCount, type QuoteStates, type ReplyVsBooked } from '@/lib/vendor-analytics-graphs';

/**
 * 📈 THE FIVE NEW GRAPHS' PICTURES (Build 6 Lane I) — the prototype's SVGs (`src/an.js` picLost · picCardSell ·
 * picReplyVs · picSlow · picQuotes), drawn from real rows. Counts only, no price. Each takes the graph's own read; the
 * tile decides unread ("Couldn’t load") and empty ("Example", fed `GRAPH_SAMPLE`) before it draws one of these.
 */

const W = 358;

/** a · Dates you lost — a column per weekday: closed (mulberry) under full (gold), the count under it. */
export function LostPic({ l }: { l: LostDates }) {
  const max = Math.max(1, ...l.byWeekday.map((d) => d.closed + d.full));
  const colW = W / 7;
  const H = 48;
  return (
    <>
      <svg viewBox={`0 0 ${W} 66`} className="ag-svg" role="img" aria-label="Dates couples asked for that you could not take, by weekday" data-graph-pic="lost">
        {WEEKDAYS.map((d, i) => {
          const x = i * colW + 6;
          const bw = colW - 12;
          const v = l.byWeekday[i]!;
          const hf = (v.full / max) * H;
          const hc = (v.closed / max) * H;
          const n = v.closed + v.full;
          return (
            <g key={d}>
              <rect className="ag-gr" x={x} y={0} width={bw} height={H} rx={3} />
              {hc ? <rect className="ag-mul" x={x} y={H - hc - hf} width={bw} height={hc} rx={2} /> : null}
              {hf ? <rect className="ag-ok2" x={x} y={H - hf} width={bw} height={hf} rx={2} /> : null}
              <text className={n ? 'ag-bk ag-d' : 'ag-bk'} x={x + bw / 2} y={62} textAnchor="middle">
                {n ? `${d} · ${n}` : d}
              </text>
            </g>
          );
        })}
      </svg>
      <div className="ag-leg">
        <span className="ag-leg-mul">▬ you were closed</span>
        <span className="ag-leg-ok">▬ you were full</span>
      </div>
    </>
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
        {withOpens ? <span>▬ opened</span> : null}
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
export function SlowPic({ months }: { months: readonly MonthCount[] }) {
  const max = Math.max(1, ...months.map((m) => m.count));
  const colW = W / months.length;
  const H = 44;
  return (
    <svg viewBox={`0 0 ${W} 62`} className="ag-svg" role="img" aria-label="Live bookings by month, the next 12" data-graph-pic="slow">
      {months.map((m, i) => {
        const x = i * colW + 3;
        const bw = colW - 6;
        const h = (m.count / max) * H;
        return (
          <g key={m.key}>
            <rect className="ag-gr" x={x} y={0} width={bw} height={H} rx={2} />
            {h ? <rect className={m.count <= 1 ? 'ag-pale' : 'ag-ok'} x={x} y={H - h} width={bw} height={h} rx={2} /> : <rect className="ag-rng" x={x + 0.8} y={0.8} width={bw - 1.6} height={H - 1.6} rx={2} />}
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
 * 🎠 THE THREE COUNT CARDS' PICTURES (owner 11 Nov: Opened · Asked · Booked are cards of their own, each with its window
 * switch). Opened = the opens as a line over the window; Asked and Booked = bars, one per day (30 days) or month (12
 * months). The lanes' own classes (`.ag-lanes`), so the colours are the approved ones. The line draws in and the bars
 * grow once the card is seen (`.perf-play` from `Reanimate`); still under reduced motion.
 */
const CW = 300;
function CountAxis({ labels, y }: { labels: readonly string[]; y: number }) {
  if (labels.length === 0) return null;
  const picks = [labels[0]!, labels[Math.floor((labels.length - 1) / 2)]!, labels[labels.length - 1]!];
  return (
    <>
      <text className="ag-xl" x={0} y={y}>
        {picks[0]}
      </text>
      <text className="ag-xl" x={CW / 2} y={y} textAnchor="middle">
        {picks[1]}
      </text>
      <text className="ag-xl" x={CW} y={y} textAnchor="end">
        {picks[2]}
      </text>
    </>
  );
}

export function CountLinePic({ values, labels }: { values: readonly number[]; labels: readonly string[] }) {
  const h = 70;
  const n = Math.max(values.length, 2);
  const max = Math.max(1, ...values);
  const pts = values.map((v, i) => [(i * CW) / (n - 1), h - 2 - (v / max) * (h - 10)] as const);
  const line = pts.map((p, i) => `${i ? 'L' : 'M'}${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(' ');
  const area = `${line} L${CW} ${h - 2} L0 ${h - 2} Z`;
  return (
    <svg viewBox={`0 0 ${CW} ${h + 14}`} className="ag-lanes" role="img" aria-label="Opens over the window" data-graph-pic="opened">
      <path className="ag-varea ag-fade-in" d={area} />
      <path className="ag-vline ag-draw" d={line} pathLength={1} />
      <line className="ag-base" x1={0} x2={CW} y1={h - 2} y2={h - 2} />
      <CountAxis labels={labels} y={h + 12} />
    </svg>
  );
}

export function CountBarsPic({ values, labels, kind }: { values: readonly number[]; labels: readonly string[]; kind: 'asked' | 'booked' }) {
  const h = 70;
  const n = Math.max(values.length, 1);
  const gap = n > 12 ? 3 : 8;
  const bw = (CW - (n - 1) * gap) / n;
  const max = Math.max(1, ...values);
  return (
    <svg viewBox={`0 0 ${CW} ${h + 14}`} className="ag-lanes" role="img" aria-label={kind === 'asked' ? 'Inquiries over the window' : 'Bookings over the window'} data-graph-pic={kind}>
      <line className="ag-base" x1={0} x2={CW} y1={h - 2} y2={h - 2} />
      {values.map((v, i) =>
        v > 0 ? (
          <rect
            key={i}
            className={`${kind === 'asked' ? 'ag-abar' : 'ag-bbar'} ag-grow`}
            style={{ animationDelay: `${Math.min(i * 18, 500)}ms` }}
            x={(i * (bw + gap)).toFixed(1)}
            y={(h - 2 - Math.max(3, (v / max) * (h - 10))).toFixed(1)}
            width={bw.toFixed(1)}
            height={Math.max(3, (v / max) * (h - 10)).toFixed(1)}
            rx={2}
          />
        ) : null,
      )}
      <CountAxis labels={labels} y={h + 12} />
    </svg>
  );
}
