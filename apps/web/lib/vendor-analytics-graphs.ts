import { formatCount } from '@/lib/format-number';
/**
 * lib/vendor-analytics-graphs.ts — THE FIVE NEW ANALYTICS GRAPHS, worded once (Build 6 Lane I, owner 10 Nov: *"what
 * other graphs do we add? No dupes. we want graphs that will help them. tapping shows a recommendation from us on what
 * they need to do."* → *"All five"*; prototype `build6_makers_analytics_2026-11-10`, approved 10 Nov).
 *
 * Pure — the rows come from `vendor-analytics-graphs.server.ts`; this file only buckets and words them, so every rule is
 * unit-tested without a database. EVERY GRAPH NAMES ITS DATA (the `SOURCE` lines are drawn on each tile):
 *
 *   a · Dates you lost          `vendor_date_waitlist` (the dates couples asked for and could not have) × your calendar
 *                               (`vendor_calendar_blocks` manual/synced · `vendor_calendar_day_states` locked = closed;
 *                               otherwise you were full), by weekday.
 *   b · Which card sells        per service card: asked (`event_vendors.requested_service_ids` / `service_id`) and
 *                               booked (`event_vendors.service_id`, a booked status). OPENED PER CARD IS NOT COUNTED —
 *                               no table records which card a couple opened — so it is never drawn and never advised on.
 *   c · Reply speed vs bookings `chat_threads` first reply (`vendor_first_reply_at − created_at`) × whether that event
 *                               booked you (`event_vendors`, a booked status).
 *   d · Slow months ahead       `vendor_schedule_pool_bookings.booked_date` (live), the next 12 months.
 *   e · Quotes waiting          `vendor_proposals.status` · `valid_until` — accepted · waiting · expired · declined.
 *
 * 🔑 HONEST: a refused read is `null` and the tile says "Couldn’t load" — never a zero, never the Example picture.
 * Counts only; no price is drawn. 🔒 lib/vendor-analytics-graphs.test.ts
 */

export const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const;
const WEEKDAY_FULL = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'] as const;
const MONTH_FULL = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'] as const;
const MONTH_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'] as const;

/** What each graph reads, in words — drawn small under the title (the prototype's "its data, named"). */
export const GRAPH_SOURCE = {
  lost: 'Counts · dates couples asked for that you were full or closed on, by weekday (the date waitlist × your calendar)',
  cardsell: 'Counts per service card · asked (inquiries naming the card) · booked (bookings on the card)',
  replyvs: 'Counts · inquiries by your first-reply time, and how many of each booked (your chats × your bookings)',
  slow: 'Counts · live bookings by month, the next 12 (your schedule)',
  quotes: 'Counts · your quotations by state (status · Valid until) — accepted, waiting, expired, declined',
} as const;
export type NewGraphKey = keyof typeof GRAPH_SOURCE;

/** Monday = 0 … Sunday = 6, for a civil `YYYY-MM-DD` (no time zone — a date is a date). */
export function weekdayIndex(date: string): number {
  const d = new Date(`${date.slice(0, 10)}T00:00:00Z`).getUTCDay();
  return (d + 6) % 7;
}

// ── a · Dates you lost ──────────────────────────────────────────────────────────────────────────────────────────────

export type LostDay = { closed: number; full: number };
export type LostDates = { byWeekday: LostDay[]; closed: number; full: number; total: number; topClosedDay: string | null };

/**
 * Each ask (one couple, one date) lands on its weekday as CLOSED when your calendar closed that date, else FULL.
 * `asks` are already de-duplicated per couple and date by the reader.
 */
export function lostDates(asks: readonly { date: string }[], closedDates: ReadonlySet<string>): LostDates {
  const byWeekday: LostDay[] = WEEKDAYS.map(() => ({ closed: 0, full: 0 }));
  for (const a of asks) {
    const d = byWeekday[weekdayIndex(a.date)]!;
    if (closedDates.has(a.date.slice(0, 10))) d.closed += 1;
    else d.full += 1;
  }
  const closed = byWeekday.reduce((s, d) => s + d.closed, 0);
  const full = byWeekday.reduce((s, d) => s + d.full, 0);
  let top = -1;
  byWeekday.forEach((d, i) => {
    if (d.closed > 0 && (top < 0 || d.closed > byWeekday[top]!.closed)) top = i;
  });
  return { byWeekday, closed, full, total: closed + full, topClosedDay: top < 0 ? null : WEEKDAY_FULL[top]! };
}

