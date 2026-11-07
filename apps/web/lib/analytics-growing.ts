/**
 * lib/analytics-growing.ts — Shop › Analytics, "a page you watch your business grow on" (owner-APPROVED 6 Nov 2026,
 * prototype `analytics-proto/index.html` · claude.ai/artifact/V1cMczWhoM3P3cxmTHU31Z).
 *
 * PURE. Every line here is WORDS over numbers the page already read with the shipped readers (funnel totals, the
 * booked series, the two new bucket readers in `lib/vendor-growth-series.ts`, the source slices, the reply verdict,
 * capacity, health, the benchmark, the price band). Nothing is computed that the page does not also draw.
 *
 * HONEST (the house rule `vendor-dashboard/reads-are-honest.test.ts`): a read that did not happen arrives as `null`
 * and is said "Couldn’t load" — never folded into a zero, an empty chart or "no inquiries yet".
 *
 * 🔒 lib/analytics-growing.test.ts — including the guard the owner asked for: a TIE NEVER CLAIMS THE BEST MONTH.
 */
import { formatCount } from './format-number';
import { formatPhpRounded } from './php';
import { FAST_REPLY_THRESHOLD_MIN, REPLY_TIME_MIN_SAMPLE, formatReplyMinutes, type ReplyTimeVerdict } from './vendor-reply-time';
import type { SourceSlice } from './vendor-funnel';

/** The one window (owner call in the prototype: "One window = Last 30 days · Last 12 months"). */
export type GrowthWindow = '30' | '12';
export const GROWTH_WINDOWS: readonly { key: GrowthWindow; label: string; hint?: string }[] = [
  { key: '30', label: 'Last 30 days', hint: 'Every number below follows this' },
  { key: '12', label: 'Last 12 months' },
];

/** Already-worded text with its bold runs — the sentence is drawn from these, never from HTML. */
export type Seg = { t: string; b?: boolean };

export const COULDNT_LOAD = 'Couldn’t load';

const plural = (n: number, one: string, many: string) => (n === 1 ? one : many);

/* ── THE SENTENCE (hero) ──────────────────────────────────────────────────────────────────────────────────── */

/**
 * The hero's sentence — composed ONLY from numbers the page already shows: the pinned figures, the change the pinned
 * row prints ("−16"), and the booked lane. "Best month" is claimed only when the LAST month's bookings beat every
 * earlier month in the series; a TIE says "matching your best month so far"; otherwise nothing. 30 days never claims
 * "best" — it says more/fewer than the 30 days before.
 */
export function growthSentence(input: {
  figures: { views: number; inquiries: number; booked: number } | null;
  /** views now − views in the 30 days before; null = not read, or the 12-month window (no 24-month read exists). */
  viewsChange: number | null;
  unit: 'day' | 'month';
  /** The booked lane, oldest first (the momentum `ChartPoint` series). null = not read. */
  booked: readonly number[] | null;
}): Seg[] {
  const f = input.figures;
  if (!f) return [{ t: 'Couldn’t load your numbers just now.' }];
  const out: Seg[] = [{ t: formatCount(f.views), b: true }, { t: ' couples opened your page' }];
  if (input.unit === 'month') out.push({ t: ' over 12 months' });
  else if (input.viewsChange !== null && input.viewsChange !== 0) {
    out.push({ t: ' · ' }, { t: formatCount(Math.abs(input.viewsChange)), b: true }, { t: ` ${input.viewsChange < 0 ? 'fewer' : 'more'} than the 30 days before` });
  }
  if (f.inquiries > 0) out.push({ t: ' · ' }, { t: formatCount(f.inquiries), b: true }, { t: ' asked' });
  else out.push({ t: ' · no inquiries yet' });
  if (f.booked > 0) {
    out.push({ t: ' · ' }, { t: formatCount(f.booked), b: true }, { t: ' booked' });
    const best = bestMonthClaim(input.unit, input.booked);
    if (best) out.push({ t: ' — ' }, { t: formatCount(best.last), b: true }, { t: best.tie ? ' this month, matching your best month so far' : ' this month, your best month so far' });
  }
  out.push({ t: '.' });
  return out;
}

/**
 * Whether the booked lane earns a "best month" line. Only on months; only when the last bucket has a booking; `tie`
 * when it EQUALS the best earlier month (then the words say "matching", never "your best").
 */
