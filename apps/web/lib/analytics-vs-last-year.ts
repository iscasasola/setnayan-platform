/**
 * lib/analytics-vs-last-year.ts — Shop › Analytics, "vs last year" and "Three years" (owner 21 Nov 2026, *"Yes, add
 * it"*; DECISION_LOG "ANALYTICS "VS LAST YEAR" — YES" · "ANALYTICS CARDS, ONE SHAPE — LOOK APPROVED"; drawing
 * `prototypes/analytics_one_shape_2026-11-21/`).
 *
 * PURE. The rules, the windows and the bucketing — the reads live in `lib/vendor-growth-series.ts`.
 *
 *   · Only the three count cards compare: Opened · Asked · Booked.
 *   · 30 days compares with the same 30 days 52 weeks back (364 days), so Saturdays line up with Saturdays.
 *     12 months compares with the same window one calendar year back; its dashed line is the same months, the
 *     current month cut to the same day.
 *   · Under 10 in either period → both counts in words, no percent and no dashed line (a percent on tiny numbers
 *     misleads). A shop under a year old → nothing at all.
 *   · Tap a count card → "Three years": one line per year, December to November, and the three yearly totals —
 *     each year counted to today's month and day, so a part year is never set against a whole one.
 *
 * HONEST: a last year we could not read is said "Couldn’t load", never drawn as a flat line or a 100% rise.
 * 🔒 lib/analytics-vs-last-year.test.ts
 */
import { bucketInstants, dayBuckets, manilaDay, monthBuckets, type BucketPoint, type GrowthWindow } from './analytics-growing';

/** Below this in EITHER period, no percent and no dashed line — both counts in words instead. */
export const COMPARE_FLOOR = 10;
/** 30 days looks back 52 weeks, so a weekday sits over the same weekday. */
export const WEEKS_52_MS = 364 * 24 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;
const MANILA_MS = 8 * 60 * 60 * 1000;

export type CountKind = 'opened' | 'asked' | 'booked';

/** The same instant one calendar year earlier (29 Feb → 1 Mar). */
export function yearEarlier(ms: number): number {
  const d = new Date(ms);
  d.setUTCFullYear(d.getUTCFullYear() - 1);
  return d.getTime();
}

/** The card's own window, `[from, to)` in ms — the same spans the pinned counts read (`isoDaysAgo(30)` · `(365)`). */
export function windowSpan(win: GrowthWindow, nowMs: number): { from: number; to: number } {
  return { from: nowMs - (win === '30' ? 30 : 365) * DAY_MS, to: nowMs };
}

/** The same window last year: 30 days → 52 weeks back; 12 months → one calendar year back. */
export function lastYearSpan(win: GrowthWindow, nowMs: number): { from: number; to: number } {
  const now = windowSpan(win, nowMs);
  if (win === '30') return { from: now.from - WEEKS_52_MS, to: now.to - WEEKS_52_MS };
  return { from: yearEarlier(now.from), to: yearEarlier(now.to) };
}

/** A shop is a year old once a whole year has passed since it opened. Unknown → not old enough (nothing drawn). */
export function shopIsAYearOld(createdAtIso: string | null | undefined, nowMs: number): boolean {
  const at = createdAtIso ? Date.parse(createdAtIso) : Number.NaN;
  return Number.isFinite(at) && at <= yearEarlier(nowMs);
}

/* ── THE COMPARISON ──────────────────────────────────────────────────────────────────────────────────────── */

export type VsLastYear =
  /** A shop under a year old, or a card whose own number did not load — nothing drawn. */
  | { show: 'none' }
  /** Last year's read was refused — "Couldn’t load", never a flat line. */
  | { show: 'unread' }
  /** Under 10 in either period — both counts in words; no percent, no line. */
  | { show: 'small'; now: number; then: number }
  | { show: 'pct'; now: number; then: number; pct: number; dir: 'up' | 'down' | 'flat' };

export function vsLastYear(now: number | null, then: number | null, yearOld: boolean): VsLastYear {
  if (!yearOld || now === null) return { show: 'none' };
  if (then === null) return { show: 'unread' };
  if (now < COMPARE_FLOOR || then < COMPARE_FLOOR) return { show: 'small', now, then };
  const pct = Math.round(((now - then) / then) * 100);
  return { show: 'pct', now, then, pct: Math.abs(pct), dir: pct > 0 ? 'up' : pct < 0 ? 'down' : 'flat' };
}

/** The key over the picture: "+23%" · "−12%" · "0%" (then "vs last year" and the dashed swatch). */
export function pctWord(c: Extract<VsLastYear, { show: 'pct' }>): string {
  return c.dir === 'up' ? `+${c.pct}%` : c.dir === 'down' ? `−${c.pct}%` : '0%';
}

/** What the line under the picture adds after its own sentence. '' when nothing compares. */
export function vsLastYearWords(c: VsLastYear, win: GrowthWindow): string {
  if (c.show === 'pct') {
    if (c.dir === 'flat') return 'the same as last year';
    return `${c.pct}% ${c.dir === 'up' ? 'more' : 'fewer'} than last year`;
  }
  if (c.show === 'small') return `${win === '30' ? 'Same days' : 'Same months'} last year: ${c.then.toLocaleString('en-PH')}.`;
  if (c.show === 'unread') return 'Last year couldn’t load.';
  return '';
}