export function lostLine(l: LostDates | null): string {
  if (l === null) return 'Couldn’t load.';
  if (l.total === 0) return 'No couple has asked for a date you couldn’t take.';
  const parts = WEEKDAYS.map((w, i) => ({ w, n: l.byWeekday[i]!.closed + l.byWeekday[i]!.full })).filter((p) => p.n > 0);
  parts.sort((a, b) => b.n - a.n);
  const top = parts
    .slice(0, 3)
    .map((p) => `${formatCount(p.n)} ${p.w}`)
    .join(', ');
  return `${formatCount(l.total)} ask${l.total === 1 ? '' : 's'} you couldn’t take (${formatCount(l.closed)} closed, ${formatCount(l.full)} full) · most on ${top}.`;
}

// ── b · Which card sells ────────────────────────────────────────────────────────────────────────────────────────────

export type CardSell = { serviceId: string; name: string; asked: number; booked: number };

/** Per card: asked = rows naming the card (requested list or the card itself); booked = a booked row on the card. */
export function cardSells(
  cards: readonly { serviceId: string; name: string }[],
  rows: readonly { serviceId: string | null; requested: readonly string[]; booked: boolean }[],
): CardSell[] {
  const out = cards.map((c) => ({ serviceId: c.serviceId, name: c.name, asked: 0, booked: 0 }));
  const at = new Map(out.map((c) => [c.serviceId, c]));
  for (const r of rows) {
    const named = new Set<string>(r.requested);
    if (r.serviceId) named.add(r.serviceId);
    for (const id of named) {
      const c = at.get(id);
      if (c) c.asked += 1;
    }
    if (r.booked && r.serviceId) {
      const c = at.get(r.serviceId);
      if (c) c.booked += 1;
    }
  }
  return out.sort((a, b) => b.asked - a.asked || b.booked - a.booked || a.name.localeCompare(b.name));
}

export function cardSellLine(c: readonly CardSell[] | null): string {
  if (c === null) return 'Couldn’t load.';
  const asked = c.filter((x) => x.asked > 0);
  if (asked.length === 0) return 'No couple has asked about a card yet.';
  const top = asked[0]!;
  return `${top.name} is asked about most: ${formatCount(top.asked)} asked, ${formatCount(top.booked)} booked.`;
}

// ── c · Reply speed vs bookings ─────────────────────────────────────────────────────────────────────────────────────

export const WITHIN_THE_HOUR_MIN = 60;
export type ReplyBucket = { n: number; booked: number };
export type ReplyVsBooked = { fast: ReplyBucket; slow: ReplyBucket };

/** Answered threads only (a thread never answered has no reply time). Booked = that thread's event booked you. */
export function replyVsBooked(
  threads: readonly { eventId: string | null; createdAt: string; firstReplyAt: string | null }[],
  bookedEventIds: ReadonlySet<string>,
): ReplyVsBooked {
  const fast = { n: 0, booked: 0 };
  const slow = { n: 0, booked: 0 };
  for (const t of threads) {
    if (!t.firstReplyAt) continue;
    const min = (Date.parse(t.firstReplyAt) - Date.parse(t.createdAt)) / 60000;
    if (!Number.isFinite(min) || min < 0) continue;
    const b = min <= WITHIN_THE_HOUR_MIN ? fast : slow;
    b.n += 1;
    if (t.eventId && bookedEventIds.has(t.eventId)) b.booked += 1;
  }
  return { fast, slow };
}

export function replyVsLine(r: ReplyVsBooked | null): string {
  if (r === null) return 'Couldn’t load.';
  if (r.fast.n + r.slow.n === 0) return 'Comes alive with your first answered inquiry.';
  return `Couples you answered within the hour booked ${formatCount(r.fast.booked)} of ${formatCount(r.fast.n)}; the ones you answered later, ${formatCount(r.slow.booked)} of ${formatCount(r.slow.n)}.`;
}

// ── d · Slow months ahead ───────────────────────────────────────────────────────────────────────────────────────────

export type MonthCount = { key: string; label: string; count: number };

