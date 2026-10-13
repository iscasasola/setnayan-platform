/**
 * vendor-dates.ts — CUSTOMERS › DATES, DECIDED ONCE, PURELY (S-PR3; corpus `SUPPLIER_DASHBOARD_REDESIGN_2026-10-08_fable.md`
 * § 2 "one month grid (booked · holding · blocked), the day's rows under it, then three folds: Block days · Waitlist ·
 * Capacity"; prototype frames 04 · 29 · 35; control templates round 2, kind 31 "Calendar days with several states").
 *
 * The month's facts come from the ONE shipped derivation, `buildCustomerCalendarMonth` (`lib/vendor-customers.ts`) —
 * this file never re-counts a booking. It only says how a day is SHOWN (kind 31: a green dot Booked, an amber dot
 * Holding, a hatched square Blocked, bold when full) and which rows the picked day lists.
 *
 * 🔑 THE THREE MEANINGS, AS-BUILT (the six-state taxonomy folded into the template's three words):
 *   Booked  (green dot)   — something consumes a seat that day: a Setnayan booking or the shop's own outside client
 *                            (`consumed > 0`). Full (its limit reached) = the number bold.
 *   Holding (amber dot)   — couples are waiting on the day: an open conversation about an unbooked event on it
 *                            (`inquiryCount`, from `openAsksOf`) or someone on its waiting list (`waitlistCount`). It
 *                            holds no seat; it is a question about the day.
 *   Blocked (hatched)     — nothing new can be booked: a closure block (`blocked`) or the shop's own hard hold
 *                            (`locked`), both of which `acquire_schedule_pools` refuses on.
 *   Approve-first (`whitelist`) is not a fourth mark: bookable with the shop's yes, so the day draws what is on it and
 *   its row says so.
 *
 * ⚖ CALENDAR TRUTH (owner 2026-10-10, P5): a day with nothing on it is NEVER called "Free". It says what is true —
 * "Nothing on this day" — and a shop with no calendar at all says "Not set".
 */
import type { CalendarDayState } from './calendar-grid';
import type { CustomerCalendarDay } from './vendor-customers';

/** Kind 31's state for one day of the month, or null for a quiet one (drawn as a plain day). */
export function dayStateOf(day: Pick<CustomerCalendarDay, 'state' | 'consumed' | 'inquiryCount' | 'waitlistCount'>): CalendarDayState | null {
  if (day.state === 'blocked' || day.state === 'locked') return { blocked: true };
  const dots: ('booked' | 'holding')[] = [];
  if (day.consumed > 0) dots.push('booked');
  if (day.inquiryCount > 0 || day.waitlistCount > 0) dots.push('holding');
  const full = day.state === 'full';
  if (dots.length === 0 && !full) return null;
  return full ? { dots, full } : { dots };
}

const WEEKDAY = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;
const MONTH = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'] as const;
const LONG_WEEKDAY = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'] as const;

/** UTC parts of a civil day — a `YYYY-MM-DD` never passes through the viewer's timezone. */
function parts(day: string): { y: number; m: number; d: number; w: number } | null {
  const hit = /^(\d{4})-(\d{2})-(\d{2})$/.exec(day);
  if (!hit) return null;
  const y = Number(hit[1]);
  const m = Number(hit[2]);
  const d = Number(hit[3]);
  const at = new Date(Date.UTC(y, m - 1, d));
  if (at.getUTCMonth() !== m - 1) return null;
  return { y, m, d, w: at.getUTCDay() };
}

/** Whole days from `today` to `day` (both civil days). */
export function daysFrom(today: string, day: string): number | null {
  const a = parts(today);
  const b = parts(day);
  if (!a || !b) return null;
  return Math.round((Date.UTC(b.y, b.m - 1, b.d) - Date.UTC(a.y, a.m - 1, a.d)) / 86_400_000);
}

