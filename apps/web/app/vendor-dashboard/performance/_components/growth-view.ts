/**
 * growth-view.ts — every read Shop › Analytics already makes, worded ONCE into what "Analytics, growing" draws
 * (owner-approved 6 Nov 2026). Pure and serialisable: `page.tsx` builds it from the live reads, the supplier lab builds
 * it from fixtures, and the client tree (`analytics-growing.tsx`) only draws it. Nothing new is computed about the shop:
 * every figure is a number a shipped reader returned; every line is a shipped line or the prototype's copy.
 *
 * HONEST: a refused read is `null` and is drawn "Couldn’t load" — never a zero chart, never "No inquiries yet" to a shop
 * we could not read (`vendor-dashboard/reads-are-honest.test.ts`).
 */
import { formatCount } from '@/lib/format-number';
import { formatPhpRounded } from '@/lib/php';
import {
  COULDNT_LOAD,
  aheadLine,
  askingLine,
  bookingLine,
  compareLine,
  dayBuckets,
  findingLine,
  growthSentence,
  manilaDay,
  monthBuckets,
  ordinal,
  railMarker,
  repLine,
  replyGauge,
  replyRow,
  stripMarks,
  stripMonths,
  type GrowthWindow,
  type Seg,
} from '@/lib/analytics-growing';
import type { GrowthSeries } from '@/lib/vendor-growth-series';
import type { SourceSlice } from '@/lib/vendor-funnel';
import type { SourceAttribution } from '@/lib/vendor-source-attribution';
import type { GrowthRec } from '@/lib/vendor-growth-recs';
import { formatReplyMinutes, type ReplyTimeVerdict } from '@/lib/vendor-reply-time';
import { formatMinutes, type InquiryAnalytics } from '@/lib/vendor-inquiry-analytics';
import { formatDuration, type ConversionAnalytics } from '@/lib/vendor-conversion-analytics';
import type { CapacityAnalytics } from '@/lib/vendor-capacity-analytics';
import type { ReputationAnalytics } from '@/lib/vendor-reputation-analytics';
import type { DemandRadar } from '@/lib/demand-radar';
import type { FunnelBenchmark } from '@/lib/funnel-benchmark';
import type { PricePositionResult } from '@/lib/price-position';
import type { VendorHealthComposite } from '@/lib/vendor-health-composite';

export type Totals = { views: number; inquiries: number; quotes: number; booked: number };
/** A source as a row: `count: null` = under the min-N floor, drawn "under 5 · hidden". */
export type SourceRow = { key: string; label: string; count: number | null };
export type Row = { title: string; line?: string; strong?: string; wrap?: boolean };
export type Chip = { tone: 'ok' | 'quiet' | 'no' | 'wait'; word: string };

export type WindowView = {
  sentence: Seg[];
  lanes: {
    unit: 'day' | 'month';
    /** One label per bucket ("6 Nov" · "Nov"), oldest first. */
    labels: string[];
    views: number[] | null;
    asked: number[] | null;
    booked: number[] | null;
  };
  finding: { line: string; sources: SourceRow[] | null };
  asking: { line: string; byType: SourceRow[] | null };
  booking: {
    line: string;
    funnel: { label: string; count: number }[] | null;
    value: { php: string; line: string } | null;
    split: { setnayan: { n: number; php: string }; own: { n: number; php: string } } | null;
    roi: string | null;
    bookedSources: SourceRow[] | null;
  };
  recs: GrowthRec[];
};

