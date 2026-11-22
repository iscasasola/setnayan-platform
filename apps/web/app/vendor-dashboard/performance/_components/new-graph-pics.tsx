'use client';

import { formatCount } from '@/lib/format-number';
import { WEEKDAYS, type CardSell, type LostDates, type MonthCount, type QuoteStates, type ReplyVsBooked } from '@/lib/vendor-analytics-graphs';

/**
 * 📈 THE FIVE NEW GRAPHS' PICTURES (Build 6 Lane I) — the prototype's SVGs (`src/an.js` picLost · picCardSell ·
 * picReplyVs · picSlow · picQuotes), drawn from real rows. Counts only, no price. Each takes the graph's own read; the
 * tile decides unread ("Couldn’t load") and empty ("Example", fed `GRAPH_SAMPLE`) before it draws one of these.
 */


/**
 * a · Dates you lost — a column per weekday: closed (grey) on top of full (the supplier colour), its count above and its
 * day below as page text (one shape, 21 Nov 2026 — the two were near-identical blues), the legend inside the box.
 */
export function LostPic({ l }: { l: LostDates }) {
  const max = Math.max(1, ...l.byWeekday.map((d) => d.closed + d.full));
  return (
    <span className="ag-pic" role="img" aria-label="Dates couples asked for that you could not take, by weekday" data-graph-pic="lost">
      <span className="ag-lost">
        {WEEKDAYS.map((d, i) => {
          const v = l.byWeekday[i]!;
          const n = v.closed + v.full;
          const hf = (v.full / max) * 100;
          const hc = (v.closed / max) * 100;
          return (
            <span key={d} className="ag-lc">
              <em>{n ? formatCount(n) : ''}</em>
              <i className="ag-col">
                {hf ? <i className="ag-full ag-grow" style={{ height: `${hf.toFixed(0)}%`, animationDelay: `${i * 60}ms` }} /> : null}
                {hc ? <i className="ag-closed ag-grow" style={{ height: `${hc.toFixed(0)}%`, bottom: `${hf.toFixed(0)}%`, animationDelay: `${i * 60}ms` }} /> : null}
              </i>
              <span className={n ? 'ag-d' : undefined}>{d}</span>
            </span>
          );
        })}
      </span>
      <span className="ag-leg2" aria-hidden>
        <span>
          <i className="ag-s-c" />
          you were closed
        </span>
        <span>
          <i className="ag-s-f" />
          you were full
        </span>
      </span>
    </span>
  );
}

/**
 * b · Which card sells — per card, its name and counts as page text and a thin bar each for opened (when read), asked
 * and booked. The card's 144-px box shows the top three; the opened view shows up to five (one shape, 21 Nov 2026).
 */