/** "Today" · "Tomorrow" · "Yesterday" · '' — the one word a near day earns. */
export function nearWord(today: string, day: string): string {
  const n = daysFrom(today, day);
  return n === 0 ? 'Today' : n === 1 ? 'Tomorrow' : n === -1 ? 'Yesterday' : '';
}

/** The picked day's eyebrow (frame 04): "Sat 3 · Tomorrow" · "Sat 24". */
export function dayEyebrow(today: string, day: string): string {
  const p = parts(day);
  if (!p) return '';
  const near = nearWord(today, day);
  return `${WEEKDAY[p.w]} ${p.d}${near ? ` · ${near}` : ''}`;
}

/** The day sheet's title (frame 35): "Sat, Oct 3" — the year only when it is not this one. */
export function dayTitle(today: string, day: string): string {
  const p = parts(day);
  const t = parts(today);
  if (!p) return '';
  return `${WEEKDAY[p.w]}, ${MONTH[p.m - 1]} ${p.d}${t && t.y !== p.y ? `, ${p.y}` : ''}`;
}

/** "Saturday, October 3, 2026" — what a screen reader hears for the day sheet. */
export function dayLongWords(day: string): string {
  const p = parts(day);
  if (!p) return '';
  const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  return `${LONG_WEEKDAY[p.w]}, ${months[p.m - 1]} ${p.d}, ${p.y}`;
}

/** "Oct 14" · "Oct 14–15" · "Oct 30 – Nov 2" · "Dec 30, 2026 – Jan 2, 2027" — the year only when it is not this one. */
export function rangeWords(from: string, to: string, today: string): string {
  const a = parts(from);
  const b = parts(to);
  const t = parts(today);
  if (!a) return '';
  const yearOf = (p: { y: number }) => (t && t.y === p.y ? '' : `, ${p.y}`);
  if (!b || to === from) return `${MONTH[a.m - 1]} ${a.d}${yearOf(a)}`;
  if (a.y === b.y && a.m === b.m) return `${MONTH[a.m - 1]} ${a.d}–${b.d}${yearOf(a)}`;
  if (a.y === b.y) return `${MONTH[a.m - 1]} ${a.d} – ${MONTH[b.m - 1]} ${b.d}${yearOf(a)}`;
  return `${MONTH[a.m - 1]} ${a.d}, ${a.y} – ${MONTH[b.m - 1]} ${b.d}, ${b.y}`;
}

/** The day sheet's own address — the old `/calendar/[date]` route forwards here (plan § 8 gap 11). */
export function daySheetHref(day: string): string {
  return `/vendor-dashboard/customers?seg=dates&day=${day}`;
}

/* ── THE PICKED DAY'S ROWS (frame 04, under the month) ─────────────────────────────────────────────────────────── */

export type DatesBooking = { poolId: string; bookedDate: string; eventName: string };
export type DatesBlock = {
  poolId: string | null;
  source: 'manual' | 'setnayan_booking' | 'synced_calendar' | 'external_client';
  startDate: string;
  endDate: string;
  /** The shop's own words for a closure ("Family trip"); '' when none. */
  label?: string | null;
  /** An outside client's name — the shop's own record (never their contact or note). */
  clientName?: string | null;
};
export type DatesHold = { poolId: string | null; stateDate: string; dayState: 'locked' | 'whitelist' };

export type DayRowKind = 'booked' | 'outside' | 'blocked' | 'held' | 'approve' | 'asking' | 'waiting' | 'nothing';
export type DayRow = {
  key: string;
  kind: DayRowKind;
  title: string;
  line: string;
  /** A shown state (kind 11 badge) — never pressed. */
  badge: { tone: 'ok' | 'wait' | 'quiet'; word: string } | null;
};

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/**
 * Every row the picked day lists — what is booked, an outside client, a closure, the shop's own hold, the couples
 * asking and the waiting list — or the one true line when there is nothing. Scoped to the calendars on show
 * (`poolIds`); an org-wide closure or hold (`poolId` null) is on every calendar.
 */
