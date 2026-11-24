import { formatCount } from '@/lib/format-number';
import { formatPhpRounded } from '@/lib/php';
import { bucketInstants, dayBuckets, monthBuckets, type GrowthWindow } from '@/lib/analytics-growing';
import type { InquiryHeatCell, InquiryMissed } from '@/lib/vendor-inquiry-analytics';
import type { LeadTime } from '@/lib/vendor-conversion-analytics';

/**
 * 🛍📊 THE STORE'S NEW GRAPHS, worded once (owner 23 Nov 2026 — the Supplier Store drawing v10, specs
 * `prototypes/supplier_store_graphs_badges_2026-11-23/`, the "All 30 graphs" table; DECISION_LOG 5a8c6bf3 "every graph
 * reads a real table" · 022681cf "every graph is free"). Twelve of the drawing's thirteen new graphs; the thirteenth,
 * "Albums opened", has no reader: `vendor_album_opens` records when the SHOP's own people last opened an album, not a
 * couple's open, so it is not built (said in the PR's STATUS, never drawn from the wrong table).
 *
 * Pure — the rows come from `vendor-store-graphs.server.ts`; this file only buckets and words them, so each rule is
 * unit-tested without a database. Every graph names its data (`STORE_GRAPH_SOURCE`, drawn under the title).
 * 🔑 HONEST: a refused read is `null` and the card says "Couldn’t load" — never a zero and never the Example picture.
 * 🔒 lib/vendor-store-graphs.test.ts · performance/the-store-graphs-are-honest.test.ts
 */

/** The new graphs, in the drawing's table order — appended to the END of the carousel (`CARD_ORDER`), marked New. */
export const STORE_GRAPH_KEYS = ['followers', 'saved', 'photos', 'whenask', 'missed', 'value', 'owed', 'lead', 'types', 'revmonth', 'substars', 'replied'] as const;
export type StoreGraphKey = (typeof STORE_GRAPH_KEYS)[number];

/** The drawing's titles, verbatim. */
export const STORE_GRAPH_TITLE: Readonly<Record<StoreGraphKey, string>> = {
  followers: 'New followers',
  saved: 'Saved by guests',
  photos: 'Your most viewed photos',
  whenask: 'When couples ask',
  missed: 'Inquiries you missed',
  value: 'Booked value, month by month',
  owed: 'Paid and still owed',
  lead: 'How far ahead couples book',
  types: 'What you celebrate',
  revmonth: 'Reviews, month by month',
  substars: 'Your stars, part by part',
  replied: 'Reviews you replied to',
};

/** What each graph reads, in words — drawn small under the title. */
export const STORE_GRAPH_SOURCE: Readonly<Record<StoreGraphKey, string>> = {
  followers: 'Counts · couples who followed your shop and still follow it, by day (by month on 12 months)',
  saved: 'Counts · guests who saved your shop for their own planning, by day (by month on 12 months)',
  photos: 'Counts · views of each photo on your page — one per person per photo per day; yours never count',
  whenask: 'Counts · inquiries by weekday and time of day, Philippine time, the last 12 months',
  missed: 'Counts · inquiries you declined, left unanswered 48 hours or more, marked no response, or waitlisted',
  value: 'Pesos · the agreed price of your bookings, by the month they were booked — bookings with a price set',
  owed: 'Pesos · your open bookings’ payment plans — received, still to come in, overdue',
  lead: 'Days · from the day a couple booked you to their event date — the middle of your dated bookings',
  types: 'Counts · events you completed through Setnayan, by kind',
  revmonth: 'Counts · reviews couples left you, by month',
  substars: 'Averages · the four part ratings on every review — communication, quality, value, on time',
  replied: 'Counts · reviews you answered, of every review you have',
};

/** Windows the drawing fixes — a label, no switch (merged into `FIXED_WINDOW`). The rest switch 30 days / 12 months. */
export const STORE_FIXED_WINDOW: Readonly<Partial<Record<StoreGraphKey, string>>> = {
  whenask: 'Last 12 months',
  value: 'Last 12 months',
  owed: 'Open bookings',
  lead: 'Last 12 months',
  types: 'All time',
  revmonth: 'Last 12 months',
  substars: 'All time',
  replied: 'All time',
};

const WINDOW_WORD: Record<GrowthWindow, string> = { '30': 'in the last 30 days', '12': 'in the last 12 months' };
const plural = (n: number, one: string, many: string) => (n === 1 ? one : many);

// ── a series over the window (followers · saved) ────────────────────────────────────────────────────────────────────

export type WindowSeries = { values: number[]; labels: string[]; total: number };

/** The instants bucketed by Manila day (30 days) or month (12 months), oldest first. */
export function windowSeries(instants: readonly string[], nowMs: number, win: GrowthWindow): WindowSeries {
  const b = win === '30' ? bucketInstants(instants, dayBuckets(nowMs, 30), 'day') : bucketInstants(instants, monthBuckets(nowMs, 12), 'month');
  return { values: b.map((x) => x.count), labels: b.map((x) => x.label), total: b.reduce((s, x) => s + x.count, 0) };
}