export function bestMonthClaim(unit: 'day' | 'month', booked: readonly number[] | null): { last: number; tie: boolean } | null {
  if (unit !== 'month' || !booked || booked.length < 2) return null;
  const last = booked[booked.length - 1] ?? 0;
  if (!(last > 0)) return null;
  const prevMax = Math.max(...booked.slice(0, -1));
  if (last > prevMax) return { last, tie: false };
  if (last === prevMax) return { last, tie: true };
  return null;
}

/** The plain text of a sentence (aria-label, tests). */
export const segText = (s: readonly Seg[]): string => s.map((x) => x.t).join('');

/* ── SECTION LINES (the one quiet line under each section title) ──────────────────────────────────────────── */

/** How each source is said in a sentence: [first word, in a short list, alone after "then"]. */
const SOURCE_WORDS: Record<string, { lead: string; short: string; long: string; almostAll: string }> = {
  profile_direct: { lead: 'Direct', short: 'direct', long: 'direct', almostAll: 'Almost all came straight to your profile link' },
  host_marketplace_search: { lead: 'Search', short: 'search', long: 'search', almostAll: 'Almost all came from search' },
  explore_card: { lead: 'The Explore card', short: 'Explore', long: 'the Explore card', almostAll: 'Almost all came from the Explore card' },
  host_manual: { lead: 'Couples adding you', short: 'couples adding you', long: 'couples adding you', almostAll: 'Almost all came from couples adding you' },
};
function wordsFor(s: SourceSlice) {
  const w = SOURCE_WORDS[s.key];
  if (w) return w;
  const l = s.label.toLowerCase();
  return { lead: s.label, short: l, long: l, almostAll: `Almost all came from ${l}` };
}

/** "Almost all" = one source holds this share or more of the window's views. */
export const ALMOST_ALL_SHARE = 0.9;

/**
 * §1 "Are couples finding me?" — the order couples found the page in. Only sources that cleared the min-N floor are
 * named (a hidden source is never spoken). `views` is the window's total.
 */
export function findingLine(slices: readonly SourceSlice[] | null, views: number | null): string {
  if (slices === null || views === null) return COULDNT_LOAD;
  if (!(views > 0)) return 'No profile views in this window yet';
  const shown = slices.filter((s) => s.shown).sort((a, b) => b.count - a.count);
  const top = shown[0];
  if (!top) return 'Each source is under 5 so far — hidden to keep the read reliable';
  if (top.count / views >= ALMOST_ALL_SHARE) return wordsFor(top).almostAll;
  const rest = shown.slice(1).map(wordsFor);
  const first = `${wordsFor(top).lead} first`;
  if (rest.length === 0) return first;
  if (rest.length === 1) return `${first}, then ${rest[0]!.long}`;
  if (rest.length === 2) return `${first}, then ${rest[0]!.long}, then ${rest[1]!.long}`;
  const head = rest.slice(0, -1).map((w) => w.short).join(', ');
  return `${first}, then ${head}, and ${rest[rest.length - 1]!.long}`;
}

/** §2 "Are they asking, and do I answer?" — the window's inquiries and what couples see about the replies. */
export function askingLine(verdict: ReplyTimeVerdict | null, inquiries: number | null): string {
  if (verdict === null || inquiries === null) return COULDNT_LOAD;
  if (verdict.shown) return `You reply in about ${formatReplyMinutes(verdict.medianMinutes)} · couples see it`;
  const lead = inquiries > 0 ? `${formatCount(inquiries)} asked` : 'No inquiries yet';
  switch (verdict.reason) {
    case 'not_enough_replies':
    case 'no_median':
      return `${lead} · couples see nothing yet about your replies`;
    case 'too_slow':
      return `${lead} · about ${formatReplyMinutes(verdict.medianMinutes)} · under ${formatReplyMinutes(FAST_REPLY_THRESHOLD_MIN)} and couples see it`;
    case 'away':
      return `${lead} · hidden while you have not signed in lately`;
  }
}

/** §3 "Am I booking?" — money first when it is confirmed, then how many Setnayan brought. */
export function bookingLine(
  booked: number | null,
  attribution: { revenuePhp: number; setnayanBookings: number } | null,
): string {
  if (booked === null || attribution === null) return COULDNT_LOAD;
  if (!(booked > 0)) return 'Nothing booked in these days yet';
  const from = `${formatCount(attribution.setnayanBookings)} from Setnayan`;
  if (attribution.revenuePhp > 0) return `${formatPhpRounded(attribution.revenuePhp)} booked · ${from}`;
  return `${formatCount(booked)} booked · ${from}`;
}

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

