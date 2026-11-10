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
  const max = Math.max(1, ...rows.map((r) => r.asked));
  const rowH = 30;
  return (
    <>
      <svg viewBox={`0 0 ${W} ${Math.max(rows.length, 1) * rowH}`} className="ag-svg" role="img" aria-label="Asked and booked per service card" data-graph-pic="cardsell">
        {rows.map((r, i) => {
          const y = i * rowH;
          const name = r.name.length > 26 ? `${r.name.slice(0, 25)}…` : r.name;
          return (
            <g key={r.serviceId}>
              <text className="ag-lbl" x={0} y={y + 11}>
                {name}
              </text>
              <rect className="ag-mul" x={0} y={y + 15} width={Math.max(2, (r.asked / max) * (W - 70))} height={4} rx={1.5} />
              <rect className="ag-ok2" x={0} y={y + 21} width={Math.max(2, (r.booked / max) * (W - 70))} height={4} rx={1.5} />
              <text className="ag-bk" x={W} y={y + 24} textAnchor="end">
                {formatCount(r.asked)} · {formatCount(r.booked)}
              </text>
            </g>
          );
        })}
      </svg>
      <div className="ag-leg">
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