export type GrowthView = {
  windows: Record<GrowthWindow, WindowView>;
  reply: {
    title: string;
    line: string;
    chip: Chip;
    shown: boolean;
    gauge: { minutes: number | null; answered: number; label: string | null };
  };
  /** §2 details, 12 months — null = not read (or the plan does not show them), [] never. */
  speed: Row[] | null;
  slipped: string | null;
  /** 7 days (Mon → Sun) × 8 three-hour blocks, Philippine time; null = nothing to draw. */
  heat: number[][] | null;
  deals: Row[] | null;
  ahead: {
    line: string;
    /** Neither the capacity read nor the booked dates came back — the strip says "Couldn’t load", never "your first". */
    unread: boolean;
    todayIso: string;
    marks: { booked: { at: number; many: boolean }[]; waiting: number[] };
    months: string[];
    rows: Row[] | null;
    dates: Row[] | null;
  };
  demand: { show: boolean; unread: boolean; rows: Row[] | null; months: Row[] | null };
  /** `unread` — the stats row was refused: the stars say so instead of "Your first review fills these". */
  rep: { line: string; unread: boolean; rating: number | null; count: number; rows: Row[] | null; dist: number[] | null; monthly: number[] | null };
  badgeRing: { have: number; goal: number; goalWord: string } | null;
  health: {
    unread: boolean;
    composite: number | null;
    band: string;
    coaching: string;
    pillars: { label: string; hint: string; score: number | null }[];
  };
  bench: { show: boolean; unread: boolean; rows: { title: string; line: string; pct: number; word: string }[] | null };
  price: {
    show: boolean;
    unread: boolean;
    when: string;
    positioned: { own: string; low: string; med: string; high: string; at: number | null; word: string } | null;
  };
  compare: { line: string };
  /** ◆ — the plan gate is ON and this shop is below the plan that sees market intel (flag-dark today → false). */
  pro: boolean;
};

/* ── helpers ─────────────────────────────────────────────────────────────────────────────────────────────── */

const DAY_MS = 24 * 60 * 60 * 1000;
const plural = (n: number, one: string, many: string) => (n === 1 ? one : many);
const php = (n: number) => formatPhpRounded(n);

export function sourceRows(slices: readonly SourceSlice[] | null): SourceRow[] | null {
  if (slices === null) return null;
  return slices.map((s) => ({ key: s.key, label: s.label, count: s.shown ? s.count : null }));
}

/** The booked lane aligned to the window's buckets — newest last; a short or failed series is null, never zeros. */
function bookedLane(points: readonly { bookings: number }[] | null, n: number): number[] | null {
  if (!points || points.length === 0) return null;
  const tail = points.slice(-n).map((p) => Number(p.bookings) || 0);
  return tail.length === n ? tail : [...Array(n - tail.length).fill(0), ...tail];
}

const DATE_FMT = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
const fmtDate = (iso: string) => DATE_FMT.format(new Date(`${iso.slice(0, 10)}T00:00:00Z`));

/** Philippine-time heat: rows Mon → Sun, eight 3-hour blocks (12a 3a 6a 9a 12p 3p 6p 9p). */
function heatGrid(cells: InquiryAnalytics['heatmap']): number[][] | null {
  const g = Array.from({ length: 7 }, () => Array(8).fill(0) as number[]);
  let any = false;
  for (const c of cells) {
    // dow: 0 = Sunday (Postgres extract(dow)) → row 6; Monday → row 0.
    const row = (c.dow + 6) % 7;
    const col = Math.floor(c.hr / 3);
    if (row < 0 || row > 6 || col < 0 || col > 7) continue;
    g[row]![col]! += c.count;
    if (c.count > 0) any = true;
  }
  return any ? g : null;
}

/* ── the build ───────────────────────────────────────────────────────────────────────────────────────────── */

