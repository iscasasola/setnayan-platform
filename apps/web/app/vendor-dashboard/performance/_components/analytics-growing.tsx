'use client';

import { formatCount } from '@/lib/format-number';
import './analytics-growing.css';
import { useRef, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { Users } from 'lucide-react';
import { Fold } from '@/app/_components/fold';
import { InfoTip } from '@/app/_components/info-tip';
import { PickMenu } from '@/app/dashboard/[eventId]/website/editor/_components/pick-menu';
import { GROWTH_WINDOWS, type GrowthWindow } from '@/lib/analytics-growing';
import type { GrowthRec, GrowthRecKey } from '@/lib/vendor-growth-recs';
import { useGrowthWindow } from '../../_components/growth-window';
import { Reanimate } from './reanimate';
import { HeldCount, HeldFill, SectionBatch } from './growth-motion';
import { GrowthLanes, LaneKeys } from './growth-lanes';
import { DoNext, RecRow } from './do-next';
import { SourceBars } from './source-bars';
import { ReplyGauge } from './reply-gauge';
import { FunnelPreviewCard } from './funnel-preview-card';
import { CalendarStrip } from './calendar-strip';
import { StarsFill } from './stars-fill';
import { ProgressRing } from './progress-ring';
import { PriceRail } from './price-rail';
import type { GrowthView, Row, SourceRow } from './growth-view';

/**
 * 🌱 ANALYTICS, GROWING — Shop › Analytics as a page a supplier WATCHES their business grow on (owner-approved 6 Nov
 * 2026; prototype "Analytics, growing" — owner: "I want it to feel like animated and see the growth of the business
 * and not like link or menus only", then "where are the recommendations?"). One window ▾, a hero that draws itself in
 * (the lanes, the sentence, Do next), and six sections in the order a supplier asks — each the shipped `Fold` with a
 * picture that is always there and plays once as it scrolls into view, its details folded under it.
 *
 * Nothing new is computed here: `growth-view.ts` words the page's own reads once; this only draws them. The headline
 * numbers count in the PINNED ROW (owner call — no twin in the hero).
 * 🔒 lib/analytics-growing.test.ts · lib/vendor-growth-recs.test.ts · performance/analytics-is-growing.test.ts
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

/** Which section each recommendation belongs under (one row under that section's picture, only when its rule fired). */
const SEC_REC: Record<string, GrowthRecKey> = { finding: 'add_photos', asking: 'reply_faster', booking: 'build_partnerships', ahead: 'open_saturdays', rep: 'ask_reviews' };

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

/** One section: the shipped Fold, its picture always visible (`between`), played once by Reanimate. */
function Section({
  id,
  index,
  title,
  when,
  line,
  pic,
  children,
  anchor,
  pro = false,
}: {
  id: string;
  index: number;
  title: string;
  when?: string;
  line: string;
  pic: ReactNode;
  children: ReactNode;
  anchor?: string;
  pro?: boolean;
}) {
  const mounted = useRef(typeof performance !== 'undefined' ? performance.now() : 0);
  const [batch, setBatch] = useState(0);
  return (
    <Reanimate still className="ag-sec" onPlay={() => setBatch(performance.now() - mounted.current < 200 ? index * 120 : 0)}>
      <SectionBatch value={batch}>
        <Fold
          title={title}
          data={`growth-${id}`}
          anchor={anchor}
          line={line}
          lineWrap
          popovers
          titleNode={
            <>
              {title}
              {pro ? ' ◆' : ''}
              {when ? <span className="ag-when"> · {when}</span> : null}
            </>
          }
          between={<div className="ag-pic">{pic}</div>}
        >
          <div className="ag-body">
            <p className="ag-details-k">Details</p>
            {children}
          </div>
        </Fold>
      </SectionBatch>
    </Reanimate>
  );
}

export function AnalyticsGrowing({
  view,
  scope = null,
  badges,
}: {
  view: GrowthView;
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
  const secRec = (id: string) => {
    const r = byKey.get(SEC_REC[id]!);
    return r ? <RecRow rec={r} sm delay={650} /> : null;
  };
  const b = w.booking;

  return (
    <div data-growth="" data-growth-window={win}>
      <div className="ag-topctl">
        <PickMenu
          label="Window — every number below follows this"
          value={win}
          options={GROWTH_WINDOWS.map((o) => ({ key: o.key, label: o.label, hint: o.hint }))}
          onPick={(k) => setWin(k as GrowthWindow)}
          dataAttr="data-growth-window-pick"
        />
        {scope}
      </div>

      {/* HERO — the lanes + the sentence + Do next (the headline numbers count in the pinned row above). */}
      <Reanimate still className="ag-hero">
        <LaneKeys
          tip={
            <InfoTip label="" ariaLabel="About these lanes" align="end">
              {TIPS.growth}
            </InfoTip>
          }
        />
        <GrowthLanes key={win} unit={w.lanes.unit} labels={w.lanes.labels} views={w.lanes.views} asked={w.lanes.asked} booked={w.lanes.booked} />
        <p className="ag-say" data-growth-sentence="">
          {w.sentence.map((s, i) => (s.b ? <b key={i}>{s.t}</b> : <span key={i}>{s.t}</span>))}
        </p>
        <DoNext recs={w.recs} />
      </Reanimate>

      <div className="ag-folds">
        {/* §1 Are couples finding me? — picture: the source bars grow */}
        <Section
          id="finding"
          index={0}
          title="Are couples finding me?"
          line={w.finding.line}
          pic={
            <>
              <SourceBars rows={w.finding.sources} />
              {secRec('finding')}
            </>
          }
        >
          <One>Where couples found your page before opening it — sources under 5 stay hidden so the read stays reliable.</One>
        </Section>

        {/* §2 Are they asking, and do I answer? — picture: the reply gauge + habit dots */}
        <Section
          id="asking"
          index={1}
          title="Are they asking, and do I answer?"
          line={w.asking.line}
          pic={
            <>
              <ReplyGauge minutes={view.reply.gauge.minutes} answered={view.reply.gauge.answered} unread={view.reply.chip.word === 'Couldn’t load'} />
              {secRec('asking')}
            </>
          }
        >
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
        </Section>

        {/* §3 Am I booking? — picture: the funnel filling stage by stage */}
        <Section
          id="booking"
          index={2}
          anchor="funnel"
          title="Am I booking?"
          line={b.line}
          pic={
            <>
              <p className="ag-subt" style={{ marginTop: 0 }}>
                <InfoTip label="Your booking funnel" align="start">
                  {TIPS.funnel}
                </InfoTip>
              </p>
              <FunnelPreviewCard steps={b.funnel} />
              {secRec('booking')}
            </>
          }
        >
          {b.value && b.split ? (
            <>
              <Rows rows={[{ title: 'Booked value', line: b.value.line, strong: b.value.php }]} />
              <Sub t="Setnayan vs your own book" tip={TIPS.split} />
              <Attribution split={b.split} roi={b.roi} />
              <Sub t="Where your bookings come from" tip={TIPS.sources} />
              <SourceRowsList list={b.bookedSources} empty="No source has 5 bookings yet." />
              {view.deals ? (
                <>
                  <Sub t="Deals" when="12 months" tip={TIPS.deals} />
                  <Rows rows={view.deals} />
                </>
              ) : null}
            </>
          ) : (
            <One>Booked value, Setnayan vs your own book, where bookings come from and your deals fill in with your first booking.</One>
          )}
        </Section>

        {/* §4 What’s ahead — picture: the calendar strip */}
        <Section
          id="ahead"
          index={3}
          title="What’s ahead"
          when="from today"
          line={view.ahead.line}
          pic={
            <>
              <CalendarStrip months={view.ahead.months} booked={view.ahead.marks.booked} waiting={view.ahead.marks.waiting} unread={view.ahead.unread} />
              {secRec('ahead')}
            </>
          }
        >
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
        </Section>

        {/* §5 Reputation & badges — picture: the stars fill + the badge tracker ring */}
        <Section
          id="rep"
          index={4}
          title="Reputation & badges"
          when="all time"
          line={view.rep.line}
          pic={
            <>
              <StarsFill rating={view.rep.rating} count={view.rep.count} unread={view.rep.unread} />
              {view.badgeRing ? (
                <div className="ag-rep" style={{ marginTop: 14 }}>
                  <ProgressRing size={64} r={26} sw={5} pct={(view.badgeRing.have / view.badgeRing.goal) * 100} id="ag:ring:badge" delay={120} ghost={view.badgeRing.have === 0}>
                    {view.badgeRing.have ? (
                      <HeldCount value={view.badgeRing.have} id="ag:ring:badgeN" delay={120} className="ag-ringn" />
                    ) : (
                      <b style={{ fontSize: 17 }}>0</b>
                    )}
                  </ProgressRing>
                  <span className="ag-rt">
                    <span className="ag-title">
                      {formatCount(view.badgeRing.have)} of {formatCount(view.badgeRing.goal)} events
                    </span>
                    <span className="ag-line">Next badge: {view.badgeRing.goalWord}</span>
                  </span>
                </div>
              ) : null}
              {secRec('rep')}
            </>
          }
        >
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
        </Section>

        {/* §6 How I compare — picture: the health ring + pillars + the price rail */}
        <Section
          id="compare"
          index={5}
          title="How I compare"
          when="now"
          pro={view.pro}
          line={view.compare.line}
          pic={
            <>
              <Health h={view.health} />
              {view.price.show ? (
                <div style={{ marginTop: 16 }}>
                  <PriceRail positioned={view.price.positioned} unread={view.price.unread} />
                </div>
              ) : null}
            </>
          }
        >
          <Sub t="Your health score" when="now" tip={TIPS.health} />
          {view.health.unread ? (
            <One>Couldn’t load your health score just now.</One>
          ) : view.health.composite === null ? (
            <One>Responsiveness · Reputation · Demand · Conversion · Delivery — none scored yet; each fills in from your own replies, reviews, bookings and delivery.</One>
          ) : (
            view.health.pillars.map((p) => <RowView key={p.label} r={{ title: p.label, line: p.hint }} />)
          )}
          {view.bench.show ? (
            <>
              <Sub t="Shops like yours" when="your category & area" tip={TIPS.bench} />
              {view.bench.unread ? (
                <One>Couldn’t load shops like yours just now.</One>
              ) : view.bench.rows ? (
                <div className="ag-rows">
                  {view.bench.rows.map((r) => (
                    <div key={r.title} className="ag-row">
                      <span className="ag-t">
                        <span className="ag-title">{r.title}</span>
                        <span className="ag-line">{r.line}</span>
                        <div className="ag-track ag-thin" style={{ marginTop: 6 }}>
                          <HeldFill value={r.pct} id={`ag:bench:${r.title}`} />
                        </div>
                      </span>
                      <span className="ag-chip ag-quiet">{r.word}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <One>
                  <b>Not enough shops like yours yet</b> — a comparison appears once the group is big enough that no single shop can be picked out of it.
                </One>
              )}
            </>
          ) : null}
          {view.price.show ? (
            <>
              <Sub t="Where your price sits" when={view.price.when} tip={TIPS.price} />
              {view.price.positioned ? (
                <RowView r={{ title: 'Your starting price', line: view.price.positioned.word, strong: view.price.positioned.own }} />
              ) : (
                <One>{view.price.unread ? 'Couldn’t load the market just now.' : 'Not enough market data yet.'}</One>
              )}
            </>
          ) : null}
        </Section>
      </div>
    </div>
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
