'use client';

import { formatCount } from '@/lib/format-number';
import './analytics-growing.css';
import { useState, type ReactNode } from 'react';
import Link from 'next/link';
import { Users } from 'lucide-react';
import { InfoTip } from '@/app/_components/info-tip';
import { PickMenu } from '@/app/dashboard/[eventId]/website/editor/_components/pick-menu';
import { COULDNT_LOAD, GROWTH_WINDOWS, type GrowthWindow } from '@/lib/analytics-growing';
import type { GrowthRec, GrowthRecKey } from '@/lib/vendor-growth-recs';
import {
  GRAPH_SOURCE,
  cardSellLine,
  lostLine,
  quotesLine,
  replyVsLine,
  slowLine,
  type NewGraphs,
} from '@/lib/vendor-analytics-graphs';
import { useGrowthWindow } from '../../_components/growth-window';
import { Reanimate } from './reanimate';
import { HeldCount, HeldFill } from './growth-motion';
import { GrowthLanes, LaneKeys } from './growth-lanes';
import { DoNext } from './do-next';
import { SourceBars } from './source-bars';
import { ReplyGauge } from './reply-gauge';
import { FunnelPreviewCard } from './funnel-preview-card';
import { CalendarStrip } from './calendar-strip';
import { StarsFill } from './stars-fill';
import { ProgressRing } from './progress-ring';
import { PriceRail } from './price-rail';
import { CardSellPic, LostPic, QuotesPic, ReplyVsPic, SlowPic } from './new-graph-pics';
import { GraphSection, GraphTile, type GraphSpec, type GraphState } from './graph-tile';
import { GRAPH_SAMPLE } from './graph-sample';
import type { GrowthView, Row, SourceRow } from './growth-view';

/**
 * 🌱📈 ONE ANALYTICS — Shop › Analytics (owner-approved 6 Nov 2026 "Analytics, growing", made ONE with the live carousel
 * and given the five new graphs in Build 6 Lane I, approved 10 Nov: *"No dupes. we want graphs that will help them.
 * tapping shows a recommendation from us on what they need to do."* → *"All five"*).
 *
 * One window ▾, the lanes (a tile too), the sentence and Do next — unchanged from 6 Nov — then the six sections in the
 * order a supplier asks, each a row of GRAPH TILES (`graph-tile.tsx`): every graph once, its data named, tap = it
 * rises with ONE recommendation from `buildGrowthRecs` (only when that rule fired). Each live Shop carousel card is
 * folded into the tile that owns its fact — the dedupe table:
 *
 *   What’s ahead                      → § What’s ahead · The next 13 weeks        (open_saturdays)
 *   Quotes that turn into bookings    → § Asking · Quotes waiting                 (requote_expired)
 *   Where your price sits             → § How I compare · Where your price sits   (none → "Nothing to fix right now")
 *   What Setnayan added               → § Am I booking? · Setnayan vs your own book (build_partnerships)
 *   Compared with similar suppliers   → § How I compare · Compared with similar suppliers (reply_faster)
 *
 * Nothing new is computed about the shop here: `growth-view.ts` words the page's reads and
 * `lib/vendor-analytics-graphs.ts` the five new ones; this only draws them. Counts only on the tiles — no price.
 * 🔒 lib/analytics-growing.test.ts · lib/vendor-growth-recs.test.ts · performance/analytics-is-growing.test.ts ·
 *    performance/every-graph-is-a-tile.test.ts · lib/vendor-analytics-graphs.test.ts
 */