export type GrowthInputs = {
  nowMs: number;
  /** The pinned row's counts — the last 30 days, the 30 before, and the last 12 months; null = not read. */
  totals30: Totals | null;
  totalsBefore30: Totals | null;
  totals12: Totals | null;
  views: GrowthSeries | null;
  inquiries: GrowthSeries | null;
  bookedDay: readonly { bookings: number }[] | null;
  bookedMonth: readonly { bookings: number }[] | null;
  viewsBySource: Record<GrowthWindow, SourceSlice[] | null>;
  inquiriesBySource: Record<GrowthWindow, SourceSlice[] | null>;
  bookedBySource: Record<GrowthWindow, SourceSlice[] | null>;
  attribution: Record<GrowthWindow, SourceAttribution | null>;
  /** "~N× your annual plan" — only on 12 months, only on a paid plan (as `RoiAttributionCard`). */
  annualPlanPhp: number | null;
  recs: Record<GrowthWindow, GrowthRec[]>;
  verdict: ReplyTimeVerdict | null;
  inquiry: InquiryAnalytics | null;
  conversion: ConversionAnalytics | null;
  capacity: CapacityAnalytics | null;
  upcoming: { date: string; bookings: number }[] | null;
  /** null = the radar read was refused. */
  radar: DemandRadar | null;
  showMarket: boolean;
  rating: string;
  ratingAvg: number | null;
  ratingCount: number;
  reputation: ReputationAnalytics | null;
  badges: { verified: boolean; completedEvents: number | null; earned: number | null; earnedName: string | null; next: number | null; nextName: string | null } | null;
  health: VendorHealthComposite;
  healthUnread: boolean;
  bench: FunnelBenchmark | null;
  benchUnread: boolean;
  price: PricePositionResult | { status: 'unreadable' } | null;
  category: string | null;
  regionLabel: string | null;
  pro: boolean;
};

function windowView(inp: GrowthInputs, w: GrowthWindow): WindowView {
  const day = w === '30';
  const t = day ? inp.totals30 : inp.totals12;
  const figures = t ? { views: t.views, inquiries: t.inquiries, booked: t.booked } : null;
  const viewsChange = day && inp.totals30 && inp.totalsBefore30 ? inp.totals30.views - inp.totalsBefore30.views : null;
  const buckets = day ? dayBuckets(inp.nowMs, 30) : monthBuckets(inp.nowMs, 12);
  const booked = day ? bookedLane(inp.bookedDay, 30) : bookedLane(inp.bookedMonth, 12);
  const att = inp.attribution[w];
  const funnel = t
    ? [
        { label: 'Profile views', count: t.views },
        { label: 'Inquiries', count: t.inquiries },
        { label: 'Quotes sent', count: t.quotes },
        { label: 'Booked', count: t.booked },
      ]
    : null;
  const hasBooked = Boolean(att && att.totalBookings > 0);
  const roi =
    !day && inp.annualPlanPhp && inp.annualPlanPhp > 0 && att && att.setnayan.revenuePhp > 0
      ? `~${(att.setnayan.revenuePhp / inp.annualPlanPhp).toFixed(1)}× your annual plan`
      : null;
  return {
    sentence: growthSentence({ figures, viewsChange, unit: day ? 'day' : 'month', booked }),
    lanes: {
      unit: day ? 'day' : 'month',
      labels: buckets.map((b) => b.label),
      views: inp.views ? (day ? inp.views.day : inp.views.month).map((b) => b.count) : null,
      asked: inp.inquiries ? (day ? inp.inquiries.day : inp.inquiries.month).map((b) => b.count) : null,
      booked,
    },
    finding: { line: findingLine(inp.viewsBySource[w], figures ? figures.views : null), sources: sourceRows(inp.viewsBySource[w]) },
    asking: { line: askingLine(inp.verdict, figures ? figures.inquiries : null), byType: sourceRows(inp.inquiriesBySource[w]) },
    booking: {
      line: bookingLine(figures ? figures.booked : null, att ? { revenuePhp: att.totalRevenuePhp, setnayanBookings: att.setnayan.bookingCount } : null),
      funnel,
      value: hasBooked && att ? { php: php(att.totalRevenuePhp), line: `Confirmed on ${formatCount(att.totalPriced)} of ${formatCount(att.totalBookings)} ${plural(att.totalBookings, 'booking', 'bookings')}` } : null,
      split:
        hasBooked && att
          ? {
              setnayan: { n: att.setnayan.bookingCount, php: php(att.setnayan.revenuePhp) },
              own: { n: att.offPlatform.bookingCount, php: php(att.offPlatform.revenuePhp) },
            }
          : null,
      roi,
      bookedSources: hasBooked ? sourceRows(inp.bookedBySource[w]) : null,
    },
    recs: inp.recs[w],
  };
}