export function dayRowsOf(
  day: string,
  input: {
    today: string;
    poolIds: ReadonlySet<string>;
    poolLabel: (poolId: string | null) => string;
    /** Draw the calendar's name on a row (only when the shop runs more than one). */
    namePools: boolean;
    bookings: readonly DatesBooking[];
    blocks: readonly DatesBlock[];
    holds: readonly DatesHold[];
    asking: number;
    waiting: number;
  },
): DayRow[] {
  const { poolIds, poolLabel, namePools, today } = input;
  const onShow = (poolId: string | null) => poolId === null || poolIds.has(poolId);
  const covers = (b: DatesBlock) => b.startDate <= day && b.endDate >= day;
  const rows: DayRow[] = [];

  input.bookings
    .filter((b) => b.bookedDate === day && poolIds.has(b.poolId))
    .forEach((b, i) =>
      rows.push({
        key: `booked-${i}`,
        kind: 'booked',
        title: b.eventName,
        line: namePools ? poolLabel(b.poolId) : 'Booked through Setnayan',
        badge: { tone: 'ok', word: 'Booked' },
      }),
    );
  input.blocks
    .filter((b) => b.source === 'external_client' && covers(b) && b.poolId !== null && poolIds.has(b.poolId))
    .forEach((b, i) =>
      rows.push({
        key: `outside-${i}`,
        kind: 'outside',
        title: b.clientName?.trim() || 'Outside client',
        line: [rangeWords(b.startDate, b.endDate, today), namePools ? poolLabel(b.poolId) : ''].filter(Boolean).join(' · '),
        badge: { tone: 'quiet', word: 'Outside' },
      }),
    );
  input.blocks
    .filter((b) => (b.source === 'manual' || b.source === 'synced_calendar') && covers(b) && onShow(b.poolId))
    .forEach((b, i) =>
      rows.push({
        key: `blocked-${i}`,
        kind: 'blocked',
        title: b.label?.trim() || 'Blocked',
        line: [rangeWords(b.startDate, b.endDate, today), b.poolId === null ? 'every calendar' : namePools ? poolLabel(b.poolId) : ''].filter(Boolean).join(' · '),
        badge: null,
      }),
    );
  input.holds
    .filter((h) => h.stateDate === day && onShow(h.poolId))
    .forEach((h, i) =>
      rows.push({
        key: `hold-${i}`,
        kind: h.dayState === 'locked' ? 'held' : 'approve',
        title: h.dayState === 'locked' ? 'Held by you' : 'You approve each ask',
        line: h.poolId === null ? 'Every calendar' : poolLabel(h.poolId),
        badge: null,
      }),
    );
  if (input.asking > 0) {
    rows.push({
      key: 'asking',
      kind: 'asking',
      title: `${plural(input.asking, 'couple', 'couples')} holding this date`,
      line: 'Asked · not booked',
      badge: { tone: 'wait', word: 'Holding' },
    });
  }
  if (input.waiting > 0) {
    rows.push({
      key: 'waiting',
      kind: 'waiting',
      title: `${plural(input.waiting, 'couple', 'couples')} on the waiting list`,
      line: 'For when a seat opens',
      badge: { tone: 'wait', word: 'Waiting' },
    });
  }
  if (rows.length === 0) {
    rows.push({ key: 'nothing', kind: 'nothing', title: 'Nothing on this day', line: '', badge: null });
  }
  return rows;
}

/* ── THE FOLDS' ONE LINE (frame 04: "Block days · Oct 14–15 blocked") ─────────────────────────────────────────── */

