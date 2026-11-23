import { formatCount } from '@/lib/format-number';
import { formatPhpRounded } from '@/lib/php';
import { routes } from '@/lib/routes';
import { PROMOTE_HREF } from '@/lib/supplier-qr-codes';
import { customersSegmentHref } from '@/app/vendor-dashboard/customers/segments';
import { heatGrid, type InquiryMissed } from '@/lib/vendor-inquiry-analytics';
import type { GrowthWindow } from '@/lib/analytics-growing';
import {
  STORE_GRAPH_KEYS,
  STORE_GRAPH_SOURCE,
  STORE_GRAPH_TITLE,
  SUB_AXES,
  followersLine,
  leadLine,
  missedLine,
  owedEmpty,
  owedLine,
  photosLine,
  repliedLine,
  revMonthLine,
  savedLine,
  subStarsLine,
  typesLine,
  valueLine,
  whenAskLine,
  type EventKinds,
  type MonthCountPoint,
  type MonthValue,
  type OwedTotals,
  type StoreGraphKey,
  type StoreGraphs,
  type SubAxis,
  type SubStars,
  type WindowSeries,
} from '@/lib/vendor-store-graphs';
import type { GraphSpec, GraphState } from './graph-tile';
import { CountPic, SlowPic } from './new-graph-pics';
import { SourceBars } from './source-bars';
import { Heat } from './analytics-growing';
import { HeldCount, HeldFill } from './growth-motion';
import { ProgressRing } from './progress-ring';

/**
 * 🛍📊 THE STORE'S NEW GRAPHS ON THE ONE ANALYTICS CAROUSEL (owner 23 Nov 2026 — Supplier Store drawing v10; DECISION_LOG
 * 5a8c6bf3 · 022681cf: every graph reads a real table, every graph is free). Twelve cards, appended to the END of
 * `CARD_ORDER` and tagged New ("new graphs stay at the end, marked New").
 *
 * Each is the SAME card as every shipped graph (`GraphCard`, through the carousel's one card builder) with the same honest
 * states: a refused read is `unread` ("Couldn’t load.", no picture, no advice); a shop with nothing yet draws the real
 * picture with sample data, faded, marked Example (`SAMPLE`, never a real shop's number); otherwise its real rows. No
 * recommendation is invented for them (`rec: null` — "Nothing to fix right now."): a rule belongs in `buildGrowthRecs`.
 * The pictures are the shipped ones where one fits (`CountPic`, `SlowPic`, `SourceBars`, `Heat`, `ProgressRing`).
 * 🔒 performance/the-store-graphs-are-honest.test.ts · lib/vendor-store-graphs.test.ts
 */

const st = (unread: boolean, empty: boolean): GraphState => (unread ? 'unread' : empty ? 'empty' : 'ok');
const UNREAD = 'Couldn’t load.';

