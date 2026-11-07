/**
 * 📈 THE ANALYTICS SHEET'S LINE — "By month · By quarter · By year": this period as a line, the last one as a dashed
 * ghost, and "+N% vs last …" (owner v96 "Graph popup"; THE ONE BUILD A3 W9, lane C4).
 *
 * PURE. Instants in, two cumulative lines out — this period so far, and the SAME SPAN of the period before (so the
 * 9th of this month is compared with the 9th of last month, never with a whole month). Manila calendar, like every
 * series the shop reads (`lib/analytics-growing.ts` buckets).
 *
 * 🔑 Three cards have a line, each from rows the app already holds (no migration):
 *   ahead  — booked days      (`vendor_schedule_pool_bookings.booked_date`, live rows — `vendor_upcoming_load`'s own)
 *   deals  — quotes accepted  (`vendor_proposals.resolved_at` where status = 'accepted' — `vendor_quote_stats`' own)
 *   worth  — bookings from Setnayan (`booking_fee_ledger.created_at` where attribution = 'sourced')
 * Price and Compare are SNAPSHOTS — no history is stored — so their sheets draw no line, never an invented one.
 *
 * HONEST: a refused read arrives as `null` and the sheet says "Couldn’t load", never a flat zero line. A change
 * against an empty last period is "new", never "+∞%" or "+100%".
 * 🔒 lib/shop-analytics-series.test.ts
 */
import { manilaDay } from './analytics-growing';

export type AnalyticsPeriod = 'month' | 'quarter' | 'year';
export const ANALYTICS_PERIODS: readonly { key: AnalyticsPeriod; label: string; word: string }[] = [
  { key: 'month', label: 'By month', word: 'month' },
  { key: 'quarter', label: 'By quarter', word: 'quarter' },
  { key: 'year', label: 'By year', word: 'year' },
];

/** The cards whose sheet draws a line. */
export type SeriesCard = 'ahead' | 'deals' | 'worth';
export const SERIES_CARDS: readonly SeriesCard[] = ['ahead', 'deals', 'worth'];
export const SERIES_LABEL: Readonly<Record<SeriesCard, string>> = {
  ahead: 'Booked days',
  deals: 'Quotes accepted',
  worth: 'Bookings from Setnayan',
};

export type PeriodLine = {
  /** Cumulative count at each point of THIS period, up to today. */
  now: number[];
  /** Cumulative count at each point of the period before, the whole of it. */
  ghost: number[];
  /** The x-axis: first · middle · last point names. */
  axis: [string, string, string];
  total: number;
  /** The period before, up to the same point. */
  prevSameSpan: number;
  /** "+31%" · "−8%" · "new" (nothing last time) · "same" · null (nothing either time). */
  change: string | null;
  /** "last month" · "last quarter" · "last year". */
  vs: string;
};

const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'] as const;

type Ymd = { y: number; m: number; d: number };
const ymd = (iso: string): Ymd => ({ y: Number(iso.slice(0, 4)), m: Number(iso.slice(5, 7)) - 1, d: Number(iso.slice(8, 10)) });
const daysIn = (y: number, m: number) => new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
const dayIndex = (y: number, m: number, d: number) => Math.round(Date.UTC(y, m, d) / 86400000);

/** A period's span in day indexes [start, end] (inclusive) and its unit. */
function span(period: AnalyticsPeriod, t: Ymd, back: number): { start: number; end: number; y: number; m: number } {
  if (period === 'month') {
    let m = t.m - back;
    let y = t.y;
    while (m < 0) {
      m += 12;
      y -= 1;
    }
    return { start: dayIndex(y, m, 1), end: dayIndex(y, m, daysIn(y, m)), y, m };
  }
  if (period === 'quarter') {
    let q = Math.floor(t.m / 3) - back;
    let y = t.y;
    while (q < 0) {
      q += 4;
      y -= 1;
    }
    const m = q * 3;
    return { start: dayIndex(y, m, 1), end: dayIndex(y, m + 2, daysIn(y, m + 2)), y, m };
  }
  const y = t.y - back;
  return { start: dayIndex(y, 0, 1), end: dayIndex(y, 11, 31), y, m: 0 };
}

/** The point an instant falls on within a period: a day (month, quarter) or a month (year). */
function pointsOf(period: AnalyticsPeriod, s: { start: number; end: number; y: number }): number {
  return period === 'year' ? 12 : s.end - s.start + 1;
}
function pointOf(period: AnalyticsPeriod, s: { start: number; y: number }, at: Ymd): number {
  return period === 'year' ? at.m : dayIndex(at.y, at.m, at.d) - s.start;
}

function axisOf(period: AnalyticsPeriod, s: { start: number; end: number; y: number; m: number }): [string, string, string] {
  if (period === 'year') return ['Jan', 'Jun', 'Dec'];
  if (period === 'month') {
    const n = s.end - s.start + 1;
    return ['Day 1', `Day ${Math.ceil(n / 2)}`, `Day ${n}`];
  }
  return [MON[s.m]!, MON[s.m + 1]!, MON[s.m + 2]!];
}

function cumulative(counts: number[]): number[] {
  let run = 0;
  return counts.map((c) => (run += c));
}

/** "+31%" · "−8%" · "new" · "same" · null. */
export function changeWord(now: number, before: number): string | null {
  if (now === 0 && before === 0) return null;
  if (before === 0) return 'new';
  const pct = Math.round(((now - before) / before) * 100);
  if (pct === 0) return 'same';
  return pct > 0 ? `+${pct}%` : `−${Math.abs(pct)}%`;
}

/** This period so far vs the period before (its whole line, and its total up to the same point). Pure. */
export function periodLine(instants: readonly string[] | null, period: AnalyticsPeriod, nowMs: number): PeriodLine | null {
  if (instants === null) return null;
  const today = ymd(manilaDay(nowMs));
  const cur = span(period, today, 0);
  const prev = span(period, today, 1);
  const nCur = pointsOf(period, cur);
  const nPrev = pointsOf(period, prev);
  const curCounts = new Array<number>(nCur).fill(0);
  const prevCounts = new Array<number>(nPrev).fill(0);
  const todayPoint = pointOf(period, cur, today);
  for (const iso of instants) {
    const ms = Date.parse(iso.length === 10 ? `${iso}T00:00:00+08:00` : iso);
    if (!Number.isFinite(ms)) continue;
    const at = ymd(manilaDay(ms));
    const di = dayIndex(at.y, at.m, at.d);
    if (di >= cur.start && di <= cur.end) {
      const p = pointOf(period, cur, at);
      if (p <= todayPoint) curCounts[p]! += 1;
    } else if (di >= prev.start && di <= prev.end) {
      prevCounts[pointOf(period, prev, at)]! += 1;
    }
  }
  const now = cumulative(curCounts).slice(0, todayPoint + 1);
  const ghost = cumulative(prevCounts);
  const total = now[now.length - 1] ?? 0;
  const prevSameSpan = ghost[Math.min(todayPoint, ghost.length - 1)] ?? 0;
  const word = ANALYTICS_PERIODS.find((p) => p.key === period)!.word;
  return { now, ghost, axis: axisOf(period, cur), total, prevSameSpan, change: changeWord(total, prevSameSpan), vs: `last ${word}` };
}

/** The first instant a sheet needs: the start of LAST year (covers every period's "before"), Manila. */
export function seriesSinceIso(nowMs: number): string {
  const y = Number(manilaDay(nowMs).slice(0, 4)) - 1;
  return new Date(Date.parse(`${y}-01-01T00:00:00+08:00`)).toISOString();
}
