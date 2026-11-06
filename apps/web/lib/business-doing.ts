/**
 * lib/business-doing.ts — "How is my business doing", in words (simpler supplier dashboard step 6; owner-APPROVED
 * 2026-10-14 "insights → How is my business doing"; prototype SCREENS.insights).
 *
 * PURE. The figures are the SAME reads the shipped Insights page already makes — funnel totals (views · inquiries ·
 * booked), the attribution windows (booked ₱ and Setnayan vs outside), `vendor_activity_stats` (reviews) and the
 * public reply-time verdict (`replyTimeVerdict`, the function the marketplace badge calls). Only the words are new.
 * Held by `lib/business-doing.test.ts`.
 */
import { formatCount } from './format-number';
import { formatReplyMinutes, type ReplyTimeVerdict } from './vendor-reply-time';

/** The one sentence on top. A shop nobody has found yet is told what to do, not shown three zeros. */
export function businessSentence(t: { views: number; inquiries: number; booked: number }): { lead: string; rest: string } {
  if (!(t.views > 0)) {
    return { lead: 'Nobody has found you yet', rest: 'put up a service and share your QR' };
  }
  return {
    lead: `${formatCount(t.views)} ${t.views === 1 ? 'couple' : 'couples'} looked at you`,
    rest: `${formatCount(t.inquiries)} asked · ${formatCount(t.booked)} booked`,
  };
}

/**
 * The `vendor_activity_stats` row, WITH whether the read actually happened — the supplier's half of the house rule
 * `vendor-dashboard/reads-are-honest.test.ts` pins (and `MeasuredGuests` in `lib/guests.ts` on the couple's side).
 *
 * 🆕 A NEW SHOP HAS NO ROW. Measured 6 Nov: 1 of 4 shops had one, so SetnaProd's Analytics said "Couldn’t load" —
 * a brand-new shop told its data FAILED, because the page collapsed `{ data, error }` into `data` and a missing row
 * and a refused read both arrived as `null`. Three cases, kept apart:
 *   `measured: false`              → the read was REFUSED (an `error`, or a throw) — "Couldn’t load"
 *   `measured: true`, `row: null`  → NO ROW — a shop with no activity yet, its honest empty state
 *   `measured: true`, `row: {…}`   → as before
 * ⚠ `measured: false` means "we do not know", NOT "a new shop". A caller that treats it as empty has reintroduced
 * the defect in the other direction.
 */
export type MeasuredStatsRow<T> = { measured: true; row: T | null } | { measured: false; row: null };

/** The value of a stats read that did NOT happen (refused, or threw). */
export function unmeasuredStats<T>(): MeasuredStatsRow<T> {
  return { measured: false, row: null };
}

/**
 * How fast you reply — the verdict couples see, said to the supplier. Never a figure the badge would not print.
 * `null` = the stats read was REFUSED, so there is no verdict to say (never "No inquiry yet" to a shop we could not read).
 */
export function replyLine(v: ReplyTimeVerdict | null): { line: string; good: boolean } {
  if (!v) return { line: 'Couldn’t load', good: false };
  if (v.shown) return { line: `${v.label} · couples see this`, good: true };
  switch (v.reason) {
    case 'not_enough_replies':
      return { line: v.sample > 0 ? 'Not enough replies yet for couples to see a time' : 'No inquiry yet', good: false };
    case 'no_median':
      return { line: 'No inquiry yet', good: false };
    case 'too_slow':
      return { line: `About ${formatReplyMinutes(v.medianMinutes)} · under 4h and couples see it`, good: false };
    case 'away':
      return { line: 'Hidden while you have not signed in lately', good: false };
  }
}

/**
 * What couples say — the review average and count off `vendor_activity_stats`. REFUSED → "Couldn’t load"; NO ROW
 * (a new shop) → "No reviews yet"; a row → its figures.
 */
export function ratingLine(
  read: MeasuredStatsRow<{ review_avg_bayesian?: number | null; review_count?: number | null }>,
): string {
  if (!read.measured) return 'Couldn’t load';
  const stats = read.row;
  if (!stats) return 'No reviews yet';
  const count = Number(stats.review_count ?? 0);
  const avg = Number(stats.review_avg_bayesian);
  if (!(count > 0) || !Number.isFinite(avg)) return 'No reviews yet';
  return `${avg.toFixed(1)} ★ · ${formatCount(count)} ${count === 1 ? 'review' : 'reviews'}`;
}

/** Where bookings come from — Setnayan vs your own, off the attribution window. */
export function fromLine(a: { setnayan: { bookingCount: number }; offPlatform: { bookingCount: number } } | null): string {
  if (!a) return 'Couldn’t load';
  const s = a.setnayan.bookingCount;
  const o = a.offPlatform.bookingCount;
  if (s + o === 0) return 'No bookings in this window yet';
  return `Setnayan ${formatCount(s)} · your own ${formatCount(o)}`;
}

/** Bars as heights 0–100 of the busiest point; empty when nothing was booked (no flat row of zero bars). */
export function barHeights(points: readonly { bookings: number }[]): number[] {
  const max = Math.max(0, ...points.map((p) => (Number.isFinite(p.bookings) ? p.bookings : 0)));
  if (max <= 0) return [];
  return points.map((p) => Math.round(((Number.isFinite(p.bookings) ? p.bookings : 0) / max) * 100));
}
