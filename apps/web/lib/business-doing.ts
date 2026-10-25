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

/** How fast you reply — the verdict couples see, said to the supplier. Never a figure the badge would not print. */
export function replyLine(v: ReplyTimeVerdict): { line: string; good: boolean } {
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

/** What couples say — the review average and count off `vendor_activity_stats`; null = the read failed. */
export function ratingLine(stats: { review_avg_bayesian?: number | null; review_count?: number | null } | null): string {
  if (!stats) return 'Couldn’t load';
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