const TIPS = {
  growth: 'Opened = times couples opened your profile, by day (or by month on 12 months). Asked = inquiries on the day they arrived. Booked = bookings confirmed. All three follow the window above.',
  sources: 'Where couples found your page before opening it. Sources with fewer than 5 are hidden to keep the read reliable.',
  reply: 'Setnayan only says “usually responds in …” after 3 answered conversations — one quick answer is not a habit. It comes off on its own if your typical reply goes past 4h, or if you go a week without signing in. Answering couples is free.',
  speed: 'Median = half your first replies land inside this. “9 in 10 within” = the 90th percentile. Last 12 months, so the picture is steady.',
  slipped: 'A floor, not a full count — “unanswered” uses a 48-hour guide and “no response” is self-reported.',
  heat: 'Darker = more inquiries arrive then · Philippine time. Needs a long window to read (12 months).',
  funnel: 'Profile views: how many times couples opened your profile. Inquiries: couples who reached out. Quotes sent: inquiries you answered with a price or package. Booked: quotes couples confirmed.',
  split: 'Booked business Setnayan sourced for you versus couples you added yourself. On 12 months, with a paid plan, this also shows “~N× your annual plan”.',
  deals: 'Win rate is of decided inquiries (won vs declined) — open and stale inquiries aren’t counted. Peso figures cover on-platform priced bookings only.',
  ahead: 'The next 13 weeks from today, a column per week. Filled = a day with a live booking (deeper = more than one). Ring = a date couples asked for that you weren’t free on. Raw counts, no utilization ratio.',
  demand: 'Every number here is a count — inquiries, unlocks and bookings rolled up by month and look for your region. Small groups stay hidden until no single couple can be picked out, so the radar can look quiet early.',
  rep: 'Overall rating and how many reviews you have answered, with how long you take. The stars fill to your average across trusted reviews.',
  health: 'Built only from your own metrics — response rate, reviews, conversion, and delivery. Pillars without data yet are left out of the average, not counted against you.',
  bench: 'Ranges across shops in your category and area — never another shop’s numbers. A comparison only appears once the group is large enough that nobody in it can be identified.',
  price: 'How your starting price compares to other published suppliers in your region. A band shows only once enough suppliers have published a price — we never estimate a range from a handful.',
} as const;


/** Which rule each graph may show (prototype GRAPHS[].rec). `null` = the graph advises nothing, by design. */
export const GRAPH_REC: Readonly<Record<string, readonly GrowthRecKey[]>> = {
  lanes: ['reply_faster'],
  sources: ['add_photos'],
  cardsell: ['offer_on_card'],
  reply: [],
  replyvs: ['reply_faster'],
  quotes: ['requote_expired'],
  split: ['build_partnerships'],
  calendar: ['open_saturdays'],
  lost: ['open_lost_dates', 'add_team'],
  slow: ['offer_for_month'],
  rep: ['ask_reviews'],
  bench: ['reply_faster'],
  price: [],
};

function Sub({ t, when, tip }: { t: string; when?: string; tip?: string }) {
  return (
    <p className="ag-subt">
      {tip ? (
        <InfoTip label={t} align="start">
          {tip}
        </InfoTip>
      ) : (
        <span>{t}</span>
      )}
      {when ? <span className="ag-when">· {when}</span> : null}
    </p>
  );
}

function RowView({ r, chip }: { r: Row; chip?: { tone: string; word: string } }) {
  return (
    <div className="ag-row">
      <span className="ag-t">
        <span className={r.wrap ? 'ag-title ag-lw' : 'ag-title'}>{r.title}</span>
        {r.line ? <span className="ag-line">{r.line}</span> : null}
      </span>
      {r.strong !== undefined ? <span className="ag-strong">{r.strong}</span> : null}
      {chip ? <span className={`ag-chip ag-${chip.tone}`}>{chip.word}</span> : null}
    </div>
  );
}

function Rows({ rows }: { rows: Row[] }) {
  return (
    <div className="ag-rows">
      {rows.map((r) => (
        <RowView key={r.title} r={r} />
      ))}
    </div>
  );
}

function One({ children }: { children: ReactNode }) {
  return <p className="ag-one">{children}</p>;
}

function SourceRowsList({ list, empty }: { list: SourceRow[] | null; empty: string }) {
  if (list === null) return <One>Couldn’t load.</One>;
  if (list.length === 0) return <One>{empty}</One>;
  return <Rows rows={list.map((s) => ({ title: s.label, line: s.count === null ? 'fewer than 5 · hidden' : undefined, strong: s.count === null ? '—' : String(s.count) }))} />;
}

const st = (unread: boolean, empty: boolean): GraphState => (unread ? 'unread' : empty ? 'empty' : 'ok');