// ── the Example pictures (sample, never a shop's number) ───────────────────────────────────────────────────────────
const sampleSeries = (win: GrowthWindow, f: (i: number) => number): number[] => Array.from({ length: win === '30' ? 30 : 12 }, (_, i) => f(i));
const MONTHS = ['Dec', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov'];
const SAMPLE = {
  heat: [
    [0, 0, 0, 1, 2, 2, 4, 3],
    [0, 0, 0, 1, 1, 2, 3, 2],
    [0, 0, 1, 1, 2, 3, 4, 2],
    [0, 0, 0, 2, 2, 3, 5, 3],
    [0, 0, 1, 2, 3, 4, 6, 4],
    [0, 0, 2, 4, 5, 6, 7, 5],
    [0, 0, 2, 3, 4, 5, 4, 2],
  ],
  missed: { declined: 2, unansweredOverSla: 3, selfReportedNoResponse: 1, waitlisted: 2 } as InquiryMissed,
  value: MONTHS.map((label, i) => ({ key: `ex-${i}`, label, count: [3, 5, 2, 0, 4, 6, 3, 1, 2, 4, 5, 7][i]! })),
  owed: { received: 60, toCome: 40 },
  lead: 180,
  types: [
    { key: 'ex-wedding', label: 'Wedding', count: 12 },
    { key: 'ex-debut', label: 'Debut', count: 5 },
    { key: 'ex-corporate', label: 'Corporate', count: 3 },
  ],
  revmonth: MONTHS.map((label, i) => ({ key: `ex-${i}`, label, count: [1, 0, 2, 1, 3, 2, 1, 0, 2, 3, 2, 4][i]! })),
  substars: { communication: 4.8, quality: 4.9, value: 4.4, on_time: 4.7 } as Record<SubAxis, number>,
  replied: 70,
};

const AXIS: Readonly<Record<SubAxis, string>> = { communication: 'Communication', quality: 'Quality', value: 'Value', on_time: 'On time' };

// ── pictures of their own (the shipped row shape: label · figure, a 6-px track under it) ──────────────────────────────

type ValueRow = { key: string; label: string; value: number; shown: string; max: number; tone: 'opened' | 'asked' | 'booked' | 'quiet' };

function ValueRows({ rows, pic }: { rows: readonly ValueRow[]; pic: string }) {
  return (
    <div className="ag-sb" data-graph-pic={pic}>
      {rows.map((r, i) => (
        <div key={r.key} className="ag-src-r">
          <span className="ag-sbl">{r.label}</span>
          <span className="ag-sbn">{r.shown}</span>
          <div className="ag-track">
            <HeldFill value={r.max > 0 ? (r.value / r.max) * 100 : 0} id={`ag:${pic}:${r.key}`} delay={i * 90} style={{ background: `rgb(var(--color-chart-${r.tone}))` }} />
          </div>
        </div>
      ))}
    </div>
  );
}

function PhotoRows({ top, urls }: { top: readonly { key: string; views: number }[]; urls: Readonly<Record<string, string>> }) {
  const max = Math.max(1, ...top.map((p) => p.views));
  return (
    <div className="ag-sb" data-graph-pic="photos">
      {top.map((p, i) => (
        <div key={p.key} className="flex items-center gap-3">
          {urls[p.key] ? (
            // eslint-disable-next-line @next/next/no-img-element -- a signed portfolio URL, as the Portfolio draws it
            <img src={urls[p.key]} alt="" loading="lazy" className="h-9 w-9 flex-none rounded-md object-cover" />
          ) : (
            <span className="h-9 w-9 flex-none rounded-md bg-ink/5" aria-hidden />
          )}
          <div className="ag-src-r min-w-0 flex-1">
            <span className="ag-sbl">{i === 0 ? 'Most viewed' : `Photo ${formatCount(i + 1)}`}</span>
            <HeldCount value={p.views} id={`ag:photo:${p.key}`} delay={i * 90} className="ag-sbn" format={(n) => `${formatCount(n)} ${n === 1 ? 'view' : 'views'}`} />
            <div className="ag-track">
              <HeldFill value={(p.views / max) * 100} id={`ag:photof:${p.key}`} delay={i * 90} style={{ background: 'rgb(var(--color-chart-opened))' }} />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

/** How far ahead: a track from "booked" to "the event", the middle booking marked in days. */
function LeadPic({ days }: { days: number }) {
  const span = Math.max(365, Math.ceil(days / 30) * 30);
  const at = Math.min(100, (days / span) * 100);
  return (
    <div className="grid content-center gap-3 pt-6" data-graph-pic="lead">
      <span className="ag-fig">
        <HeldCount value={Math.round(days)} id="ag:lead:days" className="ag-fig-n" format={(n) => `${formatCount(n)} ${n === 1 ? 'day' : 'days'}`} />
        <small>before the event, in the middle</small>
      </span>
      <div className="ag-track">
        <HeldFill value={at} id="ag:lead:fill" style={{ background: 'rgb(var(--color-chart-booked))' }} />
      </div>
      <span className="ag-axis" aria-hidden>
        <span>Booked</span>
        <span>{formatCount(span)} days</span>
      </span>
    </div>
  );
}

function RepliedPic({ pct, replied, total }: { pct: number; replied: number | null; total: number | null }) {
  return (
    <span className="ag-rep pt-4" data-graph-pic="replied">
      <ProgressRing size={96} r={40} sw={8} pct={pct} id="ag:ring:replied">
        <b className="ag-ringn">{formatCount(Math.round(pct))}%</b>
      </ProgressRing>
      <span className="ag-rt">
        <span className="ag-title">{replied === null || total === null ? 'Reviews answered' : `${formatCount(replied)} of ${formatCount(total)} answered`}</span>
        <span className="ag-line">Couples read your replies on your shop.</span>
      </span>
    </span>
  );
}

// ── the specs ─────────────────────────────────────────────────────────────────────────────────────────────────────

const DOOR = {
  promote: { label: 'Share your shop link', href: PROMOTE_HREF },
  portfolio: { label: 'Open your portfolio', href: '/vendor-dashboard/collections' },
  messages: { label: 'Go to messages', href: routes.vendorDashboard.messages.index() },
  money: { label: 'Open your money', href: customersSegmentHref('money') },
  calendar: { label: 'Open your calendar', href: customersSegmentHref('dates') },
  clients: { label: 'Open your clients', href: customersSegmentHref('events') },
  reviews: { label: 'Open your reviews', href: routes.vendorDashboard.reviews() },
} as const;

function spec(k: StoreGraphKey, state: GraphState, pic: GraphSpec['pic'], line: string, door: { label: string; href: string }): GraphSpec {
  return { k, title: STORE_GRAPH_TITLE[k], src: STORE_GRAPH_SOURCE[k], tag: 'new', state, pic, line, problem: line, rec: null, door };
}

function seriesSpec(k: 'followers' | 'saved', s: WindowSeries | null, win: GrowthWindow): GraphSpec {
  const empty = s !== null && s.total === 0;
  const sample = sampleSeries(win, (i) => (k === 'followers' ? 1 + ((i * 5) % 4) : (i * 3) % 5 === 0 ? 2 : 0));
  const labels = s ? s.labels : [];
  const axis = labels.length ? ([labels[0]!, labels[Math.floor((labels.length - 1) / 2)]!, labels[labels.length - 1]!] as const) : null;
  const line = s === null ? UNREAD : empty ? (k === 'followers' ? 'Fills in as couples follow your shop.' : 'Fills in as guests at your events save your shop.') : k === 'followers' ? followersLine(s, win) : savedLine(s, win);
  const pic = (
    <CountPic
      kind={k === 'followers' ? 'opened' : 'booked'}
      values={s && !empty ? s.values : sample}
      lastYear={null}
      axis={axis}
      countKey={null}
      label={k === 'followers' ? 'New followers over the window' : 'Guests who saved your shop over the window'}
      pic={k}
    />
  );
  return spec(k, st(s === null, empty), pic, line, DOOR.promote);
}

const missedRows = (m: InquiryMissed): ValueRow[] => {
  const max = Math.max(1, m.declined, m.unansweredOverSla, m.selfReportedNoResponse, m.waitlisted);
  const row = (key: string, label: string, value: number): ValueRow => ({ key, label, value, shown: formatCount(value), max, tone: 'asked' });
  return [
    row('unanswered', 'Never answered, 48 hours on', m.unansweredOverSla),
    row('declined', 'You declined', m.declined),
    row('waitlisted', 'Waitlisted on a full date', m.waitlisted),
    row('no-response', 'Marked no response', m.selfReportedNoResponse),
  ];
};

const owedRows = (received: number, toCome: number, money: boolean): ValueRow[] => {
  const max = Math.max(1, received + toCome);
  const shown = (n: number) => (money ? formatPhpRounded(n) : '');
  return [
    { key: 'received', label: 'Received', value: received, shown: shown(received), max, tone: 'booked' },
    { key: 'to-come', label: 'Still to come in', value: toCome, shown: shown(toCome), max, tone: 'asked' },
  ];
};

const subRows = (avg: Record<SubAxis, number>): ValueRow[] =>
  SUB_AXES.map((a) => ({ key: a, label: AXIS[a], value: avg[a], shown: `${avg[a].toFixed(1)} ★`, max: 5, tone: 'opened' as const }));

const kindRows = (kinds: readonly { key: string; label: string; count: number }[]) => kinds.slice(0, 4).map((x) => ({ key: x.key, label: x.label, count: x.count }));

/** One window's twelve new graphs, keyed for the carousel's one per-window lookup. */
export function storeGraphSpecs(g: StoreGraphs, win: GrowthWindow): Record<StoreGraphKey, GraphSpec> {
  const followers = seriesSpec('followers', g.followers, win);
  const saved = seriesSpec('saved', g.saved, win);

  const p = g.photos;
  const pEmpty = p !== null && p.top.length === 0;
  const photos = spec(
    'photos',
    st(p === null, pEmpty),
    p && !pEmpty ? (
      <PhotoRows top={p.top} urls={p.urls} />
    ) : (
      <ValueRows pic="photos" rows={[3, 2, 1].map((v, i) => ({ key: `ex-${i}`, label: i === 0 ? 'Most viewed' : `Photo ${i + 1}`, value: v * 10, shown: `${v * 10} views`, max: 30, tone: 'opened' }))} />
    ),
    p === null ? UNREAD : pEmpty ? 'Fills in as couples open the photos on your page.' : photosLine(p, win),
    DOOR.portfolio,
  );

  const grid = g.whenask ? heatGrid(g.whenask) : null;
  const wEmpty = g.whenask !== null && grid === null;
  const whenask = spec('whenask', st(g.whenask === null, wEmpty), <Heat grid={grid ?? SAMPLE.heat} compact />, g.whenask === null ? UNREAD : grid ? whenAskLine(grid) : 'Shows once couples ask you.', DOOR.messages);

  // A shop with no slipped inquiry is a real, good answer — drawn as its zeros, never as the Example.
  const m = g.missed;
  const missed = spec('missed', st(m === null, false), <ValueRows pic="missed" rows={missedRows(m ?? SAMPLE.missed)} />, m === null ? UNREAD : missedLine(m, win), DOOR.messages);

  const v: MonthValue[] | null = g.value;
  const vEmpty = v !== null && v.every((x) => x.php === 0);
  const value = spec(
    'value',
    st(v === null, vEmpty),
    <SlowPic months={v && !vEmpty ? v.map((x) => ({ key: x.key, label: x.label, count: x.php })) : SAMPLE.value} label="Booked value by month, the last 12" pic="value" />,
    v === null ? UNREAD : vEmpty ? 'Fills in as couples book you with a price set.' : valueLine(v),
    DOOR.money,
  );

  const o: OwedTotals | null = g.owed;
  const oEmpty = o !== null && owedEmpty(o);
  const owed = spec(
    'owed',
    st(o === null, oEmpty),
    <ValueRows pic="owed" rows={o && !oEmpty ? owedRows(o.receivedPhp, o.toComePhp, true) : owedRows(SAMPLE.owed.received, SAMPLE.owed.toCome, false)} />,
    o === null ? UNREAD : oEmpty ? 'Shows once a booking has a payment plan.' : owedLine(o),
    DOOR.money,
  );

  const l = g.lead;
  const lEmpty = l !== null && (l.bookedWithDateCount === 0 || l.medianLeadDays === null);
  const lead = spec('lead', st(l === null, lEmpty), <LeadPic days={l && !lEmpty ? l.medianLeadDays! : SAMPLE.lead} />, l === null ? UNREAD : lEmpty ? 'Shows once a booking has an event date.' : leadLine(l), DOOR.calendar);

  const t: EventKinds | null = g.types;
  const tEmpty = t !== null && t.kinds.length === 0;
  const types = spec('types', st(t === null, tEmpty), <SourceBars rows={kindRows(t && !tEmpty ? t.kinds : SAMPLE.types)} />, t === null ? UNREAD : tEmpty ? 'Fills in as you complete events through Setnayan.' : typesLine(t), DOOR.clients);

  const r: MonthCountPoint[] | null = g.revmonth;
  const rEmpty = r !== null && r.every((x) => x.count === 0);
  const revmonth = spec(
    'revmonth',
    st(r === null, rEmpty),
    <SlowPic months={r && !rEmpty ? r : SAMPLE.revmonth} label="Reviews by month, the last 12" pic="revmonth" />,
    r === null ? UNREAD : rEmpty ? 'Your first review lands here.' : revMonthLine(r),
    DOOR.reviews,
  );

  const s: SubStars | null = g.substars;
  const sEmpty = s !== null && s.n === 0;
  const substars = spec(
    'substars',
    st(s === null, sEmpty),
    <ValueRows pic="substars" rows={subRows(s && !sEmpty ? s.avg : SAMPLE.substars)} />,
    s === null ? UNREAD : sEmpty ? 'Your first review lands here.' : subStarsLine(s, (a) => AXIS[a]),
    DOOR.reviews,
  );

  const rp = g.replied;
  const rpEmpty = rp !== null && rp.total === 0;
  const replied = spec(
    'replied',
    st(rp === null, rpEmpty),
    rp && !rpEmpty ? <RepliedPic pct={(rp.replied / rp.total) * 100} replied={rp.replied} total={rp.total} /> : <RepliedPic pct={SAMPLE.replied} replied={null} total={null} />,
    rp === null ? UNREAD : rpEmpty ? 'Your first review lands here.' : repliedLine(rp),
    DOOR.reviews,
  );

  const out = { followers, saved, photos, whenask, missed, value, owed, lead, types, revmonth, substars, replied };
  // Every key, once — the list and the specs never drift.
  for (const k of STORE_GRAPH_KEYS) if (!out[k]) throw new Error(`store graph ${k} has no spec`);
  return out;
}