export function CardSellPic({ c }: { c: readonly CardSell[] }) {
  const rows = c.slice(0, 5);
  // Opened is drawn only when it was read (`opened !== null`) — the prototype's three bars: opened · asked · booked.
  const withOpens = rows.some((r) => r.opened !== null);
  const max = Math.max(1, ...rows.map((r) => Math.max(r.asked, r.opened ?? 0)));
  return (
    <span className="ag-pic ag-pic-free" role="img" aria-label={withOpens ? 'Opened, asked and booked per service card' : 'Asked and booked per service card'} data-graph-pic="cardsell">
      <span className="ag-cs">
        {rows.map((r) => {
          const bars: [number, string][] = [...(withOpens ? ([[r.opened ?? 0, 'ag-pale']] as [number, string][]) : []), [r.asked, 'ag-mul'], [r.booked, 'ag-ok2']];
          return (
            <span key={r.serviceId} className="ag-cs-row">
              <span className="ag-cs-n">{r.name}</span>
              <em>
                {withOpens ? `${formatCount(r.opened ?? 0)} · ` : ''}
                {formatCount(r.asked)} · {formatCount(r.booked)}
              </em>
              <span className="ag-cs-b">
                {bars.map(([v, cls]) => (
                  <i key={cls} className={cls} style={{ width: `${Math.max(1, (v / max) * 100).toFixed(0)}%` }} />
                ))}
              </span>
            </span>
          );
        })}
      </span>
      <span className="ag-leg2" aria-hidden>
        {withOpens ? (
          <span>
            <i className="ag-s-p" />
            opened
          </span>
        ) : null}
        <span>
          <i className="ag-s-a" />
          asked
        </span>
        <span>
          <i className="ag-s-b" />
          booked
        </span>
      </span>
    </span>
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

/** d · Slow months ahead — a column per month; an empty month is a dashed outline, a thin month pale. Months are page text. */
export function SlowPic({ months }: { months: readonly MonthCount[] }) {
  const max = Math.max(1, ...months.map((m) => m.count));
  return (
    <span className="ag-pic ag-pic-cols" role="img" aria-label="Live bookings by month, the next 12" data-graph-pic="slow">
      <span className="ag-lost ag-slow" style={{ gridTemplateColumns: `repeat(${Math.max(months.length, 1)}, minmax(0, 1fr))` }}>
        {months.map((m, i) => (
          <span key={m.key} className="ag-lc">
            <em>{m.count ? formatCount(m.count) : ''}</em>
            <i className={m.count === 0 ? 'ag-col ag-col-none' : 'ag-col'}>
              {m.count ? <i className={`${m.count <= 1 ? 'ag-thin' : 'ag-full'} ag-grow`} style={{ height: `${((m.count / max) * 100).toFixed(0)}%`, bottom: 0, animationDelay: `${i * 40}ms` }} /> : null}
            </i>
            <span className={m.count === 0 ? 'ag-d' : undefined}>{m.label}</span>
          </span>
        ))}
      </span>
    </span>
  );
}

/** e · Quotes waiting — one strip of the four states, each sized by its count; the words are page text. */
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
  return (
    <span className="ag-pic ag-pic-free ag-qs" role="img" aria-label="Quotations by state" data-graph-pic="quotes">
      <span className="ag-qs-strip">
        {seg.map(([l, n, cls]) => (
          <i key={l} className={cls} style={{ flexGrow: n / tot }} />
        ))}
      </span>
      <span className="ag-qs-k">
        {seg.map(([l, n, cls]) => (
          <span key={l}>
            <i className={cls} />
            {l} <b>{formatCount(n)}</b>
          </span>
        ))}
      </span>
      <span className="ag-cap">
        of <b>{formatCount(q.sent)} sent</b> · {formatCount(q.accepted)} of {formatCount(q.sent)} accepted
      </span>
    </span>
  );
}

/**
 * 🎠 THE THREE COUNT CARDS' PICTURES (owner 11 Nov: Opened · Asked · Booked are cards of their own, each with its window
 * switch). Opened = the opens as a line over the window; Asked and Booked = bars, one per day (30 days) or month (12
 * months).
 *
 * 📐 ONE SHAPE (owner 21 Nov 2026, drawing `analytics_one_shape_2026-11-21`): the picture is the card's fixed 144-px box —
 * a plot that STRETCHES SIDEWAYS ONLY (`viewBox 0 0 300 100` + `preserveAspectRatio="none"`, strokes stay 1.8 px with
 * `vector-effect: non-scaling-stroke`) over a 20-px row of axis words that are PAGE TEXT at 11 px, never SVG text that
 * scales with the card. `lastYear` (the same days a year back, newest last) draws the dashed line and its
 * "+N% vs last year" key — only when `compareYears` says both periods are big enough; otherwise nothing extra.
 */
const VW = 300;
const VH = 100;
const yOf = (v: number, max: number) => (VH - (v / max) * VH).toFixed(1);

function linePath(vals: readonly number[], max: number): string {
  const n = Math.max(vals.length, 2);
  return vals.map((v, i) => `${i ? 'L' : 'M'}${((i * VW) / (n - 1)).toFixed(1)} ${yOf(v, max)}`).join(' ');
}
function slots(n: number) {
  const gap = n > 12 ? 2.4 : 8;
  const bw = (VW - (n - 1) * gap) / Math.max(n, 1);
  return { bw, x0: (i: number) => i * (bw + gap) };
}
function stepPath(vals: readonly number[], max: number): string {
  const s = slots(vals.length);
  return vals.map((v, i) => `${i ? 'L' : 'M'}${s.x0(i).toFixed(1)} ${yOf(v, max)} H${(s.x0(i) + s.bw).toFixed(1)}`).join(' ');
}

/** The 20-px axis row: first · middle · last label, as page text. */
export function PicAxis({ labels }: { labels: readonly string[] }) {
  if (labels.length === 0) return <span className="ag-axis" />;
  const picks = [labels[0]!, labels[Math.floor((labels.length - 1) / 2)]!, labels[labels.length - 1]!];
  return (
    <span className="ag-axis" aria-hidden>
      <span>{picks[0]}</span>
      <span>{picks[1]}</span>
      <span>{picks[2]}</span>
    </span>
  );
}

/** "+18% vs last year ┄" — the key at the plot's top-left (a whole percent; "−" for fewer). */
function YearKey({ pct }: { pct: number }) {
  return (
    <span className="ag-key" data-vs-last-year={pct}>
      <b className={pct >= 0 ? 'ag-up' : 'ag-down'}>
        {pct >= 0 ? '+' : '−'}
        {Math.abs(pct)}%
      </b>{' '}
      vs last year <i className="ag-dash" aria-hidden />
    </span>
  );
}

type CountPicProps = {
  values: readonly number[];
  labels: readonly string[];
  /** The same buckets a year back, newest last — drawn only with `pct` (the comparison passed `compareYears`). */
  lastYear?: { values: readonly number[]; pct: number } | null;
};

export function CountLinePic({ values, labels, lastYear = null }: CountPicProps) {
  const max = Math.max(1, ...values, ...(lastYear ? lastYear.values : [])) * 1.38;
  const line = linePath(values, max);
  return (
    <span className="ag-pic" data-graph-pic="opened">
      <span className="ag-plot">
        <svg viewBox={`0 0 ${VW} ${VH}`} preserveAspectRatio="none" className="ag-lanes" role="img" aria-label="Opens over the window">
          <path className="ag-varea ag-fade-in" d={`${line} L${VW} ${VH} L0 ${VH} Z`} />
          <path className="ag-vline" d={line} />
        </svg>
        <span className="ag-reveal" aria-hidden />
        {lastYear ? (
          <>
            <svg viewBox={`0 0 ${VW} ${VH}`} preserveAspectRatio="none" className="ag-ly" aria-hidden>
              <path d={linePath(lastYear.values, max)} />
            </svg>
            <YearKey pct={lastYear.pct} />
          </>
        ) : null}
      </span>
      <PicAxis labels={labels} />
    </span>
  );
}

export function CountBarsPic({ values, labels, kind, lastYear = null }: CountPicProps & { kind: 'asked' | 'booked' }) {
  const max = Math.max(1, ...values, ...(lastYear ? lastYear.values : [])) * 1.38;
  const s = slots(values.length);
  return (
    <span className="ag-pic" data-graph-pic={kind}>
      <span className="ag-plot">
        <svg viewBox={`0 0 ${VW} ${VH}`} preserveAspectRatio="none" className="ag-lanes" role="img" aria-label={kind === 'asked' ? 'Inquiries over the window' : 'Bookings over the window'}>
          {values.map((v, i) => {
            if (v <= 0) return null;
            const h = Math.max(v, max * 0.03);
            return (
              <rect
                key={i}
                className={`${kind === 'asked' ? 'ag-abar' : 'ag-bbar'} ag-grow`}
                style={{ animationDelay: `${Math.min(i * 18, 500)}ms` }}
                x={s.x0(i).toFixed(1)}
                y={yOf(h, max)}
                width={s.bw.toFixed(1)}
                height={((h / max) * VH).toFixed(1)}
                rx={1.2}
              />
            );
          })}
        </svg>
        {lastYear ? (
          <>
            <svg viewBox={`0 0 ${VW} ${VH}`} preserveAspectRatio="none" className="ag-ly" aria-hidden>
              <path d={stepPath(lastYear.values, max)} />
            </svg>
            <YearKey pct={lastYear.pct} />
          </>
        ) : null}
      </span>
      <PicAxis labels={labels} />
    </span>
  );
}