export function AnalyticsGrowing({
  view,
  graphs,
  scope = null,
  badges,
}: {
  view: GrowthView;
  /** The five new graphs (Build 6 Lane I) — each `null` when refused ("Couldn’t load"). */
  graphs: NewGraphs;
  /** The service scope ▾ (`ServiceScopeSelector`), beside the window ▾ — only with 2+ active services. */
  scope?: ReactNode;
  /** `YourBadges`, drawn by the page (server) — §5's details. */
  badges: ReactNode;
}) {
  const ctx = useGrowthWindow();
  const [own, setOwn] = useState<GrowthWindow>('30');
  const win = ctx ? ctx.window : own;
  const setWin = ctx ? ctx.setWindow : setOwn;
  const w = view.windows[win];
  const byKey = new Map<GrowthRecKey, GrowthRec>(w.recs.map((r) => [r.key, r]));
  /** The graph's rule, only if it fired in this window. */
  const recOf = (k: string): GrowthRec | null => {
    for (const key of GRAPH_REC[k] ?? []) {
      const r = byKey.get(key);
      if (r) return r;
    }
    return null;
  };
  const b = w.booking;
  const S = GRAPH_SAMPLE;

  const windowPick = (
    <PickMenu
      label="Window — every number below follows this"
      value={win}
      options={GROWTH_WINDOWS.map((o) => ({ key: o.key, label: o.label, hint: o.hint }))}
      onPick={(k) => setWin(k as GrowthWindow)}
      dataAttr="data-growth-window-pick"
    />
  );

  // ── the tiles, in the six-section order (approved 6 Nov) — every graph once ──
  const sources: GraphSpec = {
    k: 'sources',
    title: 'Where couples found you',
    src: 'Counts · profile opens by where they came from · sources under 5 stay hidden',
    state: st(w.finding.sources === null || w.finding.line === COULDNT_LOAD, (w.finding.sources?.length ?? 0) === 0),
    pic: <SourceBars rows={(w.finding.sources?.length ?? 0) === 0 ? S.sources : w.finding.sources} />,
    line: (w.finding.sources?.length ?? 0) === 0 ? 'Fills in with your first profile opens.' : w.finding.line,
    problem: (w.finding.sources?.length ?? 0) === 0 ? 'Fills in with your first profile opens.' : w.finding.line,
    rec: recOf('sources'),
    details: <One>Where couples found your page before opening it — sources under 5 stay hidden so the read stays reliable.</One>,
    door: { label: 'Share your shop link', href: '/vendor-dashboard/shop/promote' },
  };

  const cs = graphs.cardsell;
  const csEmpty = !cs || cs.every((c) => c.asked === 0);
  const cardsell: GraphSpec = {
    k: 'cardsell',
    title: 'Which card sells',
    src: GRAPH_SOURCE.cardsell,
    tag: 'new',
    state: st(cs === null, csEmpty),
    pic: <CardSellPic c={csEmpty ? S.cardsell : cs!} />,
    line: csEmpty ? 'Shows once couples ask about your cards.' : cardSellLine(cs),
    problem: csEmpty ? 'Shows once couples ask about your cards.' : cardSellLine(cs),
    rec: recOf('cardsell'),
    details: <One>How many times each card was opened is not counted yet, so this graph never advises on opens — only on what couples asked about and booked.</One>,
    door: { label: 'Open your cards', href: '/vendor-dashboard/shop' },
  };

  const replyUnread = view.reply.chip.word === COULDNT_LOAD;
  const replyEmpty = view.reply.gauge.minutes === null;
  const reply: GraphSpec = {
    k: 'reply',
    title: 'How fast you answer',
    src: 'Median minutes to your first reply · last 12 months · 3 answered before Setnayan says “usually responds in …”',
    state: st(replyUnread, replyEmpty),
    pic: replyEmpty ? <ReplyGauge minutes={S.reply.minutes} answered={S.reply.answered} /> : <ReplyGauge minutes={view.reply.gauge.minutes} answered={view.reply.gauge.answered} />,
    line: replyEmpty ? 'Comes alive with your first inquiry.' : w.asking.line,
    problem: replyEmpty ? 'Comes alive with your first inquiry.' : w.asking.line,
    rec: recOf('reply'),
    details: (
      <>
        <Sub t="What couples see about your replies" tip={TIPS.reply} />
        <div className="ag-row">
          <span className="ag-t">
            <span className="ag-title ag-lw">{view.reply.title}</span>
            <span className="ag-line">{view.reply.line}</span>
          </span>
          <span className={`ag-chip ag-${view.reply.chip.tone}`}>{view.reply.chip.word}</span>
        </div>
        {view.reply.shown ? null : (
          <Link className="ag-door" href="/vendor-dashboard/customers">
            <Users aria-hidden strokeWidth={1.9} />
            Go to your customers
          </Link>
        )}
        {view.speed ? (
          <>
            <Sub t="What type of customer inquires" tip={TIPS.sources} />
            <SourceRowsList list={w.asking.byType} empty="No inquiries in this window yet." />
            <Sub t="Reply speed" when="12 months" tip={TIPS.speed} />
            <Rows rows={view.speed} />
            {view.slipped ? (
              <>
                <Sub t="Where leads slipped" when="12 months" tip={TIPS.slipped} />
                <One>{view.slipped}</One>
              </>
            ) : null}
            {view.heat ? (
              <>
                <Sub t="When couples message you" when="12 months" tip={TIPS.heat} />
                <Heat grid={view.heat} />
              </>
            ) : null}
          </>
        ) : (
          <One>Answer couples as they arrive — what type of customer asks, your reply speed, slipped leads and busy times fill in from your first inquiries.</One>
        )}
      </>
    ),
    door: { label: 'Go to messages', href: '/vendor-dashboard/messages' },
  };

  const rv = graphs.replyvs;
  const rvEmpty = !rv || rv.fast.n + rv.slow.n === 0;
  const replyvs: GraphSpec = {
    k: 'replyvs',
    title: 'Reply speed vs bookings',
    src: GRAPH_SOURCE.replyvs,
    tag: 'new',
    state: st(rv === null, rvEmpty),
    pic: <ReplyVsPic r={rvEmpty ? S.replyvs : rv!} />,
    line: rvEmpty ? 'Comes alive with your first answered inquiry.' : replyVsLine(rv),
    problem: rvEmpty ? 'Comes alive with your first answered inquiry.' : replyVsLine(rv),
    rec: recOf('replyvs'),
    door: { label: 'Go to messages', href: '/vendor-dashboard/messages' },
  };

  const q = graphs.quotes;
  const qEmpty = !q || q.sent === 0;
  const quotes: GraphSpec = {
    k: 'quotes',
    title: 'Quotes waiting',
    src: GRAPH_SOURCE.quotes,
    tag: 'new',
    state: st(q === null, qEmpty),
    pic: <QuotesPic q={qEmpty ? S.quotes : q!} />,
    line: qEmpty ? 'Fills in when you send your first quotation.' : quotesLine(q),
    problem: qEmpty ? 'Fills in when you send your first quotation.' : quotesLine(q),
    rec: recOf('quotes'),
    details: view.deals ? (
      <>
        <Sub t="Deals" when="12 months" tip={TIPS.deals} />
        <Rows rows={view.deals} />
      </>
    ) : undefined,
    door: { label: 'Open your clients', href: '/vendor-dashboard/customers' },
  };

  const splitEmpty = !b.split || b.split.setnayan.n + b.split.own.n === 0;
  const split: GraphSpec = {
    k: 'split',
    title: 'Setnayan vs your own book',
    src: 'Counts · bookings by where they came from — through Setnayan, or a client you brought in',
    tag: 'absorb',
    state: st(b.line === COULDNT_LOAD, splitEmpty),
    pic: <SplitPic n={splitEmpty ? S.split : { setnayan: b.split!.setnayan.n, own: b.split!.own.n }} />,
    line: splitEmpty ? 'Fills in with your first booking.' : b.line,
    problem: splitEmpty ? 'Fills in with your first booking.' : b.line,
    rec: recOf('split'),
    details: (
      <>
        <p className="ag-subt" style={{ marginTop: 0 }}>
          <InfoTip label="Your booking funnel" align="start">
            {TIPS.funnel}
          </InfoTip>
        </p>
        <FunnelPreviewCard steps={b.funnel} />
        {b.value && b.split ? (
          <>
            <Rows rows={[{ title: 'Booked value', line: b.value.line, strong: b.value.php }]} />
            <Sub t="Setnayan vs your own book" tip={TIPS.split} />
            <Attribution split={b.split} roi={b.roi} />
            <Sub t="Where your bookings come from" tip={TIPS.sources} />
            <SourceRowsList list={b.bookedSources} empty="No source has 5 bookings yet." />
          </>
        ) : (
          <One>Booked value, Setnayan vs your own book, where bookings come from and your deals fill in with your first booking.</One>
        )}
      </>
    ),
    door: { label: 'Import a client', href: '/vendor-dashboard/customers' },
  };

  const calEmpty = view.ahead.marks.booked.length === 0 && view.ahead.marks.waiting.length === 0;
  const calendar: GraphSpec = {
    k: 'calendar',
    title: 'The next 13 weeks',
    src: 'Live bookings by day · dates couples asked for that you weren’t free on (the waitlist)',
    tag: 'absorb',
    state: st(view.ahead.unread, calEmpty),
    pic: calEmpty ? (
      <CalendarStrip months={view.ahead.months} booked={S.calendar.booked} waiting={S.calendar.waiting} />
    ) : (
      <CalendarStrip months={view.ahead.months} booked={view.ahead.marks.booked} waiting={view.ahead.marks.waiting} />
    ),
    line: calEmpty ? 'Nothing booked ahead · no couples waiting.' : view.ahead.line,
    problem: calEmpty ? 'Nothing booked ahead · no couples waiting.' : view.ahead.line,
    rec: recOf('calendar'),
    details: (
      <>
        <Sub t="Your calendar" tip={TIPS.ahead} />
        {view.ahead.rows ? (
          <>
            <Rows rows={view.ahead.rows} />
            {view.ahead.dates ? (
              <>
                <Sub t="Dates in demand" />
                <Rows rows={view.ahead.dates} />
              </>
            ) : null}
          </>
        ) : (
          <One>Dates couples want but you’re not free on show up here once your calendar fills — a signal to add a slot or raise your price.</One>
        )}
        {view.demand.show ? (
          <>
            <Sub t={`Demand near you${view.pro ? ' ◆' : ''}`} when="your region" tip={TIPS.demand} />
            {view.demand.unread ? (
              <One>Couldn’t load the demand near you just now.</One>
            ) : view.demand.rows ? (
              <>
                <Rows rows={view.demand.rows} />
                {view.demand.months ? (
                  <>
                    <Sub t="Busiest months ahead" />
                    <Rows rows={view.demand.months} />
                  </>
                ) : null}
              </>
            ) : (
              <One>
                <b>Not enough demand data yet</b> — the radar fills in once there’s enough activity in your area to show without revealing any single couple.
              </One>
            )}
          </>
        ) : null}
      </>
    ),
    door: { label: 'Open your calendar', href: '/vendor-dashboard/calendar' },
  };

  const l = graphs.lost;
  const lEmpty = !l || l.total === 0;
  const lost: GraphSpec = {
    k: 'lost',
    title: 'Dates you lost',
    src: GRAPH_SOURCE.lost,
    tag: 'new',
    state: st(l === null, lEmpty),
    pic: <LostPic l={lEmpty ? S.lost : l!} />,
    line: lEmpty ? 'Shows once a couple asks for a date you can’t take.' : lostLine(l),
    problem: lEmpty ? 'Shows once a couple asks for a date you can’t take.' : lostLine(l),
    rec: recOf('lost'),
    door: { label: 'Open your calendar', href: '/vendor-dashboard/calendar' },
  };

  const sm = graphs.slow;
  const smEmpty = !sm || sm.every((m) => m.count === 0);
  const slow: GraphSpec = {
    k: 'slow',
    title: 'Slow months ahead',
    src: GRAPH_SOURCE.slow,
    tag: 'new',
    state: st(sm === null, smEmpty),
    pic: <SlowPic months={smEmpty ? S.slow : sm!} />,
    line: smEmpty ? 'Fills in as couples book dates.' : slowLine(sm),
    problem: smEmpty ? 'Fills in as couples book dates.' : slowLine(sm),
    rec: recOf('slow'),
    door: { label: 'Open your calendar', href: '/vendor-dashboard/calendar' },
  };

  const repEmpty = view.rep.rating === null;
  const rep: GraphSpec = {
    k: 'rep',
    title: 'What couples say · your badges',
    src: 'Your average across trusted reviews · the badges you have earned',
    state: st(view.rep.unread, repEmpty),
    pic: (
      <>
        <StarsFill rating={repEmpty ? S.rep.rating : view.rep.rating} count={repEmpty ? S.rep.count : view.rep.count} />
        {!repEmpty && view.badgeRing ? (
          <span className="ag-rep" style={{ marginTop: 14 }}>
            <ProgressRing size={64} r={26} sw={5} pct={(view.badgeRing.have / view.badgeRing.goal) * 100} id="ag:ring:badge" delay={120} ghost={view.badgeRing.have === 0}>
              {view.badgeRing.have ? <HeldCount value={view.badgeRing.have} id="ag:ring:badgeN" delay={120} className="ag-ringn" /> : <b style={{ fontSize: 17 }}>0</b>}
            </ProgressRing>
            <span className="ag-rt">
              <span className="ag-title">
                {formatCount(view.badgeRing.have)} of {formatCount(view.badgeRing.goal)} events
              </span>
              <span className="ag-line">Next badge: {view.badgeRing.goalWord}</span>
            </span>
          </span>
        ) : null}
      </>
    ),
    line: repEmpty ? 'Your first review lands here.' : view.rep.line,
    problem: repEmpty ? 'Your first review lands here.' : view.rep.line,
    rec: recOf('rep'),
    details: (
      <>
        {badges}
        <Sub t="What couples say" when="all time" tip={TIPS.rep} />
        {view.rep.rows ? (
          <>
            <Rows rows={view.rep.rows} />
            {view.rep.dist ? (
              <>
                <Sub t="Rating breakdown" />
                {view.rep.dist.map((n, i) => {
                  const tot = view.rep.dist!.reduce((a, c) => a + c, 0) || 1;
                  return (
                    <div key={i} className="ag-dist">
                      <span className="ag-s">{5 - i}★</span>
                      <div className="ag-track">
                        <i style={{ width: `${(n / tot) * 100}%`, minWidth: n ? 3 : 0 }} />
                      </div>
                      <span className="ag-n">{n}</span>
                    </div>
                  );
                })}
              </>
            ) : null}
            {view.rep.monthly ? (
              <>
                <Sub t="Reviews per month" when="12 months" />
                <Bars values={view.rep.monthly} />
              </>
            ) : null}
          </>
        ) : (
          <One>No reviews yet — your rating, how many reviews you answer and reviews per month start with your first review.</One>
        )}
      </>
    ),
    door: { label: 'See reviews', href: '/vendor-dashboard/website#reviews' },
  };

  const benchEmpty = !view.bench.rows;
  const bench: GraphSpec = {
    k: 'bench',
    title: `Compared with similar suppliers${view.pro ? ' ◆' : ''}`,
    src: 'Your place among shops in your category and area · Reply rate · Reply time · Inquiry → booking · never another shop’s numbers',
    tag: 'absorb',
    state: st(view.bench.unread, benchEmpty),
    pic: <BenchPic rows={benchEmpty ? S.bench : view.bench.rows!} />,
    line: benchEmpty ? 'Not enough shops like yours yet.' : view.compare.line,
    problem: benchEmpty ? 'Not enough shops like yours yet.' : view.compare.line,
    rec: recOf('bench'),
    details: (
      <>
        <Sub t="Your health score" when="now" tip={TIPS.health} />
        <Health h={view.health} />
        {view.health.unread || view.health.composite === null ? null : view.health.pillars.map((p) => <RowView key={p.label} r={{ title: p.label, line: p.hint }} />)}
        <Sub t="Shops like yours" when="your category & area" tip={TIPS.bench} />
        {view.bench.unread ? (
          <One>Couldn’t load shops like yours just now.</One>
        ) : view.bench.rows ? (
          <Rows rows={view.bench.rows.map((r) => ({ title: r.title, line: r.line, strong: r.word }))} />
        ) : (
          <One>
            <b>Not enough shops like yours yet</b> — a comparison appears once the group is big enough that no single shop can be picked out of it.
          </One>
        )}
      </>
    ),
    door: { label: 'Go to messages', href: '/vendor-dashboard/messages' },
  };

  const priceEmpty = !view.price.positioned;
  // Words only on the rail — no amount on a tile (the risen details carry your own starting price).
  const priceRail = view.price.show ? <PriceRail positioned={{ low: '', med: '', high: '', at: priceEmpty ? S.price.at : view.price.positioned!.at }} unread={view.price.unread} /> : null;
  const price: GraphSpec | null = priceRail
    ? {
        k: 'price',
        pic: priceRail,
        title: `Where your price sits${view.pro ? ' ◆' : ''}`,
        src: 'Your starting price against the low · median · high of published prices for your service in your region · words, never another shop’s price',
        tag: 'absorb',
        state: st(view.price.unread, priceEmpty),
        line: priceEmpty ? 'Add a starting price to see where you sit.' : view.price.positioned!.word,
        problem: priceEmpty ? 'Add a starting price to see where you sit.' : view.price.positioned!.word,
        rec: recOf('price'),
        details: (
          <>
            <Sub t="Where your price sits" when={view.price.when} tip={TIPS.price} />
            {view.price.positioned ? (
              <RowView r={{ title: 'Your starting price', line: view.price.positioned.word, strong: view.price.positioned.own }} />
            ) : (
              <One>{view.price.unread ? 'Couldn’t load the market just now.' : 'Not enough market data yet.'}</One>
            )}
          </>
        ),
        door: { label: 'Set a starting price', href: '/vendor-dashboard/shop' },
      }
    : null;

  const lanes: GraphSpec = {
    k: 'lanes',
    title: 'Opened → asked → booked',
    src: 'Counts over the window · opened (profile views by day) · asked (inquiries by arrival) · booked (bookings confirmed)',
    state: 'ok',
    pic: <GrowthLanes key={win} unit={w.lanes.unit} labels={w.lanes.labels} views={w.lanes.views} asked={w.lanes.asked} booked={w.lanes.booked} />,
    line: <>{w.sentence.map((s, i) => (s.b ? <b key={i}>{s.t}</b> : <span key={i}>{s.t}</span>))}</>,
    problem: w.sentence.map((s) => s.t).join(''),
    rec: recOf('lanes'),
    door: { label: 'Share your shop link', href: '/vendor-dashboard/shop/promote' },
  };

  return (
    <div data-growth="" data-growth-window={win}>
      <div className="ag-topctl">
        {windowPick}
        {scope}
      </div>

      {/* HERO — the lanes as a tile, then the sentence + Do next (approved 6 Nov, unchanged). */}
      <Reanimate still className="ag-hero">
        <LaneKeys
          tip={
            <InfoTip label="" ariaLabel="About these lanes" align="end">
              {TIPS.growth}
            </InfoTip>
          }
        />
        <GraphTile g={{ ...lanes, line: null }} window={windowPick} />
        <p className="ag-say" data-growth-sentence="">
          {w.sentence.map((s, i) => (s.b ? <b key={i}>{s.t}</b> : <span key={i}>{s.t}</span>))}
        </p>
        <DoNext recs={w.recs} />
      </Reanimate>

      <div className="ag-folds" data-graph-sections="">
        <GraphSection id="finding" title="Are couples finding me?">
          <GraphTile g={sources} window={windowPick} />
          <GraphTile g={cardsell} />
        </GraphSection>
        <GraphSection id="asking" title="Are they asking, and do I answer?">
          <GraphTile g={reply} />
          <GraphTile g={replyvs} />
          <GraphTile g={quotes} />
        </GraphSection>
        <GraphSection id="booking" title="Am I booking?">
          <GraphTile g={split} window={windowPick} />
        </GraphSection>
        <GraphSection id="ahead" title="What’s ahead" when="next 13 weeks · 12 months">
          <GraphTile g={calendar} />
          <GraphTile g={lost} />
          <GraphTile g={slow} />
        </GraphSection>
        <GraphSection id="rep" title="Reputation & badges" when="all time">
          <GraphTile g={rep} />
        </GraphSection>
        {view.bench.show || view.price.show ? (
          <GraphSection id="compare" title="How I compare" when="your category · region">
            {view.bench.show ? <GraphTile g={bench} /> : null}
            {price ? <GraphTile g={price} /> : null}
          </GraphSection>
        ) : null}
      </div>
    </div>
  );
}

