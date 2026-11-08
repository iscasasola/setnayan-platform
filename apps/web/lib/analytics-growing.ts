/**
 * lib/analytics-growing.ts — the time buckets and the 13-week strip behind Shop › Analytics (THE ONE BUILD, lane C4).
 *
 * 🌾 HARVESTED FROM #7338 ("Analytics, growing", owner-approved 6 Nov 2026), per the ONE BUILD's A3 §8 keep list:
 * ONLY the bucket helpers (`manilaDay`, `dayBuckets`, `monthBuckets`, `bucketInstants`), the 13-week strip
 * (`STRIP_DAYS`, `stripMarks`, `stripMonths`), the price rail's marker (`railMarker`, `ordinal`) and the "What's ahead"
 * line (`aheadLine`). #7338's hero sentence, lanes and "Do next" are NOT carried — the ruled carousel is built from the
 * five shipped cards, which #7338 deleted.
 *
 * PURE. HONEST (`vendor-dashboard/reads-are-honest.test.ts`): a read that did not happen arrives as `null` and is said
 * "Couldn’t load" — never folded into a zero, an empty chart or "no inquiries yet".
 * 🔒 lib/analytics-growing.test.ts
 */
import { formatCount } from './format-number';

export const COULDNT_LOAD = 'Couldn’t load';

const plural = (n: number, one: string, many: string) => (n === 1 ? one : many);

/** §4 "What’s ahead" — booked days ahead and the couples waiting on dates you are not free. */
export function aheadLine(c: { bookedDays: number; waitingCouples: number; waitingDates: number } | null): string {
  if (c === null) return COULDNT_LOAD;
  const a = c.bookedDays > 0 ? `${formatCount(c.bookedDays)} ${plural(c.bookedDays, 'day', 'days')} booked ahead` : 'Nothing booked ahead';
  const b =
    c.waitingCouples > 0
      ? `${formatCount(c.waitingCouples)} ${plural(c.waitingCouples, 'couple', 'couples')} waiting on ${formatCount(c.waitingDates)} ${plural(c.waitingDates, 'date', 'dates')}`
      : 'no couples waiting';
  return `${a} · ${b}`;
}

/* ── TIME BUCKETS ─────────────────────────────────────────────────────────────────────────────────────────── */

/** Manila is UTC+8 all year (no daylight saving) — the booked series' own `AT TIME ZONE 'Asia/Manila'` buckets. */
const MANILA_MS = 8 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'] as const;


/** One bucket — the momentum `ChartPoint` key/label, with the count of whatever the series counts. */
export type BucketPoint = { key: string; label: string; count: number };

/** The Manila calendar date (YYYY-MM-DD) of an instant. */
export function manilaDay(ms: number): string {
  return new Date(ms + MANILA_MS).toISOString().slice(0, 10);
}

/** The `n` trailing Manila days ending today, oldest first — keys `YYYY-MM-DD`, labels "6 Nov" (the daily series'). */
export function dayBuckets(nowMs: number, n: number): BucketPoint[] {
  const out: BucketPoint[] = [];
  for (let i = n - 1; i >= 0; i--) {
    const key = manilaDay(nowMs - i * DAY_MS);
    const [, m, d] = key.split('-');
    out.push({ key, label: `${Number(d)} ${MON[Number(m) - 1]}`, count: 0 });
  }
  return out;
}

/** The `n` trailing Manila months ending this month, oldest first — keys `YYYY-MM-01`, labels "Nov". */
export function monthBuckets(nowMs: number, n: number): BucketPoint[] {
  const today = manilaDay(nowMs);
  let y = Number(today.slice(0, 4));
  let m = Number(today.slice(5, 7)) - 1;
  const out: BucketPoint[] = [];
  for (let i = 0; i < n; i++) {
    out.unshift({ key: `${y}-${String(m + 1).padStart(2, '0')}-01`, label: MON[m]!, count: 0 });
    m -= 1;
    if (m < 0) {
      m = 11;
      y -= 1;
    }
  }
  return out;
}

/** Count instants into the buckets (an instant outside them is dropped, never folded into an edge bucket). */
export function bucketInstants(instants: readonly string[], buckets: BucketPoint[], unit: 'day' | 'month'): BucketPoint[] {
  const at = new Map(buckets.map((b, i) => [b.key, i]));
  const out = buckets.map((b) => ({ ...b, count: 0 }));
  for (const iso of instants) {
    const ms = Date.parse(iso);
    if (!Number.isFinite(ms)) continue;
    const day = manilaDay(ms);
    const key = unit === 'day' ? day : `${day.slice(0, 7)}-01`;
    const i = at.get(key);
    if (i !== undefined) out[i]!.count += 1;
  }
  return out;
}

/* ── THE 13-WEEK STRIP (§4) ───────────────────────────────────────────────────────────────────────────────── */

export const STRIP_DAYS = 91;

/** Day offsets from today (0 = today) for the strip: booked (with how many bookings) and waiting dates. */
export function stripMarks(
  todayIso: string,
  booked: readonly { date: string; bookings: number }[],
  waiting: readonly { date: string }[],
): { booked: { at: number; many: boolean }[]; waiting: number[] } {
  const t0 = Date.parse(`${todayIso}T00:00:00Z`);
  const at = (iso: string) => Math.round((Date.parse(`${iso}T00:00:00Z`) - t0) / DAY_MS);
  const inStrip = (i: number) => Number.isFinite(i) && i >= 0 && i < STRIP_DAYS;
  return {
    booked: booked.map((b) => ({ at: at(b.date), many: b.bookings > 1 })).filter((b) => inStrip(b.at)),
    waiting: waiting.map((w) => at(w.date)).filter(inStrip),
  };
}

/** The month word above each of the 13 week columns — only where a new month starts. */
export function stripMonths(todayIso: string): string[] {
  const t0 = Date.parse(`${todayIso}T00:00:00Z`);
  const out: string[] = [];
  let last = -1;
  for (let c = 0; c < 13; c++) {
    const m = new Date(t0 + c * 7 * DAY_MS).getUTCMonth();
    out.push(m !== last ? MON[m]! : '');
    last = m;
  }
  return out;
}

/* ── PRICE (§6) ───────────────────────────────────────────────────────────────────────────────────────────── */

export function ordinal(n: number): string {
  const v = Math.round(n);
  const s = ['th', 'st', 'nd', 'rd'] as const;
  const mod = v % 100;
  return `${v}${s[(mod - 20) % 10] ?? s[mod] ?? s[0]}`;
}

/** Where the marker sits on the low → high rail, 0–100 (the shipped `BandRail` rule). */
export function railMarker(own: number | null, band: { lowPhp: number; highPhp: number }, percentile: number | null): number | null {
  if (own === null) return null;
  if (percentile !== null) return Math.max(0, Math.min(100, percentile));
  return own <= band.lowPhp ? 0 : own >= band.highPhp ? 100 : 50;
}