/** Block days' line: the next closure, and how many more — or that there are none. */
export function blockDaysLine(blocks: readonly Pick<DatesBlock, 'startDate' | 'endDate'>[], today: string): string {
  if (blocks.length === 0) return 'No days blocked';
  const first = blocks[0]!;
  const more = blocks.length - 1;
  return `${rangeWords(first.startDate, first.endDate, today)} blocked${more > 0 ? ` · ${more} more` : ''}`;
}

/** Waitlist's line: who is waiting, on how many dates — or why there is none. */
export function waitlistLine(input: { allowed: boolean; on: boolean; dates: readonly { requestedDate: string; pendingCount: number }[]; today: string }): string {
  if (!input.allowed) return 'Not on your plan';
  if (!input.on) return 'Off';
  const people = input.dates.reduce((n, d) => n + d.pendingCount, 0);
  if (people === 0) return 'No one waiting';
  if (input.dates.length === 1) return `${plural(people, 'couple', 'couples')} on ${rangeWords(input.dates[0]!.requestedDate, input.dates[0]!.requestedDate, input.today)}`;
  return `${plural(people, 'couple', 'couples')} on ${input.dates.length} dates`;
}

/** Capacity's line (frame 04: "1 event a day · 2 calendars"); "Not set" when the shop has no calendar (P5). */
export function capacityLine(pools: readonly { capacity: number }[]): string {
  if (pools.length === 0) return 'Not set';
  const caps = [...new Set(pools.map((p) => p.capacity))];
  const each = caps.length === 1 ? `${plural(caps[0]!, 'event', 'events')} a day` : 'Events a day differ';
  return pools.length === 1 ? each : `${each} · ${pools.length} calendars`;
}

/* ── COUPLES HOLDING A DATE (amber) ────────────────────────────────────────────────────────────────────────────── */

/**
 * A couple in an OPEN conversation with the shop about a dated event that is not booked — "Holding" on the month
 * (frame 35: "Dela Cruz · asked Sep 30 · not booked"). Open = the enquiry is pending or accepted (never declined or
 * closed); not booked = no seat taken for that event (the same pool bookings the green dot counts).
 *
 * ⚠ THE DATE COMES FROM AN `events` READ the page makes with the admin client, scoped to this shop's own threads —
 * never from the thread's `event` embed, which is ALWAYS NULL for a supplier (no `events` RLS; `lib/chat.ts`). The
 * shipped month counted that embed, so its "N asking" mark could never appear.
 */
export type DatesAsk = { threadId: string; eventId: string; date: string; name: string | null; askedAt: string };

export function openAsksOf(
  threads: readonly { thread_id: string; event_id: string; inquiry_status: string | null; created_at: string }[],
  events: ReadonlyMap<string, { date: string | null; name: string | null }>,
  bookedEventIds: ReadonlySet<string>,
): DatesAsk[] {
  const seen = new Set<string>();
  const out: DatesAsk[] = [];
  for (const t of threads) {
    if (t.inquiry_status !== 'pending' && t.inquiry_status !== 'accepted') continue;
    if (bookedEventIds.has(t.event_id) || seen.has(t.event_id)) continue;
    const ev = events.get(t.event_id);
    const date = ev?.date ? String(ev.date).slice(0, 10) : null;
    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) continue;
    seen.add(t.event_id);
    out.push({ threadId: t.thread_id, eventId: t.event_id, date, name: ev?.name?.trim() || null, askedAt: t.created_at });
  }
  return out.sort((a, b) => a.date.localeCompare(b.date) || a.askedAt.localeCompare(b.askedAt));
}

/** The month's amber marks: how many couples hold each date (a count only crosses to the browser). */
export function asksByDate(asks: readonly Pick<DatesAsk, 'date'>[]): { requestedDate: string; count: number }[] {
  const by = new Map<string, number>();
  for (const a of asks) by.set(a.date, (by.get(a.date) ?? 0) + 1);
  return [...by.entries()].map(([requestedDate, count]) => ({ requestedDate, count })).sort((a, b) => a.requestedDate.localeCompare(b.requestedDate));
}