export function followersLine(s: WindowSeries, win: GrowthWindow): string {
  return `${formatCount(s.total)} new ${plural(s.total, 'follower', 'followers')} ${WINDOW_WORD[win]}.`;
}

export function savedLine(s: WindowSeries, win: GrowthWindow): string {
  return `${formatCount(s.total)} ${plural(s.total, 'guest', 'guests')} saved your shop ${WINDOW_WORD[win]}.`;
}

// ── photos ──────────────────────────────────────────────────────────────────────────────────────────────────────────

export type PhotoViews = { key: string; views: number };
export type TopPhotos = { top: PhotoViews[]; total: number };
export const TOP_PHOTOS = 3;

/**
 * Views per photo in the window, from the dedupe ledger's rows (`photo_key`, `viewed_on` — one row per viewer per photo
 * per Manila day, which IS one view). Only photos still on the page count; most viewed first, ties to the later photo.
 */
export function topPhotos(rows: readonly { photo_key: string; viewed_on: string }[], pageKeys: readonly string[], sinceDay: string): TopPhotos {
  const at = new Map(pageKeys.map((k, i) => [k, i] as const));
  const n = new Map<string, number>();
  for (const r of rows) {
    if (!at.has(r.photo_key) || r.viewed_on.slice(0, 10) < sinceDay) continue;
    n.set(r.photo_key, (n.get(r.photo_key) ?? 0) + 1);
  }
  const all = [...n.entries()].map(([key, views]) => ({ key, views })).sort((a, b) => b.views - a.views || at.get(b.key)! - at.get(a.key)!);
  return { top: all.slice(0, TOP_PHOTOS), total: all.reduce((s, p) => s + p.views, 0) };
}

export function photosLine(p: TopPhotos, win: GrowthWindow): string {
  const first = p.top[0];
  if (!first) return `No photo was opened ${WINDOW_WORD[win]}.`;
  return `Your top photo: ${formatCount(first.views)} ${plural(first.views, 'view', 'views')} ${WINDOW_WORD[win]} · ${formatCount(p.total)} across your photos.`;
}

// ── when couples ask ────────────────────────────────────────────────────────────────────────────────────────────────

export const HEAT_DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'] as const;
export const HEAT_BLOCKS = ['12a–3a', '3a–6a', '6a–9a', '9a–12p', '12p–3p', '3p–6p', '6p–9p', '9p–12a'] as const;

export function whenAskLine(grid: number[][]): string {
  let best = { r: 0, c: 0, v: -1 };
  grid.forEach((row, r) => row.forEach((v, c) => (v > best.v ? (best = { r, c, v }) : null)));
  const total = grid.flat().reduce((s, v) => s + v, 0);
  return `Most inquiries arrive on ${HEAT_DAYS[best.r]}, ${HEAT_BLOCKS[best.c]} · ${formatCount(total)} in the last 12 months.`;
}

// ── inquiries you missed ────────────────────────────────────────────────────────────────────────────────────────────

export const missedTotal = (m: InquiryMissed): number => m.declined + m.unansweredOverSla + m.selfReportedNoResponse + m.waitlisted;

export function missedLine(m: InquiryMissed, win: GrowthWindow): string {
  const t = missedTotal(m);
  if (t === 0) return `No inquiry slipped ${WINDOW_WORD[win]}.`;
  return `${formatCount(t)} ${plural(t, 'inquiry', 'inquiries')} slipped ${WINDOW_WORD[win]} · ${formatCount(m.unansweredOverSla)} never answered.`;
}

// ── booked value, month by month ────────────────────────────────────────────────────────────────────────────────────

export type MonthValue = { key: string; label: string; php: number };

export function valueLine(months: readonly MonthValue[]): string {
  const total = months.reduce((s, m) => s + m.php, 0);
  let best: MonthValue | null = null;
  for (const m of months) if (m.php > 0 && (!best || m.php >= best.php)) best = m;
  return `${formatPhpRounded(total)} booked in the last 12 months${best ? ` · most in ${best.label} (${formatPhpRounded(best.php)})` : ''}.`;
}

// ── paid and still owed ─────────────────────────────────────────────────────────────────────────────────────────────

/** The Clients › Money picture's own totals (`moneyPicture`, lib/vendor-money.ts) — the one reader of this fact. */
export type OwedTotals = { receivedPhp: number; toComePhp: number; overdue: number; unresolved: number; bookings: number };

export const owedEmpty = (o: OwedTotals): boolean => o.receivedPhp === 0 && o.toComePhp === 0 && o.unresolved === 0;