/** Setnayan vs your own book, counts only (the tile; the pesos stay in the risen details, as approved). */
function SplitPic({ n }: { n: { setnayan: number; own: number } }) {
  const max = Math.max(1, n.setnayan, n.own);
  return (
    <span className="ag-sb ag-split" data-graph-pic="split">
      {(
        [
          ['From Setnayan', n.setnayan, false],
          ['Your imported clients', n.own, true],
        ] as const
      ).map(([label, v, ownBook]) => (
        <span key={label} className="ag-sbr">
          <span className="ag-sbl">{label}</span>
          <span className={ownBook ? 'ag-track ag-own' : 'ag-track'}>
            <i style={{ width: `${Math.max((v / max) * 100, v > 0 ? 6 : 0)}%` }} />
          </span>
          <span className="ag-sbn tabular-nums">{formatCount(v)}</span>
        </span>
      ))}
    </span>
  );
}

/** Compared with similar suppliers — each measure placed in a quarter, in words (never another shop's number). */
function BenchPic({ rows }: { rows: readonly { title: string; pct: number; word: string }[] }) {
  return (
    <span className="ag-sb" data-graph-pic="bench">
      {rows.map((r) => (
        <span key={r.title} className="ag-sbr">
          <span className="ag-sbl">{r.title}</span>
          <span className="ag-track ag-thin">
            <HeldFill value={r.pct} id={`ag:bench:${r.title}`} />
          </span>
          <span className="ag-sbn">{r.word}</span>
        </span>
      ))}
    </span>
  );
}