export function buildGrowthView(inp: GrowthInputs): GrowthView {
  const v = inp.verdict;
  const rr = replyRow(v);
  const g = replyGauge(v);
  const title = !v
    ? 'We couldn’t load your reply time just now.'
    : v.shown
      ? `Couples see “${v.label}” on your shop.`
      : v.reason === 'too_slow'
        ? `Your typical reply is about ${formatReplyMinutes(v.medianMinutes)} — couples see nothing yet.`
        : v.reason === 'away'
          ? 'Hidden while you have not signed in for a week.'
          : 'Couples see nothing yet about how fast you reply.';

  // §2 details (12 months, the shipped inquiry analytics)
  const ia = inp.inquiry;
  const answered = ia ? ia.reply.answeredCount : 0;
  const speed: Row[] | null =
    ia && answered > 0
      ? [
          { title: 'Median reply', line: `Across ${formatCount(answered)} answered ${plural(answered, 'inquiry', 'inquiries')}`, strong: formatMinutes(ia.reply.p50Minutes) },
          { title: '9 in 10 within', line: '9 in 10 replies land inside this', strong: formatMinutes(ia.reply.p90Minutes) },
        ]
      : null;
  const m = ia?.missed;
  const slippedTotal = m ? m.declined + m.unansweredOverSla + m.selfReportedNoResponse + m.waitlisted : 0;
  const slipped =
    ia && answered > 0 && m
      ? `${formatCount(slippedTotal)} slipped · ${formatCount(m.declined)} declined · ${formatCount(m.unansweredOverSla)} unanswered 48h+ · ${formatCount(m.waitlisted)} waitlisted`
      : null;

  // §3 deals (12 months, the shipped conversion analytics)
  const c = inp.conversion;
  const deals: Row[] | null =
    c && c.winLoss.bookingsWon + c.quote.sentCount > 0
      ? [
          { title: 'Quote acceptance', line: `${formatCount(c.quote.acceptedCount)}/${formatCount(c.quote.sentCount)} quotes accepted`, strong: c.quote.acceptancePct === null ? '—' : `${Math.round(c.quote.acceptancePct)}%`, wrap: true },
          { title: 'Avg deal size', line: `${formatCount(c.deal.bookedPricedCount)} priced ${plural(c.deal.bookedPricedCount, 'booking', 'bookings')}`, strong: c.deal.avgContractPhp === null ? '—' : php(c.deal.avgContractPhp), wrap: true },
          {
            title: 'Median lead time',
            line: `${formatCount(c.lead.bookedWithDateCount)} dated${c.lead.avgLeadDays === null ? '' : ` · avg ${Math.round(c.lead.avgLeadDays)}d before the event`}`,
            strong: c.lead.medianLeadDays === null ? '—' : `${Math.round(c.lead.medianLeadDays)} days`,
            wrap: true,
          },
          {
            title: 'Win rate',
            line: `Of decided inquiries · ${formatCount(c.winLoss.bookingsWon)} won · ${formatCount(c.winLoss.inquiriesDeclined)} declined · ${formatCount(c.winLoss.quotesLost)} quotes lost`,
            strong: c.winLoss.winRateOfDecided === null ? '—' : `${Math.round(c.winLoss.winRateOfDecided)}%`,
            wrap: true,
          },
          { title: 'Avg time to quote', line: 'From inquiry to your first quote', strong: formatDuration(c.quote.avgHoursToQuote), wrap: true },
        ]
      : null;

  // §4 ahead (capacity + the upcoming booked days)
  const todayIso = manilaDay(inp.nowMs);
  const cap = inp.capacity;
  const up = inp.upcoming;
  // One fact, two readers: the strip's booked dates must agree with capacity's 90-day count, or the strip says nothing.
  const upAgrees = cap && up ? up.filter((d) => Date.parse(`${d.date}T00:00:00Z`) - Date.parse(`${todayIso}T00:00:00Z`) < 90 * DAY_MS).length === cap.load.next90DaysBooked : Boolean(up);
  const capRows: Row[] | null =
    cap && (cap.load.upcomingBookedDays > 0 || cap.waitlistTotal > 0)
      ? [
          { title: 'Days booked ahead', line: `${formatCount(cap.load.next30DaysBooked)} in next 30 · ${formatCount(cap.load.next90DaysBooked)} in next 90`, strong: formatCount(cap.load.upcomingBookedDays) },
          { title: 'Bookings ahead', line: 'Some days hold more than one booking', strong: formatCount(cap.load.upcomingBookings) },
          { title: 'Couples waiting', line: `Across ${formatCount(cap.waitlist.length)} ${plural(cap.waitlist.length, 'date', 'dates')} you weren’t free`, strong: formatCount(cap.waitlistTotal) },
        ]
      : null;
  const dates: Row[] | null = cap && cap.waitlist.length ? cap.waitlist.map((d) => ({ title: fmtDate(d.date), strong: `${formatCount(d.waiting)} waiting` })) : null;

  // §4 demand near you (the radar, market plans)
  const radar = inp.radar;
  const demandMonths = radar && radar.hasData ? [...radar.months].sort((a, b) => b.total - a.total).filter((x) => x.month >= todayIso.slice(0, 7)).slice(0, 3) : [];
  const sum = (k: 'inquiries' | 'unlocks' | 'bookings') => (radar ? radar.months.reduce((s, x) => s + x[k], 0) : 0);
  const demand = {
    show: inp.showMarket,
    unread: inp.showMarket && radar === null,
    rows: radar && radar.hasData ? [{ title: 'Inquiries', strong: formatCount(sum('inquiries')) }, { title: 'Paid unlocks', strong: formatCount(sum('unlocks')) }, { title: 'Bookings', strong: formatCount(sum('bookings')) }] : null,
    months: demandMonths.length ? demandMonths.map((x) => ({ title: monthName(x.month), strong: formatCount(x.total) })) : null,
  };

  // §5 reputation
  const rep = inp.reputation;
  const cov = rep?.coverage;
  const repRows: Row[] | null =
    cov && cov.totalReviews > 0
      ? [
          { title: 'Overall rating', line: `Across ${formatCount(cov.totalReviews)} ${plural(cov.totalReviews, 'review', 'reviews')}`, strong: cov.avgRating === null ? '—' : `${cov.avgRating.toFixed(1)}★` },
          { title: 'Reply to reviews', line: `${formatCount(cov.repliedCount)}/${formatCount(cov.totalReviews)} reviews answered`, strong: cov.coveragePct === null ? '—' : `${Math.round(cov.coveragePct)}%` },
          { title: 'Time to reply', line: 'From review posted to your reply', strong: cov.avgReplyHours === null ? '—' : `${(cov.avgReplyHours / 24).toFixed(1)}d` },
        ]
      : null;
  const b = inp.badges;
  const milestoneWord = b && b.earned ? `${formatCount(b.earned)} events${b.earnedName ? ` ${b.earnedName}` : ''}` : null;

  // §6 compare
  const h = inp.health;
  const benchRows =
    inp.bench && inp.bench.hasBand
      ? inp.bench.metrics
          .filter((x) => x.own !== null && x.band !== null && x.percentile !== null)
          .map((x) => ({ title: x.label, line: `${benchOwn(x.key, x.own!)} · middle of the field ${benchOwn(x.key, x.band!.p50)}`, pct: Math.max(0, Math.min(100, x.percentile!)), word: x.tier ? TIER_COPY[x.tier] : '—' }))
      : null;
  const p = inp.price;
  const positioned =
    p && p.status === 'positioned'
      ? {
          own: p.key.ownPricePhp === null ? '—' : php(p.key.ownPricePhp),
          low: php(p.band.lowPhp),
          med: php(p.band.medianPhp),
          high: php(p.band.highPhp),
          at: railMarker(p.key.ownPricePhp, p.band, p.percentile),
          word: `${p.percentile === null ? 'Single-price band' : `${ordinal(p.percentile)} percentile`} · ${POSITION_WORD[p.position]}`,
        }
      : null;

  return {
    windows: { '30': windowView(inp, '30'), '12': windowView(inp, '12') },
    reply: { title, line: rr.line, chip: rr.chip, shown: Boolean(v && v.shown), gauge: { minutes: g.minutes, answered: g.answered, label: g.minutes === null ? null : formatReplyMinutes(g.minutes) } },
    speed,
    slipped,
    heat: ia && answered > 0 ? heatGrid(ia.heatmap) : null,
    deals,
    ahead: {
      line: cap ? aheadLine({ bookedDays: cap.load.upcomingBookedDays, waitingCouples: cap.waitlistTotal, waitingDates: cap.waitlist.length }) : inp.upcoming ? aheadLine({ bookedDays: inp.upcoming.length, waitingCouples: 0, waitingDates: 0 }) : COULDNT_LOAD,
      unread: !cap && !up,
      todayIso,
      marks: up && upAgrees ? stripMarks(todayIso, up, cap ? cap.waitlist : []) : { booked: [], waiting: cap ? stripMarks(todayIso, [], cap.waitlist).waiting : [] },
      months: stripMonths(todayIso),
      rows: capRows,
      dates,
    },
    demand,
    rep: {
      line: repLine(inp.rating, b ? { verified: b.verified, milestone: milestoneWord } : null),
      unread: inp.rating === COULDNT_LOAD,
      rating: inp.ratingCount > 0 && inp.ratingAvg !== null ? inp.ratingAvg : null,
      count: inp.ratingCount,
      rows: repRows,
      dist: cov && cov.totalReviews > 0 ? [cov.distribution.five, cov.distribution.four, cov.distribution.three, cov.distribution.two, cov.distribution.one] : null,
      monthly: rep && cov && cov.totalReviews > 0 ? rep.monthly.map((x) => x.count) : null,
    },
    badgeRing: b && b.completedEvents !== null && b.next !== null ? { have: b.completedEvents, goal: b.next, goalWord: `${formatCount(b.next)} events${b.nextName ? ` · ${b.nextName}` : ''}` } : null,
    health: {
      unread: inp.healthUnread,
      composite: h.composite,
      band: h.bandLabel,
      coaching: h.coaching,
      pillars: h.pillars.map((x) => ({ label: x.label, hint: x.hint, score: x.score })),
    },
    bench: { show: inp.showMarket, unread: inp.benchUnread, rows: benchRows && benchRows.length ? benchRows : null },
    price: {
      show: inp.showMarket,
      unread: Boolean(p && p.status === 'unreadable'),
      when: `${inp.category ?? 'your category'} · ${inp.regionLabel ?? 'your region'}`,
      positioned,
    },
    compare: {
      line: compareLine(
        { composite: h.composite, bandLabel: h.bandLabel, unread: inp.healthUnread },
        inp.benchUnread ? 'unreadable' : inp.bench && inp.bench.hasBand ? inp.bench.metrics.map((x) => ({ key: x.key, tier: x.tier })) : null,
      ),
    },
    pro: inp.pro,
  };
}

const TIER_COPY = { top: 'Top quarter', above_median: 'Above the middle', below_median: 'Below the middle', bottom: 'Bottom quarter' } as const;
const POSITION_WORD = { below_band: 'below the market band', in_band: 'inside the market band', above_band: 'above the market band' } as const;
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const monthName = (iso: string) => MONTHS[Number(iso.slice(5, 7)) - 1] ?? iso;

function benchOwn(key: string, v: number): string {
  if (key === 'reply_mins') return formatMinutes(v);
  return `${Math.round(v)}%`;
}