export function owedLine(o: OwedTotals): string {
  const head = `${formatPhpRounded(o.receivedPhp)} received · ${formatPhpRounded(o.toComePhp)} still to come in, across ${formatCount(o.bookings)} ${plural(o.bookings, 'booking', 'bookings')}`;
  const tail = [o.overdue > 0 ? `${formatCount(o.overdue)} overdue` : null, o.unresolved > 0 ? `${formatCount(o.unresolved)} with no amount set` : null].filter(Boolean);
  return tail.length ? `${head} · ${tail.join(' · ')}.` : `${head}.`;
}

// ── how far ahead couples book ──────────────────────────────────────────────────────────────────────────────────────

export function leadLine(l: LeadTime): string {
  const med = Math.round(l.medianLeadDays ?? 0);
  return `Couples book you about ${formatCount(med)} ${plural(med, 'day', 'days')} before their event — the middle of ${formatCount(l.bookedWithDateCount)} dated ${plural(l.bookedWithDateCount, 'booking', 'bookings')}.`;
}

// ── what you celebrate ──────────────────────────────────────────────────────────────────────────────────────────────

export type KindCount = { key: string; label: string; count: number };
export type EventKinds = { kinds: KindCount[]; total: number; atLeast: boolean };

export function typesLine(t: EventKinds): string {
  const top = t.kinds[0];
  const n = `${formatCount(t.total)}${t.atLeast ? '+' : ''}`;
  return `${n} ${plural(t.total, 'event', 'events')} completed through Setnayan${top ? ` · most are ${top.label} (${formatCount(top.count)})` : ''}.`;
}

// ── reviews ─────────────────────────────────────────────────────────────────────────────────────────────────────────

export type MonthCountPoint = { key: string; label: string; count: number };

export function revMonthLine(months: readonly MonthCountPoint[]): string {
  const total = months.reduce((s, m) => s + m.count, 0);
  const now = months[months.length - 1];
  return `${formatCount(total)} ${plural(total, 'review', 'reviews')} in the last 12 months${now ? ` · ${formatCount(now.count)} this month` : ''}.`;
}

export const SUB_AXES = ['communication', 'quality', 'value', 'on_time'] as const;
export type SubAxis = (typeof SUB_AXES)[number];
export type SubStars = { n: number; avg: Record<SubAxis, number> };

/** The four part ratings' averages over every review (rows read in full; a refused page is the reader's `null`). */
export function subStars(rows: readonly Record<'rating_communication' | 'rating_quality' | 'rating_value' | 'rating_on_time', number | null>[]): SubStars {
  const sum: Record<SubAxis, number> = { communication: 0, quality: 0, value: 0, on_time: 0 };
  let n = 0;
  for (const r of rows) {
    const v = [r.rating_communication, r.rating_quality, r.rating_value, r.rating_on_time].map(Number);
    if (v.some((x) => !Number.isFinite(x) || x < 1)) continue;
    sum.communication += v[0]!;
    sum.quality += v[1]!;
    sum.value += v[2]!;
    sum.on_time += v[3]!;
    n += 1;
  }
  const avg = (k: SubAxis) => (n ? sum[k] / n : 0);
  return { n, avg: { communication: avg('communication'), quality: avg('quality'), value: avg('value'), on_time: avg('on_time') } };
}

export function subStarsLine(s: SubStars, label: (k: SubAxis) => string): string {
  const sorted = [...SUB_AXES].sort((a, b) => s.avg[b] - s.avg[a]);
  const hi = sorted[0]!;
  const lo = sorted[sorted.length - 1]!;
  if (s.avg[hi] === s.avg[lo]) return `Every part at ${s.avg[hi].toFixed(1)} across ${formatCount(s.n)} ${plural(s.n, 'review', 'reviews')}.`;
  return `Highest on ${label(hi)} (${s.avg[hi].toFixed(1)}), lowest on ${label(lo)} (${s.avg[lo].toFixed(1)}) · ${formatCount(s.n)} ${plural(s.n, 'review', 'reviews')}.`;
}

export type Replied = { replied: number; total: number };

export function repliedLine(r: Replied): string {
  return `You answered ${formatCount(r.replied)} of ${formatCount(r.total)} ${plural(r.total, 'review', 'reviews')}.`;
}

// ── the whole read, per window ──────────────────────────────────────────────────────────────────────────────────────

/** Every new graph's read for ONE window. Each `null` = that read was refused ("Couldn’t load"). */
export type StoreGraphs = {
  followers: WindowSeries | null;
  saved: WindowSeries | null;
  photos: (TopPhotos & { urls: Readonly<Record<string, string>> }) | null;
  whenask: InquiryHeatCell[] | null;
  missed: InquiryMissed | null;
  value: MonthValue[] | null;
  owed: OwedTotals | null;
  lead: LeadTime | null;
  types: EventKinds | null;
  revmonth: MonthCountPoint[] | null;
  substars: SubStars | null;
  replied: Replied | null;
};