/**
 * §5 "Reputation & badges" — the rating line (`ratingLine`, the same words as everywhere) and the badges the shop
 * wears. "SETNAYAN Verified" when it is the only badge word beside "No reviews yet"; "Verified" in a longer line.
 */
export function repLine(rating: string, badges: { verified: boolean; milestone: string | null } | null): string {
  const parts = [rating];
  if (badges) {
    const rated = rating !== 'No reviews yet' && rating !== COULDNT_LOAD;
    if (badges.verified) parts.push(rated || badges.milestone ? 'Verified' : 'SETNAYAN Verified');
    if (badges.milestone) parts.push(badges.milestone);
  }
  return parts.join(' · ');
}

const TIER_PHRASE = { top: 'in the top quarter', above_median: 'above the middle', below_median: 'below the middle', bottom: 'in the bottom quarter' } as const;
const TIER_RANK = { top: 0, above_median: 1, below_median: 2, bottom: 3 } as const;
const METRIC_PHRASE: Record<string, string> = { reply_rate: 'response rate', reply_mins: 'reply time', conversion: 'inquiry → booking' };

/** §6 "How I compare" — the health score and band, then the shop's best-placed benchmark metric. */
export function compareLine(
  health: { composite: number | null; bandLabel: string; unread: boolean } | null,
  bench: { key: string; tier: keyof typeof TIER_PHRASE | null }[] | 'unreadable' | null,
): string {
  if (health === null || health.unread) return COULDNT_LOAD;
  const parts: string[] = [];
  if (health.composite !== null) {
    const band = health.bandLabel.charAt(0) + health.bandLabel.slice(1).toLowerCase();
    parts.push(`Health ${formatCount(health.composite)}`, band);
  }
  if (Array.isArray(bench)) {
    const best = bench.filter((m) => m.tier !== null).sort((a, b) => TIER_RANK[a.tier!] - TIER_RANK[b.tier!])[0];
    if (best) parts.push(`${METRIC_PHRASE[best.key] ?? best.key} ${TIER_PHRASE[best.tier!]}`);
  }
  return parts.length ? parts.join(' · ') : 'Not enough shops like yours yet';
}

/* ── REPLY (§2 details + the gauge) ───────────────────────────────────────────────────────────────────────── */

/** The row under "What couples see about your replies": the claim's line and its chip. */
export function replyRow(v: ReplyTimeVerdict | null): { line: string; chip: { tone: 'ok' | 'quiet' | 'no'; word: string } } {
  if (!v) return { line: 'Refresh to try again.', chip: { tone: 'no', word: COULDNT_LOAD } };
  if (v.shown) return { line: `From your ${formatCount(v.sample)} answered ${plural(v.sample, 'conversation', 'conversations')}`, chip: { tone: 'ok', word: 'Shown' } };
  switch (v.reason) {
    case 'not_enough_replies':
    case 'no_median':
      return { line: `Answered conversations · ${REPLY_TIME_MIN_SAMPLE} make a habit`, chip: { tone: 'quiet', word: 'Not shown yet' } };
    case 'too_slow':
      return { line: `About ${formatReplyMinutes(v.medianMinutes)} · under ${formatReplyMinutes(FAST_REPLY_THRESHOLD_MIN)} and couples see it`, chip: { tone: 'quiet', word: 'Hidden' } };
    case 'away':
      return { line: 'Hidden while you have not signed in lately', chip: { tone: 'quiet', word: 'Hidden' } };
  }
}

/** The gauge's needle (minutes) and the habit dots (answered conversations, 0..3). null minutes = the empty gauge. */
export function replyGauge(v: ReplyTimeVerdict | null): { minutes: number | null; answered: number; shown: boolean } {
  if (!v) return { minutes: null, answered: 0, shown: false };
  if (v.shown) return { minutes: v.medianMinutes, answered: Math.min(v.sample, REPLY_TIME_MIN_SAMPLE), shown: true };
  if (v.reason === 'too_slow') return { minutes: v.medianMinutes, answered: REPLY_TIME_MIN_SAMPLE, shown: false };
  if (v.reason === 'not_enough_replies') return { minutes: null, answered: Math.min(v.sample, REPLY_TIME_MIN_SAMPLE), shown: false };
  return { minutes: null, answered: 0, shown: false };
}

/** The gauge's scale: 0 → twice the four-hour line, so the line sits at the top of the arc. */
export const GAUGE_MAX_MIN = FAST_REPLY_THRESHOLD_MIN * 2;

/* ── TIME BUCKETS (the lanes) ─────────────────────────────────────────────────────────────────────────────── */

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