/** The next 12 Manila months starting with the current one, oldest first (`YYYY-MM-01` keys, "Feb" labels). */
export function nextMonths(todayIso: string, n = 12): MonthCount[] {
  let y = Number(todayIso.slice(0, 4));
  let m = Number(todayIso.slice(5, 7)) - 1;
  const out: MonthCount[] = [];
  for (let i = 0; i < n; i++) {
    out.push({ key: `${y}-${String(m + 1).padStart(2, '0')}-01`, label: MONTH_SHORT[m]!, count: 0 });
    m += 1;
    if (m > 11) {
      m = 0;
      y += 1;
    }
  }
  return out;
}

export function monthsAhead(bookedDates: readonly string[], todayIso: string): MonthCount[] {
  const months = nextMonths(todayIso);
  const at = new Map(months.map((m) => [m.key.slice(0, 7), m]));
  for (const d of bookedDates) {
    const m = at.get(d.slice(0, 7));
    if (m) m.count += 1;
  }
  return months;
}

export type SlowMonth = { key: string; label: string; name: string; lastDay: string; before: number; after: number };

/**
 * The first month AFTER this one with nothing booked while a month beside it has bookings — a gap, not an empty
 * calendar (a shop with nothing booked anywhere is told nothing here: there is no "slow" against nothing).
 */
export function slowMonth(months: readonly MonthCount[]): SlowMonth | null {
  for (let i = 1; i < months.length; i++) {
    const m = months[i]!;
    if (m.count !== 0) continue;
    const before = months[i - 1]?.count ?? 0;
    const after = months[i + 1]?.count ?? 0;
    if (before > 0 || after > 0) {
      const y = Number(m.key.slice(0, 4));
      const mo = Number(m.key.slice(5, 7));
      const last = new Date(Date.UTC(y, mo, 0)).toISOString().slice(0, 10);
      return { key: m.key, label: m.label, name: MONTH_FULL[mo - 1]!, lastDay: last, before, after };
    }
  }
  return null;
}

export function slowLine(months: readonly MonthCount[] | null): string {
  if (months === null) return 'Couldn’t load.';
  const total = months.reduce((s, m) => s + m.count, 0);
  if (total === 0) return 'Nothing booked in the next 12 months yet.';
  const s = slowMonth(months);
  if (!s) return `${formatCount(total)} booked date${total === 1 ? '' : 's'} across the next 12 months — no gap between busy months.`;
  return `${s.name} has nothing booked while the months beside it have ${formatCount(Math.max(s.before, s.after))}.`;
}

// ── e · Quotes waiting ──────────────────────────────────────────────────────────────────────────────────────────────

export type QuoteState = 'accepted' | 'waiting' | 'expired' | 'declined';
export type QuoteStates = Record<QuoteState, number> & { sent: number };

/**
 * A sent/viewed quotation past its Valid until is EXPIRED even before a writer flips its status (expiry is lazy — no
 * cron, migration `…_only_the_supplier_flips_a_lock_and_a_quote_expires`); a legacy one (no date) never lapses.
 * Drafts and superseded rows are not "sent" and are not counted.
 */
export function quoteStates(
  rows: readonly { status: string; validUntil: string | null; legacy: boolean }[],
  todayIso: string,
): QuoteStates {
  const s: QuoteStates = { accepted: 0, waiting: 0, expired: 0, declined: 0, sent: 0 };
  for (const r of rows) {
    if (r.status === 'accepted') s.accepted += 1;
    else if (r.status === 'declined') s.declined += 1;
    else if (r.status === 'expired') s.expired += 1;
    else if (r.status === 'sent' || r.status === 'viewed') {
      if (r.validUntil && !r.legacy && r.validUntil.slice(0, 10) < todayIso) s.expired += 1;
      else s.waiting += 1;
    } else continue;
    s.sent += 1;
  }
  return s;
}

export function quotesLine(q: QuoteStates | null): string {
  if (q === null) return 'Couldn’t load.';
  if (q.sent === 0) return 'No quotation sent yet.';
  return `${formatCount(q.waiting)} waiting on an answer · ${formatCount(q.expired)} expired · ${formatCount(q.accepted)} of ${formatCount(q.sent)} accepted.`;
}

// ── everything the five graphs read, in one shape ──────────────────────────────────────────────────────────────────

export type NewGraphs = {
  lost: LostDates | null;
  cardsell: CardSell[] | null;
  replyvs: ReplyVsBooked | null;
  slow: MonthCount[] | null;
  quotes: QuoteStates | null;
};