const PILLAR_COLOR = (s: number) => (s > 85 ? 'rgb(var(--color-ok))' : s >= 70 ? 'var(--m-orange)' : 'rgb(var(--color-danger))');

function Health({ h }: { h: GrowthView['health'] }) {
  const ghost = h.unread || h.composite === null;
  return (
    <div className="ag-cmp" data-health-ring={ghost ? 'empty' : 'scored'}>
      <ProgressRing size={112} r={45.5} sw={8} pct={h.composite ?? 0} id="ag:ring:health" ghost={ghost}>
        {ghost ? (
          <b style={{ fontSize: 30 }} className="ag-ghost">
            —
          </b>
        ) : (
          <HeldCount value={h.composite!} id="ag:health:n" className="ag-ring-big" />
        )}
        <small>{h.band}</small>
      </ProgressRing>
      <div className="ag-rt" style={{ minWidth: 0 }}>
        {ghost ? (
          <p className="ag-ghost-t" style={{ marginTop: 4 }}>
            {h.unread ? 'Couldn’t load your health score just now.' : h.coaching}
          </p>
        ) : (
          <div className="ag-pil">
            {h.pillars.map((p, i) => (
              <Pillar key={p.label} label={p.label} score={p.score} i={i} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function Pillar({ label, score, i }: { label: string; score: number | null; i: number }) {
  return (
    <>
      <span>{label}</span>
      <div className="ag-track">{score === null ? null : <HeldFill value={score} id={`ag:pil:${label}`} delay={i * 80} style={{ background: PILLAR_COLOR(score) }} />}</div>
      {score === null ? <span className="ag-n">—</span> : <HeldCount value={score} id={`ag:piln:${label}`} delay={i * 80} className="ag-n" />}
    </>
  );
}

function Attribution({ split, roi }: { split: NonNullable<GrowthView['windows']['30']['booking']['split']>; roi: string | null }) {
  const max = Math.max(split.setnayan.n, split.own.n, 1);
  const bar = (label: string, n: number, phpText: string, own: boolean) => (
    <>
      <div className="ag-ar">
        <span>{label}</span>
        <small>
          {formatCount(n)} booking{n === 1 ? '' : 's'}
        </small>
      </div>
      <div className="ag-am">
        <div className={own ? 'ag-track ag-own' : 'ag-track'}>
          <i style={{ width: `${Math.max((n / max) * 100, n > 0 ? 6 : 0)}%` }} />
        </div>
        <span className="ag-php">{phpText}</span>
      </div>
    </>
  );
  return (
    <div className="ag-attr">
      {bar('From Setnayan', split.setnayan.n, split.setnayan.php, false)}
      {bar('Your imported clients', split.own.n, split.own.php, true)}
      {roi ? (
        <p className="ag-one">
          <b>{roi}</b> — Setnayan-sourced bookings against what you pay for your plan.
        </p>
      ) : null}
    </div>
  );
}

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const BLOCKS = ['12a', '3a', '6a', '9a', '12p', '3p', '6p', '9p'];

function Heat({ grid }: { grid: number[][] }) {
  const max = Math.max(...grid.flat(), 1);
  return (
    <>
      <div className="ag-heat">
        <span />
        {BLOCKS.map((b) => (
          <span key={b} className="ag-h">
            {b}
          </span>
        ))}
        {grid.map((r, i) => (
          <HeatRow key={i} day={DAYS[i]!} row={r} max={max} />
        ))}
      </div>
      <p className="ag-cap">Darker = more inquiries arrive then · Philippine time</p>
    </>
  );
}
function HeatRow({ day, row, max }: { day: string; row: number[]; max: number }) {
  return (
    <>
      <span className="ag-l">{day}</span>
      {row.map((v, j) => (
        <span key={j} className="ag-c" style={v ? { background: `color-mix(in srgb, var(--m-orange-2) ${Math.round(20 + (v / max) * 80)}%, var(--m-paper))` } : undefined} />
      ))}
    </>
  );
}

function Bars({ values }: { values: number[] }) {
  const max = Math.max(...values, 1);
  return (
    <>
      <div className="ag-bars" aria-hidden>
        {values.map((v, i) => (
          <i key={i} style={{ height: `${Math.max((v / max) * 100, 3)}%` }} />
        ))}
      </div>
      <p className="ag-cap">Each bar is a month · reviews</p>
    </>
  );
}