/** Draw the dashed "same days last year" line? Only when a percent is shown. */
export function drawsLastYearLine(c: VsLastYear): boolean {
  return c.show === 'pct';
}

/* ── THE BUCKETS ─────────────────────────────────────────────────────────────────────────────────────────── */

/** One read row: its instant, and who (a view's `viewer_hash`; null for every other kind). */
export type InstantRow = { at: string; who: string | null };

/** One year of "Three years": its label ("2026"), its 12 months December → November (null = not yet), its total. */
export type YearLine = { label: string; months: (number | null)[]; total: number; /** The season the shop opened in. */ first?: boolean };

export type CompareSeries = {
  /** This window's buckets — the lanes the cards draw. */
  day: BucketPoint[];
  month: BucketPoint[];
  /** The same buckets last year (the dashed line), and last year's count over each card's window. */
  lastYear: { day: BucketPoint[]; month: BucketPoint[]; total: Record<GrowthWindow, number> };
  /** Oldest first. */
  years: YearLine[];
};

/** Manila midnight of a calendar date, as ms. */
const manilaMidnight = (y: number, m0: number, d: number) => Date.UTC(y, m0, d) - MANILA_MS;

/** The season (December → November) today sits in: Dec 2025 – Nov 2026 is "2026". */
function seasonOf(nowMs: number): number {
  const today = manilaDay(nowMs);
  const y = Number(today.slice(0, 4));
  return Number(today.slice(5, 7)) === 12 ? y + 1 : y;
}

/** The three seasons' spans, oldest first: from 1 December, to today's month and day (inclusive) in that season. */
export function yearSpans(nowMs: number): { label: string; from: number; to: number }[] {
  const season = seasonOf(nowMs);
  const today = manilaDay(nowMs);
  const m0 = Number(today.slice(5, 7)) - 1;
  const d = Number(today.slice(8, 10));
  return [season - 2, season - 1, season].map((s) => {
    const y = m0 === 11 ? s - 1 : s;
    return { label: String(s), from: manilaMidnight(s - 1, 11, 1), to: manilaMidnight(y, m0, d) + DAY_MS };
  });
}

/** How far back the one read reaches: the oldest season's 1 December, or two years and a margin, whichever is older. */
export function compareStartMs(nowMs: number): number {
  return Math.min(yearSpans(nowMs)[0]!.from, yearEarlier(yearEarlier(nowMs)) - 2 * DAY_MS);
}

/** How a window's rows become its total: rows, or (for opens) couples — the reader hands in `countDistinctViewers`. */
export type CountRows = (rows: readonly InstantRow[]) => number;
const countAll: CountRows = (rows) => rows.length;

function countIn(rows: readonly InstantRow[], from: number, to: number, count: CountRows): number {
  return count(
    rows.filter((r) => {
      const ms = Date.parse(r.at);
      return ms >= from && ms < to;
    }),
  );
}

/**
 * Every series a count card draws, from ONE set of rows. For profile opens the reader passes the card's own count
 * (`countDistinctViewers`: couples, never rows) so a total means what the card's number means; a lane stays opens per
 * bucket, as the solid line draws them. Kept free of server modules so the client tree can import the rules above.
 */
export function buildCompareSeries(rows: readonly InstantRow[], nowMs: number, count: CountRows = countAll): CompareSeries {
  const at = rows.map((r) => r.at);
  const ly30 = lastYearSpan('30', nowMs);
  const ly12 = lastYearSpan('12', nowMs);
  const before = (to: number) => at.filter((iso) => Date.parse(iso) < to);
  const lyMonthTo = yearEarlier(nowMs);
  const cur = manilaDay(nowMs).slice(0, 7);
  const years = yearSpans(nowMs).map((y) => {
    // 12 buckets, December → November of this season (the 12 months that end in its November).
    const buckets = monthBuckets(manilaMidnight(Number(y.label), 10, 15), 12);
    // This season has no point after the current month.
    const months = bucketInstants(at, buckets, 'month').map((b) => (b.key.slice(0, 7) > cur ? null : b.count));
    return { label: y.label, months, total: countIn(rows, y.from, y.to, count) };
  });
  return {
    day: bucketInstants(at, dayBuckets(nowMs, 30), 'day'),
    month: bucketInstants(at, monthBuckets(nowMs, 12), 'month'),
    lastYear: {
      day: bucketInstants(at, dayBuckets(nowMs - WEEKS_52_MS, 30), 'day'),
      month: bucketInstants(before(lyMonthTo), monthBuckets(lyMonthTo, 12), 'month'),
      total: { '30': countIn(rows, ly30.from, ly30.to, count), '12': countIn(rows, ly12.from, ly12.to, count) },
    },
    years,
  };
}

/** The seasons a shop has lived in (its first counted from the season it opened in). Fewer than two → none. */
export function yearsToShow(years: readonly YearLine[], createdAtIso: string | null | undefined, nowMs: number): YearLine[] {
  const at = createdAtIso ? Date.parse(createdAtIso) : Number.NaN;
  if (!Number.isFinite(at)) return [];
  const spans = yearSpans(nowMs);
  const kept = years.flatMap((y, i) => (spans[i] && spans[i]!.to > at ? [{ ...y, first: at >= spans[i]!.from }] : []));
  return kept.length >= 2 ? kept : [];
}
